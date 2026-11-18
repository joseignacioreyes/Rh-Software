"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto, esContador, MODULOS } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { normalizarRut } from "@/lib/rut";

export type EstadoInvitacion =
  | { error?: string; ok?: { nombre: string; rut: string; claveTemporal: string | null } }
  | undefined;

const esquema = z.object({
  rut: z.string().transform((v, ctx) => normalizarRut(v) ?? (ctx.addIssue({ code: "custom", message: "RUT no válido" }), z.NEVER)),
  nombre: z.string().trim().min(3, "Escribe el nombre completo"),
  correo: z.email("Correo no válido").transform((v) => v.trim().toLowerCase()),
  rol: z.enum(["contador", "asistente", "cliente"]),
  empresas: z.array(z.string().uuid()),
  modulos: z.array(z.enum(MODULOS.map((m) => m.codigo) as [string, ...string[]])),
});

/** Clave temporal legible (sin letras ni números que se confundan). */
function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += letras[randomInt(letras.length)];
  for (let i = 0; i < 4; i++) c += numeros[randomInt(numeros.length)];
  return c;
}

/**
 * Invita a un usuario al estudio. Si el RUT ya tiene cuenta en RH Software, solo se le agrega acceso.
 * Si no, se crea su cuenta con una clave temporal que el contador le entrega (debe cambiarla al entrar).
 */
export async function invitarUsuario(_p: EstadoInvitacion, datos: FormData): Promise<EstadoInvitacion> {
  const ctx = await obtenerContexto();
  if (!ctx.estudio || !esContador(ctx)) return { error: "Solo el contador puede invitar usuarios." };
  if (ctx.estudio.es_demo) return { error: "En el estudio de ejemplo no se pueden invitar usuarios." };

  const r = esquema.safeParse({
    rut: datos.get("rut"),
    nombre: datos.get("nombre"),
    correo: datos.get("correo"),
    rol: datos.get("rol"),
    empresas: datos.getAll("empresas"),
    modulos: datos.getAll("modulos"),
  });
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join(". ") };
  const d = r.data;
  if (d.rol !== "contador" && d.empresas.length === 0) return { error: "Elige al menos una empresa." };
  if (d.rol === "asistente" && d.modulos.length === 0) return { error: "Elige al menos un módulo para el asistente." };
  if (d.rut === ctx.usuario.rut) return { error: "No puedes invitarte a ti mismo." };

  const admin = clienteAdmin();
  let { data: usuario } = await admin.from("usuarios").select("id, nombre").eq("rut", d.rut).maybeSingle();
  let clave: string | null = null;

  if (!usuario) {
    clave = claveTemporal();
    const creado = await admin.auth.admin.createUser({ email: d.correo, password: clave, email_confirm: true });
    if (creado.error || !creado.data.user) {
      return { error: creado.error?.message.includes("already") ? "Ese correo ya está registrado con otro RUT." : "No se pudo crear la cuenta." };
    }
    const perfil = await admin
      .from("usuarios")
      .insert({
        id: creado.data.user.id, rut: d.rut, nombre: d.nombre, correo: d.correo,
        requiere_2fa: d.rol !== "cliente", debe_cambiar_clave: true, created_by: ctx.usuario.id,
      })
      .select("id, nombre")
      .single();
    if (perfil.error) {
      await admin.auth.admin.deleteUser(creado.data.user.id);
      return { error: "No se pudo crear el perfil del usuario." };
    }
    usuario = perfil.data;
  } else if (d.rol !== "cliente") {
    // Si pasa a ser contador o asistente, se le exige segundo factor.
    await admin.from("usuarios").update({ requiere_2fa: true }).eq("id", usuario.id);
  }

  // Las membresías se crean con la sesión del contador: la base de datos verifica el permiso.
  const supabase = await clienteServidor();
  const permisos = Object.fromEntries(MODULOS.map((m) => [m.codigo, d.modulos.includes(m.codigo)]));
  const filas =
    d.rol === "contador"
      ? [{ usuario_id: usuario.id, estudio_id: ctx.estudio.id, rol: "contador", permisos: {}, created_by: ctx.usuario.id }]
      : d.empresas.map((empresa_id) => ({
          usuario_id: usuario!.id, estudio_id: ctx.estudio!.id, empresa_id, rol: d.rol,
          permisos: d.rol === "asistente" ? permisos : {}, created_by: ctx.usuario.id,
        }));
  for (const f of filas) {
    const ins = await supabase.from("membresias").insert(f);
    // 23505: ya tenía ese acceso; se ignora.
    if (ins.error && ins.error.code !== "23505") return { error: `No se pudo dar acceso: ${ins.error.message}` };
  }

  revalidatePath("/estudio/usuarios");
  return { ok: { nombre: usuario.nombre, rut: d.rut, claveTemporal: clave } };
}

/** Cambia los módulos de un asistente en una empresa. */
export async function actualizarPermisos(membresiaId: string, permisos: Record<string, boolean>) {
  const ctx = await obtenerContexto();
  if (!esContador(ctx)) return { error: "Solo el contador puede cambiar permisos." };
  const limpios = Object.fromEntries(MODULOS.map((m) => [m.codigo, !!permisos[m.codigo]]));
  const supabase = await clienteServidor();
  const { error } = await supabase.from("membresias").update({ permisos: limpios }).eq("id", membresiaId);
  if (error) return { error: error.message };
  revalidatePath("/estudio/usuarios");
  return {};
}

/** Quita o devuelve el acceso (no borra la membresía: queda en el historial). */
export async function cambiarAcceso(membresiaId: string, activa: boolean) {
  const ctx = await obtenerContexto();
  if (!esContador(ctx)) return { error: "Solo el contador puede cambiar accesos." };
  const supabase = await clienteServidor();
  const { error } = await supabase.from("membresias").update({ activa }).eq("id", membresiaId);
  if (error) return { error: error.message };
  revalidatePath("/estudio/usuarios");
  return {};
}
