"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearCuenta } from "./acciones";
import { claseBotonPrimario, claseEtiqueta, claseError, claseInput } from "@/components/ui/estilos";

export function FormularioRegistro() {
  const [estado, accion, pendiente] = useActionState(crearCuenta, null as { error?: string } | null);
  return (
    <form action={accion} className="space-y-3">
      <label className="block"><span className={claseEtiqueta}>Nombre del estudio</span><input name="estudio" className={claseInput} placeholder="Ej.: Contadores Asociados del Sur" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={claseEtiqueta}>Tu RUT</span><input name="rut" className={claseInput} placeholder="12.345.678-5" required /></label>
        <label className="block"><span className={claseEtiqueta}>Tu nombre</span><input name="nombre" className={claseInput} autoComplete="name" required /></label>
      </div>
      <label className="block"><span className={claseEtiqueta}>Correo</span><input type="email" name="correo" className={claseInput} autoComplete="email" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={claseEtiqueta}>Clave</span><input type="password" name="clave" minLength={8} className={claseInput} autoComplete="new-password" required /></label>
        <label className="block"><span className={claseEtiqueta}>Repite la clave</span><input type="password" name="clave2" minLength={8} className={claseInput} autoComplete="new-password" required /></label>
      </div>
      <p className="-mt-1 text-xs text-texto-suave">Mínimo 8 caracteres, con minúsculas, mayúsculas y números.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acepto" className="mt-1" required />
        <span>Acepto los <Link href="/terminos" target="_blank" className="text-azul underline">términos</Link> y la <Link href="/privacidad" target="_blank" className="text-azul underline">política de privacidad</Link>, y el encargo de tratamiento de datos de mis clientes.</span>
      </label>
      {estado?.error && <p className={claseError}>{estado.error}</p>}
      <button type="submit" disabled={pendiente} className={`${claseBotonPrimario} w-full`}>{pendiente ? "Creando tu cuenta…" : "Crear cuenta y probar 30 días gratis"}</button>
      <p className="text-center text-xs text-texto-suave">Sin tarjeta de crédito. Al entrar configurarás tu segundo factor de seguridad.</p>
    </form>
  );
}
