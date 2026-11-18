"use client";

import { useActionState } from "react";
import { crearSolicitud } from "./accion";
import { claseBotonSecundario, claseError, claseEtiqueta, claseExito, claseInput } from "@/components/ui/estilos";

export function SolicitudTitular() {
  const [estado, accion, enviando] = useActionState(crearSolicitud, undefined);
  return (
    <section className="rounded-lg border border-borde bg-white p-5 text-sm">
      <h2 className="mb-1 font-bold text-texto">Ejercer tus derechos</h2>
      <p className="mb-3 text-texto-suave">
        Puedes pedir rectificar, eliminar u oponerte al tratamiento de tus datos. Respondemos dentro del plazo legal.
      </p>
      <form action={accion} className="grid gap-3">
        <div>
          <label htmlFor="tipo" className={claseEtiqueta}>Qué necesitas</label>
          <select id="tipo" name="tipo" className={claseInput} defaultValue="supresion">
            <option value="supresion">Eliminar mis datos</option>
            <option value="rectificacion">Corregir un dato</option>
            <option value="oposicion">Oponerme a un tratamiento</option>
            <option value="acceso">Saber qué datos tienen y cómo los usan</option>
          </select>
        </div>
        <div>
          <label htmlFor="detalle" className={claseEtiqueta}>Detalle (opcional)</label>
          <textarea id="detalle" name="detalle" rows={3} className={claseInput} />
        </div>
        {estado?.error && <p className={claseError}>{estado.error}</p>}
        {estado?.ok && <p className={claseExito}>{estado.ok}</p>}
        <div>
          <button type="submit" disabled={enviando} className={claseBotonSecundario}>Enviar solicitud</button>
        </div>
      </form>
    </section>
  );
}
