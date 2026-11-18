"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responderSolicitud } from "./acciones";

export function Solicitud({ id, titulo, detalle }: { id: string; titulo: string; detalle: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-xl border-2 border-ambar bg-amber-50 p-4">
      <p className="font-semibold text-texto">{titulo}</p>
      {detalle && <p className="mt-1 text-sm text-texto-suave">{detalle}</p>}
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Responde aquí (o envía los documentos con el botón azul)" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-base" />
      {error && <p className="text-sm text-rojo">{error}</p>}
      <button
        type="button"
        disabled={pendiente}
        className="mt-2 w-full rounded-lg bg-ambar py-2.5 font-semibold text-white disabled:opacity-60"
        onClick={() => iniciar(async () => { const r = await responderSolicitud(id, texto); if (r.error) setError(r.error); else router.refresh(); })}
      >
        Responder
      </button>
    </div>
  );
}
