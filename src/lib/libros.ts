import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIPOS_DOCUMENTO, esNotaCredito, totalesLibro } from "@/lib/importar/rcv";
import { formatearRut } from "@/lib/rut";
import { formatoFecha } from "@/lib/formato";
import { nombrePeriodo, type Periodo } from "@/lib/sesion";
import type { TablaExport } from "@/lib/exportar/tabla";

// Consultas y armado de los libros de compras, ventas y honorarios de un periodo.

export type DocLibro = {
  id: string; tipo_doc: number; tipo_operacion: string | null; folio: string; rut_contraparte: string; razon_social: string | null;
  fecha_docto: string; monto_exento: number; monto_neto: number; monto_iva: number; monto_iva_no_recuperable: number;
  otros_impuestos: number; monto_total: number; origen: string; cantidad_documentos: number | null;
  iva_uso_comun: number; monto_neto_activo_fijo: number; iva_activo_fijo: number; codigo_iva_no_recuperable: string | null;
};

const f = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));

export async function cargarLibro(supabase: SupabaseClient, empresaId: string, libro: "compras" | "ventas", p: Periodo) {
  const { data } = await supabase
    .from("documentos_rcv")
    .select("id, tipo_doc, tipo_operacion, folio, rut_contraparte, razon_social, fecha_docto, monto_exento, monto_neto, monto_iva, monto_iva_no_recuperable, otros_impuestos, monto_total, origen, cantidad_documentos, iva_uso_comun, monto_neto_activo_fijo, iva_activo_fijo, codigo_iva_no_recuperable")
    .eq("empresa_id", empresaId)
    .eq("libro", libro)
    .eq("anio", p.anio)
    .eq("mes", p.mes)
    .order("fecha_docto")
    .order("folio");
  const docs = (data ?? []) as DocLibro[];
  return { docs, totales: totalesLibro(docs) };
}

/** Tabla del libro (los montos de notas de crédito van en negativo). */
export function tablaLibro(
  libro: "compras" | "ventas",
  docs: DocLibro[],
  empresa: { razon_social: string; rut: string },
  p: Periodo,
): TablaExport {
  const s = (d: DocLibro) => (esNotaCredito(d.tipo_doc) ? -1 : 1);
  const t = totalesLibro(docs);
  return {
    titulo: `Libro de ${libro} · ${nombrePeriodo(p)}`,
    subtitulo: `${empresa.razon_social} · RUT ${formatearRut(empresa.rut)}`,
    columnas: [
      { titulo: "Tipo", ancho: 8 }, { titulo: "Documento", ancho: 20 }, { titulo: "Folio", ancho: 10 }, { titulo: "Fecha", ancho: 11 },
      { titulo: "RUT", ancho: 12 }, { titulo: "Razón social", ancho: 30 },
      { titulo: "Exento", tipo: "monto" }, { titulo: "Neto", tipo: "monto" },
      { titulo: libro === "compras" ? "IVA rec." : "IVA", tipo: "monto" },
      ...(libro === "compras" ? [{ titulo: "IVA no rec.", tipo: "monto" as const }] : []),
      { titulo: "Otros imp.", tipo: "monto" }, { titulo: "Total", tipo: "monto" },
    ],
    filas: docs.map((d) => [
      d.tipo_doc, TIPOS_DOCUMENTO[d.tipo_doc] ?? `Tipo ${d.tipo_doc}`, d.folio, f(d.fecha_docto), formatearRut(d.rut_contraparte), d.razon_social,
      s(d) * d.monto_exento, s(d) * d.monto_neto, s(d) * d.monto_iva,
      ...(libro === "compras" ? [s(d) * d.monto_iva_no_recuperable] : []),
      s(d) * d.otros_impuestos, s(d) * d.monto_total,
    ]),
    totales: ["", `${t.documentos} documentos`, "", "", "", "Totales", t.exento, t.neto, t.iva, ...(libro === "compras" ? [t.ivaNoRecuperable] : []), t.otros, t.total],
    pie: "Generado por RH Software a partir del Registro de Compras y Ventas importado. Las notas de crédito restan.",
  };
}

/**
 * Formato CSV para el importador de libros del SII (punto y coma), pensado para documentos no electrónicos.
 * POR VERIFICAR: comparar con la estructura que se descarga en sii.cl ("Descargar estructura libro de compras/ventas")
 * antes de usarlo en una declaración. Las columnas siguen el detalle del RCV.
 */
