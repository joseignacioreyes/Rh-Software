"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarPermisos, cambiarAcceso } from "./acciones";

type Props = {
  id: string;
  rol: string;
  activa: boolean;
  permisos: Record<string, boolean>;
  modulos: { codigo: string; nombre: string }[];
  esPropia: boolean;
};

/** Módulos de un asistente (casillas) y botón para quitar o devolver el acceso. */
export function PermisosMembresia({ id, rol, activa, permisos, modulos, esPropia }: Props) {
  const router = useRouter();
  const [actual, setActual] = useState(permisos);
  const [pendiente, iniciar] = useTransition();

  function alternar(codigo: string) {
    const nuevos = { ...actual, [codigo]: !actual[codigo] };
    setActual(nuevos);
    iniciar(async () => {
      const r = await actualizarPermisos(id, nuevos);
      if (r.error) {
        alert(r.error);
        setActual(actual);
      }
      router.refresh();
    });
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-1 ${activa ? "" : "opacity-50"}`}>
      {rol === "asistente" &&
        modulos.map((m) => (
          <label key={m.codigo} className="flex items-center gap-1 text-xs text-texto-suave">
            <input
              type="checkbox"
              checked={!!actual[m.codigo]}
              disabled={pendiente || !activa}
              onChange={() => alternar(m.codigo)}
              className="h-3.5 w-3.5 accent-azul"
            />
            {m.nombre}
          </label>
        ))}
      {rol === "contador" && <span className="text-xs text-texto-suave">Acceso completo</span>}
      {rol === "lector" && <span className="text-xs text-texto-suave">Solo puede mirar</span>}
      {!esPropia && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (activa && !confirm("¿Quitar este acceso? El usuario dejará de ver esta empresa. Puedes devolvérselo después.")) return;
            iniciar(async () => {
              const r = await cambiarAcceso(id, !activa);
              if (r.error) alert(r.error);
              router.refresh();
            });
          }}
          className={`ml-2 text-xs font-medium ${activa ? "text-rojo" : "text-verde"} hover:underline`}
        >
          {activa ? "Quitar acceso" : "Devolver acceso"}
        </button>
      )}
    </div>
  );
}
