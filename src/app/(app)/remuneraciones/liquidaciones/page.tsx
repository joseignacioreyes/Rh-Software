import type { Metadata } from "next";
import Link from "next/link";
import { contextoModulo } from "@/lib/contexto-contable";
import { nombrePeriodo } from "@/lib/sesion";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { claseBotonPrimario } from "@/components/ui/estilos";
import { PanelLiquidaciones, type FilaTrabajador } from "./PanelLiquidaciones";

export const metadata: Metadata = { title: "Liquidaciones" };

export default async function Liquidaciones() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const inicio = `${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(ctx.periodo.anio, ctx.periodo.mes, 0)).toISOString().slice(0, 10);
  const [{ data: trabajadores }, { data: novedades }, { data: liqs }] = await Promise.all([
    supabase.from("trabajadores").select("id, rut, nombres, apellido_paterno, cargo, sueldo_base").eq("empresa_id", empresa.id).lte("fecha_ingreso", fin).or(`fecha_termino.is.null,fecha_termino.gte.${inicio}`).order("apellido_paterno"),
    supabase.from("novedades").select("*").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes),
    supabase.from("liquidaciones").select("id, trabajador_id, estado, dias_trabajados, total_imponible, total_haberes, total_descuentos, liquido, costo_empresa, impuesto_unico, detalle, updated_at").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes),
  ]);

  const filas: FilaTrabajador[] = (trabajadores ?? []).map((t) => {
    const n = novedades?.find((x) => x.trabajador_id === t.id);
    const l = liqs?.find((x) => x.trabajador_id === t.id);
    return {
      id: t.id,
      nombre: `${t.nombres} ${t.apellido_paterno}`,
      rut: t.rut,
      cargo: t.cargo,
      novedades: {
        horas_extra: Number(n?.horas_extra ?? 0), dias_licencia: n?.dias_licencia ?? 0, dias_ausencia: n?.dias_ausencia ?? 0,
        bono_imponible: Number(n?.bono_imponible ?? 0), comisiones: Number(n?.comisiones ?? 0), anticipo: Number(n?.anticipo ?? 0),
        prestamo: Number(n?.prestamo ?? 0),
      },
      liquidacion: l ? {
        id: l.id, estado: l.estado, dias: l.dias_trabajados, imponible: Number(l.total_imponible), haberes: Number(l.total_haberes),
        descuentos: Number(l.total_descuentos), liquido: Number(l.liquido), costo: Number(l.costo_empresa), impuesto: Number(l.impuesto_unico),
        alertas: ((l.detalle as { alertas?: { tono: string; texto: string }[] }).alertas ?? []),
        desactualizada: !!n && Date.parse(n.updated_at) > Date.parse(l.updated_at),
      } : null,
    };
  });

  return (
    <Pagina>
      <Encabezado titulo={`Liquidaciones · ${nombrePeriodo(ctx.periodo)}`} descripcion={`${empresa.razon_social} · Ingresa las novedades del mes y calcula todas las liquidaciones de una vez.`}>
        {puedeEditar && <Link href="/remuneraciones/trabajadores/nuevo" className="text-sm text-azul hover:underline">+ Trabajador</Link>}
        <Link href="/remuneraciones/parametros" className="text-sm text-azul hover:underline">Parámetros legales usados</Link>
      </Encabezado>
      {filas.length === 0 ? (
        <Vacio titulo="No hay trabajadores con contrato vigente en el mes">
          {puedeEditar && <Link href="/remuneraciones/trabajadores/nuevo" className={`${claseBotonPrimario} mt-3`}>Agregar trabajador</Link>}
        </Vacio>
      ) : (
        <PanelLiquidaciones filas={filas} puedeEditar={puedeEditar} />
      )}
    </Pagina>
  );
}
