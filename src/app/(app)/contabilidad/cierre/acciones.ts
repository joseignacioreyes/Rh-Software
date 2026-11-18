"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function cerrarMes(anio: number, mes: number) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !esContador(ctx)) return { error: "Solo el contador puede cerrar periodos." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("cerrar_periodo", { p_empresa: ctx.empresa.id, p_anio: anio, p_mes: mes });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function reabrirMes(anio: number, mes: number, motivo: string) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !esContador(ctx)) return { error: "Solo el contador puede reabrir periodos." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("reabrir_periodo", { p_empresa: ctx.empresa.id, p_anio: anio, p_mes: mes, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
