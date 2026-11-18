"use client";

import { useState } from "react";
import { formatoPesos } from "@/lib/formato";

export type Linea = {
  codigo: string;
  nombre: string;
  tipo: string;
  monto: number;
  detalle: {
    formula: string;
    calculo: string;
    parametros: { codigo: string; descripcion: string; valor: unknown; unidad: string; vigente_desde: string; fuente: string; fuente_url: string | null; estado: string }[];
  };
};

/** Un bloque de la liquidación con "Ver cómo se calculó" en cada línea. */
export function LineasLiquidacion({ titulo, lineas, total, informativo = false }: { titulo: string; lineas: Linea[]; total?: number; informativo?: boolean }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (!lineas.length) return null;
  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-borde bg-white">
      <h2 className="bg-fondo-suave px-4 py-2 text-sm font-bold text-azul">{titulo}</h2>
      <ul>
        {lineas.map((l) => (
          <li key={l.codigo} className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => setAbierta(abierta === l.codigo ? null : l.codigo)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-celeste/30"
              aria-expanded={abierta === l.codigo}
            >
              <span>{l.nombre}</span>
              <span className="flex items-center gap-3">
                <span className="numeros">{informativo && l.codigo === "dias" ? `${l.monto} días` : formatoPesos(Number(l.monto))}</span>
                <span className="text-xs text-azul" title="Ver cómo se calculó">{abierta === l.codigo ? "▲" : "?"}</span>
              </span>
            </button>
            {abierta === l.codigo && (
              <div className="space-y-1 bg-fondo-suave px-4 py-2 text-xs text-texto-suave">
                <p><strong className="text-texto">Fórmula:</strong> {l.detalle.formula}</p>
                <p><strong className="text-texto">Cálculo:</strong> <span className="numeros">{l.detalle.calculo}</span></p>
                {l.detalle.parametros?.length > 0 && (
                  <div>
                    <strong className="text-texto">Parámetros legales:</strong>
                    <ul className="mt-0.5 list-disc pl-5">
                      {l.detalle.parametros.map((p) => (
                        <li key={`${p.codigo}${p.vigente_desde}`}>
                          {p.descripcion} ({typeof p.valor === "number" ? `${p.valor.toLocaleString("es-CL")}${p.unidad === "%" ? "%" : p.unidad === "UF" ? " UF" : ""}` : "tabla"}), vigente desde {p.vigente_desde.split("-").reverse().join("-")}.
                          Fuente: {p.fuente_url ? <a href={p.fuente_url} target="_blank" rel="noopener noreferrer" className="underline">{p.fuente}</a> : p.fuente}
                          {p.estado === "por_verificar" && <span className="ml-1 font-semibold text-ambar">POR VERIFICAR</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {total !== undefined && (
        <div className="flex justify-between border-t border-borde px-4 py-2 text-sm font-semibold">
          <span>Total</span><span className="numeros">{formatoPesos(total)}</span>
        </div>
      )}
    </section>
  );
}
