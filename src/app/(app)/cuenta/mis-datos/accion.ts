"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

const TIPOS = ["acceso", "rectificacion", "supresion", "oposicion"];

export async function crearSolicitud(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  const ctx = await obtenerContexto();
  if (ctx.estudio?.es_demo) return { error: "No disponible en el estudio de ejemplo." };
  const tipo = String(datos.get("tipo"));
  if (!TIPOS.includes(tipo)) return { error: "Tipo de solicitud no válido." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("solicitudes_titular").insert({
    usuario_id: ctx.usuario.id,
    tipo,
    detalle: String(datos.get("detalle") ?? "").slice(0, 2000) || null,
  });
  if (error) return { error: "No se pudo registrar la solicitud." };
  await supabase.rpc("registrar_evento", { p_accion: "solicitud_titular", p_detalle: { tipo } });
  revalidatePath("/cuenta/mis-datos");
  return { ok: "Solicitud recibida. Te responderemos por correo." };
}
