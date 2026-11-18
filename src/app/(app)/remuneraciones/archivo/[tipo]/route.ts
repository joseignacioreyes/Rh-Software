import { NextResponse, type NextRequest } from "next/server";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { construirArchivo, datosArchivosMes, registrarArchivo } from "@/lib/servicios/archivos-legales";

/** Descarga del archivo Previred o LRE del mes. Solo si pasa la validación campo por campo. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (tipo !== "previred" && tipo !== "lre") return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "remuneraciones").editar) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const supabase = await clienteServidor();
  const r = await datosArchivosMes(supabase, ctx.empresa.id, ctx.periodo);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const a = construirArchivo(tipo, r.datos);
  if (a.validacion.errores.length) {
    return NextResponse.json({ error: "El archivo tiene errores de validación. Corrígelos antes de descargarlo.", errores: a.validacion.errores }, { status: 422 });
  }
  // El SII y la DT trabajan con Latin-1; Previred acepta texto plano.
  const contenido = Buffer.from(a.contenido, "latin1");
  await registrarArchivo(supabase, { estudioId: ctx.estudio!.id, empresaId: ctx.empresa.id, tipo, periodo: ctx.periodo, nombre: a.nombre, contenido, version: r.version, validacion: a.validacion });
  await supabase.rpc("registrar_evento", { p_accion: "exportacion", p_estudio: ctx.estudio!.id, p_empresa: ctx.empresa.id, p_detalle: { que: tipo, periodo: ctx.periodo } });
  return new NextResponse(new Uint8Array(contenido), {
    headers: { "content-type": "text/plain; charset=iso-8859-1", "content-disposition": `attachment; filename="${a.nombre}"` },
  });
}
