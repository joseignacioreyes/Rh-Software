"use client";

import { useActionState } from "react";
import { cambiarClave } from "./accion";
import { claseBotonPrimario, claseError, claseEtiqueta, claseExito, claseInput } from "@/components/ui/estilos";

export function CambiarClave({ deshabilitado }: { deshabilitado: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarClave, undefined);
  return (
    <form action={accion} className="grid max-w-md gap-3">
      <div>
        <label htmlFor="clave" className={claseEtiqueta}>Nueva clave</label>
        <input id="clave" name="clave" type="password" autoComplete="new-password" className={claseInput} disabled={deshabilitado} />
        <p className="mt-1 text-xs text-texto-suave">Al menos 8 caracteres, con letras y números.</p>
      </div>
      <div>
        <label htmlFor="repetir" className={claseEtiqueta}>Repite la clave</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" className={claseInput} disabled={deshabilitado} />
      </div>
      {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
      {estado?.ok && <p role="status" className={claseExito}>{estado.ok}</p>}
      <div>
        <button type="submit" disabled={enviando || deshabilitado} className={claseBotonPrimario}>
          {enviando ? "Guardando…" : "Cambiar clave"}
        </button>
        {deshabilitado && <span className="ml-3 text-xs text-texto-suave">Desactivado en el estudio de ejemplo.</span>}
      </div>
    </form>
  );
}
