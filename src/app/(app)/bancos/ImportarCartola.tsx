"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analizarCartola, importarCartola, type AnalisisCartola } from "./acciones";
import { claseBotonPrimario, claseError, claseExito, claseInput } from "@/components/ui/estilos";

const CAMPOS = [
  ["fecha", "Fecha"], ["descripcion", "Descripción"], ["documento", "N° documento"],
  ["cargo", "Cargo (sale)"], ["abono", "Abono (entra)"], ["monto", "Monto con signo"], ["saldo", "Saldo"],
] as const;

/** Importa la cartola (Excel o CSV de cualquier banco). El mapeo de columnas se recuerda por formato. */
export function ImportarCartola({ cuentaId }: { cuentaId: string }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisCartola | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, number | null>>({});
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="rounded-lg border border-borde bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-azul">Importar cartola</span>
        <input
          type="file"
          accept=".xlsx,.csv,.txt"
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setArchivo(f);
            setMensaje(null);
            if (!f) return;
            const fd = new FormData();
            fd.set("archivo", f);
            iniciar(async () => {
              const r = await analizarCartola(fd);
              setAnalisis(r);
              setMapeo(r.mapeo ?? {});
            });
          }}
        />
        {analisis?.guardado && <span className="text-xs text-verde">Formato reconocido: se usa el mapeo guardado.</span>}
      </div>
      {analisis?.error && <p className={`${claseError} mt-2`}>{analisis.error}</p>}
      {analisis?.encabezados && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {CAMPOS.map(([c, n]) => (
            <label key={c} className="text-xs">{n}
              <select value={mapeo[c] ?? ""} onChange={(e) => setMapeo({ ...mapeo, [c]: e.target.value === "" ? null : Number(e.target.value) })} className={`${claseInput} w-40 py-1 text-xs`}>
                <option value="">—</option>
                {analisis.encabezados!.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
            </label>
          ))}
          <button
            type="button"
            disabled={pendiente || !archivo}
            className={claseBotonPrimario}
            onClick={() => {
              const fd = new FormData();
              fd.set("archivo", archivo!);
              fd.set("cuenta_bancaria_id", cuentaId);
              fd.set("mapeo", JSON.stringify(mapeo));
              iniciar(async () => {
                const r = await importarCartola(fd);
                setMensaje(r);
                if (r.ok) {
                  setAnalisis(null);
                  router.refresh();
                }
              });
            }}
          >
            Importar
          </button>
        </div>
      )}
      {mensaje?.ok && <p className={`${claseExito} mt-2`}>{mensaje.ok}</p>}
      {mensaje?.error && <p className={`${claseError} mt-2`}>{mensaje.error}</p>}
    </div>
  );
}
