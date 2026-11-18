import type { Metadata } from "next";
import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { cargarHonorarios } from "@/lib/libros";
import { nombrePeriodo } from "@/lib/sesion";
import { formatoPesos } from "@/lib/formato";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { MenuExportar } from "@/components/ui/MenuExportar";
import { claseBotonPrimario } from "@/components/ui/estilos";

export const metadata: Metadata = { title: "Libro de honorarios" };

export default async function Honorarios({ searchParams }: PageProps<"/libros/honorarios">) {
  const { tipo: t } = await searchParams;
  const tipo = t === "emitidas" ? "emitidas" : "recibidas";
  const { ctx, empresa, puedeEditar, supabase } = await contextoModulo("libros");
  const { boletas, totales } = await cargarHonorarios(supabase, empresa.id, tipo, ctx.periodo);

  return (
    <Pagina>
      <Encabezado titulo="Libro de honorarios" descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}>
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          <Link href="/libros/honorarios" className={`px-3 py-2 ${tipo === "recibidas" ? "bg-azul text-white" : "bg-white"}`}>Recibidas</Link>
          <Link href="/libros/honorarios?tipo=emitidas" className={`px-3 py-2 ${tipo === "emitidas" ? "bg-azul text-white" : "bg-white"}`}>Emitidas</Link>
        </div>
        {puedeEditar && <Link href="/libros/importar" className={claseBotonPrimario}>Importar del SII</Link>}
        <MenuExportar que={`honorarios_${tipo}`} />
      </Encabezado>
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          ["Monto bruto", totales.bruto],
          ["Retención total", totales.retencion],
          [tipo === "recibidas" ? "Retención a pagar en el F29" : "Retenida por los clientes", totales.retencionEmpresa],
          ["Líquido", totales.liquido],
        ].map(([n, v]) => (
          <div key={n as string} className="rounded-lg border border-borde bg-white px-4 py-3">
            <p className="text-xs text-texto-suave">{n}</p>
            <p className="numeros text-lg font-bold">{formatoPesos(v as number)}</p>
          </div>
        ))}
      </div>
      <TablaDatos
        nombreArchivo={`honorarios-${tipo}-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
        columnas={[
          { clave: "folio", titulo: "N° boleta", ancho: "90px" },
          { clave: "fecha", titulo: "Fecha", tipo: "fecha", ancho: "100px" },
          { clave: "rut", titulo: tipo === "recibidas" ? "RUT emisor" : "RUT receptor", tipo: "rut", ancho: "120px" },
          { clave: "nombre", titulo: "Nombre" },
          { clave: "estado", titulo: "Estado", ancho: "90px" },
          { clave: "bruto", titulo: "Bruto", tipo: "monto", total: true },
          { clave: "retencion", titulo: "Retención", tipo: "monto", total: true },
          { clave: "liquido", titulo: "Líquido", tipo: "monto", total: true },
        ]}
        filas={boletas.map((b) => ({
          folio: b.folio, fecha: b.fecha, rut: b.rut_contraparte, nombre: b.nombre,
          estado: b.estado === "vigente" ? "Vigente" : "Anulada",
          bruto: b.estado === "vigente" ? b.monto_bruto : 0, retencion: b.estado === "vigente" ? b.monto_retencion : 0,
          liquido: b.estado === "vigente" ? b.monto_liquido : 0,
        }))}
        vacio={`Sin boletas ${tipo} en ${nombrePeriodo(ctx.periodo).toLowerCase()}.`}
      />
    </Pagina>
  );
}
