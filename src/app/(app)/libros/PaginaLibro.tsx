import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { cargarLibro } from "@/lib/libros";
import { TIPOS_DOCUMENTO, esNotaCredito } from "@/lib/importar/rcv";
import { nombrePeriodo } from "@/lib/sesion";
import { formatoPesos } from "@/lib/formato";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { MenuExportar } from "@/components/ui/MenuExportar";
import { claseBotonPrimario } from "@/components/ui/estilos";
import { ResumenBoletas } from "./ResumenBoletas";

/** Página de un libro (compras o ventas) del periodo elegido. */
export async function PaginaLibro({ libro }: { libro: "compras" | "ventas" }) {
  const { ctx, empresa, puedeEditar, supabase } = await contextoModulo("libros");
  const { docs, totales } = await cargarLibro(supabase, empresa.id, libro, ctx.periodo);
  const s = (t: number) => (esNotaCredito(t) ? -1 : 1);

  const filas = docs.map((d) => ({
    tipo: d.tipo_doc,
    documento: TIPOS_DOCUMENTO[d.tipo_doc] ?? `Tipo ${d.tipo_doc}`,
    folio: d.origen === "resumen_boletas" ? `${d.cantidad_documentos} boletas` : d.folio,
    fecha: d.fecha_docto,
    rut: d.rut_contraparte,
    razon: d.razon_social,
    exento: s(d.tipo_doc) * d.monto_exento,
    neto: s(d.tipo_doc) * d.monto_neto,
    iva: s(d.tipo_doc) * d.monto_iva,
    otros: s(d.tipo_doc) * (d.otros_impuestos + d.monto_iva_no_recuperable),
    total: s(d.tipo_doc) * d.monto_total,
  }));

  const tarjetas = [
    ["Documentos", totales.documentos.toLocaleString("es-CL")],
    ["Neto", formatoPesos(totales.neto)],
    ["Exento", formatoPesos(totales.exento)],
    [libro === "compras" ? "IVA crédito (recuperable)" : "IVA débito", formatoPesos(totales.iva)],
    ["Total", formatoPesos(totales.total)],
  ];

  return (
    <Pagina>
      <Encabezado titulo={`Libro de ${libro}`} descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}>
        {puedeEditar && <Link href="/libros/importar" className={claseBotonPrimario}>Importar del SII</Link>}
        <MenuExportar que={libro} sii />
      </Encabezado>
      <div className="mb-4 grid grid-cols-5 gap-3">
        {tarjetas.map(([t, v]) => (
          <div key={t} className="rounded-lg border border-borde bg-white px-4 py-3">
            <p className="text-xs text-texto-suave">{t}</p>
            <p className="numeros text-lg font-bold text-texto">{v}</p>
          </div>
        ))}
      </div>
      {libro === "ventas" && puedeEditar && <ResumenBoletas anio={ctx.periodo.anio} mes={ctx.periodo.mes} />}
      <TablaDatos
        nombreArchivo={`libro-${libro}-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
        tituloExcel={`Libro de ${libro} · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
        columnas={[
          { clave: "tipo", titulo: "Tipo", tipo: "numero", ancho: "60px" },
          { clave: "documento", titulo: "Documento", ancho: "180px" },
          { clave: "folio", titulo: "Folio", ancho: "90px" },
          { clave: "fecha", titulo: "Fecha", tipo: "fecha", ancho: "100px" },
          { clave: "rut", titulo: libro === "compras" ? "RUT proveedor" : "RUT cliente", tipo: "rut", ancho: "120px" },
          { clave: "razon", titulo: "Razón social" },
          { clave: "exento", titulo: "Exento", tipo: "monto", total: true, ocultarCero: true },
          { clave: "neto", titulo: "Neto", tipo: "monto", total: true, ocultarCero: true },
          { clave: "iva", titulo: libro === "compras" ? "IVA recup." : "IVA", tipo: "monto", total: true, ocultarCero: true },
          { clave: "otros", titulo: "Otros", tipo: "monto", total: true, ocultarCero: true },
          { clave: "total", titulo: "Total", tipo: "monto", total: true },
        ]}
        filas={filas}
        vacio={`No hay documentos de ${libro} en ${nombrePeriodo(ctx.periodo).toLowerCase()}. Impórtalos desde el archivo del SII.`}
      />
    </Pagina>
  );
}
