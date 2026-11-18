"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizarRut } from "@/lib/rut";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoFormulario = { error?: string } | undefined;

const MAX_INTENTOS = 5;
const VENTANA_MINUTOS = 15;

async function ipCliente() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

/** Inicio de sesión con RUT y clave. */
export async function iniciarSesion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const rut = normalizarRut(String(datos.get("rut") ?? ""));
  const clave = String(datos.get("clave") ?? "");
  if (!rut) return { error: "El RUT no es válido. Revisa el dígito verificador." };
  if (!clave) return { error: "Escribe tu clave." };

  const admin = clienteAdmin();
  const ip = await ipCliente();

  // Límite de intentos fallidos por RUT.
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();
  const { count } = await admin
    .from("intentos_login")
    .select("id", { count: "exact", head: true })
    .eq("rut", rut)
    .eq("exito", false)
    .gte("created_at", desde);
  if ((count ?? 0) >= MAX_INTENTOS) {
    return { error: `Demasiados intentos fallidos. Espera ${VENTANA_MINUTOS} minutos antes de volver a intentar.` };
  }

  // El inicio de sesión de Supabase usa el correo: lo buscamos por RUT en el servidor.
  const { data: usuario } = await admin.from("usuarios").select("correo").eq("rut", rut).maybeSingle();

  const supabase = await clienteServidor();
  let exito = false;
  if (usuario) {
    const { error } = await supabase.auth.signInWithPassword({ email: usuario.correo, password: clave });
    exito = !error;
  }
  await admin.from("intentos_login").insert({ rut, ip, exito });

  // Mismo mensaje si el RUT no existe o la clave está mala (no revelamos qué RUT tiene cuenta).
  if (!exito) return { error: "RUT o clave incorrectos." };

  await supabase.rpc("registrar_evento", { p_accion: "inicio_sesion" });
  redirect("/mi-mes");
}

/** Verifica el código de la app autenticadora (segundo factor). */
export async function verificarCodigo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const codigo = String(datos.get("codigo") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(codigo)) return { error: "El código tiene 6 números." };

  const supabase = await clienteServidor();
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = factores?.totp?.find((f) => f.status === "verified");
  if (!factor) redirect("/ingresar/configurar-2fa");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
  if (error) return { error: "El código no es correcto o ya venció. Prueba con el siguiente." };

  await supabase.rpc("registrar_evento", { p_accion: "segundo_factor_ok" });
  redirect("/mi-mes");
}

/** Empieza a configurar la app autenticadora: entrega el código QR. */
export async function iniciarConfiguracion2fa(): Promise<
  { factorId: string; qr: string; secreto: string } | { error: string }
> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  // Limpiar intentos anteriores sin terminar.
  const { data: factores } = await supabase.auth.mfa.listFactors();
  for (const f of factores?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `RH Software ${new Date().toISOString().slice(0, 16)}`,
    issuer: "RH Software",
  });
  if (error || !data) return { error: "No se pudo iniciar la configuración. Intenta de nuevo." };
  return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
}

/** Confirma la app autenticadora con el primer código. */
export async function confirmarConfiguracion2fa(factorId: string, codigo: string): Promise<{ error?: string }> {
  if (!/^\d{6}$/.test(codigo.replace(/\s/g, ""))) return { error: "El código tiene 6 números." };
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo.replace(/\s/g, "") });
  if (error) return { error: "El código no es correcto. Revisa que la hora de tu teléfono esté al día." };
  await supabase.rpc("registrar_evento", { p_accion: "segundo_factor_configurado" });
  return {};
}

export async function cerrarSesion() {
  const supabase = await clienteServidor();
  await supabase.rpc("registrar_evento", { p_accion: "cierre_sesion" });
  await supabase.auth.signOut();
  redirect("/ingresar");
}
