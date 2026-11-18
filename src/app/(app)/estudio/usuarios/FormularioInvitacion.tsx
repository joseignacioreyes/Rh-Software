"use client";

import { useActionState, useState } from "react";
import { invitarUsuario } from "./acciones";
import { claseBotonPrimario, claseError, claseEtiqueta, claseInput } from "@/components/ui/estilos";
import { formatearRut } from "@/lib/rut";
import { linkWhatsApp } from "@/lib/config";

type Props = {
  empresas: { id: string; nombre: string }[];
  modulos: { codigo: string; nombre: string }[];
  esDemo: boolean;
};

export function FormularioInvitacion({ empresas, modulos, esDemo }: Props) {
  const [estado, accion, enviando] = useActionState(invitarUsuario, undefined);
  const [rol, setRol] = useState("asistente");

  const ok = estado?.ok;
  const mensaje = ok?.claveTemporal
    ? `Hola ${ok.nombre}, te di acceso a RH Software. Ingresa en ${typeof window !== "undefined" ? window.location.origin : ""}/ingresar con tu RUT ${formatearRut(ok.rut)} y la clave temporal ${ok.claveTemporal}. Te pedirá crear tu propia clave.`
    : "";

  return (
    <aside className="h-fit rounded-lg border border-borde bg-white p-5">
      <h2 className="text-base font-bold text-azul">Invitar a una persona</h2>
      <p className="mb-4 text-xs text-texto-suave">Si ya tiene cuenta en RH Software, solo le agregamos el acceso.</p>

      {ok ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-verde">Listo: {ok.nombre} ya tiene acceso.</p>
          {ok.claveTemporal && (
            <>
              <p className="text-texto-suave">
                Entrégale esta clave temporal (se muestra una sola vez). Al ingresar deberá crear la suya y activar su segundo factor.
              </p>
              <p className="rounded-md border border-borde bg-fondo-suave px-3 py-2 text-center font-mono text-lg tracking-wider">{ok.claveTemporal}</p>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-azul hover:underline" onClick={() => navigator.clipboard.writeText(mensaje)}>
                  Copiar mensaje
                </button>
                <a className="text-xs text-verde hover:underline" target="_blank" rel="noopener noreferrer" href={linkWhatsApp("", mensaje)}>
                  Enviar por WhatsApp
                </a>
              </div>
            </>
          )}
          <button type="button" className="text-xs text-texto-suave underline" onClick={() => location.reload()}>Invitar a otra persona</button>
        </div>
      ) : (
        <form action={accion} className="space-y-3">
          <div>
            <label htmlFor="inv-rut" className={claseEtiqueta}>RUT</label>
            <input id="inv-rut" name="rut" className={claseInput} placeholder="12.345.678-9" required />
          </div>
          <div>
            <label htmlFor="inv-nombre" className={claseEtiqueta}>Nombre</label>
            <input id="inv-nombre" name="nombre" className={claseInput} required />
          </div>
          <div>
            <label htmlFor="inv-correo" className={claseEtiqueta}>Correo</label>
            <input id="inv-correo" name="correo" type="email" className={claseInput} required />
          </div>
          <div>
            <label htmlFor="inv-rol" className={claseEtiqueta}>Rol</label>
            <select id="inv-rol" name="rol" value={rol} onChange={(e) => setRol(e.target.value)} className={claseInput}>
              <option value="asistente">Asistente: solo las empresas y módulos que elijas</option>
              <option value="contador">Contador: todas las empresas del estudio</option>
              <option value="cliente">Cliente: portal de su empresa</option>
            </select>
          </div>
          {rol !== "contador" && (
            <fieldset>
              <legend className={claseEtiqueta}>Empresas</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-borde p-2">
                {empresas.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="empresas" value={e.id} className="h-4 w-4 accent-azul" />
                    {e.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {rol === "asistente" && (
            <fieldset>
              <legend className={claseEtiqueta}>Módulos</legend>
              <div className="grid grid-cols-2 gap-1">
                {modulos.map((m) => (
                  <label key={m.codigo} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="modulos" value={m.codigo} className="h-4 w-4 accent-azul" />
                    {m.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {estado?.error && <p role="alert" className={claseError}>{estado.error}</p>}
          <button type="submit" disabled={enviando || esDemo} className={`${claseBotonPrimario} w-full`}>
            {enviando ? "Invitando…" : "Dar acceso"}
          </button>
          {esDemo && <p className="text-xs text-texto-suave">Desactivado en el estudio de ejemplo.</p>}
        </form>
      )}
    </aside>
  );
}
