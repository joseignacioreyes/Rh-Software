import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio: SALTA las reglas de seguridad (RLS).
 * Usar solo en el servidor y solo para tareas acotadas:
 *  - buscar el correo asociado a un RUT al iniciar sesión;
 *  - contar intentos de inicio de sesión;
 *  - crear cuentas de usuarios invitados (después de verificar que quien invita es contador).
 */
export function clienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
