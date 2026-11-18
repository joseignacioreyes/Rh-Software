"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

/** El contador informa una transferencia con su comprobante. José la revisa y la aprueba en /admin. */
export async function informarPago(_: unknown, datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.estudio || !esContador(ctx)) return { error: "Solo el contador del estudio informa pagos." };
  const supabase = await clienteServidor();
  const plan = String(datos.get("plan") ?? "");
  const meses = Number(datos.get("meses") ?? 1);
  const fecha = String(datos.get("fecha") ?? "");
  const { data: p } = await supabase.from("planes").select("precio_mensual, max_empresas").eq("codigo", plan).eq("activo", true).maybeSingle();
  if (!p) return { error: "Elige un plan." };
  if (![1, 3, 6, 12].includes(meses)) return { error: "Elige cuántos meses pagas." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indica la fecha de la transferencia." };
  const { count } = await supabase.from("empresas").select("id", { count: "exact", head: true }).eq("estudio_id", ctx.estudio.id).eq("activa", true);
  if ((count ?? 0) > p.max_empresas) return { error: `Tienes ${count} empresas activas y este plan permite ${p.max_empresas}. Elige un plan mayor.` };

  let ruta: string | null = null;
  const archivo = datos.get("comprobante");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > 10_000_000) return { error: "El comprobante pesa más de 10 MB." };
    if (!/^(image\/|application\/pdf)/.test(archivo.type)) return { error: "El comprobante debe ser una imagen o un PDF." };
    ruta = `${ctx.estudio.id}/${Date.now()}-${archivo.name.replace(/[^\w.\-]+/g, "_").slice(-60)}`;
    const s = await supabase.storage.from("suscripciones").upload(ruta, archivo, { contentType: archivo.type });
    if (s.error) return { error: `No se pudo subir el comprobante: ${s.error.message}` };
  } else {
    return { error: "Adjunta el comprobante de la transferencia." };
  }
  const { error } = await supabase.from("pagos_suscripcion").insert({
    estudio_id: ctx.estudio.id, plan, meses, monto: Number(p.precio_mensual) * meses, fecha_transferencia: fecha,
    banco_origen: String(datos.get("banco") ?? "").slice(0, 80) || null, numero_operacion: String(datos.get("operacion") ?? "").slice(0, 40) || null,
    ruta_comprobante: ruta,
  });
  if (error) return { error: error.message };
  revalidatePath("/estudio/suscripcion");
  return { ok: "Recibimos tu pago. Lo revisamos en menos de 1 día hábil y te avisamos." };
}
