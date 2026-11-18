"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularComprobante } from "../acciones";
import { claseBotonPeligro, claseBotonSecundario, claseError, claseInput } from "@/components/ui/estilos";

/** Anular no borra: el comprobante queda visible, marcado como anulado y con su motivo. */
export function BotonAnular({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) {
    return <button type="button" className={claseBotonSecundario} onClick={() => setAbierto(true)}>Anular</button>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAbierto(false)}>
      <div role="dialog" aria-label="Anular comprobante" className="w-[440px] rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-texto">¿Anular este comprobante?</h2>
        <p className="mt-1 text-sm text-texto-suave">No se borra: queda registrado como anulado y deja de sumar en los libros. Escribe el motivo.</p>
        <textarea autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={`${claseInput} mt-3`} placeholder="Ej.: Registrado dos veces" />
        {error && <p className={`${claseError} mt-2`}>{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={claseBotonSecundario} onClick={() => setAbierto(false)}>Cancelar</button>
          <button
            type="button"
            disabled={pendiente || motivo.trim().length < 5}
            className={claseBotonPeligro}
            onClick={() =>
              iniciar(async () => {
                const r = await anularComprobante(id, motivo);
                if (r.error) return setError(r.error);
                setAbierto(false);
                router.refresh();
              })
            }
          >
            Anular
          </button>
        </div>
      </div>
    </div>
  );
}
