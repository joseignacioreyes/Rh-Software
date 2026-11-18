"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { leerEntero } from "@/lib/importar/csv";

/** Guarda (o reemplaza) el resumen mensual de boletas de venta. */
export async function guardarResumenBoletas(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "libros").editar) return { error: "Sin permiso." };
  const anio = Number(datos.get("anio"));
  const mes = Number(datos.get("mes"));
  const tipo = Number(datos.get("tipo"));
  const cantidad = leerEntero(String(datos.get("cantidad") ?? "")) ?? 0;
  const neto = leerEntero(String(datos.get("neto") ?? "")) ?? 0;
  const iva = leerEntero(String(datos.get("iva") ?? "")) ?? 0;
  if (![39, 41, 48].includes(tipo)) return { error: "Tipo no válido." };
  if (cantidad <= 0 || neto <= 0) return { error: "Escribe la cantidad de boletas y el neto." };
  const exenta = tipo === 41;
  const supabase = await clienteServidor();
  const fin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  const { error } = await supabase.from("documentos_rcv").upsert(
    {
      estudio_id: ctx.estudio!.id, empresa_id: ctx.empresa.id, libro: "ventas", anio, mes, tipo_doc: tipo,
      folio: `RESUMEN-${anio}${String(mes).padStart(2, "0")}`, rut_contraparte: "66666666-6", razon_social: "Resumen de boletas del mes",
      fecha_docto: fin, monto_exento: exenta ? neto : 0, monto_neto: exenta ? 0 : neto, monto_iva: exenta ? 0 : iva,
      monto_total: neto + (exenta ? 0 : iva), cantidad_documentos: cantidad, origen: "resumen_boletas",
    },
    { onConflict: "empresa_id,libro,tipo_doc,folio,rut_contraparte" },
  );
  if (error) return { error: error.message };
  revalidatePath("/libros/ventas");
  return { ok: "Resumen de boletas guardado." };
}
