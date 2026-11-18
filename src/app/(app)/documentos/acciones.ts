"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { leerDocumentoIA, iaDisponible } from "@/lib/ia";
import { normalizarRut } from "@/lib/rut";

async function contexto() {
  const ctx = await obtenerContexto();
  const empresa = ctx.empresa;
  if (!empresa || !permiso(ctx, empresa.id, "documentos").editar) throw new Error("Sin permiso para trabajar la bandeja de esta empresa.");
  return { ctx, empresa, supabase: await clienteServidor() };
}

/** Busca si ya existe en el RCV un documento con el mismo tipo, folio y RUT (posible duplicado). */
async function buscarDuplicado(supabase: Awaited<ReturnType<typeof clienteServidor>>, empresaId: string, tipo: number, folio: string, rut: string) {
  const { data } = await supabase.from("documentos_rcv").select("id, anio, mes").eq("empresa_id", empresaId)
    .eq("tipo_doc", tipo).eq("folio", folio).eq("rut_contraparte", rut).maybeSingle();
  return data;
}

/** Lee el documento con IA (si hay clave). El resultado se muestra para que una persona lo confirme. */
export async function leerConIA(id: string) {
  const { empresa, supabase } = await contexto();
  if (!iaDisponible()) return { error: "La lectura con IA aún no está activa (falta la clave de la API de Claude). Ingresa los datos a mano." };
  const { data: doc } = await supabase.from("documentos_bandeja").select("ruta_storage, tipo_mime").eq("id", id).eq("empresa_id", empresa.id).single();
  if (!doc) return { error: "Documento no encontrado." };
  if (!/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(doc.tipo_mime ?? "")) return { error: "La IA lee fotos (JPG, PNG) y PDF." };
  const archivo = await supabase.storage.from("archivos").download(doc.ruta_storage);
  if (archivo.error) return { error: "No se pudo abrir el archivo." };
  const leido = await leerDocumentoIA(Buffer.from(await archivo.data.arrayBuffer()), doc.tipo_mime!);
  if (!leido) return { error: "La IA no pudo leer el documento. Ingresa los datos a mano." };
  await supabase.from("documentos_bandeja").update({ datos: leido, leido_con: "ia" }).eq("id", id);
  revalidatePath("/documentos");
  return { ok: `Leído con IA (confianza ${leido.confianza}). Revisa cada dato antes de registrar.` };
}

