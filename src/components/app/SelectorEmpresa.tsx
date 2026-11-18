"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEmpresa } from "@/app/(app)/acciones-contexto";
import { formatearRut } from "@/lib/rut";

type Empresa = { id: string; rut: string; razon_social: string; nombre_fantasia: string | null };

/** Quita tildes y puntos para buscar "almacen" o "76111" y encontrar "Almacén" o "76.111.222-8". */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, "").toLowerCase();
}

/**
 * Selector de empresa siempre visible. Ctrl+K (o Cmd+K) lo abre desde cualquier pantalla.
 * Flechas para moverse, Enter para elegir, Esc para cerrar.
 */
export function SelectorEmpresa({ empresas, actual }: { empresas: Empresa[]; actual: Empresa | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [indice, setIndice] = useState(0);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  function abrir() {
    setBusqueda("");
    setIndice(0);
    setAbierto(true);
  }

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusqueda("");
        setIndice(0);
        setAbierto(true);
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return empresas;
    return empresas.filter((e) =>
      normalizar(`${e.razon_social} ${e.nombre_fantasia ?? ""} ${e.rut} ${formatearRut(e.rut)}`).includes(q),
    );
  }, [busqueda, empresas]);

  function elegir(e: Empresa) {
    setAbierto(false);
    iniciar(async () => {
      await cambiarEmpresa(e.id);
      router.refresh();
    });
  }

  function alTeclear(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtradas[indice]) {
      e.preventDefault();
      elegir(filtradas[indice]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex min-w-0 max-w-md items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left hover:border-azul focus-visible:outline-2 focus-visible:outline-azul"
        aria-haspopup="dialog"
        title="Cambiar de empresa (Ctrl+K)"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-texto">
            {pendiente ? "Cambiando…" : actual?.razon_social ?? "Elige una empresa"}
          </span>
          {actual && <span className="numeros block text-xs text-texto-suave">{formatearRut(actual.rut)}</span>}
        </span>
        <kbd className="ml-auto shrink-0 rounded border border-gray-300 bg-fondo-suave px-1.5 py-0.5 font-mono text-[11px] text-texto-suave">
          Ctrl K
        </kbd>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24"
          onMouseDown={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-label="Cambiar de empresa"
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              ref={entrada}
              autoFocus
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setIndice(0);
              }}
              onKeyDown={alTeclear}
              placeholder="Busca por nombre o RUT…"
              className="w-full border-b border-borde px-4 py-3 text-base outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="lista-empresas"
              aria-activedescendant={filtradas[indice] ? `empresa-${filtradas[indice].id}` : undefined}
            />
            <ul id="lista-empresas" role="listbox" className="max-h-80 overflow-y-auto py-1">
              {filtradas.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-texto-suave">Ninguna empresa coincide con “{busqueda}”.</li>
              )}
              {filtradas.map((e, i) => (
                <li
                  key={e.id}
                  id={`empresa-${e.id}`}
                  role="option"
                  aria-selected={i === indice}
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => elegir(e)}
                  className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 ${
                    i === indice ? "bg-celeste" : ""
                  }`}
                >
                  <span className="truncate text-sm font-medium text-texto">
                    {e.razon_social}
                    {actual?.id === e.id && <span className="ml-2 text-xs font-normal text-verde">(actual)</span>}
                  </span>
                  <span className="numeros shrink-0 text-xs text-texto-suave">{formatearRut(e.rut)}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 border-t border-borde bg-fondo-suave px-4 py-2 text-xs text-texto-suave">
              <span>↑ ↓ moverse</span>
              <span>Enter elegir</span>
              <span>Esc cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
