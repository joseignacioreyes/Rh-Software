import "server-only";
import { redirect } from "next/navigation";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { compararCodigos, type Cuenta } from "@/lib/contabilidad";

/** Contexto común de las pantallas de contabilidad: empresa elegida y permisos. */
export async function contextoContable() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa) redirect("/mi-mes");
  const p = permiso(ctx, ctx.empresa.id, "contabilidad");
  if (!p.ver) redirect("/mi-mes");
  const supabase = await clienteServidor();
  return { ctx, empresa: ctx.empresa, puedeEditar: p.editar, supabase };
}

type Supabase = Awaited<ReturnType<typeof clienteServidor>>;

/** Plan de cuentas completo de la empresa, ordenado por código. */
export async function cargarCuentas(supabase: Supabase, empresaId: string): Promise<Cuenta[]> {
  const { data } = await supabase
    .from("plan_cuentas")
    .select("id, codigo, nombre, tipo, imputable, activa")
    .eq("empresa_id", empresaId);
  return ((data ?? []) as Cuenta[]).sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

/** Meses cerrados de un año: Set con los números de mes. */
export async function mesesCerrados(supabase: Supabase, empresaId: string, anio: number): Promise<Set<number>> {
  const { data } = await supabase
    .from("periodos")
    .select("mes")
    .eq("empresa_id", empresaId)
    .eq("anio", anio)
    .eq("estado", "cerrado");
  return new Set((data ?? []).map((p) => p.mes));
}