const esquemaRegistro = z.object({
  id: z.uuid(),
  libro: z.enum(["compras", "ventas"]),
  tipo_doc: z.coerce.number().int().positive(),
  folio: z.string().trim().min(1, "Falta el folio"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  rut: z.string().trim(),
  razon_social: z.string().trim().max(200).optional(),
  neto: z.coerce.number().int().min(0),
  exento: z.coerce.number().int().min(0),
  iva: z.coerce.number().int().min(0),
  total: z.coerce.number().int().min(0),
});

/** Registra el documento confirmado en el libro de compras o ventas (origen manual, nunca automático). */
export async function registrarEnLibro(_: unknown, datos: FormData) {
  const { ctx, empresa, supabase } = await contexto();
  const r = esquemaRegistro.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const rut = normalizarRut(d.rut);
  if (!rut) return { error: "El RUT no es válido (revisa el dígito verificador)." };
  if (d.neto + d.exento + d.iva !== d.total) return { error: `No cuadra: neto + exento + IVA = ${d.neto + d.exento + d.iva}, pero el total es ${d.total}.` };
  const anio = Number(d.fecha.slice(0, 4));
  const mes = Number(d.fecha.slice(5, 7));
  const { data: cerrado } = await supabase.from("periodos").select("estado").eq("empresa_id", empresa.id).eq("anio", anio).eq("mes", mes).maybeSingle();
  if (cerrado?.estado === "cerrado") return { error: `El periodo ${String(mes).padStart(2, "0")}-${anio} está cerrado. Reábrelo con un motivo para registrar.` };
  const dup = await buscarDuplicado(supabase, empresa.id, d.tipo_doc, d.folio, rut);
  if (dup) {
    await supabase.from("documentos_bandeja").update({ duplicado_de: dup.id }).eq("id", d.id);
    revalidatePath("/documentos");
    return { error: `Este documento ya está en el libro (${String(dup.mes).padStart(2, "0")}-${dup.anio}). Probablemente vino en el RCV del SII: descártalo.` };
  }
  const { data: nuevo, error } = await supabase.from("documentos_rcv").insert({
    estudio_id: ctx.estudio!.id, empresa_id: empresa.id, libro: d.libro, anio, mes, tipo_doc: d.tipo_doc, folio: d.folio,
    rut_contraparte: rut, razon_social: d.razon_social || null, fecha_docto: d.fecha, monto_neto: d.neto, monto_exento: d.exento,
    monto_iva: d.iva, monto_total: d.total, origen: "manual", tipo_operacion: "Del Giro",
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("documentos_bandeja").update({
    estado: "registrado", documento_rcv_id: nuevo.id, procesado_por: ctx.usuario.id, procesado_at: new Date().toISOString(),
    datos: { ...d, rut }, leido_con: datos.get("leido_con") === "ia" ? "ia" : "manual",
  }).eq("id", d.id);
  revalidatePath("/documentos");
  return { ok: `Registrado en el libro de ${d.libro} de ${String(mes).padStart(2, "0")}-${anio}.` };
}

/** Marca el documento como revisado sin registrarlo (no se borra: queda en la bandeja como "descartado"). */
export async function descartar(id: string) {
  const { ctx, supabase } = await contexto();
  await supabase.from("documentos_bandeja").update({ estado: "descartado", procesado_por: ctx.usuario.id, procesado_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/documentos");
}

/** Vuelve a dejar pendiente un documento descartado. */
export async function reabrir(id: string) {
  const { supabase } = await contexto();
  await supabase.from("documentos_bandeja").update({ estado: "pendiente", procesado_por: null, procesado_at: null }).eq("id", id).eq("estado", "descartado");
  revalidatePath("/documentos");
}

/** El contador le pide algo al cliente (aparece en su portal). */
export async function crearSolicitud(_: unknown, datos: FormData) {
  const { ctx, empresa, supabase } = await contexto();
  const titulo = String(datos.get("titulo") ?? "").trim();
  if (titulo.length < 4) return { error: "Escribe qué necesitas." };
  const { error } = await supabase.from("solicitudes_cliente").insert({
    estudio_id: ctx.estudio!.id, empresa_id: empresa.id, titulo: titulo.slice(0, 200), detalle: String(datos.get("detalle") ?? "").trim().slice(0, 1000) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/documentos");
  return { ok: "Solicitud enviada al portal del cliente." };
}

export async function cerrarSolicitud(id: string) {
  const { supabase } = await contexto();
  await supabase.from("solicitudes_cliente").update({ estado: "cerrada" }).eq("id", id);
  revalidatePath("/documentos");
}

/** Sube documentos a la bandeja desde el estudio (por ejemplo, los que llegaron por correo). */
export async function subirDesdeEstudio(datos: FormData) {
  const { ctx, empresa, supabase } = await contexto();
  const archivos = datos.getAll("archivos").filter((a): a is File => a instanceof File && a.size > 0);
  for (const a of archivos) {
    if (a.size > 15_000_000) return { error: `${a.name} pesa más de 15 MB.` };
    const ruta = `${ctx.estudio!.id}/${empresa.id}/bandeja/${Date.now()}-${a.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
    const s = await supabase.storage.from("archivos").upload(ruta, a, { contentType: a.type || undefined });
    if (s.error) return { error: s.error.message };
    await supabase.from("documentos_bandeja").insert({
      estudio_id: ctx.estudio!.id, empresa_id: empresa.id, origen: "correo", nombre_archivo: a.name, ruta_storage: ruta, tipo_mime: a.type, tamano: a.size,
    });
  }
  revalidatePath("/documentos");
  return { ok: `${archivos.length} documento(s) agregados a la bandeja.` };
}
