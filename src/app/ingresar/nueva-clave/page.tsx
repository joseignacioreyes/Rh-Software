"use client";

import { useActionState } from "react";
import { crearNuevaClave } from "./accion";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { claseBotonPrimario, claseError, claseEtiqueta, claseInput } from "@/components/ui/estilos";

export default function NuevaClave() {
  const [estado, accion, enviando] = useActionState(crearNuevaClave, undefined);
  return (
    <MarcoAcceso titulo="Crea tu clave" subtitulo="Ingresaste con una clave temporal. Elige una clave propia para continuar.">
      <form action={accion} className="space-y-4">
        <div>
          <label htmlFor="clave" className={claseEtiqueta}>Nueva clave</label>
          <input id="clave" name="clave" type="password" autoComplete="new-password" className={claseInput} />
          <p className="mt-1 text-xs text-texto-suave">Al menos 8 caracteres, con letras y números.</p>
        </div>
        <div>
          <label htmlFor="repetir" className={claseEtiqueta}>Repite la clave</label>
          <input id="repetir" name="repetir" type="password" autoComplete="new-password" className={claseInput} />
        </div>
        {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
        <button type="submit" disabled={enviando} className={`${claseBotonPrimario} w-full`}>
          {enviando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </MarcoAcceso>
  );
}
