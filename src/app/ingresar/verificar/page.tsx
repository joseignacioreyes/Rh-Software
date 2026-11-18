"use client";

import { useActionState } from "react";
import { verificarCodigo } from "../acciones";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { claseBotonPrimario, claseError, claseEtiqueta, claseInput } from "@/components/ui/estilos";

export default function Verificar() {
  const [estado, accion, enviando] = useActionState(verificarCodigo, undefined);
  return (
    <MarcoAcceso
      titulo="Segundo factor"
      subtitulo="Escribe el código de 6 números que muestra tu app autenticadora (Google Authenticator, Microsoft Authenticator u otra)."
    >
      <form action={accion} className="space-y-4">
        <div>
          <label htmlFor="codigo" className={claseEtiqueta}>Código</label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={7}
            placeholder="123456"
            className={`${claseInput} numeros text-center text-lg tracking-[0.4em]`}
          />
        </div>
        {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
        <button type="submit" disabled={enviando} className={`${claseBotonPrimario} w-full`}>
          {enviando ? "Verificando…" : "Verificar"}
        </button>
      </form>
    </MarcoAcceso>
  );
}
