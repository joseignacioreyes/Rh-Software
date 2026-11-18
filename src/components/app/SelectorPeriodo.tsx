"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarPeriodo } from "@/app/(app)/acciones-contexto";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Periodo (mes y año) siempre visible: flechas para mes anterior/siguiente y un clic para elegir. */
export function SelectorPeriodo({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [anioVista, setAnioVista] = useState(anio);
  const [pendiente, iniciar] = useTransition();

  function ir(a: number, m: number) {
    setAbierto(false);
    iniciar(async () => {
      await cambiarPeriodo(a, m);
      router.refresh();
    });
  }
  const anterior = mes === 1 ? [anio - 1, 12] : [anio, mes - 1];
  const siguiente = mes === 12 ? [anio + 1, 1] : [anio, mes + 1];

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => ir(anterior[0], anterior[1])}
        className="rounded-l-md border border-gray-300 bg-white px-2 py-1.5 text-texto-suave hover:bg-fondo-suave"
        aria-label="Mes anterior"
        title="Mes anterior"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => {
          setAnioVista(anio);
          setAbierto((a) => !a);
        }}
        className="min-w-36 border-y border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-texto hover:bg-fondo-suave"
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        {pendiente ? "…" : `${MESES_LARGOS[mes - 1]} ${anio}`}
      </button>
      <button
        type="button"
        onClick={() => ir(siguiente[0], siguiente[1])}
        className="rounded-r-md border border-gray-300 bg-white px-2 py-1.5 text-texto-suave hover:bg-fondo-suave"
        aria-label="Mes siguiente"
        title="Mes siguiente"
      >
        ›
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir periodo"
          className="absolute top-full right-0 z-40 mt-1 w-64 rounded-lg border border-borde bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="px-2 text-texto-suave hover:text-azul" onClick={() => setAnioVista((a) => a - 1)} aria-label="Año anterior">‹</button>
            <span className="numeros font-semibold">{anioVista}</span>
            <button type="button" className="px-2 text-texto-suave hover:text-azul" onClick={() => setAnioVista((a) => a + 1)} aria-label="Año siguiente">›</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES.map((m, i) => {
              const activo = anioVista === anio && i + 1 === mes;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => ir(anioVista, i + 1)}
                  className={`rounded px-2 py-1.5 text-sm ${activo ? "bg-azul font-semibold text-white" : "hover:bg-celeste"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
