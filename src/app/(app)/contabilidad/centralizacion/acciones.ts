"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso, nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { CUENTAS_CENTRALIZACION, asientoCompras, asientoHonorarios, asientoRemuneraciones, asientoVentas, type ConfigCuentas } from "@/lib/centralizacion";
import { cargarHonorarios } from "@/lib/libros";

async function verificar() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "contabilidad").editar) throw new Error("No tienes permiso en esta empresa.");
  return { ctx, empresa: ctx.empresa, supabase: await clienteServidor() };
}

export async function guardarConfig(cuentas: ConfigCuentas) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const limpias = Object.fromEntries(Object.entries(cuentas).filter(([k, v]) => CUENTAS_CENTRALIZACION.some((c) => c.clave === k) && v));
    const { error } = await supabase.from("config_centralizacion").upsert({ empresa_id: empresa.id, estudio_id: ctx.estudio!.id, cuentas: limpias });
    if (error) return { error: error.message };
    revalidatePath("/contabilidad/centralizacion");
    return { ok: "Cuentas guardadas." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Genera (o regenera) el comprobante de centralización del periodo. Si ya existía, el anterior queda anulado. */
export async function centralizar(que: "compras" | "ventas" | "honorarios" | "remuneraciones") {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const { data: conf } = await supabase.from("config_centralizacion").select("cuentas").eq("empresa_id", empresa.id).maybeSingle();
    const config = (conf?.cuentas ?? {}) as ConfigCuentas;
    const { hasta } = rangoPeriodo(ctx.periodo);
    let lineas;
    if (que === "remuneraciones") {
      const { data: liqs } = await supabase.from("liquidaciones").select("id, liquido, estado").eq("empresa_id", empresa.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).neq("estado", "anulada");
      const { data: items } = await supabase.from("items_liquidacion").select("liquidacion_id, codigo, monto").in("liquidacion_id", (liqs ?? []).map((l) => l.id));
      lineas = asientoRemuneraciones((liqs ?? []).map((l) => ({ liquido: Number(l.liquido), items: (items ?? []).filter((i) => i.liquidacion_id === l.id).map((i) => ({ codigo: i.codigo, monto: Number(i.monto) })) })), config);
    } else if (que === "honorarios") {
      const { boletas } = await cargarHonorarios(supabase, empresa.id, "recibidas", ctx.periodo);
      lineas = asientoHonorarios(boletas.filter((b) => b.estado === "vigente"), config);
    } else {
      const { data } = await supabase
        .from("documentos_rcv")
        .select("tipo_doc, monto_exento, monto_neto, monto_iva, monto_iva_no_recuperable, otros_impuestos, monto_total, monto_neto_activo_fijo, iva_activo_fijo")
        .eq("empresa_id", empresa.id).eq("libro", que).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes);
      lineas = que === "compras" ? asientoCompras(data ?? [], config) : asientoVentas(data ?? [], config);
    }
    if (lineas.length < 2) return { error: `No hay documentos de ${que} en ${nombrePeriodo(ctx.periodo).toLowerCase()} para centralizar.` };
    const { data: id, error } = await supabase.rpc("centralizar", {
      p_empresa: empresa.id,
      p_origen: `centralizacion_${que}`,
      p_fecha: hasta,
      p_glosa: `Centralización ${que === "honorarios" ? "boletas de honorarios" : que === "remuneraciones" ? "de remuneraciones" : `libro de ${que}`} ${nombrePeriodo(ctx.periodo).toLowerCase()}`,
      p_lineas: lineas,
    });
    if (error) return { error: error.message };
    revalidatePath("/contabilidad", "layout");
    return { ok: "Comprobante de centralización generado.", id: id as string };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
