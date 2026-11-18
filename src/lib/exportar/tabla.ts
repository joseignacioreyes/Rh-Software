import "server-only";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { formatoPesos } from "@/lib/formato";

// Exportación de una tabla a Excel, CSV (punto y coma) o PDF, generada en el servidor.

export type ColumnaExport = { titulo: string; tipo?: "texto" | "monto" | "numero"; ancho?: number };
export type TablaExport = {
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaExport[];
  filas: (string | number | null)[][];
  totales?: (string | number | null)[];
  pie?: string;
};

export async function aExcel(t: TablaExport): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "RH Software";
  const hoja = libro.addWorksheet(t.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  hoja.addRow([t.titulo]).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
  if (t.subtitulo) hoja.addRow([t.subtitulo]).font = { color: { argb: "FF4B5563" } };
  hoja.addRow([]);
  const cab = hoja.addRow(t.columnas.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }));
  t.filas.forEach((f) => hoja.addRow(f));
  if (t.totales) hoja.addRow(t.totales).font = { bold: true };
  if (t.pie) {
    hoja.addRow([]);
    hoja.addRow([t.pie]).font = { italic: true, color: { argb: "FF4B5563" } };
  }
  t.columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1);
    col.width = c.ancho ?? (c.tipo === "monto" ? 15 : 22);
    if (c.tipo === "monto") col.numFmt = "#,##0;-#,##0";
  });
  hoja.views = [{ state: "frozen", ySplit: t.subtitulo ? 4 : 3 }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** CSV separado por punto y coma, UTF-8 con BOM (Excel lo abre bien). Montos sin separador de miles. */
export function aCsv(t: TablaExport, conBom = true): Buffer {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [t.columnas.map((c) => esc(c.titulo)).join(";"), ...t.filas.map((f) => f.map(esc).join(";"))];
  return Buffer.from((conBom ? "﻿" : "") + lineas.join("\r\n") + "\r\n", "utf8");
}

/** PDF horizontal con encabezado de marca, tabla y totales. */
export function aPdf(t: TablaExport): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 32, bufferPages: true, info: { Title: t.titulo, Producer: "RH Software" } });
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => resolver(Buffer.concat(partes)));
    doc.on("error", rechazar);

    const ancho = doc.page.width - 64;
    const pesos = t.columnas.map((c) => c.ancho ?? (c.tipo === "monto" ? 12 : 18));
    const suma = pesos.reduce((a, b) => a + b, 0);
    const anchos = pesos.map((p) => (p / suma) * ancho);
    const fmt = (v: string | number | null, c: ColumnaExport) =>
      v === null || v === undefined || v === "" ? "" : c.tipo === "monto" && typeof v === "number" ? formatoPesos(v) : c.tipo === "numero" && typeof v === "number" ? v.toLocaleString("es-CL") : String(v);

    const encabezado = () => {
      doc.fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(13).text(t.titulo, 32, 32, { width: ancho });
      if (t.subtitulo) doc.fillColor("#4B5563").font("Helvetica").fontSize(9).text(t.subtitulo, { width: ancho });
      doc.moveDown(0.6);
      const y = doc.y;
      doc.rect(32, y, ancho, 16).fill("#1E3A8A");
      let x = 32;
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.5);
      t.columnas.forEach((c, i) => {
        doc.text(c.titulo, x + 3, y + 4, { width: anchos[i] - 6, align: c.tipo && c.tipo !== "texto" ? "right" : "left", lineBreak: false, ellipsis: true, height: 9 });
        x += anchos[i];
      });
      doc.y = y + 18;
    };
    const fila = (valores: (string | number | null)[], negrita = false, fondo?: string) => {
      if (doc.y > doc.page.height - 50) {
        doc.addPage();
        encabezado();
      }
      const y = doc.y;
      if (fondo) doc.rect(32, y - 1, ancho, 13).fill(fondo);
      let x = 32;
      doc.fillColor("#111827").font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(7.5);
      t.columnas.forEach((c, i) => {
        doc.text(fmt(valores[i] ?? null, c), x + 3, y + 2, { width: anchos[i] - 6, align: c.tipo && c.tipo !== "texto" ? "right" : "left", lineBreak: false, ellipsis: true, height: 9 });
        x += anchos[i];
      });
      doc.y = y + 13;
    };

    encabezado();
    t.filas.forEach((f, i) => fila(f, false, i % 2 ? "#F9FAFB" : undefined));
    if (t.totales) {
      doc.moveTo(32, doc.y).lineTo(32 + ancho, doc.y).strokeColor("#111827").lineWidth(0.8).stroke();
      doc.y += 2;
      fila(t.totales, true);
    }
    if (t.pie) {
      doc.moveDown(0.8);
      doc.fillColor("#4B5563").font("Helvetica-Oblique").fontSize(7.5).text(t.pie, 32, doc.y, { width: ancho });
    }
    // Pie de página con número de página.
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#9CA3AF").font("Helvetica").fontSize(7)
        .text(`RH Software · Página ${i + 1} de ${rango.count}`, 32, doc.page.height - 24, { width: ancho, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

export const hashContenido = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export const TIPOS_CONTENIDO = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
} as const;
