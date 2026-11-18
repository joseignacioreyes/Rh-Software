"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function verificarParametro(id: string, quien: string) {
  const ctx = await obtenerContexto();
  if (!ctx.usuario.es_superadmin) return { error: "Solo el superadministrador puede verificar parámetros." };
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("parametros_legales")
    .update({ estado: "verificado", verificado_por: quien.trim().slice(0, 100), verificado_at: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/remuneraciones/parametros");
  return {};
}
