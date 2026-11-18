"use server";

import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";

/** Reglas de la clave: al menos 8 caracteres, con letras y números. */
export async function validarClave(clave: string): Promise<string | null> {
  if (clave.length < 8) return "La clave debe tener al menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) return "La clave debe tener letras y números.";
  return null;
}

export async function crearNuevaClave(_p: { error?: string } | undefined, datos: FormData) {
  const clave = String(datos.get("clave") ?? "");
  if (clave !== String(datos.get("repetir") ?? "")) return { error: "Las claves no coinciden." };
  const problema = await validarClave(clave);
  if (problema) return { error: problema };

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) return { error: "No se pudo guardar la clave. Prueba con otra." };

  await clienteAdmin().from("usuarios").update({ debe_cambiar_clave: false }).eq("id", user.id);
  await supabase.rpc("registrar_evento", { p_accion: "clave_cambiada" });
  redirect("/mi-mes");
}
