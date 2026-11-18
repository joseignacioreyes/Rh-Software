"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { baseSugerida, calcularFiniquitoAccion } from "./acciones";
import type { ResultadoFiniquito } from "@/lib/finiquito";
import { formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito, claseInput } from "@/components/ui/estilos";

export function NuevoFiniquito({ trabajadores, causales }: { trabajadores: { id: string; nombre: string }[]; causales: { codigo: number; texto: string }[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [base, setBase] = useState("");
  const [notaBase, setNotaBase] = useState<string | null>(null);
  const [res, setRes] = useState<{ error?: string; resultado?: ResultadoFiniquito; id?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const ejecutar = (guardar: boolean) => iniciar(async () => {
    const r = await calcularFiniquitoAccion(new FormData(form.current!), guardar);
    setRes(r);
    if (r.id) router.refresh();
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form ref={form} className="space-y-2 rounded-lg border border-borde bg-white p-4" onSubmit={(e) => { e.preventDefault(); ejecutar(false); }}>
        <h2 className="font-bold text-azul">Nuevo finiquito</h2>
        <label className="block text-sm">Trabajador
          <select name="trabajador_id" className={claseInput} required defaultValue="" onChange={(e) => iniciar(async () => {
            const s = await baseSugerida(e.target.value);
            setBase(s.base.toLocaleString("es-CL"));
            setNotaBase(s.desde ? `Sugerida desde la liquidación de ${s.desde}: sueldo + gratificación + colación + movilización. Ajústala si corresponde (art. 172).` : "Sin liquidaciones: escribe la última remuneración mensual.");
          })}>
            <option value="" disabled>Elegir…</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="block text-sm">Fecha de término<input type="date" name="fecha_termino" className={claseInput} required /></label>
        <label className="block text-sm">Causal
          <select name="causal" className={claseInput} required defaultValue="">
            <option value="" disabled>Elegir…</option>
            {causales.map((c) => <option key={c.codigo} value={c.codigo}>{c.texto}</option>)}
          </select>
        </label>
        <label className="block text-sm">Última remuneración mensual (base)
          <input name="remuneracion_base" value={base} onChange={(e) => setBase(e.target.value)} inputMode="numeric" className={`${claseInput} numeros`} required />
        </label>
        {notaBase && <p className="text-xs text-texto-suave">{notaBase}</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="aviso_previo_dado" className="h-4 w-4 accent-azul" />Se dio aviso con 30 días de anticipación</label>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={pendiente} className={claseBotonSecundario}>Calcular</button>
          <button type="button" disabled={pendiente || !res?.resultado} className={claseBotonPrimario} onClick={() => ejecutar(true)}>Guardar borrador</button>
        </div>
      </form>
      <div>
        {res?.error && <p className={claseError}>{res.error}</p>}
        {res?.id && <p className={`${claseExito} mb-2`}>Finiquito guardado como borrador. Revísalo y márcalo como revisado.</p>}
        {res?.resultado && (
          <div className="overflow-hidden rounded-lg border border-borde bg-white">
            <ul>
              {res.resultado.lineas.map((l) => (
                <li key={l.concepto} className="border-b border-gray-100 px-4 py-2 text-sm">
                  <div className="flex justify-between"><span className="font-medium">{l.concepto}</span><span className="numeros font-semibold">{formatoPesos(l.monto)}</span></div>
                  <p className="mt-0.5 text-xs text-texto-suave"><strong>Cómo se calculó:</strong> {l.calculo}</p>
                  <p className="text-xs text-texto-suave">{l.formula}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-between bg-fondo-suave px-4 py-2 font-bold"><span>Total finiquito</span><span className="numeros">{formatoPesos(res.resultado.total)}</span></div>
            <ul className="list-disc space-y-0.5 py-2 pr-3 pl-8 text-xs text-ambar">{res.resultado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
