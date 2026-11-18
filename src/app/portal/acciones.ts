"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, esCliente } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

/** El cliente sube documentos (fotos, PDF, Excel) a la bandeja de su contador. */
export async function subirDocumentos(datos: FormData) {
  const ctx = await obtenerContexto();
  const empresa = ctx.empresa;
  if (!empresa || !esCliente(ctx, empresa.id)) return { error: "No tienes acceso a esta empresa." };
  const archivos = datos.getAll("archivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (!archivos.length) return { error: "Elige al menos un archivo." };
  const comentario = String(datos.get("comentario") ?? "").slice(0, 500) || null;
  const supabase = await clienteServidor();
  let subidos = 0;
  for (const a of archivos) {
    if (a.size > 15_000_000) return { error: `${a.name} pesa más de 15 MB.` };
    if (!/^(image\/|application\/pdf|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/csv)/.test(a.type || "")) {
      return { error: `${a.name}: solo se aceptan fotos, PDF o Excel.` };
    }
    const nombre = a.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const ruta = `${ctx.estudio!.id}/${empresa.id}/bandeja/${Date.now()}-${nombre}`;
    const subida = await supabase.storage.from("archivos").upload(ruta, a, { contentType: a.type || undefined });
    if (subida.error) return { error: `No se pudo subir ${a.name}: ${subida.error.message}` };
    const { error } = await supabase.from("documentos_bandeja").insert({
      estudio_id: ctx.estudio!.id, empresa_id: empresa.id, origen: "portal", nombre_archivo: a.name, ruta_storage: ruta,
      tipo_mime: a.type, tamano: a.size, comentario,
    });
    if (error) return { error: error.message };
    subidos++;
  }
  revalidatePath("/portal");
  return { ok: subidos === 1 ? "¡Listo! Tu contador recibió el documento." : `¡Listo! Tu contador recibió ${subidos} documentos.` };
}

/** El cliente responde una solicitud de su contador. */
export async function responderSolicitud(id: string, respuesta: string) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !esCliente(ctx, ctx.empresa.id)) return { error: "Sin acceso." };
  if (respuesta.trim().length < 2) return { error: "Escribe tu respuesta." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("solicitudes_cliente").update({ respuesta: respuesta.trim().slice(0, 1000), estado: "respondida", respondida_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/portal");
  return { ok: "Respuesta enviada." };
}
