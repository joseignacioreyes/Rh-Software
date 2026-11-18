import type { Metadata } from "next";
import { contextoModulo } from "@/lib/contexto-contable";
import { CAUSALES } from "@/lib/finiquito";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { NuevoFiniquito } from "./NuevoFiniquito";
import { EstadoFiniquito } from "./EstadoFiniquito";

export const metadata: Metadata = { title: "Finiquitos" };

export default async function Finiquitos() {
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const [{ data: trabajadores }, { data: finiquitos }] = await Promise.all([
    supabase.from("trabajadores").select("id, nombres, apellido_paterno").eq("empresa_id", empresa.id).eq("activo", true).order("apellido_paterno"),
    supabase.from("finiquitos").select("id, trabajador_id, fecha_termino, causal, total, estado, revisado_por, revisado_at, trabajadores(nombres, apellido_paterno)").eq("empresa_id", empresa.id).order("created_at", { ascending: false }),
  ]);
  const revisores = [...new Set((finiquitos ?? []).map((f) => f.revisado_por).filter(Boolean))] as string[];
  const { data: usuarios } = revisores.length ? await supabase.from("usuarios").select("id, nombre").in("id", revisores) : { data: [] };
  const nombreRev = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const tono = { borrador: "ambar", revisado: "azul", firmado: "verde", anulado: "gris" } as const;

  return (
    <Pagina>
      <Encabezado titulo="Finiquitos" descripcion={`${empresa.razon_social} · Cálculo de indemnizaciones con causales del Código del Trabajo. Siempre revisado por el contador antes de firmar.`} />
      {puedeEditar && <NuevoFiniquito trabajadores={(trabajadores ?? []).map((t) => ({ id: t.id, nombre: `${t.nombres} ${t.apellido_paterno}` }))} causales={CAUSALES.map((c) => ({ codigo: c.codigo, texto: c.texto }))} />}
      <h2 className="mt-5 mb-2 text-base font-bold text-azul">Finiquitos de la empresa</h2>
      <div className="overflow-hidden rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Trabajador</th>
              <th className="px-3 py-2 text-left font-semibold">Término</th>
              <th className="px-3 py-2 text-left font-semibold">Causal</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(finiquitos ?? []).length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-texto-suave">Sin finiquitos.</td></tr>}
            {(finiquitos ?? []).map((f) => {
              const t = f.trabajadores as unknown as { nombres: string; apellido_paterno: string };
              return (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{t.nombres} {t.apellido_paterno}</td>
                  <td className="numeros px-3 py-1.5">{formatoFecha(new Date(`${f.fecha_termino}T12:00:00-04:00`))}</td>
                  <td className="px-3 py-1.5 text-xs">{CAUSALES.find((c) => c.codigo === f.causal)?.texto}</td>
                  <td className="numeros px-3 py-1.5 text-right font-semibold">{formatoPesos(Number(f.total))}</td>
                  <td className="px-3 py-1.5">
                    <Etiqueta tono={tono[f.estado as keyof typeof tono]}>{f.estado}</Etiqueta>
                    {f.revisado_por && <div className="text-[11px] text-texto-suave">Revisado por: {nombreRev.get(f.revisado_por)}</div>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">
                    <a href={`/remuneraciones/documentos/pdf?tipo=finiquito&id=${f.id}`} className="text-azul hover:underline">PDF</a>
                    {puedeEditar && <EstadoFiniquito id={f.id} estado={f.estado} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Pagina>
  );
}
