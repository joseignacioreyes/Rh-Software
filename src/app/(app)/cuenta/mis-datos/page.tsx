import type { Metadata } from "next";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { formatoFecha } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseBotonSecundario } from "@/components/ui/estilos";
import { SolicitudTitular } from "./SolicitudTitular";

export const metadata: Metadata = { title: "Mis datos" };

const TIPO: Record<string, string> = {
  acceso: "Acceso", rectificacion: "Rectificación", supresion: "Eliminación", oposicion: "Oposición", portabilidad: "Portabilidad",
};

/** Derechos del titular (Ley 21.719): ver, descargar y pedir la eliminación de sus datos. */
export default async function MisDatos() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data: solicitudes } = await supabase
    .from("solicitudes_titular")
    .select("id, tipo, estado, created_at")
    .order("created_at", { ascending: false });

  return (
    <Pagina>
      <div className="max-w-2xl space-y-5">
        <Encabezado titulo="Mis datos" descripcion="Lo que RH Software guarda sobre ti y cómo ejercer tus derechos." />
        <section className="rounded-lg border border-borde bg-white p-5 text-sm">
          <h2 className="mb-3 font-bold text-texto">Tus datos de cuenta</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
            <dt className="text-texto-suave">Nombre</dt><dd>{ctx.usuario.nombre}</dd>
            <dt className="text-texto-suave">RUT</dt><dd className="numeros">{formatearRut(ctx.usuario.rut)}</dd>
            <dt className="text-texto-suave">Correo</dt><dd>{ctx.usuario.correo}</dd>
            <dt className="text-texto-suave">Estudios</dt><dd>{ctx.estudios.map((e) => e.nombre).join(", ") || "Ninguno"}</dd>
          </dl>
          <a href="/cuenta/mis-datos/descargar" className={`${claseBotonSecundario} mt-4`}>Descargar mis datos (JSON)</a>
          <p className="mt-2 text-xs text-texto-suave">
            Incluye tu perfil, tus accesos, tus consentimientos y tu historial de actividad. Los datos contables de las empresas
            pertenecen a cada empresa: los exporta su contador.
          </p>
        </section>

        <SolicitudTitular />

        {(solicitudes ?? []).length > 0 && (
          <section className="rounded-lg border border-borde bg-white p-5 text-sm">
            <h2 className="mb-3 font-bold text-texto">Tus solicitudes</h2>
            <ul className="space-y-1">
              {solicitudes!.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="numeros text-texto-suave">{formatoFecha(new Date(s.created_at))}</span>
                  <span>{TIPO[s.tipo]}</span>
                  <Etiqueta tono={s.estado === "respondida" ? "verde" : "ambar"}>{s.estado.replace("_", " ")}</Etiqueta>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Pagina>
  );
}
