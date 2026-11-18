import "server-only";
import PDFDocument from "pdfkit";
import { formatearRut } from "@/lib/rut";
import { formatoFecha, formatoPesos } from "@/lib/formato";

export type Bloque =
  | { tipo: "parrafo"; texto: string; negrita?: boolean }
  | { tipo: "titulo"; texto: string }
  | { tipo: "tabla"; columnas: string[]; filas: (string | number)[][]; montos?: number[]; totales?: (string | number)[] }
  | { tipo: "espacio" };

/**
 * Documento laboral en PDF (contrato, anexo, carta de aviso, finiquito, certificados).
 * Todos llevan la marca "BORRADOR: revisión del contador obligatoria" hasta que se revisen.
 */
export function pdfDocumento(d: {
  titulo: string;
  empresa: { razon_social: string; rut: string; direccion?: string | null; comuna?: string | null };
  bloques: Bloque[];
  firmas?: string[];
  borrador?: boolean;
}): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 56, bufferPages: true, info: { Title: d.titulo, Producer: "RH Software" } });
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => resolver(Buffer.concat(partes)));
    doc.on("error", rechazar);
    const ancho = doc.page.width - 112;

    doc.fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(12).text(d.empresa.razon_social, 56, 50);
    doc.fillColor("#4B5563").font("Helvetica").fontSize(8.5).text(`RUT ${formatearRut(d.empresa.rut)}${d.empresa.direccion ? ` · ${d.empresa.direccion}` : ""}${d.empresa.comuna ? `, ${d.empresa.comuna}` : ""}`);
    if (d.borrador !== false) {
      doc.fillColor("#D97706").font("Helvetica-Bold").fontSize(8.5).text("BORRADOR: revisión del contador obligatoria antes de usar", 56, 50, { width: ancho, align: "right" });
    }
    doc.moveDown(2);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text(d.titulo.toUpperCase(), 56, doc.y, { width: ancho, align: "center" });
    doc.moveDown(1.2);

    for (const b of d.bloques) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      if (b.tipo === "titulo") {
        doc.moveDown(0.4).fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(10.5).text(b.texto, 56, doc.y, { width: ancho });
        doc.moveDown(0.3);
      } else if (b.tipo === "parrafo") {
        doc.fillColor("#111827").font(b.negrita ? "Helvetica-Bold" : "Helvetica").fontSize(10).text(b.texto, 56, doc.y, { width: ancho, align: "justify", lineGap: 2 });
        doc.moveDown(0.6);
      } else if (b.tipo === "espacio") {
        doc.moveDown(1);
      } else {
        const n = b.columnas.length;
        const anchos = b.columnas.map((_, i) => (i === 0 ? ancho * 0.4 : (ancho * 0.6) / (n - 1)));
        const fila = (valores: (string | number)[], negrita = false, fondo?: string) => {
          if (doc.y > doc.page.height - 80) doc.addPage();
          const y = doc.y;
          if (fondo) doc.rect(56, y - 2, ancho, 14).fill(fondo);
          let x = 56;
          valores.forEach((v, i) => {
            const esMonto = b.montos?.includes(i) && typeof v === "number";
            doc.fillColor(fondo === "#1E3A8A" ? "#FFFFFF" : "#111827").font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
              .text(esMonto ? formatoPesos(v as number) : String(v), x + 3, y + 1, { width: anchos[i] - 6, align: i === 0 ? "left" : "right", lineBreak: false, ellipsis: true, height: 10 });
            x += anchos[i];
          });
          doc.y = y + 14;
        };
        fila(b.columnas, true, "#1E3A8A");
        b.filas.forEach((f, i) => fila(f, false, i % 2 ? "#F9FAFB" : undefined));
        if (b.totales) fila(b.totales, true, "#DBEAFE");
        doc.moveDown(0.8);
      }
    }

    if (d.firmas?.length) {
      const yf = Math.max(doc.y + 70, doc.page.height - 150);
      if (yf > doc.page.height - 80) doc.addPage();
      const y = Math.min(yf, doc.page.height - 110);
      const w = ancho / d.firmas.length;
      d.firmas.forEach((f, i) => {
        const x = 56 + i * w;
        doc.moveTo(x + 20, y).lineTo(x + w - 20, y).strokeColor("#111827").lineWidth(0.6).stroke();
        doc.fillColor("#111827").font("Helvetica").fontSize(8.5).text(f, x + 10, y + 4, { width: w - 20, align: "center" });
      });
    }
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#9CA3AF").font("Helvetica").fontSize(7).text(`Generado por RH Software el ${formatoFecha(new Date())} · Página ${i + 1} de ${rango.count}`, 56, doc.page.height - 36, { width: ancho, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
