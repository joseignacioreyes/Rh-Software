"use client";

import { useActionState, useState } from "react";
import { guardarResumenBoletas } from "./acciones";
import { claseBotonPrimario, claseBotonSecundario, claseError, claseExito, claseInput } from "@/components/ui/estilos";

/** Las boletas de venta llegan al RCV como resumen mensual: el contador ingresa los totales. */
export function ResumenBoletas({ anio, mes }: { anio: number; mes: number }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(guardarResumenBoletas, undefined);
  if (!abierto) {
    return (
      <button type="button" className={`${claseBotonSecundario} mb-3`} onClick={() => setAbierto(true)}>
        Agregar resumen de boletas del mes
      </button>
    );
  }
  return (
    <form action={accion} className="mb-3 grid grid-cols-[150px_150px_150px_160px_auto_auto] items-end gap-3 rounded-lg border border-borde bg-white p-4">
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="mes" value={mes} />
      <label className="text-sm">Tipo
        <select name="tipo" className={claseInput} defaultValue="39">
          <option value="39">39 Boleta electrónica</option>
          <option value="41">41 Boleta exenta electrónica</option>
          <option value="48">48 Comprobante de pago electrónico</option>
        </select>
      </label>
      <label className="text-sm">Cantidad<input name="cantidad" inputMode="numeric" className={`${claseInput} numeros`} /></label>
      <label className="text-sm">Neto<input name="neto" inputMode="numeric" className={`${claseInput} numeros`} /></label>
      <label className="text-sm">IVA<input name="iva" inputMode="numeric" className={`${claseInput} numeros`} placeholder="Según resumen SII" /></label>
      <button type="submit" disabled={enviando} className={claseBotonPrimario}>Guardar</button>
      <button type="button" className={claseBotonSecundario} onClick={() => setAbierto(false)}>Cerrar</button>
      {estado?.error && <p className={`${claseError} col-span-6`}>{estado.error}</p>}
      {estado?.ok && <p className={`${claseExito} col-span-6`}>{estado.ok}</p>}
      <p className="col-span-6 text-xs text-texto-suave">Copia los totales del resumen de ventas del RCV (sección boletas) o del informe de tu punto de venta.</p>
    </form>
  );
}
