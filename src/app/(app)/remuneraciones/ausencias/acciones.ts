"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { diasHabiles } from "@/lib/finiquito";
import { normalizarRut } from "@/lib/rut";

async function verificar() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "remuneraciones").editar) throw new Error("Sin permiso de remuneraciones.");
  return { ctx, empresa: ctx.empresa, supabase: await clienteServidor() };
}

export async function registrarVacaciones(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const trabajador = String(datos.get("trabajador_id") ?? "");
    const desde = String(datos.get("desde") ?? "");
    const hasta = String(datos.get("hasta") ?? "");
    if (!trabajador || !desde || !hasta || hasta < desde) return { error: "Indica el trabajador y un rango de fechas válido." };
    const { data: fer } = await supabase.from("feriados").select("fecha");
    const dias = diasHabiles(desde, hasta, new Set((fer ?? []).map((f) => f.fecha)));
    if (dias === 0) return { error: "El rango no tiene días hábiles." };
    const { error } = await supabase.from("vacaciones").insert({ estudio_id: ctx.estudio!.id, empresa_id: empresa.id, trabajador_id: trabajador, desde, hasta, dias_habiles: dias, observaciones: String(datos.get("observaciones") ?? "") || null });
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones/ausencias");
    return { ok: `Vacaciones registradas: ${dias} días hábiles.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function registrarLicencia(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const trabajador = String(datos.get("trabajador_id") ?? "");
    const desde = String(datos.get("desde") ?? "");
    const hasta = String(datos.get("hasta") ?? "");
    if (!trabajador || !desde || !hasta || hasta < desde) return { error: "Indica el trabajador y un rango de fechas válido." };
    const rp = String(datos.get("rut_pagadora") ?? "").trim();
    const rutPagadora = rp ? normalizarRut(rp) : null;
    if (rp && !rutPagadora) return { error: "El RUT de la entidad pagadora no es válido." };
    const { error } = await supabase.from("licencias").insert({
      estudio_id: ctx.estudio!.id, empresa_id: empresa.id, trabajador_id: trabajador, desde, hasta,
      folio: String(datos.get("folio") ?? "") || null, tipo: String(datos.get("tipo") ?? "enfermedad"), rut_pagadora: rutPagadora,
    });
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones", "layout");
    return { ok: "Licencia registrada. Se descontará en la liquidación del mes al recalcular." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function eliminarRegistro(tabla: "vacaciones" | "licencias", id: string) {
  try {
    const { supabase } = await verificar();
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/remuneraciones/ausencias");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
