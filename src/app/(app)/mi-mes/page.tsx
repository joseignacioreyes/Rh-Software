import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto, nombrePeriodo, permiso, MODULOS } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { estadoDelMes, type Semaforo } from "@/lib/servicios/estado-mes";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { ProcesosMasivos } from "./ProcesosMasivos";

export const metadata: Metadata = { title: "Mi mes" };

const ESTILO: Record<Semaforo, { punto: string; texto: string }> = {
  listo: { punto: "bg-verde", texto: "Al día" },
  revisar: { punto: "bg-ambar", texto: "Revisar o por vencer" },
  atrasado: { punto: "bg-rojo", texto: "Atrasado" },
  pronto: { punto: "bg-gray-200", texto: "Próximamente" },
  na: { punto: "bg-gray-200", texto: "No aplica" },
};

const TAREAS = [
  { clave: "libros", titulo: "Libros importados" },
  { clave: "comprobantes", titulo: "Comprobantes" },
  { clave: "f29", titulo: "F29" },
  { clave: "remuneraciones", titulo: "Remuneraciones" },
  { clave: "previred", titulo: "Previred" },
  { clave: "lre", titulo: "LRE" },
  { clave: "documentos", titulo: "Docs. del cliente" },
  { clave: "cierre", titulo: "Cierre" },
];

export default async function MiMes() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const empresas = ctx.empresas.filter((e) => e.activa);
  const clavePeriodo = `${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`;
  const estados = await estadoDelMes(supabase, empresas, ctx.periodo, (id) =>
    Object.fromEntries(MODULOS.map((m) => [m.codigo, permiso(ctx, id, m.codigo).ver])),
  );
  const porEmpresa = new Map(estados.map((e) => [e.empresaId, e]));
  const avisos = estados.flatMap((e) => e.avisos).sort((a, b) => (a.tono === b.tono ? 0 : a.tono === "rojo" ? -1 : 1));
  const conteo = (s: Semaforo) => estados.reduce((n, e) => n + Object.values(e.tareas).filter((t) => t.estado === s).length, 0);
  const puedeImpuestos = empresas.filter((e) => permiso(ctx, e.id, "impuestos").editar);

  return (
    <Pagina>
      <Encabezado
        titulo={`Mi mes · ${nombrePeriodo(ctx.periodo)}`}
        descripcion="Todas tus empresas y el estado de cada tarea del mes. Haz clic en un punto para ir directo a la tarea."
      >
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rojo" />{conteo("atrasado")} atrasadas</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ambar" />{conteo("revisar")} por revisar</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-verde" />{conteo("listo")} al día</span>
        </div>
      </Encabezado>

      {puedeImpuestos.length > 0 && (
        <ProcesosMasivos empresas={puedeImpuestos.map((e) => ({ id: e.id, nombre: e.razon_social }))} periodo={ctx.periodo} />
      )}

      {avisos.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {avisos.slice(0, 8).map((a) => (
            <li key={a.texto} className={`rounded-md border px-3 py-2 text-sm ${a.tono === "rojo" ? "border-rojo/30 bg-red-50" : "border-ambar/30 bg-amber-50"}`}>
              <strong className={a.tono === "rojo" ? "text-rojo" : "text-ambar"}>{a.tono === "rojo" ? "Atrasado:" : "Revisar:"}</strong> {a.texto}
            </li>
          ))}
        </ul>
      )}

      {empresas.length === 0 ? (
        <Vacio titulo="No tienes empresas asignadas">
          {ctx.rolEstudio === "contador" ? <Link href="/empresas/nueva" className="text-azul underline">Crea la primera empresa</Link> : "Pide a tu contador que te asigne empresas."}
        </Vacio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Empresa</th>
                {TAREAS.map((t) => <th key={t.clave} scope="col" className="px-2 py-2.5 text-center font-semibold">{t.titulo}</th>)}
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Vencimientos</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => {
                const est = porEmpresa.get(empresa.id);
                return (
                  <tr key={empresa.id} className={`border-t border-borde ${ctx.empresa?.id === empresa.id ? "bg-celeste/40" : ""}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/ir?empresa=${empresa.id}&a=/empresas/${empresa.id}`} className="font-medium text-texto hover:text-azul hover:underline">{empresa.razon_social}</Link>
                      <div className="numeros text-xs text-texto-suave">{formatearRut(empresa.rut)}</div>
                    </td>
                    {TAREAS.map((t) => {
                      const s = est?.tareas[t.clave] ?? { estado: "na" as Semaforo, detalle: "" };
                      const punto = (
                        <span className="inline-flex flex-col items-center">
                          <span className={`inline-block h-3.5 w-3.5 rounded-full ${ESTILO[s.estado].punto}`} aria-hidden="true" />
                          <span className="sr-only">{t.titulo}: {ESTILO[s.estado].texto}. {s.detalle}</span>
                        </span>
                      );
                      return (
                        <td key={t.clave} className="px-2 py-2.5 text-center" title={`${ESTILO[s.estado].texto}: ${s.detalle}`}>
                          {s.href ? (
                            <Link href={`/ir?empresa=${empresa.id}&periodo=${clavePeriodo}&a=${s.href}`} className="inline-block rounded p-1 hover:bg-celeste">{punto}</Link>
                          ) : punto}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-xs text-texto-suave">
                      {(est?.vencimientos ?? []).map((v) => (
                        <div key={v.que} className="numeros whitespace-nowrap">{v.que}: {v.fecha.slice(8, 10)}-{v.fecha.slice(5, 7)}</div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-borde bg-fondo-suave px-4 py-2 text-xs text-texto-suave">
            {(["listo", "revisar", "atrasado", "na"] as Semaforo[]).map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${ESTILO[e].punto}`} aria-hidden="true" />{ESTILO[e].texto}</span>
            ))}
            <span className="ml-auto">Pasa el mouse sobre un punto para ver el detalle.</span>
          </div>
        </div>
      )}
    </Pagina>
  );
}
