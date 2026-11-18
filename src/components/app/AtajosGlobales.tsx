"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ATAJOS: [string, string][] = [
  ["Ctrl + K", "Cambiar de empresa"],
  ["Alt + N", "Nuevo comprobante"],
  ["Alt + M", "Ir a Mi mes"],
  ["Alt + C", "Ir a comprobantes"],
  ["Ctrl + S", "Guardar (en formularios)"],
  ["Enter", "Siguiente celda (en comprobantes)"],
  ["?", "Ver esta ayuda"],
];

/** Atajos de teclado disponibles en toda la app. "?" muestra la lista. */
export function AtajosGlobales({ puedeCrearComprobante }: { puedeCrearComprobante: boolean }) {
  const router = useRouter();
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const escribiendo = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const tecla = e.code;
        if (tecla === "KeyN" && puedeCrearComprobante) {
          e.preventDefault();
          router.push("/contabilidad/comprobantes/nuevo");
        } else if (tecla === "KeyM") {
          e.preventDefault();
          router.push("/mi-mes");
        } else if (tecla === "KeyC") {
          e.preventDefault();
          router.push("/contabilidad/comprobantes");
        }
      } else if (e.key === "?" && !escribiendo) {
        setAyuda((a) => !a);
      } else if (e.key === "Escape") {
        setAyuda(false);
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [router, puedeCrearComprobante]);

  if (!ayuda) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAyuda(false)}>
      <div role="dialog" aria-label="Atajos de teclado" className="w-96 rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold text-azul">Atajos de teclado</h2>
        <table className="w-full text-sm">
          <tbody>
            {ATAJOS.map(([k, d]) => (
              <tr key={k} className="border-t border-borde">
                <td className="py-1.5 pr-4"><kbd className="rounded border border-gray-300 bg-fondo-suave px-1.5 font-mono text-xs">{k}</kbd></td>
                <td className="py-1.5 text-texto-suave">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
