"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deshacer, marcarDiferencia, parear } from "./acciones";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { claseBotonPrimario, claseError } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Encabezado";

export type FilaConciliacion = {
  id: string; fecha: string; descripcion: string; documento: string | null; monto: number;
  estado: "conciliado" | "diferencia" | "sugerido" | "pendiente"; detalle: string; sugerencia: string | null; automatica: boolean;
};

const ESTADO = {
  conciliado: <Etiqueta tono="verde">Conciliado</Etiqueta>,
  diferencia: <Etiqueta tono="ambar">Diferencia</Etiqueta>,
  sugerido: <Etiqueta tono="azul">Sugerido</Etiqueta>,
  pendiente: <Etiqueta tono="rojo">Sin pareo</Etiqueta>,
};

export function Conciliacion({ filas, lineasLibres, puedeEditar }: { filas: FilaConciliacion[]; lineasLibres: { id: string; texto: string; monto: number }[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "pendientes">("todos");
  const sugeridos = filas.filter((f) => f.estado === "sugerido");
  const visibles = filtro === "pendientes" ? filas.filter((f) => f.estado === "pendiente" || f.estado === "sugerido") : filas;

  function ejecutar(p: Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await p;
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          <button type="button" onClick={() => setFiltro("todos")} className={`px-3 py-1.5 ${filtro === "todos" ? "bg-azul text-white" : "bg-white"}`}>Todos</button>
          <button type="button" onClick={() => setFiltro("pendientes")} className={`px-3 py-1.5 ${filtro === "pendientes" ? "bg-azul text-white" : "bg-white"}`}>Por conciliar</button>
        </div>
        {puedeEditar && sugeridos.length > 0 && (
          <button type="button" disabled={pendiente} className={claseBotonPrimario} onClick={() => ejecutar(parear(sugeridos.map((s) => ({ movimiento_id: s.id, linea_id: s.sugerencia! })), true))}>
            Aceptar {sugeridos.length} pareos sugeridos
          </button>
        )}
        {error && <span className={claseError}>{error}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="w-24 px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Movimiento de la cartola</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Monto</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Asiento contable / nota</th>
              {puedeEditar && <th className="w-56 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-texto-suave">Sin movimientos en este periodo. Importa la cartola del mes.</td></tr>}
            {visibles.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 align-top">
                <td className="numeros px-3 py-1.5 whitespace-nowrap">{formatoFecha(new Date(`${f.fecha}T12:00:00-04:00`))}</td>
                <td className="px-3 py-1.5">{f.descripcion}{f.documento && <span className="ml-2 text-xs text-texto-suave">doc. {f.documento}</span>}</td>
                <td className={`numeros px-3 py-1.5 text-right ${f.monto < 0 ? "text-rojo" : "text-verde"}`}>{formatoPesos(f.monto)}</td>
                <td className="px-3 py-1.5">{ESTADO[f.estado]}{f.automatica && <span className="ml-1 text-[10px] text-texto-suave">auto</span>}</td>
                <td className="px-3 py-1.5 text-xs text-texto-suave">{f.detalle}</td>
                {puedeEditar && (
                  <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap">
                    {f.estado === "sugerido" && (
                      <button type="button" className="font-medium text-azul hover:underline" onClick={() => ejecutar(parear([{ movimiento_id: f.id, linea_id: f.sugerencia! }]))}>Aceptar</button>
                    )}
                    {(f.estado === "pendiente" || f.estado === "sugerido") && (
                      <>
                        <select
                          className="ml-2 w-28 rounded border border-gray-300 text-xs"
                          defaultValue=""
                          onChange={(e) => e.target.value && ejecutar(parear([{ movimiento_id: f.id, linea_id: e.target.value }]))}
                          aria-label="Parear con otro asiento"
                        >
                          <option value="">Parear con…</option>
                          {lineasLibres.filter((l) => Math.sign(l.monto) === Math.sign(f.monto)).map((l) => <option key={l.id} value={l.id}>{formatoPesos(l.monto)} · {l.texto}</option>)}
                        </select>
                        <button type="button" className="ml-2 text-ambar hover:underline" onClick={() => { const n = prompt("Nota de la diferencia (ej.: comisión no contabilizada):"); if (n) ejecutar(marcarDiferencia(f.id, n)); }}>Diferencia</button>
                      </>
                    )}
                    {(f.estado === "conciliado" || f.estado === "diferencia") && (
                      <button type="button" className="text-texto-suave hover:underline" onClick={() => ejecutar(deshacer(f.id))}>Deshacer</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
