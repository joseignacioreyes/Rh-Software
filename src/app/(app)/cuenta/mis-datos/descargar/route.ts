import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/** Portabilidad: entrega los datos personales del usuario en JSON. */
export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const [perfil, membresias, consentimientos, solicitudes, actividad] = await Promise.all([
    supabase.from("usuarios").select("rut, nombre, correo, requiere_2fa, created_at").eq("id", user.id).single(),
    supabase.from("membresias").select("rol, permisos, activa, created_at, estudios(nombre), empresas(razon_social)").eq("usuario_id", user.id),
    supabase.from("consentimientos").select("tipo, version, aceptado, created_at").eq("usuario_id", user.id),
    supabase.from("solicitudes_titular").select("tipo, estado, detalle, created_at").eq("usuario_id", user.id),
    // La auditoría propia solo la ve el contador; aquí se entrega lo que el usuario puede ver.
    supabase.from("auditoria").select("accion, tabla, created_at, ip").eq("usuario_id", user.id).limit(5000),
  ]);
  await supabase.rpc("registrar_evento", { p_accion: "exportacion", p_detalle: { que: "mis_datos" } });

  const cuerpo = {
    generado: new Date().toISOString(),
    fuente: "RH Software",
    perfil: perfil.data,
    accesos: membresias.data,
    consentimientos: consentimientos.data,
    solicitudes: solicitudes.data,
    actividad: actividad.data,
  };
  return new NextResponse(JSON.stringify(cuerpo, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mis-datos-rhsoftware.json"`,
    },
  });
}
