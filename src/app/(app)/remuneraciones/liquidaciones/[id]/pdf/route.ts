import { NextResponse, type NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import { obtenerContexto, permiso, esCliente, NOMBRES_MES } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { hashContenido } from "@/lib/exportar/tabla";

/** Liquidación en PDF (art. 54 del Código del Trabajo: detalle de haberes y descuentos), lista para firmar. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data: l } = await supabase
    .from("liquidaciones")
    .select("*, trabajadores(nombres, apellido_paterno, apellido_materno, rut, cargo, fecha_ingreso, tipo_contrato, afp, salud), empresas(razon_social, rut, direccion, comuna, representante_legal)")
    .eq("id", id)
    .maybeSingle();
  // El cliente (portal) solo llega a liquidaciones aprobadas: lo asegura la base de datos (RLS).
  if (!l || (!permiso(ctx, l.empresa_id, "remuneraciones").ver && !esCliente(ctx, l.empresa_id))) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const { data: items } = await supabase.from("items_liquidacion").select("nombre, tipo, monto").eq("liquidacion_id", id).order("orden");
  const t = l.trabajadores as Record<string, string | null>;
  const e = l.empresas as Record<string, string | null>;
  const periodo = `${NOMBRES_MES[l.mes - 1]} ${l.anio}`;

  const pdf = await new Promise<Buffer>((resolver, rechazar) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48, info: { Title: `Liquidación ${periodo} ${t.nombres} ${t.apellido_paterno}`, Producer: "RH Software" } });
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => resolver(Buffer.concat(partes)));
    doc.on("error", rechazar);
    const ancho = doc.page.width - 96;

    // Encabezado con los datos de la empresa cliente (su logo se agregará cuando se cargue en la ficha).
    doc.fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(14).text(e.razon_social ?? "", 48, 48);
    doc.fillColor("#4B5563").font("Helvetica").fontSize(9).text(`RUT ${formatearRut(e.rut ?? "")}${e.direccion ? ` · ${e.direccion}` : ""}${e.comuna ? `, ${e.comuna}` : ""}`);
    doc.moveDown(0.8);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text(`LIQUIDACIÓN DE SUELDO · ${periodo.toUpperCase()}`, { align: "center" });
    doc.moveDown(0.6);

    const dato = (k: string, v: string, x: number, y: number) => {
      doc.font("Helvetica").fontSize(8).fillColor("#4B5563").text(k, x, y);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#111827").text(v, x, y + 10, { width: ancho / 3 - 8 });
    };
    const y0 = doc.y;
    dato("Trabajador", `${t.nombres} ${t.apellido_paterno} ${t.apellido_materno ?? ""}`, 48, y0);
    dato("RUT", formatearRut(t.rut ?? ""), 48 + ancho / 3, y0);
    dato("Cargo", t.cargo ?? "—", 48 + (2 * ancho) / 3, y0);
    dato("Fecha de ingreso", formatoFecha(new Date(`${t.fecha_ingreso}T12:00:00-04:00`)), 48, y0 + 30);
    dato("Días trabajados", String(l.dias_trabajados), 48 + ancho / 3, y0 + 30);
    dato("Renta imponible", formatoPesos(Number(l.renta_imponible_afp)), 48 + (2 * ancho) / 3, y0 + 30);
    doc.y = y0 + 66;

    const bloque = (titulo: string, tipos: string[], total?: [string, number]) => {
      const filas = (items ?? []).filter((i) => tipos.includes(i.tipo) && Number(i.monto) !== 0);
      if (!filas.length && !total) return;
      doc.rect(48, doc.y, ancho, 15).fill("#1E3A8A");
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(titulo, 54, doc.y + 4);
      doc.y += 13;
      for (const f of filas) {
        const y = doc.y + 3;
        doc.fillColor("#111827").font("Helvetica").fontSize(9).text(f.nombre, 54, y, { width: ancho - 140 });
        doc.text(formatoPesos(Number(f.monto)), 48 + ancho - 130, y, { width: 124, align: "right" });
        doc.y = y + 12;
      }
      if (total) {
        doc.moveTo(48, doc.y + 2).lineTo(48 + ancho, doc.y + 2).strokeColor("#D1D5DB").lineWidth(0.5).stroke();
        const y = doc.y + 5;
        doc.font("Helvetica-Bold").text(total[0], 54, y);
        doc.text(formatoPesos(total[1]), 48 + ancho - 130, y, { width: 124, align: "right" });
        doc.y = y + 14;
      }
      doc.moveDown(0.4);
    };
    bloque("HABERES IMPONIBLES", ["haber_imponible"], ["Total imponible", Number(l.total_imponible)]);
    bloque("HABERES NO IMPONIBLES", ["haber_no_imponible"], ["Total no imponible", Number(l.total_no_imponible)]);
    bloque("DESCUENTOS", ["descuento_legal", "descuento_otro"], ["Total descuentos", Number(l.total_descuentos)]);

    const y = doc.y + 4;
    doc.rect(48, y, ancho, 26).fill("#ECFDF5");
    doc.fillColor("#059669").font("Helvetica-Bold").fontSize(12).text("LÍQUIDO A PAGAR", 56, y + 8);
    doc.text(formatoPesos(Number(l.liquido)), 48 + ancho - 180, y + 8, { width: 172, align: "right" });
    doc.y = y + 40;

    doc.fillColor("#4B5563").font("Helvetica").fontSize(8).text(
      `Aportes del empleador (no descontados): ${formatoPesos(Number(l.aportes_empleador))}. Costo empresa: ${formatoPesos(Number(l.costo_empresa))}.`,
      48, doc.y, { width: ancho },
    );
    doc.moveDown(0.5);
    doc.text("Certifico que he recibido de mi empleador, a mi entera satisfacción, el saldo líquido indicado en la presente liquidación, sin cargo ni cobro posterior alguno que hacer.", { width: ancho });

    const yf = Math.max(doc.y + 60, 660);
    doc.moveTo(80, yf).lineTo(260, yf).moveTo(352, yf).lineTo(532, yf).strokeColor("#111827").lineWidth(0.6).stroke();
    doc.fillColor("#111827").fontSize(8.5).text("Firma del empleador", 80, yf + 4, { width: 180, align: "center" });
    doc.text("Firma del trabajador", 352, yf + 4, { width: 180, align: "center" });
    doc.fillColor("#9CA3AF").fontSize(7).text(`Generado por RH Software el ${formatoFecha(new Date())} · Versión de datos ${l.version_datos}`, 48, doc.page.height - 40, { width: ancho, align: "center" });
    doc.end();
  });

  await supabase.from("archivos_generados").insert({
    estudio_id: l.estudio_id, empresa_id: l.empresa_id, tipo: "liquidacion_pdf", anio: l.anio, mes: l.mes,
    nombre_archivo: `liquidacion_${t.rut}_${l.anio}${String(l.mes).padStart(2, "0")}.pdf`, hash_contenido: hashContenido(pdf), tamano: pdf.length,
    resumen: { liquidacion_id: id },
  });
  await supabase.rpc("registrar_evento", { p_accion: "descargar_liquidacion", p_estudio: l.estudio_id, p_empresa: l.empresa_id, p_detalle: { liquidacion: id } });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="liquidacion_${t.rut}_${l.anio}${String(l.mes).padStart(2, "0")}.pdf"` },
  });
}
