"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso, type Periodo } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { calcularYGuardarF29 } from "@/lib/servicios/f29";

async function verificar(empresaId?: string) {
  const ctx = await obtenerContexto();
  const id = empresaId ?? ctx.empresa?.id;
  if (!id || !ctx.empresas.some((e) => e.id === id) || !permiso(ctx, id, "impuestos").editar) {
    throw new Error("No tienes permiso de impuestos en esta empresa.");
  }
  return { ctx, empresaId: id, supabase: await clienteServidor() };
}

/** Calcula el F29 de una empresa (la actual, o la indicada en los procesos masivos). */
export async function calcularF29Empresa(empresaId?: string, periodo?: Periodo) {
  try {
    const { ctx, empresaId: id, supabase } = await verificar(empresaId);
    const r = await calcularYGuardarF29(supabase, { id }, ctx.estudio!.id, periodo ?? ctx.periodo);
    revalidatePath("/impuestos", "layout");
    revalidatePath("/mi-mes");
    if (r.error) return { error: r.error };
    return {
      ok: r.bloqueado ? "Ya estaba declarado: no se recalculó." : "F29 calculado.",
      total: r.resultado?.totalAPagar ?? 0,
      avisos: r.resultado?.avisos ?? [],
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Guarda los valores de la propuesta del SII (para comparar) y los ajustes manuales. */
export async function guardarComparacion(propuestaSii: Record<string, number | null>, ajustes: Record<string, number | null>, notas: string) {
  try {
    const { ctx, empresaId, supabase } = await verificar();
    const limpio = (o: Record<string, number | null>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && Number.isFinite(v)));
    const { data: f } = await supabase.from("f29_propuestas").select("calculada, estado").eq("empresa_id", empresaId).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).single();
    if (!f) return { error: "Primero calcula el F29." };
    const aj = limpio(ajustes) as Record<string, number>;
    const cod = { ...(f.calculada as { codigos: Record<string, number> }).codigos, ...aj };
    const total = Math.max((cod["538"] ?? 0) - (cod["537"] ?? 0), 0) + (cod["62"] ?? 0) + (cod["151"] ?? 0) + (cod["48"] ?? 0);
    const cambios = f.estado === "declarado" || f.estado === "pagado"
      ? { propuesta_sii: limpio(propuestaSii), notas }
      : { propuesta_sii: limpio(propuestaSii), ajustes: aj, notas, total_a_pagar: Object.keys(aj).length ? total : (f.calculada as { totalAPagar: number }).totalAPagar };
    const { error } = await supabase.from("f29_propuestas").update(cambios).eq("empresa_id", empresaId).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes);
    if (error) return { error: error.message };
    revalidatePath("/impuestos/f29");
    return { ok: "Guardado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cambiarEstadoF29(estado: "revisado" | "declarado" | "pagado" | "borrador", datos?: { folio?: string; monto?: number }) {
  try {
    const { ctx, empresaId, supabase } = await verificar();
    const cambios: Record<string, unknown> = { estado };
    if (estado === "revisado") Object.assign(cambios, { revisado_por: ctx.usuario.id, revisado_at: new Date().toISOString() });
    if (estado === "declarado" || estado === "pagado") {
      Object.assign(cambios, { declarado_at: new Date().toISOString(), folio_declaracion: datos?.folio || null, monto_pagado: datos?.monto ?? null });
    }
    const { error } = await supabase.from("f29_propuestas").update(cambios).eq("empresa_id", empresaId).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes);
    if (error) return { error: error.message };
    revalidatePath("/impuestos", "layout");
    revalidatePath("/mi-mes");
    return { ok: "Estado actualizado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Sube el comprobante de pago (PDF o imagen) al almacenamiento privado. */
export async function subirComprobanteF29(datos: FormData) {
  try {
    const { ctx, empresaId, supabase } = await verificar();
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || !archivo.size) return { error: "Elige el archivo del comprobante." };
    if (archivo.size > 10_000_000) return { error: "Máximo 10 MB." };
    const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const ruta = `${ctx.estudio!.id}/${empresaId}/f29/${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}-comprobante.${ext}`;
    const { error } = await supabase.storage.from("archivos").upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined });
    if (error) return { error: error.message };
    await supabase.from("f29_propuestas").update({ ruta_comprobante: ruta }).eq("empresa_id", empresaId).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes);
    revalidatePath("/impuestos/f29");
    return { ok: "Comprobante adjuntado." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
