import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto, esContador, MODULOS } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { FormularioInvitacion } from "./FormularioInvitacion";
import { PermisosMembresia } from "./PermisosMembresia";

export const metadata: Metadata = { title: "Usuarios y permisos" };

const ROL: Record<string, string> = { contador: "Contador", asistente: "Asistente", cliente: "Cliente", lector: "Solo lectura" };

export default async function Usuarios() {
  const ctx = await obtenerContexto();
  if (!esContador(ctx) || !ctx.estudio) redirect("/mi-mes");
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("membresias")
    .select("id, rol, permisos, activa, empresa_id, usuarios(id, rut, nombre, correo, requiere_2fa), empresas(razon_social)")
    .eq("estudio_id", ctx.estudio.id)
    .order("created_at");

  type Fila = {
    id: string; rol: string; permisos: Record<string, boolean>; activa: boolean; empresa_id: string | null;
    usuarios: { id: string; rut: string; nombre: string; correo: string; requiere_2fa: boolean };
    empresas: { razon_social: string } | null;
  };
  const membresias = (data ?? []) as unknown as Fila[];

  // Agrupar por usuario.
  const porUsuario = new Map<string, { usuario: Fila["usuarios"]; accesos: Fila[] }>();
  for (const m of membresias) {
    const g = porUsuario.get(m.usuarios.id) ?? { usuario: m.usuarios, accesos: [] };
    g.accesos.push(m);
    porUsuario.set(m.usuarios.id, g);
  }
  const grupos = [...porUsuario.values()].sort((a, b) => a.usuario.nombre.localeCompare(b.usuario.nombre, "es"));

  return (
    <Pagina>
      <Encabezado titulo="Usuarios y permisos" descripcion="Quién trabaja en el estudio y qué puede ver en cada empresa." />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {grupos.map(({ usuario, accesos }) => (
            <section key={usuario.id} className="rounded-lg border border-borde bg-white">
              <header className="flex flex-wrap items-center gap-3 border-b border-borde px-4 py-3">
                <div>
                  <p className="font-semibold text-texto">
                    {usuario.nombre}
                    {usuario.id === ctx.usuario.id && <span className="ml-2 text-xs font-normal text-texto-suave">(tú)</span>}
                  </p>
                  <p className="numeros text-xs text-texto-suave">{formatearRut(usuario.rut)} · {usuario.correo}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  {usuario.requiere_2fa ? <Etiqueta tono="verde">2FA obligatorio</Etiqueta> : <Etiqueta tono="gris">Sin 2FA</Etiqueta>}
                </div>
              </header>
              <table className="w-full text-sm">
                <tbody>
                  {accesos.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100 first:border-t-0">
                      <td className="w-32 px-4 py-2"><Etiqueta tono={a.rol === "contador" ? "azul" : "gris"}>{ROL[a.rol]}</Etiqueta></td>
                      <td className="px-2 py-2 text-texto">{a.empresas?.razon_social ?? "Todas las empresas del estudio"}</td>
                      <td className="px-4 py-2">
                        <PermisosMembresia
                          id={a.id}
                          rol={a.rol}
                          activa={a.activa}
                          permisos={a.permisos}
                          modulos={MODULOS}
                          esPropia={usuario.id === ctx.usuario.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <FormularioInvitacion
          empresas={ctx.empresas.filter((e) => e.activa).map((e) => ({ id: e.id, nombre: e.razon_social }))}
          modulos={MODULOS}
          esDemo={ctx.estudio.es_demo}
        />
      </div>
    </Pagina>
  );
}
