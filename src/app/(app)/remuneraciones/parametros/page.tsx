import type { Metadata } from "next";
import { obtenerContexto } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { BotonVerificar } from "./BotonVerificar";

export const metadata: Metadata = { title: "Parámetros legales" };

const fecha = (f: string | null) => (f ? f.split("-").reverse().join("-") : "Sin término");

/** Tabla de parámetros legales: cada valor con su vigencia, fuente oficial y estado de verificación. */
export default async function ParametrosLegales() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const { data } = await supabase.from("parametros_legales").select("*").order("codigo").order("vigente_desde", { ascending: false });
  const filas = data ?? [];
  const porVerificar = filas.filter((p) => p.estado === "por_verificar").length;
  const valor = (p: (typeof filas)[number]) => {
    if (p.valor !== null) return `${Number(p.valor).toLocaleString("es-CL")}${p.unidad === "%" ? "%" : p.unidad === "$" ? "" : ` ${p.unidad}`}`;
    const j = p.valor_json;
    if (Array.isArray(j)) return `Tabla de ${j.length} tramos`;
    return Object.entries(j as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v).replace(/[{}"]/g, "").replace(/,/g, ", ") : v}`).join(" · ");
  };

  return (
    <Pagina>
      <Encabezado
        titulo="Parámetros legales"
        descripcion={`Todos los cálculos usan los valores vigentes en el periodo que se calcula. ${porVerificar} de ${filas.length} valores están por verificar por la contadora.`}
      />
      <div className="overflow-x-auto rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Parámetro</th>
              <th className="px-3 py-2 text-left font-semibold">Valor</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Desde</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Hasta</th>
              <th className="px-3 py-2 text-left font-semibold">Fuente</th>
              <th className="w-40 px-3 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-1.5"><div className="font-medium">{p.descripcion}</div><div className="font-mono text-[11px] text-texto-suave">{p.codigo}</div></td>
                <td className="numeros max-w-xs px-3 py-1.5 text-xs">{valor(p)}</td>
                <td className="numeros px-3 py-1.5">{fecha(p.vigente_desde)}</td>
                <td className="numeros px-3 py-1.5">{fecha(p.vigente_hasta)}</td>
                <td className="px-3 py-1.5 text-xs">
                  {p.fuente_url ? <a href={p.fuente_url} target="_blank" rel="noopener noreferrer" className="text-azul underline">{p.fuente_nombre}</a> : p.fuente_nombre}
                  {p.notas && <div className="text-texto-suave">{p.notas}</div>}
                </td>
                <td className="px-3 py-1.5">
                  {p.estado === "verificado" ? (
                    <><Etiqueta tono="verde">Verificado</Etiqueta><div className="text-[11px] text-texto-suave">{p.verificado_por} · {fecha(p.verificado_at)}</div></>
                  ) : (
                    <>
                      <Etiqueta tono="ambar">Por verificar</Etiqueta>
                      {ctx.usuario.es_superadmin && <BotonVerificar id={p.id} />}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-texto-suave">
        Solo el superadministrador puede cargar o modificar parámetros, siempre con su fuente y vigencia. Cada cambio queda en la auditoría.
        Los valores mensuales (UF, UTM, topes, tasas de AFP y SIS) deben cargarse cada mes desde Previred, el SII o la CMF.
      </p>
    </Pagina>
  );
}
