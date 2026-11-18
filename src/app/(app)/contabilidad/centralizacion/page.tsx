import type { Metadata } from "next";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo } from "@/lib/sesion";
import { CUENTAS_CENTRALIZACION } from "@/lib/centralizacion";
import { totalesLibro } from "@/lib/importar/rcv";
import { cargarHonorarios } from "@/lib/libros";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { Centralizacion } from "./Centralizacion";

export const metadata: Metadata = { title: "Centralizaciones" };

export default async function PaginaCentralizacion() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoContable();
  const [cuentas, { data: conf }, { data: docs }, hon, { data: liqs }, { data: previos }] = await Promise.all([
    cargarCuentas(supabase, empresa.id),
    supabase.from("config_centralizacion").select("cuentas").eq("empresa_id", empresa.id).maybeSingle(),
    supabase.from("documentos_rcv").select("libro, tipo_doc, monto_exento, monto_neto, monto_iva, monto_iva_no_recuperable, otros_impuestos, monto_total").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes),
    cargarHonorarios(supabase, empresa.id, "recibidas", ctx.periodo),
    supabase.from("liquidaciones").select("liquido").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).neq("estado", "anulada"),
    supabase.from("comprobantes").select("id, numero, origen, created_at").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).eq("estado", "vigente").like("origen", "centralizacion_%"),
  ]);
  // Valores por defecto: las cuentas de la plantilla base, si existen.
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c.id]));
  const config: Record<string, string> = Object.fromEntries(CUENTAS_CENTRALIZACION.map((c) => [c.clave, porCodigo.get(c.codigo) ?? ""]));
  Object.assign(config, conf?.cuentas ?? {});
  const compras = totalesLibro((docs ?? []).filter((d) => d.libro === "compras"));
  const ventas = totalesLibro((docs ?? []).filter((d) => d.libro === "ventas"));
  const hecho = (o: string) => (previos ?? []).find((p) => p.origen === o);

  return (
    <Pagina>
      <Encabezado
        titulo="Centralizaciones"
        descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}. Genera el comprobante del mes desde los libros, con las cuentas que configuras una vez.`}
      />
      <Centralizacion
        puedeEditar={puedeEditar}
        configGuardada={!!conf}
        config={config}
        opciones={cuentas.filter((c) => c.imputable && c.activa).map((c) => ({ id: c.id, texto: `${c.codigo} ${c.nombre}` }))}
        definiciones={CUENTAS_CENTRALIZACION.map(({ clave, nombre, grupo }) => ({ clave, nombre, grupo }))}
        libros={[
          { que: "compras", titulo: "Libro de compras", documentos: compras.documentos, total: compras.total, previo: hecho("centralizacion_compras") ?? null },
          { que: "ventas", titulo: "Libro de ventas", documentos: ventas.documentos, total: ventas.total, previo: hecho("centralizacion_ventas") ?? null },
          { que: "honorarios", titulo: "Honorarios recibidos", documentos: hon.boletas.length, total: hon.totales.bruto, previo: hecho("centralizacion_honorarios") ?? null },
          { que: "remuneraciones", titulo: "Remuneraciones", documentos: (liqs ?? []).length, total: (liqs ?? []).reduce((s, l) => s + Number(l.liquido), 0), previo: hecho("centralizacion_remuneraciones") ?? null },
        ]}
      />
    </Pagina>
  );
}