export function csvImportadorSii(libro: "compras" | "ventas", docs: DocLibro[]): Buffer {
  const enc = libro === "compras"
    ? ["Tipo Doc", "Folio", "Fecha Docto", "RUT Proveedor", "Razon Social", "Monto Exento", "Monto Neto", "Monto IVA Recuperable", "Monto Iva No Recuperable", "Codigo IVA No Rec.", "Monto Neto Activo Fijo", "IVA Activo Fijo", "IVA uso Comun", "Monto Total"]
    : ["Tipo Doc", "Folio", "Fecha Docto", "Rut cliente", "Razon Social", "Monto Exento", "Monto Neto", "Monto IVA", "Monto total"];
  const fila = (d: DocLibro) =>
    libro === "compras"
      ? [d.tipo_doc, d.folio, f(d.fecha_docto).replace(/-/g, "/"), d.rut_contraparte, d.razon_social ?? "", d.monto_exento, d.monto_neto, d.monto_iva, d.monto_iva_no_recuperable, d.codigo_iva_no_recuperable ?? "", d.monto_neto_activo_fijo, d.iva_activo_fijo, d.iva_uso_comun, d.monto_total]
      : [d.tipo_doc, d.folio, f(d.fecha_docto).replace(/-/g, "/"), d.rut_contraparte, d.razon_social ?? "", d.monto_exento, d.monto_neto, d.monto_iva, d.monto_total];
  const texto = [enc, ...docs.map(fila)].map((x) => x.map((v) => String(v).replace(/;/g, ",")).join(";")).join("\r\n") + "\r\n";
  // El SII trabaja con Latin-1.
  return Buffer.from(texto, "latin1");
}

export type Boleta = {
  id: string; folio: string; fecha: string; rut_contraparte: string; nombre: string | null; monto_bruto: number;
  monto_retencion: number; monto_liquido: number; estado: string; retencion_por: string | null;
};

export async function cargarHonorarios(supabase: SupabaseClient, empresaId: string, tipo: "recibidas" | "emitidas", p: Periodo) {
  const { data } = await supabase
    .from("honorarios")
    .select("id, folio, fecha, rut_contraparte, nombre, monto_bruto, monto_retencion, monto_liquido, estado, retencion_por")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .eq("anio", p.anio)
    .eq("mes", p.mes)
    .order("fecha");
  const boletas = (data ?? []) as Boleta[];
  const vigentes = boletas.filter((b) => b.estado === "vigente");
  return {
    boletas,
    totales: {
      bruto: vigentes.reduce((s, b) => s + b.monto_bruto, 0),
      retencion: vigentes.reduce((s, b) => s + b.monto_retencion, 0),
      // Retención que paga la empresa (cuando ella retiene): va al F29.
      retencionEmpresa: vigentes.filter((b) => b.retencion_por !== "emisor").reduce((s, b) => s + b.monto_retencion, 0),
      liquido: vigentes.reduce((s, b) => s + b.monto_liquido, 0),
    },
  };
}

export function tablaHonorarios(tipo: "recibidas" | "emitidas", boletas: Boleta[], empresa: { razon_social: string; rut: string }, p: Periodo): TablaExport {
  const vig = boletas.filter((b) => b.estado === "vigente");
  return {
    titulo: `Libro de honorarios (${tipo}) · ${nombrePeriodo(p)}`,
    subtitulo: `${empresa.razon_social} · RUT ${formatearRut(empresa.rut)}`,
    columnas: [
      { titulo: "N° boleta", ancho: 10 }, { titulo: "Fecha", ancho: 11 }, { titulo: tipo === "recibidas" ? "RUT emisor" : "RUT receptor", ancho: 13 },
      { titulo: "Nombre", ancho: 30 }, { titulo: "Estado", ancho: 10 }, { titulo: "Bruto", tipo: "monto" }, { titulo: "Retención", tipo: "monto" }, { titulo: "Líquido", tipo: "monto" },
    ],
    filas: boletas.map((b) => [b.folio, f(b.fecha), formatearRut(b.rut_contraparte), b.nombre, b.estado === "vigente" ? "Vigente" : "Anulada", b.monto_bruto, b.monto_retencion, b.monto_liquido]),
    totales: ["", "", "", `${vig.length} boletas vigentes`, "Totales", vig.reduce((s, b) => s + b.monto_bruto, 0), vig.reduce((s, b) => s + b.monto_retencion, 0), vig.reduce((s, b) => s + b.monto_liquido, 0)],
    pie: "Las boletas anuladas se muestran pero no suman.",
  };
}
