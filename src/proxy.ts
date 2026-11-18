import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas públicas: no requieren sesión.
const PUBLICAS = ["/", "/privacidad", "/terminos", "/ingresar", "/demo", "/registro"];

function esPublica(ruta: string) {
  return PUBLICAS.some((p) => ruta === p || (p !== "/" && ruta.startsWith(p + "/")));
}

/**
 * Refresca la sesión de Supabase en cada visita y manda a /ingresar a quien no tenga sesión.
 * Es solo un control "optimista": los permisos reales los aplica la base de datos (RLS).
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  if (!user && !esPublica(ruta)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  // Todo menos archivos estáticos e íconos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|opengraph-image|brand/).*)"],
};
