"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstudio } from "@/app/(app)/acciones-contexto";
import { cerrarSesion } from "@/app/ingresar/acciones";

type Props = {
  nombre: string;
  rol: string;
  estudios: { id: string; nombre: string }[];
  estudioActual: string | null;
};

/** Menú del usuario: cambiar de estudio sin volver a ingresar, seguridad, mis datos y salir. */
export function MenuUsuario({ nombre, rol, estudios, estudioActual }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [, iniciar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-fondo-suave"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-celeste text-xs font-bold text-azul">
          {iniciales}
        </span>
        <span className="hidden text-left xl:block">
          <span className="block text-sm font-medium text-texto">{nombre}</span>
          <span className="block text-xs text-texto-suave capitalize">{rol}</span>
        </span>
      </button>
      {abierto && (
        <div role="menu" className="absolute top-full right-0 z-40 mt-1 w-64 rounded-lg border border-borde bg-white py-1 shadow-lg">
          {estudios.length > 1 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-texto-suave">Cambiar de estudio</p>
              {estudios.map((e) => (
                <button
                  key={e.id}
                  role="menuitem"
                  type="button"
                  onClick={() =>
                    iniciar(async () => {
                      setAbierto(false);
                      await cambiarEstudio(e.id);
                      router.push("/mi-mes");
                      router.refresh();
                    })
                  }
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-celeste ${e.id === estudioActual ? "font-semibold text-azul" : ""}`}
                >
                  {e.nombre}
                </button>
              ))}
              <hr className="my-1 border-borde" />
            </>
          )}
          <Link role="menuitem" href="/cuenta/seguridad" className="block px-3 py-1.5 text-sm hover:bg-celeste" onClick={() => setAbierto(false)}>
            Seguridad y segundo factor
          </Link>
          <Link role="menuitem" href="/cuenta/mis-datos" className="block px-3 py-1.5 text-sm hover:bg-celeste" onClick={() => setAbierto(false)}>
            Mis datos
          </Link>
          <hr className="my-1 border-borde" />
          <form action={cerrarSesion}>
            <button role="menuitem" type="submit" className="block w-full px-3 py-1.5 text-left text-sm text-rojo hover:bg-red-50">
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
