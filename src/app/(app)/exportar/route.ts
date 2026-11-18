import { NextResponse, type NextRequest } from "next/server";
import { obtenerContexto, permiso, leerPeriodo, esCliente, type Modulo } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { aCsv, aExcel, aPdf, hashContenido, TIPOS_CONTENIDO, type TablaExport } from "@/lib/exportar/tabla";
import { cargarHonorarios, cargarLibro, csvImportadorSii, tablaHonorarios, tablaLibro } from "@/lib/libros";

/**
 * Exportación de libros: /exportar?que=compras|ventas|honorarios_recibidas|honorarios_emitidas&formato=xlsx|csv|pdf|sii&periodo=AAAA-MM
 * Cada archivo queda registrado en "archivos generados" con su hash.
 */
export async function GET(request: NextRequest) {
  const ctx = await obtenerContexto();
  const p = request.nextUrl.searchParams;
  const que = p.get("que") ?? "";
  const formato = p.get("formato") ?? "xlsx";
  const periodo = p.get("periodo") ? leerPeriodo(p.get("periodo")!) : ctx.periodo;
  const empresa = ctx.empresa;
  if (!empresa) return NextResponse.json({ error: "Elige una empresa" }, { status: 400 });
  const modulo: Modulo = "libros";
  if (!permiso(ctx, empresa.id, modulo).ver && !esCliente(ctx, empresa.id)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const supabase = await clienteServidor();
  let tabla: TablaExport;
  let contenido: Buffer;
  const sufijo = `${empresa.rut}_${periodo.anio}${String(periodo.mes).padStart(2, "0")}`;
  let nombre: string;

  if (que === "compras" || que === "ventas") {
    const { docs } = await cargarLibro(supabase, empresa.id, que, periodo);
    tabla = tablaLibro(que, docs, empresa, periodo);
    if (formato === "sii") {
      contenido = csvImportadorSii(que, docs);
      nombre = `libro_${que}_importador_sii_${sufijo}.csv`;
    } else {
      contenido = formato === "csv" ? aCsv(tabla) : formato === "pdf" ? await aPdf(tabla) : await aExcel(tabla);
      nombre = `libro_${que}_${sufijo}.${formato}`;
    }
  } else if (que === "honorarios_recibidas" || que === "honorarios_emitidas") {
    const tipo = que === "honorarios_recibidas" ? "recibidas" : "emitidas";
    const { boletas } = await cargarHonorarios(supabase, empresa.id, tipo, periodo);
    tabla = tablaHonorarios(tipo, boletas, empresa, periodo);
    contenido = formato === "csv" ? aCsv(tabla) : formato === "pdf" ? await aPdf(tabla) : await aExcel(tabla);
    nombre = `libro_honorarios_${tipo}_${sufijo}.${formato}`;
  } else {
    return NextResponse.json({ error: "Exportación no reconocida" }, { status: 400 });
  }

  await supabase.from("archivos_generados").insert({
    estudio_id: ctx.estudio!.id, empresa_id: empresa.id, tipo: `libro_${que}_${formato}`, anio: periodo.anio, mes: periodo.mes,
    nombre_archivo: nombre, hash_contenido: hashContenido(contenido), tamano: contenido.length,
    resumen: { filas: tabla.filas.length },
  });

  const tipoContenido = formato === "sii" || formato === "csv" ? TIPOS_CONTENIDO.csv : formato === "pdf" ? TIPOS_CONTENIDO.pdf : TIPOS_CONTENIDO.xlsx;
  return new NextResponse(new Uint8Array(contenido), {
    headers: { "content-type": tipoContenido, "content-disposition": `attachment; filename="${nombre}"` },
  });
}
