import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { formatoFecha } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseBotonSecundario } from "@/components/ui/estilos";
import { CambiarClave } from "./CambiarClave";

export const metadata: Metadata = { title: "Seguridad" };

export default async function Seguridad() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const totp = (factores?.totp ?? []).filter((f) => f.status === "verified");

  return (
    <Pagina>
      <div className="max-w-2xl space-y-5">
        <Encabezado titulo="Seguridad" descripcion={`${ctx.usuario.nombre} · RUT ${formatearRut(ctx.usuario.rut)}`} />

        <section className="rounded-lg border border-borde bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-bold text-texto">Segundo factor (app autenticadora)</h2>
            {totp.length > 0 ? <Etiqueta tono="verde">Activo</Etiqueta> : <Etiqueta tono={ctx.usuario.requiere_2fa ? "rojo" : "gris"}>No configurado</Etiqueta>}
          </div>
          {!ctx.usuario.requiere_2fa && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-ambar">
              Tu cuenta no exige segundo factor{ctx.estudio?.es_demo ? " (solo en el estudio de ejemplo)" : ""}.
            </p>
          )}
          {totp.length > 0 ? (
            <ul className="mb-3 text-sm text-texto-suave">
              {totp.map((f) => (
                <li key={f.id}>{f.friendly_name ?? "App autenticadora"} · activada el {formatoFecha(new Date(f.created_at))}</li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-texto-suave">Al ingresar te pediremos un código de tu teléfono además de tu clave.</p>
          )}
          <Link href="/ingresar/configurar-2fa" className={claseBotonSecundario}>
            {totp.length > 0 ? "Agregar otro teléfono" : "Configurar ahora"}
          </Link>
          <p className="mt-3 text-xs text-texto-suave">
            El segundo factor por correo estará disponible cuando conectemos el servicio de correos (Resend).
          </p>
        </section>

        <section className="rounded-lg border border-borde bg-white p-5">
          <h2 className="mb-3 font-bold text-texto">Cambiar clave</h2>
          <CambiarClave deshabilitado={!!ctx.estudio?.es_demo} />
        </section>
      </div>
    </Pagina>
  );
}
