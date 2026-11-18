import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_EMPRESA, COOKIE_PERIODO } from "@/lib/sesion";

/**
 * Link directo a una tarea de una empresa: /ir?empresa=<id>&periodo=2026-10&a=/contabilidad/comprobantes
 * Cambia la empresa (y el periodo) de trabajo y lleva a la pantalla. Lo usa "Mi mes".
 */
export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const a = p.get("a") ?? "/mi-mes";
  // Solo rutas internas.
  const destino = new URL(a.startsWith("/") && !a.startsWith("//") ? a : "/mi-mes", request.url);
  const respuesta = NextResponse.redirect(destino);
  const opciones = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
  const empresa = p.get("empresa");
  if (empresa && /^[0-9a-f-]{36}$/.test(empresa)) respuesta.cookies.set(COOKIE_EMPRESA, empresa, opciones);
  const periodo = p.get("periodo");
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) respuesta.cookies.set(COOKIE_PERIODO, periodo, opciones);
  return respuesta;
}
