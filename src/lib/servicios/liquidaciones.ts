import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularLiquidacion, NOVEDADES_VACIAS, type FichaTrabajador, type NovedadesMes } from "@/lib/remuneraciones";
import { Parametros } from "@/lib/parametros";
import type { Periodo } from "@/lib/sesion";

export type ResumenCalculo = {
  calculadas: number;
  omitidas: number;
  alertas: { tono: "rojo" | "ambar"; texto: string }[];
  errores: string[];
};

const COLUMNAS_TRABAJADOR =
  "id, rut, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_ingreso, fecha_termino, tipo_contrato, jornada_horas, sueldo_base, gratificacion, colacion, movilizacion, afp, pensionado, salud, plan_isapre_uf, plan_isapre_pesos, seguro_cesantia, trabajo_pesado, cargas_familiares";

/** Calcula (o recalcula) las liquidaciones del mes de una empresa. Las aprobadas no se tocan. */
export async function calcularLiquidacionesEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
  estudioId: string,
  p: Periodo,
  creadoPor?: string,
): Promise<ResumenCalculo> {
  const inicio = `${p.anio}-${String(p.mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(p.anio, p.mes, 0)).toISOString().slice(0, 10);
  const [{ data: trabajadores }, { data: novedades }, { data: existentes }, { data: empresa }, params] = await Promise.all([
    supabase.from("trabajadores").select(COLUMNAS_TRABAJADOR).eq("empresa_id", empresaId).lte("fecha_ingreso", fin).or(`fecha_termino.is.null,fecha_termino.gte.${inicio}`),
    supabase.from("novedades").select("*").eq("empresa_id", empresaId).eq("anio", p.anio).eq("mes", p.mes),
    supabase.from("liquidaciones").select("id, trabajador_id, estado").eq("empresa_id", empresaId).eq("anio", p.anio).eq("mes", p.mes),
    supabase.from("empresas").select("tasa_cotizacion_adicional").eq("id", empresaId).single(),
    Parametros.cargar(supabase),
  ]);
  const { data: licencias } = await supabase.from("licencias").select("trabajador_id, desde, hasta").eq("empresa_id", empresaId).lte("desde", fin).gte("hasta", inicio);
  const diasLicencia = (trabajadorId: string) =>
    (licencias ?? []).filter((l) => l.trabajador_id === trabajadorId).reduce((s, l) => {
      const a = Math.max(Date.parse(inicio), Date.parse(l.desde));
      const b = Math.min(Date.parse(fin), Date.parse(l.hasta));
      return s + (b >= a ? Math.round((b - a) / 86400000) + 1 : 0);
    }, 0);
  const resumen: ResumenCalculo = { calculadas: 0, omitidas: 0, alertas: [], errores: [] };
  if (!trabajadores?.length) {
    resumen.alertas.push({ tono: "ambar", texto: "La empresa no tiene trabajadores con contrato vigente en el mes." });
    return resumen;
  }

  for (const t of trabajadores) {
    const previa = existentes?.find((e) => e.trabajador_id === t.id);
    const nombre = `${t.nombres} ${t.apellido_paterno}`;
    if (previa?.estado === "aprobada") {
      resumen.omitidas++;
      continue;
    }
    const n = novedades?.find((x) => x.trabajador_id === t.id);
    const nov: NovedadesMes = n
      ? { horas_extra: Number(n.horas_extra), dias_licencia: n.dias_licencia, dias_ausencia: n.dias_ausencia, bono_imponible: Number(n.bono_imponible), comisiones: Number(n.comisiones), bono_no_imponible: Number(n.bono_no_imponible), anticipo: Number(n.anticipo), prestamo: Number(n.prestamo), cuota_sindical: Number(n.cuota_sindical), apv: Number(n.apv), otros_descuentos: Number(n.otros_descuentos) }
      : { ...NOVEDADES_VACIAS };
    // Las licencias registradas cuentan si la novedad no informa días (tope 30, mes comercial).
    const lic = Math.min(diasLicencia(t.id), 30);
    if (lic > nov.dias_licencia) nov.dias_licencia = lic;
    const ficha: FichaTrabajador = {
      ...t,
      nombre,
      jornada_horas: Number(t.jornada_horas),
      sueldo_base: Number(t.sueldo_base),
      colacion: Number(t.colacion),
      movilizacion: Number(t.movilizacion),
      plan_isapre_uf: t.plan_isapre_uf === null ? null : Number(t.plan_isapre_uf),
      plan_isapre_pesos: t.plan_isapre_pesos === null ? null : Number(t.plan_isapre_pesos),
    } as FichaTrabajador;

    let r;
    try {
      r = calcularLiquidacion(ficha, nov, p, params, { tasa_cotizacion_adicional: empresa?.tasa_cotizacion_adicional === null ? 0 : Number(empresa?.tasa_cotizacion_adicional ?? 0) });
    } catch (e) {
      resumen.errores.push(`${nombre}: ${(e as Error).message}`);
      continue;
    }
    resumen.alertas.push(...r.alertas);
    const version = createHash("sha256").update(JSON.stringify([ficha, nov])).digest("hex").slice(0, 16);
    const fila = {
      estudio_id: estudioId, empresa_id: empresaId, trabajador_id: t.id, anio: p.anio, mes: p.mes, estado: "calculada",
      dias_trabajados: r.diasTrabajados, total_imponible: r.totalImponible, total_no_imponible: r.totalNoImponible, total_haberes: r.totalHaberes,
      renta_imponible_afp: r.rentaImponibleAfp, renta_imponible_afc: r.rentaImponibleAfc, base_tributable: r.baseTributable,
      cotizacion_afp: r.cotizacionAfp, cotizacion_salud: r.cotizacionSalud, cotizacion_afc: r.cotizacionAfc, impuesto_unico: r.impuestoUnico,
      total_descuentos: r.totalDescuentos, liquido: r.liquido, aportes_empleador: r.aportesEmpleador, costo_empresa: r.costoEmpresa,
      detalle: { items: r.items, alertas: r.alertas, ficha: { nombre, rut: t.rut, sueldo_base: ficha.sueldo_base, afp: ficha.afp, salud: ficha.salud, tipo_contrato: ficha.tipo_contrato, jornada_horas: ficha.jornada_horas }, novedades: nov },
      parametros: r.parametros, version_datos: version,
      ...(creadoPor ? { created_by: creadoPor } : {}),
    };
    const { data: guardada, error } = await supabase.from("liquidaciones").upsert(fila, { onConflict: "trabajador_id,anio,mes" }).select("id").single();
    if (error) {
      resumen.errores.push(`${nombre}: ${error.message}`);
      continue;
    }
    await supabase.from("items_liquidacion").delete().eq("liquidacion_id", guardada.id);
    const { error: e2 } = await supabase.from("items_liquidacion").insert(
      r.items.map((i, k) => ({
        estudio_id: estudioId, empresa_id: empresaId, liquidacion_id: guardada.id, orden: k + 1, codigo: i.codigo, nombre: i.nombre, tipo: i.tipo,
        monto: i.monto, detalle: { formula: i.formula, calculo: i.calculo, parametros: i.parametros },
      })),
    );
    if (e2) resumen.errores.push(`${nombre}: ${e2.message}`);
    resumen.calculadas++;
  }
  return resumen;
}
