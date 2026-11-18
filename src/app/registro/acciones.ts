"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizarRut } from "@/lib/rut";
import { clienteAdmin } from "@/lib/supabase/admin";
import { DIAS_PRUEBA } from "@/lib/config";
import { hoyChile } from "@/lib/suscripcion";

const esquema = z.object({
  estudio: z.string().trim().min(3, "Escribe el nombre de tu estudio o tu nombre comercial.").max(120),
  rut: z.string(),
  nombre: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  correo: z.email("El correo no es válido.").transform((c) => c.toLowerCase()),
  clave: z.string().min(8, "La clave debe tener al menos 8 caracteres.").max(72)
    .regex(/[a-z]/, "La clave debe tener minúsculas, mayúsculas y números.")
    .regex(/[A-Z]/, "La clave debe tener minúsculas, mayúsculas y números.")
    .regex(/\d/, "La clave debe tener minúsculas, mayúsculas y números."),
  clave2: z.string(),
  acepto: z.literal("on", { error: "Debes aceptar los términos y la política de privacidad." }),
});

const MAX_REGISTROS_POR_HORA = 3;

/** Crea un estudio nuevo con 30 días de prueba gratis. El contador configura su segundo factor al entrar. */
export async function crearCuenta(_: unknown, datos: FormData) {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  if (d.clave !== d.clave2) return { error: "Las claves no coinciden." };
  const rut = normalizarRut(d.rut);
  if (!rut) return { error: "Tu RUT no es válido. Revisa el dígito verificador." };

  const admin = clienteAdmin();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  if (ip) {
    const { count } = await admin.from("intentos_login").select("id", { count: "exact", head: true }).eq("rut", "registro").eq("ip", ip).gte("created_at", desde);
    if ((count ?? 0) >= MAX_REGISTROS_POR_HORA) return { error: "Demasiados registros desde esta conexión. Intenta en una hora o escríbenos por WhatsApp." };
  }
  await admin.from("intentos_login").insert({ rut: "registro", ip, exito: true });

  const { data: existe } = await admin.from("usuarios").select("id").or(`rut.eq.${rut},correo.eq.${d.correo}`).limit(1);
  // Mismo mensaje para RUT o correo: no revelamos cuál existe.
  if (existe?.length) return { error: "Ya existe una cuenta con ese RUT o correo. Ingresa con tu RUT o recupera tu clave." };

  const u = await admin.auth.admin.createUser({ email: d.correo, password: d.clave, email_confirm: true });
  if (u.error || !u.data.user) return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  const id = u.data.user.id;
  const deshacer = async (msg: string) => { await admin.auth.admin.deleteUser(id); return { error: msg }; };

  let resultado: { error?: string };
  try {
    resultado = await completarCuenta(admin, id, rut, d, ip);
  } catch (e) {
    console.error("Registro: error inesperado", e);
    await admin.from("estudios").delete().eq("created_by", id);
    return deshacer("No pudimos terminar de crear la cuenta.");
  }
  if (resultado.error) return resultado;
  // redirect() fuera del try: lanza una excepción interna de Next que no debe atraparse.
  redirect("/ingresar?nuevo=1");
}

async function completarCuenta(admin: ReturnType<typeof clienteAdmin>, id: string, rut: string, d: z.infer<typeof esquema>, ip: string | null) {
  const deshacer = async (msg: string) => { await admin.auth.admin.deleteUser(id); return { error: msg }; };
  const p = await admin.from("usuarios").insert({ id, rut, nombre: d.nombre, correo: d.correo, requiere_2fa: true });
  if (p.error) return deshacer("No pudimos crear tu perfil.");
  const e = await admin.from("estudios").insert({ nombre: d.estudio, created_by: id }).select("id").single();
  if (e.error) return deshacer("No pudimos crear el estudio.");
  const hasta = new Date(`${hoyChile()}T12:00:00Z`);
  hasta.setUTCDate(hasta.getUTCDate() + DIAS_PRUEBA);
  const pasos = await Promise.all([
    admin.from("membresias").insert({ usuario_id: id, estudio_id: e.data.id, rol: "contador", permisos: {}, created_by: id }),
    admin.from("suscripciones").insert({ estudio_id: e.data.id, plan: "inicial", estado: "prueba", pagado_hasta: hasta.toISOString().slice(0, 10) }),
    admin.from("consentimientos").insert([
      { usuario_id: id, tipo: "terminos", version: "borrador-2026-11", ip },
      { usuario_id: id, tipo: "privacidad", version: "borrador-2026-11", ip },
    ]),
  ]);
  const fallo = pasos.find((x) => x.error);
  if (fallo) {
    console.error("Registro: falló un paso", fallo.error);
    await admin.from("estudios").delete().eq("id", e.data.id);
    return deshacer("No pudimos terminar de crear la cuenta.");
  }
  return {};
}
