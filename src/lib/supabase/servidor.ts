import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * Cliente de Supabase para el servidor, con la sesión del usuario (respeta RLS).
 * Envía la IP y el navegador del usuario para que la auditoría registre "desde dónde".
 */
export async function clienteServidor() {
  const almacen = await cookies();
  const encabezados = await headers();
  const ip = (encabezados.get("x-forwarded-for") ?? "").split(",")[0].trim() || encabezados.get("x-real-ip") || "";
  const ua = (encabezados.get("user-agent") ?? "").slice(0, 300);

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Llamado desde un componente de servidor: el proxy refresca la sesión.
        }
      },
    },
    global: { headers: { "x-rh-ip": ip, "x-rh-ua": ua } },
  });
}
