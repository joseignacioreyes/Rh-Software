import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { DEMO } from "@/lib/demo";

/**
 * "Ver demo": entra al Estudio Contable Demo con un usuario de solo lectura.
 * La base de datos impide cualquier modificación a ese usuario (rol "lector").
 */
async function entrarDemo(request: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO.visitante.correo,
    password: process.env.DEMO_CLAVE_VISITANTE || DEMO.clave,
  });
  const destino = new URL(error ? "/ingresar?error=demo" : "/mi-mes", request.url);
  return NextResponse.redirect(destino, { status: 303 });
}

export const GET = entrarDemo;
export const POST = entrarDemo;
