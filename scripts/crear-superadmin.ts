// Crea (o marca) al superadministrador de RH Software. Lo corre José una sola vez por ambiente.
// Uso: npm run crear:superadmin -- --rut 12.345.678-5 --nombre "José Reyes" --correo jose@ejemplo.cl
// Si el usuario no existe, se crea con una clave temporal que se muestra UNA vez y que debe cambiar al entrar.
// El segundo factor (app autenticadora) es obligatorio para el superadministrador.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizarRut } from "../src/lib/rut";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const rut = normalizarRut(arg("rut") ?? "");
const nombre = arg("nombre");
const correo = arg("correo")?.toLowerCase();
if (!rut || !nombre || !correo) {
  console.error('Uso: npm run crear:superadmin -- --rut 12.345.678-5 --nombre "Nombre" --correo correo@dominio.cl');
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: existente } = await db.from("usuarios").select("id").eq("rut", rut).maybeSingle();
  if (existente) {
    const r = await db.from("usuarios").update({ es_superadmin: true, requiere_2fa: true }).eq("id", existente.id);
    if (r.error) throw r.error;
    console.log("Listo: el usuario existente ahora es superadministrador.");
    return;
  }
  // Cumple la política de claves: minúsculas, mayúsculas y números.
  const clave = `Rh${randomBytes(9).toString("base64url")}7a`;
  const u = await db.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  if (u.error) throw u.error;
  const p = await db.from("usuarios").insert({ id: u.data.user!.id, rut, nombre, correo, es_superadmin: true, requiere_2fa: true, debe_cambiar_clave: true });
  if (p.error) throw p.error;
  console.log(`Listo. Ingresa con tu RUT y esta clave temporal (se pide cambiarla al entrar): ${clave}`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
