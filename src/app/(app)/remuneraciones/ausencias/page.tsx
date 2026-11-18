import type { Metadata } from "next";
import { contextoModulo } from "@/lib/contexto-contable";
import { Parametros } from "@/lib/parametros";
import { saldoVacaciones } from "@/lib/finiquito";
import { formatoFecha, ZONA_HORARIA } from "@/lib/formato";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { Formularios } from "./Formularios";
import { BotonEliminar } from "./BotonEliminar";

export const metadata: Metadata = { title: "Vacaciones y licencias" };

const TIPO_LICENCIA: Record<string, string> = { enfermedad: "Enfermedad", accidente_trabajo: "Accidente del trabajo", maternal: "Maternal", hijo_menor: "Hijo menor de 1 año", otra: "Otra" };
const f = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));

export default async function Ausencias() {
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
  const [{ data: trabajadores }, { data: vac }, { data: lic }, params] = await Promise.all([
    supabase.from("trabajadores").select("id, nombres, apellido_paterno, fecha_ingreso, anios_previos_cotizados").eq("empresa_id", empresa.id).eq("activo", true).order("apellido_paterno"),
    supabase.from("vacaciones").select("id, trabajador_id, desde, hasta, dias_habiles").eq("empresa_id", empresa.id).order("desde", { ascending: false }),
    supabase.from("licencias").select("id, trabajador_id, folio, tipo, desde, hasta, rut_pagadora").eq("empresa_id", empresa.id).order("desde", { ascending: false }),
    Parametros.cargar(supabase),
  ]);
  const nombre = new Map((trabajadores ?? []).map((t) => [t.id, `${t.nombres} ${t.apellido_paterno}`]));

  return (
    <Pagina>
      <Encabezado titulo="Vacaciones y licencias médicas" descripcion={`${empresa.razon_social} · Saldos al ${f(hoy)}. Las licencias registradas descuentan días en la liquidación y se informan en Previred y el LRE.`} />
      {puedeEditar && <Formularios trabajadores={(trabajadores ?? []).map((t) => ({ id: t.id, nombre: `${t.nombres} ${t.apellido_paterno}` }))} />}

      <h2 className="mt-5 mb-2 text-base font-bold text-azul">Saldo de vacaciones</h2>
      <div className="overflow-hidden rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Trabajador</th>
              <th className="px-3 py-2 text-left font-semibold">Ingreso</th>
              <th className="px-3 py-2 text-right font-semibold">Ganados</th>
              <th className="px-3 py-2 text-right font-semibold">Progresivos</th>
              <th className="px-3 py-2 text-right font-semibold">Tomados</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo</th>
              <th className="px-3 py-2 text-right font-semibold">Proporcional año en curso</th>
            </tr>
          </thead>
          <tbody>
            {(trabajadores ?? []).map((t) => {
              const tomados = (vac ?? []).filter((v) => v.trabajador_id === t.id).reduce((s, v) => s + Number(v.dias_habiles), 0);
              const s = saldoVacaciones(t.fecha_ingreso, hoy, t.anios_previos_cotizados, tomados, params);
              return (
                <tr key={t.id} className="border-t border-gray-100" title={s.detalle}>
                  <td className="px-3 py-1.5">{nombre.get(t.id)}</td>
                  <td className="numeros px-3 py-1.5">{f(t.fecha_ingreso)}</td>
                  <td className="numeros px-3 py-1.5 text-right">{s.ganadosLegales}</td>
                  <td className="numeros px-3 py-1.5 text-right">{s.progresivos}</td>
                  <td className="numeros px-3 py-1.5 text-right">{s.tomados.toLocaleString("es-CL")}</td>
                  <td className={`numeros px-3 py-1.5 text-right font-semibold ${s.saldo > 30 ? "text-ambar" : ""}`}>{s.saldo.toLocaleString("es-CL")}</td>
                  <td className="numeros px-3 py-1.5 text-right text-texto-suave">{s.proporcionalAnioEnCurso.toLocaleString("es-CL")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-borde px-3 py-2 text-xs text-texto-suave">Días hábiles. 15 por año completo (art. 67) más feriado progresivo (art. 68). Un saldo mayor a 30 días (dos períodos) se marca para revisar.</p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-base font-bold text-azul">Vacaciones registradas</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-borde bg-white text-sm">
            {(vac ?? []).length === 0 && <li className="px-3 py-4 text-center text-texto-suave">Sin vacaciones registradas.</li>}
            {(vac ?? []).slice(0, 30).map((v) => (
              <li key={v.id} className="flex items-center justify-between px-3 py-1.5">
                <span>{nombre.get(v.trabajador_id)} · <span className="numeros">{f(v.desde)} al {f(v.hasta)}</span> · {Number(v.dias_habiles)} días hábiles</span>
                {puedeEditar && <BotonEliminar tabla="vacaciones" id={v.id} />}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-base font-bold text-azul">Licencias médicas</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-borde bg-white text-sm">
            {(lic ?? []).length === 0 && <li className="px-3 py-4 text-center text-texto-suave">Sin licencias registradas.</li>}
            {(lic ?? []).slice(0, 30).map((l) => (
              <li key={l.id} className="flex items-center justify-between px-3 py-1.5">
                <span>{nombre.get(l.trabajador_id)} · <span className="numeros">{f(l.desde)} al {f(l.hasta)}</span> · {TIPO_LICENCIA[l.tipo]}{l.folio ? ` · folio ${l.folio}` : ""}</span>
                {puedeEditar && <BotonEliminar tabla="licencias" id={l.id} />}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Pagina>
  );
}
