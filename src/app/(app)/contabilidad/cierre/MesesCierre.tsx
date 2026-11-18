"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cerrarMes, reabrirMes } from "./acciones";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseInput } from "@/components/ui/estilos";

export type MesCierre = { mes: number; nombre: string; cerrado: boolean; cerradoEl: string | null; comprobantes: number };

export function MesesCierre({ anio, meses, mesActual, puedeCerrar }: { anio: number; meses: MesCierre[]; mesActual: number; puedeCerrar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [reabriendo, setReabriendo] = useState<MesCierre | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function ejecutar(p: Promise<{ error?: string }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await p;
      if (r.error) setError(r.error);
      else alTerminar?.();
      router.refresh();
    });
  }

  return (
    <>
      {error && <p className={`${claseError} mb-3`}>{error}</p>}
      <div className="grid grid-cols-4 gap-3 xl:grid-cols-6">
        {meses.map((m) => (
          <div
            key={m.mes}
            className={`rounded-lg border bg-white p-3 ${m.mes === mesActual ? "border-azul ring-2 ring-azul/20" : "border-borde"}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-texto">{m.nombre}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${m.cerrado ? "bg-verde" : m.comprobantes > 0 ? "bg-ambar" : "bg-gray-300"}`} aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-texto-suave">
              {m.cerrado ? `Cerrado el ${m.cerradoEl}` : m.comprobantes > 0 ? "Abierto" : "Sin movimientos"}
            </p>
            <p className="numeros text-xs text-texto-suave">{m.comprobantes} comprobantes</p>
            {puedeCerrar && (
              <div className="mt-2">
                {m.cerrado ? (
                  <button type="button" disabled={pendiente} className="text-xs font-medium text-ambar hover:underline" onClick={() => { setReabriendo(m); setMotivo(""); }}>
                    Reabrir…
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pendiente}
                    className="text-xs font-medium text-azul hover:underline"
                    onClick={() => {
                      if (confirm(`¿Cerrar ${m.nombre.toLowerCase()} de ${anio}? Ya no se podrán crear ni modificar comprobantes de ese mes.`)) {
                        ejecutar(cerrarMes(anio, m.mes));
                      }
                    }}
                  >
                    Cerrar mes
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {reabriendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setReabriendo(null)}>
          <div role="dialog" aria-label="Reabrir periodo" className="w-[460px] rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-texto">Reabrir {reabriendo.nombre.toLowerCase()} {anio}</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Si el mes ya fue declarado, cualquier cambio puede requerir rectificar. El motivo queda registrado en el historial y en la auditoría.
            </p>
            <label htmlFor="motivo" className="mt-3 block text-sm font-medium">Motivo</label>
            <textarea id="motivo" autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={claseInput} placeholder="Ej.: Falta registrar factura de compra recibida tarde" />
            <p className="mt-1 text-xs text-texto-suave">Al menos 10 caracteres.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={claseBotonSecundario} onClick={() => setReabriendo(null)}>Cancelar</button>
              <button
                type="button"
                disabled={pendiente || motivo.trim().length < 10}
                className={claseBotonPrimario}
                onClick={() => ejecutar(reabrirMes(anio, reabriendo.mes, motivo), () => setReabriendo(null))}
              >
                Reabrir mes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
