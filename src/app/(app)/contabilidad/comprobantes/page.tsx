import type { Metadata } from "next";
import Link from "next/link";
import { contextoContable, mesesCerrados } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { claseBotonPrimario } from "@/components/ui/estilos";

export const metadata: Metadata = { title: "Comprobantes" };

const TIPO: Record<string, string> = { ingreso: "Ingreso", egreso: "Egreso", traspaso: "Traspaso", apertura: "Apertura" };

export default async function Comprobantes() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoContable();
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const [{ data }, cerrados] = await Promise.all([
    supabase
      .from("comprobantes")
      .select("id, numero, tipo, fecha, glosa, total_debe, estado, origen")
      .eq("empresa_id", empresa.id)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero"),
    mesesCerrados(supabase, empresa.id, ctx.periodo.anio),
  ]);
  const cerrado = cerrados.has(ctx.periodo.mes);

  const filas = (data ?? []).map((c) => ({
    numero: c.numero,
    enlace: `/contabilidad/comprobantes/${c.id}`,
    fecha: c.fecha,
    tipo: TIPO[c.tipo] ?? c.tipo,
    glosa: c.glosa,
    total: c.estado === "anulado" ? 0 : c.total_debe,
    estado: c.estado === "anulado" ? "Anulado" : "Vigente",
  }));

  return (
    <Pagina>
      <Encabezado
        titulo="Comprobantes"
        descripcion={
          <span className="flex items-center gap-2">
            {empresa.razon_social} · {nombrePeriodo(ctx.periodo)}
            {cerrado ? <Etiqueta tono="gris">Mes cerrado</Etiqueta> : <Etiqueta tono="verde">Mes abierto</Etiqueta>}
          </span>
        }
      >
        {puedeEditar && !cerrado && (
          <Link href="/contabilidad/comprobantes/nuevo" className={claseBotonPrimario}>
            Nuevo comprobante <kbd className="rounded bg-white/20 px-1 font-mono text-[10px]">Alt N</kbd>
          </Link>
        )}
      </Encabezado>
      <TablaDatos
        nombreArchivo={`comprobantes-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
        tituloExcel={`Comprobantes · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
        columnas={[
          { clave: "numero", titulo: "N°", tipo: "numero", enlace: "enlace", ancho: "70px" },
          { clave: "fecha", titulo: "Fecha", tipo: "fecha", ancho: "100px" },
          { clave: "tipo", titulo: "Tipo", ancho: "100px" },
          { clave: "glosa", titulo: "Glosa", enlace: "enlace" },
          { clave: "total", titulo: "Monto", tipo: "monto", total: true, ancho: "140px" },
          { clave: "estado", titulo: "Estado", ancho: "90px" },
        ]}
        filas={filas}
        vacio={`No hay comprobantes en ${nombrePeriodo(ctx.periodo).toLowerCase()}.`}
      />
    </Pagina>
  );
}
