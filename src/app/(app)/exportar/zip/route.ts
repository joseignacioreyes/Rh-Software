import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { obtenerContexto, permiso, NOMBRES_MES } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { aExcel, hashContenido, TIPOS_CONTENIDO } from "@/lib/exportar/tabla";
import { cargarHonorarios, cargarLibro, tablaHonorarios, tablaLibro } from "@/lib/libros";
import { cargarCuentas } from "@/lib/contexto-contable";
import { balanceOchoColumnas, NOMBRE_TIPO, type Sumas } from "@/lib/contabilidad";
import { formatoFecha } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";

/** Exportación completa de una empresa: todos sus libros de un año en un ZIP (respaldo o cambio de contador). */
export async function GET(request: NextRequest) {
  const ctx = await obtenerContexto();
  const empresa = ctx.empresa;
  if (!empresa) return NextResponse.json({ error: "Elige una empresa" }, { status: 400 });
  const verLibros = permiso(ctx, empresa.id, "libros").ver;
  const verConta = permiso(ctx, empresa.id, "contabilidad").ver;
  if (!verLibros && !verConta) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const anio = Number(request.nextUrl.searchParams.get("anio")) || ctx.periodo.anio;
  const supabase = await clienteServidor();
  const zip = new JSZip();
  const raiz = zip.folder(`${empresa.rut}_${anio}`)!;
  const indice: string[] = [`RH Software · Exportación completa`, `Empresa: ${empresa.razon_social} (${formatearRut(empresa.rut)})`, `Año: ${anio}`, `Generado: ${new Date().toISOString()}`, ""];

  if (verLibros) {
    for (let mes = 1; mes <= 12; mes++) {
      const p = { anio, mes };
      const carpeta = `libros/${String(mes).padStart(2, "0")}-${NOMBRES_MES[mes - 1].toLowerCase()}`;
      for (const libro of ["compras", "ventas"] as const) {
        const { docs } = await cargarLibro(supabase, empresa.id, libro, p);
        if (docs.length) {
          raiz.file(`${carpeta}/libro_${libro}.xlsx`, await aExcel(tablaLibro(libro, docs, empresa, p)));
          indice.push(`${carpeta}/libro_${libro}.xlsx: ${docs.length} documentos`);
        }
      }
      for (const tipo of ["recibidas", "emitidas"] as const) {
        const { boletas } = await cargarHonorarios(supabase, empresa.id, tipo, p);
        if (boletas.length) {
          raiz.file(`${carpeta}/honorarios_${tipo}.xlsx`, await aExcel(tablaHonorarios(tipo, boletas, empresa, p)));
          indice.push(`${carpeta}/honorarios_${tipo}.xlsx: ${boletas.length} boletas`);
        }
      }
    }
  }

  if (verConta) {
    const cuentas = await cargarCuentas(supabase, empresa.id);
    const porId = new Map(cuentas.map((c) => [c.id, c]));
    raiz.file("contabilidad/plan_de_cuentas.xlsx", await aExcel({
      titulo: "Plan de cuentas", subtitulo: empresa.razon_social,
      columnas: [{ titulo: "Código" }, { titulo: "Nombre", ancho: 40 }, { titulo: "Tipo" }, { titulo: "Imputable" }, { titulo: "Activa" }],
      filas: cuentas.map((c) => [c.codigo, c.nombre, NOMBRE_TIPO[c.tipo], c.imputable ? "Sí" : "No", c.activa ? "Sí" : "No"]),
    }));
    const { data: comprobantes } = await supabase
      .from("comprobantes")
      .select("numero, tipo, fecha, glosa, estado, lineas_comprobante(orden, cuenta_id, glosa, debe, haber)")
      .eq("empresa_id", empresa.id).eq("anio", anio).order("fecha").order("numero");
    type C = { numero: number; tipo: string; fecha: string; glosa: string; estado: string; lineas_comprobante: { orden: number; cuenta_id: string; glosa: string | null; debe: number; haber: number }[] };
    const filas = ((comprobantes ?? []) as C[]).flatMap((c) =>
      c.lineas_comprobante.sort((a, b) => a.orden - b.orden).map((l) => [
        formatoFecha(new Date(`${c.fecha}T12:00:00-04:00`)), c.numero, c.tipo, c.estado, porId.get(l.cuenta_id)?.codigo ?? "", porId.get(l.cuenta_id)?.nombre ?? "", l.glosa ?? c.glosa, l.debe || null, l.haber || null,
      ]),
    );
    raiz.file("contabilidad/libro_diario.xlsx", await aExcel({
      titulo: `Libro diario ${anio}`, subtitulo: empresa.razon_social,
      columnas: [{ titulo: "Fecha" }, { titulo: "N°", tipo: "numero" }, { titulo: "Tipo" }, { titulo: "Estado" }, { titulo: "Código" }, { titulo: "Cuenta", ancho: 32 }, { titulo: "Glosa", ancho: 40 }, { titulo: "Debe", tipo: "monto" }, { titulo: "Haber", tipo: "monto" }],
      filas,
    }));
    indice.push(`contabilidad/libro_diario.xlsx: ${comprobantes?.length ?? 0} comprobantes`);
    const { data: sumas } = await supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: `${anio}-01-01`, p_hasta: `${anio}-12-31` });
    const b = balanceOchoColumnas(cuentas, (sumas ?? []) as Sumas[]);
    raiz.file("contabilidad/balance_8_columnas.xlsx", await aExcel({
      titulo: `Balance de 8 columnas ${anio}`, subtitulo: empresa.razon_social,
      columnas: [{ titulo: "Código" }, { titulo: "Cuenta", ancho: 34 }, ...["Débitos", "Créditos", "Deudor", "Acreedor", "Activo", "Pasivo", "Pérdidas", "Ganancias"].map((t) => ({ titulo: t, tipo: "monto" as const }))],
      filas: b.filas.map((f) => [f.codigo, f.nombre, f.debitos, f.creditos, f.deudor || null, f.acreedor || null, f.activo || null, f.pasivo || null, f.perdidas || null, f.ganancias || null]),
      totales: ["", "Totales", b.totales.debitos, b.totales.creditos, b.totales.deudor, b.totales.acreedor, b.totales.activo, b.totales.pasivo, b.totales.perdidas, b.totales.ganancias],
    }));
  }
  raiz.file("LEEME.txt", indice.join("\r\n"));
  const contenido = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const nombre = `rhsoftware_${empresa.rut}_${anio}.zip`;
  await supabase.from("archivos_generados").insert({
    estudio_id: ctx.estudio!.id, empresa_id: empresa.id, tipo: "zip_anual", anio, nombre_archivo: nombre,
    hash_contenido: hashContenido(contenido), tamano: contenido.length,
  });
  return new NextResponse(new Uint8Array(contenido), { headers: { "content-type": TIPOS_CONTENIDO.zip, "content-disposition": `attachment; filename="${nombre}"` } });
}
