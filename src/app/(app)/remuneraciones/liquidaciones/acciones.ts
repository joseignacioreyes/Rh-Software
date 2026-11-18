"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso, type Periodo } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { calcularLiquidacionesEmpresa } from "@/lib/servicios/liquidaciones";

async function verificar(empresaId?: string) {
  const ctx = await obtenerContexto();
  const id = empresaId ?? ctx.empresa?.id;
  if (!id || !ctx.empresas.some((e) => e.id === id) || !permiso(ctx, id, "remuneraciones").editar) {
    throw new Error("No tienes permiso de remuneraciones en esta empresa.");
  }
  return { ctx, empresaId: id, supabase: await clienteServidor() };
}

/** Calcula las liquidaciones del mes (usado también por el proceso masivo de "Mi mes"). */
export async function calcularLiquidaciones(empresaId?: string, periodo?: Periodo) {
  try {
    const { ctx, empresaId: id, supabase } = await verificar(empresaId);
    const r = await calcularLiquidacionesEmpresa(supabase, id, ctx.estudio!.id, periodo ?? ctx.periodo);
    revalidatePath("/remuneraciones", "layout");
    revalidatePath("/mi-mes");
    if (r.errores.length) return { error: r.errores.join(" · "), avisos: r.alertas.map((a) => a.texto) };
    return {
      ok: `${r.calculadas} liquidaciones calculadas${r.omitidas ? `, ${r.omitidas} ya aprobadas (no se tocaron)` : ""}.`,
      avisos: r.alertas.map((a) => a.texto),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const CAMPOS = ["horas_extra", "dias_licencia", "dias_ausencia", "bono_imponible", "comisiones", "bono_no_imponible", "anticipo", "prestamo", "cuota_sindical", "apv", "otros_descuentos"] as const;
export type CampoNovedad = (typeof CAMPOS)[number];

/** Guarda las novedades del mes de un trabajador. */
export async function guardarNovedad(trabajadorId: string, valores: Partial<Record<CampoNovedad, number>>) {
  try {
    const { ctx, empresaId, supabase } = await verificar();
    const limpio = Object.fromEntries(
      CAMPOS.map((c) => [c, Math.max(0, Number(valores[c] ?? 0) || 0)]),
    ) as Record<CampoNovedad, number>;
    if (limpio.dias_licencia + limpio.dias_ausencia > 30) return { error: "Licencias más ausencias no pueden superar 30 días." };
    const { error } = await supabase.from("novedades").upsert(
      { ...limpio, estudio_id: ctx.estudio!.id, empresa_id: empresaId, trabajador_id: trabajadorId, anio: ctx.periodo.anio, mes: ctx.periodo.mes },
      { onConflict: "trabajador_id,anio,mes" },
    );
    if (error) return { error: error.message };
    return { ok: "Guardado" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cambiarEstadoLiquidacion(id: string, estado: "aprobada" | "calculada" | "anulada") {
  try {
    const { ctx, supabase } = await verificar();
    const cambios: Record<string, unknown> = { estado };
    if (estado === "aprobada") Object.assign(cambios, { aprobada_por: ctx.usuario.id, aprobada_at: new Date().toISOString() });
    else Object.assign(cambios, { aprobada_por: null, aprobada_at: null });
    const { error } = await supabase.from("liquidaciones").update(cambios).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones", "layout");
    return { ok: "Listo." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Aprueba todas las liquidaciones calculadas del mes. */
export async function aprobarTodas() {
  try {
    const { ctx, empresaId, supabase } = await verificar();
    const { error } = await supabase.from("liquidaciones").update({ estado: "aprobada", aprobada_por: ctx.usuario.id, aprobada_at: new Date().toISOString() })
      .eq("empresa_id", empresaId).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).eq("estado", "calculada");
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones", "layout");
    return { ok: "Liquidaciones aprobadas." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
