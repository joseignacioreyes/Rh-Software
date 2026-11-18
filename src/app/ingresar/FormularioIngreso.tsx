"use client";

import { useActionState, useState } from "react";
import { iniciarSesion } from "./acciones";
import { claseBotonPrimario, claseError, claseEtiqueta, claseInput } from "@/components/ui/estilos";
import { formatearRut, normalizarRut } from "@/lib/rut";

/** Da formato al RUT mientras se escribe ("151112226" → "15.111.222-6"). */
function formatearMientrasEscribe(valor: string) {
  const limpio = valor.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (limpio.length < 2) return limpio;
  return formatearRut(`${limpio.slice(0, -1)}-${limpio.slice(-1)}`);
}

export function FormularioIngreso() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, undefined);
  const [rut, setRut] = useState("");
  const completo = rut.replace(/[^0-9kK]/g, "").length >= 8;
  const rutMalo = completo && !normalizarRut(rut);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <div>
        <label htmlFor="rut" className={claseEtiqueta}>RUT</label>
        <input
          id="rut"
          name="rut"
          inputMode="text"
          autoComplete="username"
          autoFocus
          placeholder="12.345.678-9"
          value={rut}
          onChange={(e) => setRut(formatearMientrasEscribe(e.target.value))}
          className={`${claseInput} numeros ${rutMalo ? "border-rojo" : ""}`}
          aria-invalid={rutMalo}
          aria-describedby={rutMalo ? "rut-error" : undefined}
        />
        {rutMalo && (
          <p id="rut-error" className="mt-1 text-xs text-rojo">El dígito verificador no corresponde.</p>
        )}
      </div>
      <div>
        <label htmlFor="clave" className={claseEtiqueta}>Clave</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" className={claseInput} />
      </div>
      {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
      <button type="submit" disabled={enviando} className={`${claseBotonPrimario} w-full`}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
      <p className="text-center text-xs text-texto-suave">
        ¿Olvidaste tu clave? Pídele a tu contador o a soporte que la restablezca.
      </p>
    </form>
  );
}
