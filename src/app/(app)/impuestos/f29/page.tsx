import type { Metadata } from "next";
import { contextoModulo } from "@/lib/contexto-contable";
import { nombrePeriodo } from "@/lib/sesion";
import { EXPLICACION_DIFERENCIA, vencimiento, type ResultadoF29 } from "@/lib/f29";
import { Parametros } from "@/lib/parametros";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { PanelF29 } from "./PanelF29";

export const metadata: Metadata = { title: "F29" };

export default async function F29() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoModulo("impuestos");
  const [{ data: f29 }, { data: emp }, { data: feriados }, params] = await Promise.all([
    supabase.from("f29_propuestas").select("*").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).maybeSingle(),
    supabase.from("empresas").select("emite_factura_electronica").eq("id", empresa.id).single(),
    supabase.from("feriados").select("fecha"),
    Parametros.cargar(supabase),
  ]);
  const fechaRef = `${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}-01`;
  const dia = params.buscar(emp?.emite_factura_electronica ? "VENC_F29_DIA_ELECTRONICO" : "VENC_F29_DIA", fechaRef)?.valor ?? null;
  const vence = dia ? vencimiento(ctx.periodo.anio, ctx.periodo.mes, dia, new Set((feriados ?? []).map((f) => f.fecha))) : null;

  let nombreRevisor: string | null = null;
  if (f29?.revisado_por) {
    const { data } = await supabase.from("usuarios").select("nombre").eq("id", f29.revisado_por).maybeSingle();
    nombreRevisor = data?.nombre ?? null;
  }
  let urlComprobante: string | null = null;
  if (f29?.ruta_comprobante) {
    const { data } = await supabase.storage.from("archivos").createSignedUrl(f29.ruta_comprobante, 600);
    urlComprobante = data?.signedUrl ?? null;
  }
  const tono = { borrador: "gris", revisado: "ambar", declarado: "azul", pagado: "verde" } as const;

  return (
    <Pagina>
      <Encabezado
        titulo={`F29 · ${nombrePeriodo(ctx.periodo)}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {empresa.razon_social}
            {f29 && <Etiqueta tono={tono[f29.estado as keyof typeof tono]}>{f29.estado === "borrador" ? "Borrador" : f29.estado === "revisado" ? "Revisado" : f29.estado === "declarado" ? "Declarado" : "Declarado y pagado"}</Etiqueta>}
            {vence && <span>· Vence el <span className="numeros font-semibold">{formatoFecha(new Date(`${vence}T12:00:00-04:00`))}</span></span>}
            {f29 && <span>· Total a pagar <span className="numeros font-semibold text-texto">{formatoPesos(Number(f29.total_a_pagar))}</span></span>}
          </span>
        }
      />
      <PanelF29
        f29={f29 ? {
          calculada: f29.calculada as ResultadoF29,
          propuestaSii: (f29.propuesta_sii ?? {}) as Record<string, number>,
          ajustes: (f29.ajustes ?? {}) as Record<string, number>,
          estado: f29.estado,
          notas: f29.notas,
          totalAPagar: Number(f29.total_a_pagar),
          revisadoPor: nombreRevisor,
          revisadoEl: f29.revisado_at ? formatoFecha(new Date(f29.revisado_at)) : null,
          folio: f29.folio_declaracion,
          montoPagado: f29.monto_pagado === null ? null : Number(f29.monto_pagado),
          urlComprobante,
          versionDatos: f29.version_datos,
          calculadoEl: formatoFecha(new Date(f29.updated_at)),
        } : null}
        explicaciones={EXPLICACION_DIFERENCIA}
        puedeEditar={puedeEditar}
        periodo={nombrePeriodo(ctx.periodo)}
      />
    </Pagina>
  );
}
