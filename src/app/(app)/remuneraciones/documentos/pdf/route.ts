import { NextResponse, type NextRequest } from "next/server";
import { obtenerContexto, permiso, NOMBRES_MES } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { pdfDocumento, type Bloque } from "@/lib/pdf/documento";
import { CAUSALES, type ResultadoFiniquito } from "@/lib/finiquito";
import { formatearRut } from "@/lib/rut";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { hashContenido } from "@/lib/exportar/tabla";

const CONTRATO: Record<string, string> = { indefinido: "indefinido", plazo_fijo: "a plazo fijo", obra: "por obra o faena" };
const f = (iso: string | null) => (iso ? formatoFecha(new Date(`${iso}T12:00:00-04:00`)) : "—");

/**
 * Documentos laborales en PDF, completados con los datos de la ficha:
 * contrato, anexo, carta de aviso de término, finiquito, certificado de remuneraciones y de cotizaciones.
 * Todos salen como BORRADOR: el contador los revisa antes de usarlos.
 */
export async function GET(request: NextRequest) {
  const ctx = await obtenerContexto();
  const p = request.nextUrl.searchParams;
  const tipo = p.get("tipo") ?? "";
  const supabase = await clienteServidor();

  let trabajadorId = p.get("trabajador");
  let finiquito: { fecha_termino: string; causal: number; total: number; detalle: ResultadoFiniquito; estado: string; revisado_por: string | null } | null = null;
  if (tipo === "finiquito") {
    const { data } = await supabase.from("finiquitos").select("trabajador_id, fecha_termino, causal, total, detalle, estado, revisado_por").eq("id", p.get("id") ?? "").maybeSingle();
    if (!data) return NextResponse.json({ error: "Finiquito no encontrado" }, { status: 404 });
    trabajadorId = data.trabajador_id;
    finiquito = { ...data, total: Number(data.total), detalle: data.detalle as ResultadoFiniquito };
  }
  const { data: t } = await supabase.from("trabajadores").select("*, empresas(razon_social, rut, direccion, comuna, representante_legal, rut_representante, giro)").eq("id", trabajadorId ?? "").maybeSingle();
  if (!t || !permiso(ctx, t.empresa_id, "remuneraciones").ver) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const e = t.empresas as { razon_social: string; rut: string; direccion: string | null; comuna: string | null; representante_legal: string | null; rut_representante: string | null; giro: string | null };
  const nombre = `${t.nombres} ${t.apellido_paterno} ${t.apellido_materno ?? ""}`.trim();
  const partes = `${e.razon_social}, RUT ${formatearRut(e.rut)}, representada por ${e.representante_legal ?? "[representante legal]"}${e.rut_representante ? `, RUT ${formatearRut(e.rut_representante)}` : ""}, con domicilio en ${e.direccion ?? "[dirección]"}${e.comuna ? `, ${e.comuna}` : ""}, en adelante "el empleador", y don(ña) ${nombre}, RUT ${formatearRut(t.rut)}, de nacionalidad ${t.nacionalidad ?? "chilena"}, nacido(a) el ${f(t.fecha_nacimiento)}, domiciliado(a) en ${t.direccion ?? "[dirección]"}${t.comuna ? `, ${t.comuna}` : ""}, en adelante "el trabajador"`;
  const anio = Number(p.get("anio")) || ctx.periodo.anio;
  let titulo = "";
  let bloques: Bloque[] = [];
  let firmas = ["Empleador", "Trabajador"];

  if (tipo === "contrato") {
    titulo = `Contrato de trabajo ${CONTRATO[t.tipo_contrato]}`;
    bloques = [
      { tipo: "parrafo", texto: `En ${e.comuna ?? "[ciudad]"}, a ${f(t.fecha_ingreso)}, entre ${partes}, se ha convenido el siguiente contrato de trabajo:` },
      { tipo: "titulo", texto: "Primero: naturaleza de los servicios" },
      { tipo: "parrafo", texto: `El trabajador se compromete a desempeñar el cargo de ${t.cargo ?? "[cargo]"}, en las dependencias del empleador ubicadas en ${e.direccion ?? "[lugar de trabajo]"}.` },
      { tipo: "titulo", texto: "Segundo: jornada de trabajo" },
      { tipo: "parrafo", texto: `La jornada ordinaria será de ${Number(t.jornada_horas).toLocaleString("es-CL")} horas semanales, distribuida de [días y horario], con [tiempo] de colación no imputable a la jornada.` },
      { tipo: "titulo", texto: "Tercero: remuneración" },
      { tipo: "parrafo", texto: `El empleador pagará un sueldo base mensual de ${formatoPesos(Number(t.sueldo_base))}${t.gratificacion === "art50_mensual" ? ", más gratificación legal conforme al artículo 50 del Código del Trabajo, pagada mensualmente con el tope legal" : ""}${Number(t.colacion) ? `, asignación de colación de ${formatoPesos(Number(t.colacion))}` : ""}${Number(t.movilizacion) ? ` y asignación de movilización de ${formatoPesos(Number(t.movilizacion))}` : ""}. La remuneración se pagará por mes vencido mediante ${t.forma_pago}.` },
      { tipo: "titulo", texto: "Cuarto: duración" },
      { tipo: "parrafo", texto: t.tipo_contrato === "indefinido" ? `El presente contrato es de duración indefinida, y el trabajador ingresó a prestar servicios el ${f(t.fecha_ingreso)}.` : `El presente contrato durará hasta el ${f(t.fecha_termino)}, contado desde el ${f(t.fecha_ingreso)}.` },
      { tipo: "titulo", texto: "Quinto: previsión y salud" },
      { tipo: "parrafo", texto: "El trabajador declara estar afiliado a la AFP y al sistema de salud que informa en su ficha, para los descuentos legales correspondientes." },
      { tipo: "parrafo", texto: "El presente contrato se firma en dos ejemplares, quedando uno en poder de cada parte. [Agregar cláusulas especiales: obligaciones, prohibiciones, reglamento interno, etc.]" },
    ];
  } else if (tipo === "anexo") {
    titulo = "Anexo de contrato de trabajo";
    const texto = (p.get("texto") ?? "").slice(0, 2000) || "[Describir la modificación acordada: cambio de remuneración, jornada, cargo u otra.]";
    bloques = [
      { tipo: "parrafo", texto: `En ${e.comuna ?? "[ciudad]"}, a ${formatoFecha(new Date())}, entre ${partes}, se acuerda modificar el contrato de trabajo de fecha ${f(t.fecha_ingreso)}, en lo siguiente:` },
      { tipo: "parrafo", texto: texto },
      { tipo: "parrafo", texto: "En todo lo no modificado, se mantienen vigentes las cláusulas del contrato original." },
    ];
  } else if (tipo === "carta_aviso") {
    const causal = CAUSALES.find((c) => c.codigo === Number(p.get("causal"))) ?? CAUSALES[7];
    titulo = "Carta de aviso de término de contrato";
    bloques = [
      { tipo: "parrafo", texto: `${e.comuna ?? "[ciudad]"}, ${formatoFecha(new Date())}` },
      { tipo: "parrafo", texto: `Señor(a) ${nombre}\nRUT ${formatearRut(t.rut)}\n${t.direccion ?? "[dirección]"}` },
      { tipo: "parrafo", texto: `De nuestra consideración: por medio de la presente, comunicamos a usted que se ha resuelto poner término a su contrato de trabajo a contar del ${p.get("fecha") ? f(p.get("fecha")) : "[fecha de término]"}, en virtud de la causal del ${causal.texto}.` },
      { tipo: "parrafo", texto: "Los hechos en que se funda esta decisión son los siguientes: [describir los hechos]." },
      { tipo: "parrafo", texto: "Le informamos que sus cotizaciones previsionales se encuentran pagadas hasta el último día del mes anterior al término, según consta en los certificados adjuntos. Copia de esta carta se enviará a la Inspección del Trabajo dentro del plazo legal." },
      { tipo: "parrafo", texto: "Saluda atentamente," },
    ];
    firmas = ["Empleador", "Recibí copia (trabajador)"];
  } else if (tipo === "finiquito" && finiquito) {
    const causal = CAUSALES.find((c) => c.codigo === finiquito!.causal);
    titulo = "Finiquito de contrato de trabajo";
    bloques = [
      { tipo: "parrafo", texto: `En ${e.comuna ?? "[ciudad]"}, a [fecha], entre ${partes}, se deja constancia de lo siguiente:` },
      { tipo: "parrafo", texto: `Primero: el trabajador prestó servicios desde el ${f(t.fecha_ingreso)} hasta el ${f(finiquito.fecha_termino)}, fecha en que terminó su contrato por la causal del ${causal?.texto ?? "[causal]"}.` },
      { tipo: "parrafo", texto: "Segundo: el empleador paga al trabajador los siguientes montos:" },
      { tipo: "tabla", columnas: ["Concepto", "Monto"], filas: finiquito.detalle.lineas.map((l) => [l.concepto, l.monto]), montos: [1], totales: ["Total a pagar", finiquito.total] },
      { tipo: "parrafo", texto: "Tercero: el trabajador declara recibir a su entera satisfacción la suma indicada y que nada se le adeuda por concepto alguno derivado de la relación laboral, sin perjuicio de las reservas que estime pertinentes." },
      { tipo: "parrafo", texto: "El presente finiquito debe ser ratificado ante un ministro de fe." },
    ];
    firmas = ["Empleador", "Trabajador", "Ministro de fe"];
  } else if (tipo === "cert_remuneraciones" || tipo === "cert_cotizaciones") {
    const { data: liqs } = await supabase.from("liquidaciones").select("mes, total_imponible, base_tributable, impuesto_unico, liquido, cotizacion_afp, cotizacion_salud, cotizacion_afc, renta_imponible_afp, estado").eq("trabajador_id", t.id).eq("anio", anio).neq("estado", "anulada").order("mes");
    const lista = liqs ?? [];
    if (tipo === "cert_remuneraciones") {
      titulo = `Certificado de remuneraciones ${anio}`;
      bloques = [
        { tipo: "parrafo", texto: `${e.razon_social}, RUT ${formatearRut(e.rut)}, certifica que don(ña) ${nombre}, RUT ${formatearRut(t.rut)}, percibió durante el año ${anio} las siguientes remuneraciones:` },
        {
          tipo: "tabla", columnas: ["Mes", "Renta imponible", "Base tributable", "Impuesto único", "Líquido"], montos: [1, 2, 3, 4],
          filas: lista.map((l) => [NOMBRES_MES[l.mes - 1], Number(l.total_imponible), Number(l.base_tributable), Number(l.impuesto_unico), Number(l.liquido)]),
          totales: ["Total", ...(["total_imponible", "base_tributable", "impuesto_unico", "liquido"] as const).map((k) => lista.reduce((s, l) => s + Number(l[k]), 0))],
        },
        { tipo: "parrafo", texto: "Montos sin reajustar. Para la Declaración Jurada 1887 y el certificado N°6 del SII deben aplicarse los factores de actualización publicados por el SII (fase posterior)." },
      ];
    } else {
      titulo = `Certificado de cotizaciones ${anio}`;
      bloques = [
        { tipo: "parrafo", texto: `${e.razon_social}, RUT ${formatearRut(e.rut)}, certifica que respecto de don(ña) ${nombre}, RUT ${formatearRut(t.rut)}, se declararon las siguientes cotizaciones previsionales durante ${anio}:` },
        {
          tipo: "tabla", columnas: ["Mes", "Renta imponible", "AFP", "Salud", "Seguro cesantía"], montos: [1, 2, 3, 4],
          filas: lista.map((l) => [NOMBRES_MES[l.mes - 1], Number(l.renta_imponible_afp), Number(l.cotizacion_afp), Number(l.cotizacion_salud), Number(l.cotizacion_afc)]),
        },
        { tipo: "parrafo", texto: "El pago efectivo de las cotizaciones se acredita con los comprobantes de Previred de cada mes." },
      ];
    }
    firmas = ["Empleador"];
  } else {
    return NextResponse.json({ error: "Tipo de documento no válido" }, { status: 400 });
  }

  const pdf = await pdfDocumento({ titulo, empresa: e, bloques, firmas, borrador: !(tipo === "finiquito" && finiquito?.estado !== "borrador") });
  await supabase.from("archivos_generados").insert({
    estudio_id: t.estudio_id, empresa_id: t.empresa_id, tipo: `documento_${tipo}`, anio, nombre_archivo: `${tipo}_${t.rut}.pdf`,
    hash_contenido: hashContenido(pdf), tamano: pdf.length, resumen: { trabajador: t.id },
  });
  return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${tipo}_${t.rut}.pdf"` } });
}
