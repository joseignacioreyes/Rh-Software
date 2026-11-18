"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esquemaEmpresa } from "@/lib/empresas";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cambiarEmpresa } from "../acciones-contexto";

export type EstadoEmpresa = { error?: string; errores?: Record<string, string>; ok?: string } | undefined;

function leer(datos: FormData) {
  return esquemaEmpresa.safeParse(Object.fromEntries(datos.entries()));
}

function erroresPorCampo(issues: { path: PropertyKey[]; message: string }[]) {
  const r: Record<string, string> = {};
  for (const i of issues) r[String(i.path[0])] = i.message;
  return r;
}

export async function guardarEmpresa(_p: EstadoEmpresa, datos: FormData): Promise<EstadoEmpresa> {
  const ctx = await obtenerContexto();
  if (!ctx.estudio || !esContador(ctx)) return { error: "Solo el contador del estudio puede crear o editar empresas." };

  const r = leer(datos);
  if (!r.success) return { error: "Revisa los campos marcados.", errores: erroresPorCampo(r.error.issues) };

  const id = String(datos.get("id") ?? "");
  const supabase = await clienteServidor();
  if (id) {
    const { error } = await supabase.from("empresas").update(r.data).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Ya existe otra empresa con ese RUT en el estudio." : error.message };
    revalidatePath("/empresas");
    revalidatePath(`/empresas/${id}`);
    return { ok: "Cambios guardados." };
  }

  const { data, error } = await supabase
    .from("empresas")
    .insert({ ...r.data, estudio_id: ctx.estudio.id, created_by: ctx.usuario.id })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "Ya existe una empresa con ese RUT en el estudio." : error.message };

  // Plan de cuentas inicial desde la plantilla base.
  await supabase.rpc("copiar_plan_cuentas", { p_destino: data.id });
  await cambiarEmpresa(data.id);
  revalidatePath("/", "layout");
  redirect(`/empresas/${data.id}?creada=1`);
}

/** Desactiva o reactiva una empresa (no se borra nunca). */
export async function cambiarEstadoEmpresa(id: string, activa: boolean) {
  const ctx = await obtenerContexto();
  if (!esContador(ctx)) return { error: "Solo el contador puede hacerlo." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("empresas").update({ activa }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
