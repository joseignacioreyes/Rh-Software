import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto, nombrePeriodo, permiso, MODULOS } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { estadoDelMes } from "@/lib/servicios/estado-mes";
import { Parametros } from "@/lib/parametros";
import { formatoFecha, ZONA_HORARIA } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";

export const metadata: Metadata = { title: "Calendario" };

const RUTA: Record<string, { tarea: string; href: string; parametro: string }> = {
  F29: { tarea: "f29", href: "/impuestos/f29", parametro: "VENC_F29_DIA_ELECTRONICO" },
  Previred: { tarea: "previred", href: "/remuneraciones/previred", parametro: "VENC_PREVIRED_DIA_ELECTRONICO" },
  LRE: { tarea: "lre", href: "/remuneraciones/lre", parametro: "VENC_LRE_DIA" },
};

/** Calendario tributario y laboral del periodo: vencimientos de todas las empresas, con su estado. */
export default async function Calendario() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const empresas = ctx.empresas.filter((e) => e.activa);
  const [estados, params] = await Promise.all([
    estadoDelMes(supabase, empresas, ctx.periodo, (id) => Object.fromEntries(MODULOS.map((m) => [m.codigo, permiso(ctx, id, m.codigo).ver]))),
    Parametros.cargar(supabase),
  ]);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
  const clavePeriodo = `${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`;
  const fechaRef = `${clavePeriodo}-01`;

  const filas = estados
    .flatMap((e) => e.vencimientos.map((v) => ({ ...v, empresa: empresas.find((x) => x.id === e.empresaId)!, tarea: e.tareas[RUTA[v.que]?.tarea ?? ""] })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.empresa.razon_social.localeCompare(b.empresa.razon_social));
  const dias = (f: string) => Math.round((Date.parse(f) - Date.parse(hoy)) / 86400000);

  return (
    <Pagina>
      <Encabezado
        titulo={`Calendario · obligaciones de ${nombrePeriodo(ctx.periodo)}`}
        descripcion="Vencimientos de F29, Previred y Libro de Remuneraciones Electrónico de todas tus empresas. Las fechas salen de la tabla de parámetros legales y se corren al día hábil siguiente cuando corresponde."
      />
      <div className="overflow-hidden rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="w-32 px-3 py-2 text-left font-semibold">Vence</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Obligación</th>
              <th className="px-3 py-2 text-left font-semibold">Empresa</th>
              <th className="w-48 px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-texto-suave">Sin obligaciones para el periodo.</td></tr>}
            {filas.map((f, i) => {
              const d = dias(f.fecha);
              const listo = f.tarea?.estado === "listo";
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="numeros px-3 py-1.5 whitespace-nowrap">{formatoFecha(new Date(`${f.fecha}T12:00:00-04:00`))}</td>
                  <td className="px-3 py-1.5 font-medium">{f.que}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/ir?empresa=${f.empresa.id}&periodo=${clavePeriodo}&a=${RUTA[f.que]?.href ?? "/mi-mes"}`} className="hover:text-azul hover:underline">{f.empresa.razon_social}</Link>
                  </td>
                  <td className="px-3 py-1.5">
                    {listo ? <Etiqueta tono="verde">Listo</Etiqueta> : d < 0 ? <Etiqueta tono="rojo">Atrasado {-d} días</Etiqueta> : d <= 5 ? <Etiqueta tono="ambar">Vence en {d} días</Etiqueta> : <Etiqueta tono="gris">Faltan {d} días</Etiqueta>}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-texto-suave">{f.tarea?.detalle ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg border border-borde bg-white p-4 text-xs text-texto-suave">
        <p className="mb-1 font-semibold text-texto">Reglas usadas (tabla de parámetros legales)</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {["VENC_F29_DIA", "VENC_F29_DIA_ELECTRONICO", "VENC_PREVIRED_DIA_ELECTRONICO", "VENC_LRE_DIA"].map((c) => {
            const p = params.buscar(c, fechaRef);
            return p ? (
              <li key={c}>
                {p.descripcion}: día {p.valor}. {p.notas ?? ""} Fuente: {p.fuente_url ? <a href={p.fuente_url} target="_blank" rel="noopener noreferrer" className="underline">{p.fuente_nombre}</a> : p.fuente_nombre}
                {p.estado === "por_verificar" && <span className="ml-1 font-semibold text-ambar">POR VERIFICAR</span>}
              </li>
            ) : null;
          })}
          <li>Declaraciones juradas anuales (DJ 1887, DJ 1879) y Operación Renta: se agregan en una fase posterior.</li>
        </ul>
      </div>
    </Pagina>
  );
}
