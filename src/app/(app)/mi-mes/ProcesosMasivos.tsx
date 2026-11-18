"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calcularF29Empresa } from "../impuestos/f29/acciones";
import { calcularLiquidaciones } from "../remuneraciones/liquidaciones/acciones";
import { formatoPesos } from "@/lib/formato";
import { claseBotonSecundario } from "@/components/ui/estilos";
import type { Periodo } from "@/lib/sesion";

type Resultado = { nombre: string; ok?: string; error?: string; total?: number; avisos?: string[] };

/**
 * Procesos masivos: se ejecutan empresa por empresa con barra de avance y un resumen de errores.
 * (Las remuneraciones y Previred masivos se agregan en las fases 5 y 6.)
 */
export function ProcesosMasivos({ empresasImpuestos, empresasRemuneraciones, periodo }: {
  empresasImpuestos: { id: string; nombre: string }[];
  empresasRemuneraciones: { id: string; nombre: string }[];
  periodo: Periodo;
}) {
  const router = useRouter();
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [avance, setAvance] = useState(0);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  const todas = [
    { titulo: "Calcular F29 de todas mis empresas", ejecutar: calcularF29Empresa, empresas: empresasImpuestos },
    { titulo: "Generar liquidaciones de todas", ejecutar: calcularLiquidaciones, empresas: empresasRemuneraciones },
  ].filter((a) => a.empresas.length > 0);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);

  async function correr(titulo: string, ejecutar: (typeof todas)[number]["ejecutar"], empresas: { id: string; nombre: string }[]) {
    setEmpresas(empresas);
    setCorriendo(titulo);
    setAvance(0);
    let lista: Resultado[] = [];
    setResultados([]);
    for (let i = 0; i < empresas.length; i++) {
      const e = empresas[i];
      try {
        const r = await ejecutar(e.id, periodo);
        lista = [...lista, { nombre: e.nombre, ...r }];
      } catch (err) {
        lista = [...lista, { nombre: e.nombre, error: (err as Error).message }];
      }
      setResultados(lista);
      setAvance(i + 1);
    }
    setCorriendo(null);
    router.refresh();
  }

  const errores = (resultados ?? []).filter((r) => r.error);
  return (
    <div className="mb-4 rounded-lg border border-borde bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-azul">Procesos masivos:</span>
        {todas.map((a) => (
          <button key={a.titulo} type="button" disabled={!!corriendo} className={claseBotonSecundario} onClick={() => correr(a.titulo, a.ejecutar, a.empresas)}>
            {a.titulo}
          </button>
        ))}
      </div>
      {resultados && (
        <div className="mt-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={empresas.length} aria-valuenow={avance}>
              <div className="h-full bg-verde transition-all" style={{ width: `${(avance / empresas.length) * 100}%` }} />
            </div>
            <span className="numeros text-texto-suave">{avance} de {empresas.length}</span>
            {!corriendo && <span className={errores.length ? "text-rojo" : "text-verde"}>{errores.length ? `${errores.length} con error` : "Todo listo"}</span>}
          </div>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
            {resultados.map((r) => (
              <li key={r.nombre} className={`rounded px-2 py-1 ${r.error ? "bg-red-50 text-rojo" : "bg-emerald-50 text-texto"}`}>
                <strong>{r.nombre}:</strong> {r.error ?? `${r.ok}${r.total !== undefined ? ` Total ${formatoPesos(r.total)}` : ""}`}
                {(r.avisos ?? []).length > 0 && <span className="block text-ambar">{r.avisos!.length} avisos para revisar</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
