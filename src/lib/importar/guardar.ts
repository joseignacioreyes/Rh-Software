// Guarda en la base de datos lo leído de un archivo, sin duplicar documentos.
// Recibe el cliente de Supabase (con la sesión del usuario, para respetar permisos; o el de servicio en el seed).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentoRcv } from "./rcv";
import type { BoletaHonorarios } from "./honorarios";
import type { MovimientoLeido } from "./mapeo";

type Base = { supabase: SupabaseClient; estudioId: string; empresaId: string; nombreArchivo: string; hash?: string; creadoPor?: string };

const clave = (d: { tipo_doc: number; folio: string; rut_contraparte: string }) => `${d.tipo_doc}|${d.folio}|${d.rut_contraparte}`;

async function registrarImportacion(
  b: Base,
  datos: { tipo: string; anio: number | null; mes: number | null; leidas: number; nuevas: number; duplicadas: number; errores: { fila: number; mensaje: string }[]; mapeo?: unknown },
) {
  const { data, error } = await b.supabase
    .from("importaciones")
    .insert({
      estudio_id: b.estudioId, empresa_id: b.empresaId, tipo: datos.tipo, anio: datos.anio, mes: datos.mes,
      nombre_archivo: b.nombreArchivo, hash_archivo: b.hash ?? null, mapeo: datos.mapeo ?? null,
      filas_leidas: datos.leidas, filas_nuevas: datos.nuevas, filas_duplicadas: datos.duplicadas,
      filas_con_error: datos.errores.length, errores: datos.errores.slice(0, 200),
      ...(b.creadoPor ? { created_by: b.creadoPor } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar la importación: ${error.message}`);
  return data.id as string;
}

/** Documentos del RCV: inserta solo los que no existen (por tipo, folio y RUT). */
export async function guardarDocumentosRcv(
  b: Base,
  libro: "compras" | "ventas",
  docs: DocumentoRcv[],
  errores: { fila: number; mensaje: string }[],
  periodo: { anio: number | null; mes: number | null },
  origen: "rcv_sii" | "excel" = "rcv_sii",
  mapeo?: unknown,
) {
  const existentes = new Set<string>();
  if (docs.length) {
    const folios = [...new Set(docs.map((d) => d.folio))];
    for (let i = 0; i < folios.length; i += 500) {
      const { data } = await b.supabase
        .from("documentos_rcv")
        .select("tipo_doc, folio, rut_contraparte")
        .eq("empresa_id", b.empresaId)
        .eq("libro", libro)
        .in("folio", folios.slice(i, i + 500));
      for (const d of data ?? []) existentes.add(clave(d));
    }
  }
  const vistos = new Set<string>();
  const nuevos = docs.filter((d) => {
    const k = clave(d);
    if (existentes.has(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const importacionId = await registrarImportacion(b, {
    tipo: `rcv_${libro}`, ...periodo, leidas: docs.length + errores.length, nuevas: nuevos.length,
    duplicadas: docs.length - nuevos.length, errores, mapeo,
  });
  for (let i = 0; i < nuevos.length; i += 500) {
    const { error } = await b.supabase.from("documentos_rcv").insert(
      nuevos.slice(i, i + 500).map((d) => ({
        ...d, libro, estudio_id: b.estudioId, empresa_id: b.empresaId, origen, importacion_id: importacionId,
        ...(b.creadoPor ? { created_by: b.creadoPor } : {}),
      })),
    );
    if (error) throw new Error(`No se pudieron guardar los documentos: ${error.message}`);
  }
  return { importacionId, nuevos: nuevos.length, duplicados: docs.length - nuevos.length };
}

/** Boletas de honorarios. */
export async function guardarHonorarios(
  b: Base,
  tipo: "recibidas" | "emitidas",
  boletas: BoletaHonorarios[],
  errores: { fila: number; mensaje: string }[],
) {
  const { data: previas } = await b.supabase
    .from("honorarios")
    .select("folio, rut_contraparte")
    .eq("empresa_id", b.empresaId)
    .eq("tipo", tipo)
    .in("folio", boletas.map((x) => x.folio));
  const existentes = new Set((previas ?? []).map((p) => `${p.folio}|${p.rut_contraparte}`));
  const nuevas = boletas.filter((x) => !existentes.has(`${x.folio}|${x.rut_contraparte}`));
  const meses = new Map<string, number>();
  for (const x of boletas) meses.set(x.fecha.slice(0, 7), (meses.get(x.fecha.slice(0, 7)) ?? 0) + 1);
  const principal = [...meses.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
  const importacionId = await registrarImportacion(b, {
    tipo: `honorarios_${tipo}`, anio: principal ? Number(principal.slice(0, 4)) : null, mes: principal ? Number(principal.slice(5, 7)) : null,
    leidas: boletas.length + errores.length, nuevas: nuevas.length, duplicadas: boletas.length - nuevas.length, errores,
  });
  if (nuevas.length) {
    const { error } = await b.supabase.from("honorarios").insert(
      nuevas.map((x) => ({
        ...x, tipo, anio: Number(x.fecha.slice(0, 4)), mes: Number(x.fecha.slice(5, 7)),
        estudio_id: b.estudioId, empresa_id: b.empresaId, importacion_id: importacionId,
        ...(b.creadoPor ? { created_by: b.creadoPor } : {}),
      })),
    );
    if (error) throw new Error(`No se pudieron guardar las boletas: ${error.message}`);
  }
  return { importacionId, nuevos: nuevas.length, duplicados: boletas.length - nuevas.length };
}

/** Movimientos de una cartola, en la cuenta bancaria indicada. */
export async function guardarCartola(
  b: Base,
  cuentaBancariaId: string,
  movimientos: MovimientoLeido[],
  errores: { fila: number; mensaje: string }[],
  mapeo: unknown,
) {
  const meses = new Map<string, number>();
  for (const m of movimientos) meses.set(m.fecha.slice(0, 7), (meses.get(m.fecha.slice(0, 7)) ?? 0) + 1);
  const principal = [...meses.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? new Date().toISOString().slice(0, 7);
  const anio = Number(principal.slice(0, 4));
  const mes = Number(principal.slice(5, 7));
  const { data: previos } = await b.supabase
    .from("movimientos_bancarios")
    .select("huella")
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .in("huella", movimientos.map((m) => m.huella));
  const existentes = new Set((previos ?? []).map((p) => p.huella));
  const nuevos = movimientos.filter((m) => !existentes.has(m.huella));
  const importacionId = await registrarImportacion(b, {
    tipo: "cartola", anio, mes, leidas: movimientos.length + errores.length, nuevas: nuevos.length,
    duplicadas: movimientos.length - nuevos.length, errores, mapeo,
  });
  const conSaldo = movimientos.filter((m) => m.saldo !== null);
  const { data: cartola, error } = await b.supabase
    .from("cartolas")
    .insert({
      estudio_id: b.estudioId, empresa_id: b.empresaId, cuenta_bancaria_id: cuentaBancariaId, anio, mes,
      saldo_inicial: conSaldo.length ? conSaldo[0].saldo! - conSaldo[0].monto : null,
      saldo_final: conSaldo.length ? conSaldo[conSaldo.length - 1].saldo : null,
      importacion_id: importacionId,
      ...(b.creadoPor ? { created_by: b.creadoPor } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar la cartola: ${error.message}`);
  if (nuevos.length) {
    const r = await b.supabase.from("movimientos_bancarios").insert(
      nuevos.map((m) => ({ ...m, estudio_id: b.estudioId, empresa_id: b.empresaId, cartola_id: cartola.id, cuenta_bancaria_id: cuentaBancariaId })),
    );
    if (r.error) throw new Error(`No se pudieron guardar los movimientos: ${r.error.message}`);
  }
  return { importacionId, nuevos: nuevos.length, duplicados: movimientos.length - nuevos.length };
}
