"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { leerFilasArchivo } from "@/lib/importar/excel";
import { CAMPOS, aplicarMapeoLibro, firmaEncabezados, sugerirMapeo, type Mapeo, type TipoMapeo } from "@/lib/importar/mapeo";
import { guardarDocumentosRcv } from "@/lib/importar/guardar";
import { totalesLibro } from "@/lib/importar/rcv";
import { sugerirMapeoIA } from "@/lib/ia";

const texto = (c: unknown) => (c instanceof Date ? c.toISOString().slice(0, 10) : c === null || c === undefined ? "" : String(c));

export type Analisis = {
  error?: string;
  encabezados?: string[];
  ejemplos?: string[][];
  mapeo?: Mapeo;
  fuente?: "guardado" | "ia" | "nombres";
  nombreGuardado?: string;
  filas?: number;
};

/** Lee el archivo y sugiere el mapeo: primero uno guardado, luego IA, luego por nombres de columna. */
export async function analizarArchivo(datos: FormData): Promise<Analisis> {
  const ctx = await obtenerContexto();
  const archivo = datos.get("archivo");
  const tipo = String(datos.get("tipo")) as TipoMapeo;
  if (!(archivo instanceof File) || !archivo.size) return { error: "Elige un archivo Excel (.xlsx) o CSV." };
  if (!CAMPOS[tipo]) return { error: "Tipo de libro no válido." };
  const { encabezados, filas } = await leerFilasArchivo(archivo);
  if (encabezados.length < 2) return { error: "No se encontró una fila de encabezados en el archivo." };

  const firma = firmaEncabezados(encabezados);
  const supabase = await clienteServidor();
  const { data: guardado } = await supabase
    .from("mapeos_importacion")
    .select("nombre, mapeo")
    .eq("estudio_id", ctx.estudio!.id)
    .eq("tipo", tipo)
    .eq("firma_encabezados", firma)
    .maybeSingle();
  const ejemplos = filas.slice(0, 8).map((f) => encabezados.map((_, i) => texto(f[i])));
  if (guardado) {
    return { encabezados, ejemplos, mapeo: guardado.mapeo as Mapeo, fuente: "guardado", nombreGuardado: guardado.nombre, filas: filas.length };
  }
  const ia = await sugerirMapeoIA(CAMPOS[tipo], encabezados, ejemplos);
  if (ia) return { encabezados, ejemplos, mapeo: { ...sugerirMapeo(tipo, encabezados), ...ia }, fuente: "ia", filas: filas.length };
  return { encabezados, ejemplos, mapeo: sugerirMapeo(tipo, encabezados), fuente: "nombres", filas: filas.length };
}

export type ResultadoMapeo = {
  error?: string;
  vista?: { tipo_doc: number; folio: string; fecha: string; rut: string; razon: string | null; neto: number; iva: number; total: number }[];
  documentos?: number;
  total?: number;
  errores?: { fila: number; mensaje: string }[];
  ok?: string;
};

/** Valida (y si `confirmar`, importa) el libro con el mapeo elegido. Puede guardar el mapeo para la próxima vez. */
export async function importarConMapeo(datos: FormData): Promise<ResultadoMapeo> {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "libros").editar) return { error: "No tienes permiso para importar libros en esta empresa." };
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File)) return { error: "Falta el archivo." };
  const tipo = String(datos.get("tipo")) as TipoMapeo;
  if (tipo !== "libro_compras" && tipo !== "libro_ventas") return { error: "Tipo no válido." };
  const mapeo = JSON.parse(String(datos.get("mapeo") ?? "{}")) as Mapeo;
  const anio = Number(datos.get("anio"));
  const mes = Number(datos.get("mes"));
  const faltan = CAMPOS[tipo].filter((c) => c.obligatorio && (mapeo[c.campo] === null || mapeo[c.campo] === undefined));
  if (faltan.length) return { error: `Falta indicar la columna de: ${faltan.map((c) => c.nombre).join(", ")}.` };

  const { encabezados, filas } = await leerFilasArchivo(archivo);
  const libro = tipo === "libro_compras" ? "compras" : "ventas";
  const { documentos, errores } = aplicarMapeoLibro(libro, filas, mapeo, { anio, mes });
  const t = totalesLibro(documentos);

  if (datos.get("confirmar") !== "1") {
    return {
      documentos: documentos.length, total: t.total, errores,
      vista: documentos.slice(0, 10).map((d) => ({ tipo_doc: d.tipo_doc, folio: d.folio, fecha: d.fecha_docto, rut: d.rut_contraparte, razon: d.razon_social, neto: d.monto_neto, iva: d.monto_iva, total: d.monto_total })),
    };
  }

  const supabase = await clienteServidor();
  const hash = createHash("sha256").update(new Uint8Array(await archivo.arrayBuffer())).digest("hex");
  const r = await guardarDocumentosRcv(
    { supabase, estudioId: ctx.estudio!.id, empresaId: ctx.empresa.id, nombreArchivo: archivo.name, hash },
    libro, documentos, errores, { anio, mes }, "excel", mapeo,
  );
  const nombre = String(datos.get("nombreMapeo") ?? "").trim();
  if (nombre) {
    await supabase.from("mapeos_importacion").upsert(
      { estudio_id: ctx.estudio!.id, nombre, tipo, firma_encabezados: firmaEncabezados(encabezados), mapeo },
      { onConflict: "estudio_id,tipo,firma_encabezados" },
    );
  }
  revalidatePath("/libros", "layout");
  return { ok: `Importados ${r.nuevos} documentos nuevos (${r.duplicados} ya estaban).${nombre ? ` Mapeo “${nombre}” guardado para la próxima vez.` : ""}` };
}
