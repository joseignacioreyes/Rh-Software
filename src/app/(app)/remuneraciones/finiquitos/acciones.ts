"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Parametros } from "@/lib/parametros";
import { calcularFiniquito, saldoVacaciones, type ResultadoFiniquito } from "@/lib/finiquito";
import { leerEntero } from "@/lib/importar/csv";

async function verificar() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "remuneraciones").editar) throw new Error("Sin permiso de remuneraciones.");
  return { ctx, empresa: ctx.empresa, supabase: await clienteServidor() };
}

/** Remuneración base sugerida (art. 172): sueldo, gratificación y asignaciones fijas de la última liquidación. */
export async function baseSugerida(trabajadorId: string) {
  const { supabase } = await verificar();
  const { data: l } = await supabase.from("liquidaciones").select("id, anio, mes").eq("trabajador_id", trabajadorId).neq("estado", "anulada").order("anio", { ascending: false }).order("mes", { ascending: false }).limit(1).maybeSingle();
  const { data: t } = await supabase.from("trabajadores").select("sueldo_base, colacion, movilizacion").eq("id", trabajadorId).single();
  let grat = 0;
  if (l) {
    const { data: it } = await supabase.from("items_liquidacion").select("monto").eq("liquidacion_id", l.id).eq("codigo", "gratificacion").maybeSingle();
    grat = Number(it?.monto ?? 0);
  }
  return { base: Number(t?.sueldo_base ?? 0) + grat + Number(t?.colacion ?? 0) + Number(t?.movilizacion ?? 0), desde: l ? `${String(l.mes).padStart(2, "0")}-${l.anio}` : null };
}

export async function calcularFiniquitoAccion(datos: FormData, guardar: boolean): Promise<{ error?: string; resultado?: ResultadoFiniquito; id?: string }> {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const trabajadorId = String(datos.get("trabajador_id") ?? "");
    const fechaTermino = String(datos.get("fecha_termino") ?? "");
    const causal = Number(datos.get("causal"));
    const aviso = datos.get("aviso_previo_dado") === "on";
    const base = leerEntero(String(datos.get("remuneracion_base") ?? "")) ?? 0;
    if (!trabajadorId || !fechaTermino || !causal || base <= 0) return { error: "Completa trabajador, fecha de término, causal y remuneración base." };
    const [{ data: t }, { data: vac }, { data: fer }, params] = await Promise.all([
      supabase.from("trabajadores").select("fecha_ingreso, tipo_contrato, anios_previos_cotizados").eq("id", trabajadorId).single(),
      supabase.from("vacaciones").select("dias_habiles").eq("trabajador_id", trabajadorId),
      supabase.from("feriados").select("fecha"),
      Parametros.cargar(supabase),
    ]);
    if (!t) return { error: "Trabajador no encontrado." };
    if (fechaTermino < t.fecha_ingreso) return { error: "La fecha de término es anterior al ingreso." };
    const tomados = (vac ?? []).reduce((s, v) => s + Number(v.dias_habiles), 0);
    const saldo = saldoVacaciones(t.fecha_ingreso, fechaTermino, t.anios_previos_cotizados, tomados, params);
    const resultado = calcularFiniquito(
      { fechaIngreso: t.fecha_ingreso, fechaTermino, causal, avisoPrevioDado: aviso, remuneracionBase: base, tipoContrato: t.tipo_contrato, diasVacacionesPendientes: Math.max(0, saldo.saldo), aniosPrevios: t.anios_previos_cotizados },
      params,
      new Set((fer ?? []).map((f) => f.fecha)),
    );
    if (!guardar) return { resultado };
    const { data, error } = await supabase.from("finiquitos").insert({
      estudio_id: ctx.estudio!.id, empresa_id: empresa.id, trabajador_id: trabajadorId, fecha_termino: fechaTermino, causal,
      aviso_previo_dado: aviso, remuneracion_base: base, detalle: resultado, total: resultado.total,
    }).select("id").single();
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones/finiquitos");
    return { resultado, id: data.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function marcarRevisado(id: string, estado: "revisado" | "firmado" | "anulado") {
  try {
    const { ctx, supabase } = await verificar();
    const cambios: Record<string, unknown> = { estado };
    if (estado === "revisado") Object.assign(cambios, { revisado_por: ctx.usuario.id, revisado_at: new Date().toISOString() });
    const { data: f, error } = await supabase.from("finiquitos").update(cambios).eq("id", id).select("trabajador_id, fecha_termino").single();
    if (error) return { error: error.message };
    // Al firmarse, se registra la fecha de término en la ficha del trabajador.
    if (estado === "firmado") await supabase.from("trabajadores").update({ fecha_termino: f.fecha_termino }).eq("id", f.trabajador_id);
    revalidatePath("/remuneraciones", "layout");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
