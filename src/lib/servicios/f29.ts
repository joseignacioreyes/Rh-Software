import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularF29, type DocF29, type ResultadoF29 } from "@/lib/f29";
import { Parametros } from "@/lib/parametros";
import type { Periodo } from "@/lib/sesion";

/** Impuesto único del mes desde las liquidaciones calculadas (si el módulo de remuneraciones tiene datos). */
async function impuestoUnicoDelMes(supabase: SupabaseClient, empresaId: string, p: Periodo) {
  const { data, error } = await supabase
    .from("liquidaciones")
    .select("impuesto_unico, estado")
    .eq("empresa_id", empresaId)
    .eq("anio", p.anio)
    .eq("mes", p.mes)
    .neq("estado", "anulada");
  if (error || !data?.length) return { monto: 0, fuente: "Sin liquidaciones calculadas para el mes" };
  return { monto: data.reduce((s, l) => s + Number(l.impuesto_unico ?? 0), 0), fuente: `${data.length} liquidaciones del mes` };
}

export type ResultadoServicioF29 = { error?: string; resultado?: ResultadoF29; estado?: string; bloqueado?: boolean };

/**
 * Calcula y guarda la propuesta de F29 de una empresa para un periodo.
 * Si ya fue declarada, no se recalcula.
 */
export async function calcularYGuardarF29(
  supabase: SupabaseClient,
  empresa: { id: string; estudio_id?: string },
  estudioId: string,
  p: Periodo,
): Promise<ResultadoServicioF29> {
  const { data: previa } = await supabase.from("f29_propuestas").select("estado, calculada").eq("empresa_id", empresa.id).eq("anio", p.anio).eq("mes", p.mes).maybeSingle();
  if (previa && (previa.estado === "declarado" || previa.estado === "pagado")) {
    return { bloqueado: true, estado: previa.estado, resultado: previa.calculada as ResultadoF29 };
  }

  const anterior = p.mes === 1 ? { anio: p.anio - 1, mes: 12 } : { anio: p.anio, mes: p.mes - 1 };
  const [{ data: docs }, { data: hon }, { data: f29Anterior }, { data: emp }, params, iu] = await Promise.all([
    supabase
      .from("documentos_rcv")
      .select("id, libro, tipo_doc, monto_exento, monto_neto, monto_iva, monto_total, monto_neto_activo_fijo, iva_activo_fijo, cantidad_documentos")
      .eq("empresa_id", empresa.id).eq("anio", p.anio).eq("mes", p.mes),
    supabase.from("honorarios").select("id, monto_retencion, retencion_por, estado").eq("empresa_id", empresa.id).eq("tipo", "recibidas").eq("anio", p.anio).eq("mes", p.mes),
    supabase.from("f29_propuestas").select("calculada, ajustes").eq("empresa_id", empresa.id).eq("anio", anterior.anio).eq("mes", anterior.mes).maybeSingle(),
    supabase.from("empresas").select("tasa_ppm").eq("id", empresa.id).single(),
    Parametros.cargar(supabase),
    impuestoUnicoDelMes(supabase, empresa.id, p),
  ]);
  const vigentes = (hon ?? []).filter((h) => h.estado === "vigente" && h.retencion_por !== "emisor");
  const anteriorCalc = f29Anterior?.calculada as { codigos?: Record<string, number> } | undefined;
  const remanente = Number((f29Anterior?.ajustes as Record<string, number> | undefined)?.["77"] ?? anteriorCalc?.codigos?.["77"] ?? 0);
  const utmAnterior = params.buscar("UTM", `${anterior.anio}-${String(anterior.mes).padStart(2, "0")}-01`)?.valor ?? null;

  let resultado: ResultadoF29;
  try {
    resultado = calcularF29({
      anio: p.anio, mes: p.mes,
      documentos: (docs ?? []) as DocF29[],
      retencionHonorarios: vigentes.reduce((s, h) => s + Number(h.monto_retencion), 0),
      boletasHonorarios: vigentes.length,
      impuestoUnico: iu.monto,
      fuenteImpuestoUnico: iu.fuente,
      remanenteAnterior: remanente,
      utmAnterior,
      tasaPpm: emp?.tasa_ppm === null || emp?.tasa_ppm === undefined ? null : Number(emp.tasa_ppm),
    }, params);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!f29Anterior && remanente === 0) {
    resultado.avisos.push("No hay F29 del mes anterior en RH Software: si había remanente, ingrésalo como ajuste en el código 504.");
  }
  if (!docs?.length) resultado.avisos.push("No hay libros importados para el periodo.");

  const version = createHash("sha256")
    .update(JSON.stringify([(docs ?? []).map((d) => [d.id, d.monto_total, d.monto_iva]), (hon ?? []).map((h) => [h.id, h.monto_retencion, h.estado]), iu.monto, remanente]))
    .digest("hex")
    .slice(0, 16);

  const { error } = await supabase.from("f29_propuestas").upsert(
    {
      estudio_id: estudioId, empresa_id: empresa.id, anio: p.anio, mes: p.mes,
      calculada: resultado, parametros: resultado.parametros, version_datos: version, total_a_pagar: resultado.totalAPagar,
      ...(previa ? {} : { estado: "borrador" }),
    },
    { onConflict: "empresa_id,anio,mes" },
  );
  if (error) return { error: error.message };
  return { resultado, estado: previa?.estado ?? "borrador" };
}
