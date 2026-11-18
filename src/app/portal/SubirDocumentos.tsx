"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { subirDocumentos } from "./acciones";

/** Botón grande para subir fotos, PDF o Excel desde el celular (abre la cámara si se elige). */
export function SubirDocumentos() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [comentario, setComentario] = useState("");
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <section className="rounded-xl border border-borde bg-white p-4">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-azul px-4 py-6 text-white active:bg-azul-oscuro"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="text-lg font-bold">Enviar documentos</span>
        <span className="text-sm text-blue-100">Fotos de facturas, boletas, PDF o Excel</span>
      </button>
      <input ref={entrada} type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { setArchivos(Array.from(e.target.files ?? [])); setMensaje(null); }} />
      {archivos.length > 0 && (
        <div className="mt-3 space-y-2">
          <ul className="text-sm text-texto">{archivos.map((a) => <li key={a.name} className="truncate">📄 {a.name}</li>)}</ul>
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario (opcional), ej.: facturas de octubre" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base" />
          <button
            type="button"
            disabled={pendiente}
            className="w-full rounded-lg bg-verde py-3 text-base font-semibold text-white disabled:opacity-60"
            onClick={() => {
              const fd = new FormData();
              archivos.forEach((a) => fd.append("archivos", a));
              fd.set("comentario", comentario);
              iniciar(async () => {
                const r = await subirDocumentos(fd);
                setMensaje(r);
                if (r.ok) { setArchivos([]); setComentario(""); router.refresh(); }
              });
            }}
          >
            {pendiente ? "Enviando…" : `Enviar ${archivos.length} ${archivos.length === 1 ? "archivo" : "archivos"}`}
          </button>
        </div>
      )}
      {mensaje?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center font-medium text-verde">{mensaje.ok}</p>}
      {mensaje?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-rojo">{mensaje.error}</p>}
    </section>
  );
}
