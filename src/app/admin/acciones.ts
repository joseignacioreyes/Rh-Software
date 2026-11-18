"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

async function soloSuperadmin() {
  const ctx = await obtenerContexto();
  if (!ctx.usuario.es_superadmin) throw new Error("Solo el superadministrador.");
  return clienteServidor();
}

export async function aprobarPago(id: string) {
  const supabase = await soloSuperadmin();
  const { data, error } = await supabase.rpc("aprobar_pago", { p_pago: id });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: `Pago aprobado. Pagado hasta ${String(data).split("-").reverse().join("-")}.` };
}

export async function rechazarPago(id: string, motivo: string) {
  const supabase = await soloSuperadmin();
  if (motivo.trim().length < 4) return { error: "Escribe el motivo del rechazo (lo verá el estudio)." };
  const { error } = await supabase.from("pagos_suscripcion").update({ estado: "rechazado", motivo_rechazo: motivo.trim().slice(0, 300), revisado_at: new Date().toISOString() }).eq("id", id).eq("estado", "informado");
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: "Pago rechazado." };
}

/** Cambia el estado de la cuenta (por ejemplo, extender la prueba). Nunca borra datos del estudio. */
export async function ajustarSuscripcion(estudioId: string, cambios: { pagado_hasta?: string; estado?: string; plan?: string }) {
  const supabase = await soloSuperadmin();
  const { error } = await supabase.from("suscripciones").update(cambios).eq("estudio_id", estudioId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: "Suscripción actualizada." };
}
