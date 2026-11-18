import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { generarLRE, generarPrevired, type DatosArchivo, type FilaArchivo } from "@/lib/archivos-legales";
import { Parametros } from "@/lib/parametros";
import type { Periodo } from "@/lib/sesion";

/** Junta los datos del mes (liquidaciones, fichas, licencias, vacaciones) para los archivos legales. */
export async function datosArchivosMes(supabase: SupabaseClient, empresaId: string, p: Periodo): Promise<{ datos: DatosArchivo; sinAprobar: number; version: string } | { error: string }> {
  const inicio = `${p.anio}-${String(p.mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10);
  const [{ data: liqs }, { data: emp }, { data: inst }, { data: lic }, { data: vac }, { data: fin_ }, params] = await Promise.all([
    supabase.from("liquidaciones").select("*, trabajadores(*)").eq("empresa_id", empresaId).eq("anio", p.anio).eq("mes", p.mes).neq("estado", "anulada"),
    supabase.from("empresas").select("rut, mutual, ccaf, region_lre, comuna_lre").eq("id", empresaId).single(),
    supabase.from("instituciones").select("codigo, tipo, codigo_previred, codigo_lre"),
    supabase.from("licencias").select("trabajador_id, desde, hasta, rut_pagadora").eq("empresa_id", empresaId).lte("desde", fin).gte("hasta", inicio),
    supabase.from("vacaciones").select("trabajador_id, dias_habiles, desde").eq("empresa_id", empresaId).gte("desde", inicio).lte("desde", fin),
    supabase.from("finiquitos").select("trabajador_id, causal").eq("empresa_id", empresaId).neq("estado", "anulado"),
    Parametros.cargar(supabase),
  ]);
  if (!emp) return { error: "Empresa no encontrada." };
  if (!liqs?.length) return { error: "No hay liquidaciones calculadas en el mes." };
  const codigos = new Map((inst ?? []).map((i) => [i.codigo, i]));
  const cod = (c: string | null) => (c && codigos.get(c) ? { previred: codigos.get(c)!.codigo_previred, lre: codigos.get(c)!.codigo_lre } : null);
  const jornada = params.buscar("JORNADA_MAXIMA", fin)?.valor ?? 42;
  const tramos = (params.buscar("ASIGNACION_FAMILIAR_TRAMOS", inicio)?.valor_json ?? []) as { tramo: string; hasta: number | null }[];
  const liqIds = liqs.map((l) => l.id);
  const { data: items } = await supabase.from("items_liquidacion").select("liquidacion_id, codigo, monto").in("liquidacion_id", liqIds);

  const filas: FilaArchivo[] = liqs.map((l) => {
    const t = l.trabajadores as Record<string, unknown>;
    const s = cod(t.salud as string);
    const tramo = (tramos.find((x) => x.hasta === null || Number(l.total_imponible) <= x.hasta)?.tramo ?? "D") as FilaArchivo["tramoAsignacion"];
    return {
      trabajador: {
        rut: t.rut as string, nombres: t.nombres as string, apellido_paterno: t.apellido_paterno as string, apellido_materno: t.apellido_materno as string | null,
        sexo: t.sexo as string | null, nacionalidad: t.nacionalidad as string | null, fecha_ingreso: t.fecha_ingreso as string, fecha_termino: t.fecha_termino as string | null,
        tipo_contrato: t.tipo_contrato as FilaArchivo["trabajador"]["tipo_contrato"], jornada_horas: Number(t.jornada_horas), pensionado: !!t.pensionado,
        afp: cod(t.afp as string | null), salud: { previred: s?.previred ?? null, lre: s?.lre ?? null, esIsapre: String(t.salud).startsWith("isapre") },
        plan_isapre_uf: t.plan_isapre_uf === null ? null : Number(t.plan_isapre_uf), seguro_cesantia: !!t.seguro_cesantia,
        cargas_familiares: Number(t.cargas_familiares), trabajo_pesado: t.trabajo_pesado as string, cargo: t.cargo as string | null,
      },
      liquidacion: {
        dias: l.dias_trabajados,
        items: (items ?? []).filter((i) => i.liquidacion_id === l.id).map((i) => ({ codigo: i.codigo, monto: Number(i.monto) })),
        total_imponible: Number(l.total_imponible), total_no_imponible: Number(l.total_no_imponible), total_haberes: Number(l.total_haberes),
        renta_imponible_afp: Number(l.renta_imponible_afp), renta_imponible_afc: Number(l.renta_imponible_afc), cotizacion_afp: Number(l.cotizacion_afp),
        cotizacion_salud: Number(l.cotizacion_salud), cotizacion_afc: Number(l.cotizacion_afc), impuesto_unico: Number(l.impuesto_unico),
        total_descuentos: Number(l.total_descuentos), liquido: Number(l.liquido), aportes_empleador: Number(l.aportes_empleador),
      },
      licencias: (lic ?? []).filter((x) => x.trabajador_id === l.trabajador_id),
      diasVacaciones: Math.round((vac ?? []).filter((v) => v.trabajador_id === l.trabajador_id).reduce((s, v) => s + Number(v.dias_habiles), 0)),
      tramoAsignacion: tramo,
      causalTermino: (fin_ ?? []).find((f) => f.trabajador_id === l.trabajador_id)?.causal ?? null,
    };
  });
  filas.sort((a, b) => a.trabajador.apellido_paterno.localeCompare(b.trabajador.apellido_paterno));
  const version = createHash("sha256").update(JSON.stringify(liqs.map((l) => [l.id, l.version_datos, l.liquido]))).digest("hex").slice(0, 16);
  return {
    datos: {
      anio: p.anio, mes: p.mes,
      empresa: { rut: emp.rut, mutual: cod(emp.mutual ?? "isl"), ccaf: cod(emp.ccaf), region_lre: emp.region_lre, comuna_lre: emp.comuna_lre, jornadaMaxima: jornada },
      filas,
    },
    sinAprobar: liqs.filter((l) => l.estado !== "aprobada").length,
    version,
  };
}

export function construirArchivo(tipo: "previred" | "lre", datos: DatosArchivo) {
  if (tipo === "previred") {
    const r = generarPrevired(datos);
    return { contenido: r.contenido, nombre: `previred_${datos.empresa.rut.replace("-", "")}_${datos.anio}${String(datos.mes).padStart(2, "0")}.txt`, validacion: r.validacion, filas: r.lineas.length };
  }
  const r = generarLRE(datos);
  return { contenido: r.contenido, nombre: r.nombreArchivo, validacion: r.validacion, filas: r.filas.length };
}

/** Guarda el archivo generado con su hash, en el almacenamiento y en el registro de archivos generados. */
export async function registrarArchivo(
  supabase: SupabaseClient,
  e: { estudioId: string; empresaId: string; tipo: "previred" | "lre"; periodo: Periodo; nombre: string; contenido: Buffer; version: string; validacion: unknown; creadoPor?: string },
) {
  const hash = createHash("sha256").update(e.contenido).digest("hex");
  const ruta = `${e.estudioId}/${e.empresaId}/${e.tipo}/${e.periodo.anio}-${String(e.periodo.mes).padStart(2, "0")}-${hash.slice(0, 10)}-${e.nombre}`;
  await supabase.storage.from("archivos").upload(ruta, e.contenido, { upsert: true, contentType: "text/plain" });
  await supabase.from("archivos_generados").insert({
    estudio_id: e.estudioId, empresa_id: e.empresaId, tipo: e.tipo, anio: e.periodo.anio, mes: e.periodo.mes, nombre_archivo: e.nombre,
    hash_contenido: hash, tamano: e.contenido.length, ruta_storage: ruta, parametros: { version_datos: e.version, formato: e.tipo === "previred" ? "previred_v58" : "lre_dt" },
    resumen: e.validacion, ...(e.creadoPor ? { created_by: e.creadoPor } : {}),
  });
  return hash;
}
