"use server";

import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerContexto } from "@/lib/sesion";
import { validarClave } from "@/app/ingresar/nueva-clave/accion";

export async function cambiarClave(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  const ctx = await obtenerContexto();
  if (ctx.estudio?.es_demo) return { error: "No disponible en el estudio de ejemplo." };
  const clave = String(datos.get("clave") ?? "");
  if (clave !== String(datos.get("repetir") ?? "")) return { error: "Las claves no coinciden." };
  const problema = await validarClave(clave);
  if (problema) return { error: problema };
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) return { error: "No se pudo cambiar la clave. Prueba con otra." };
  await supabase.rpc("registrar_evento", { p_accion: "clave_cambiada" });
  return { ok: "Clave cambiada." };
}
