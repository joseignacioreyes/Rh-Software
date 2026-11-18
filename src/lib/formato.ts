// Formatos chilenos usados en toda la app:
// - montos en pesos enteros con separador de miles con punto ($1.234.567);
// - fechas DD-MM-AAAA en la zona horaria America/Santiago.

export const ZONA_HORARIA = "America/Santiago";

/** Formatea un monto en pesos (entero) como "$1.234.567". Los negativos van como "-$1.234". */
export function formatoPesos(monto: number): string {
  if (!Number.isInteger(monto)) {
    throw new Error(`Los montos en pesos deben ser enteros y llegó ${monto}`);
  }
  const absoluto = Math.abs(monto)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${monto < 0 ? "-" : ""}$${absoluto}`;
}

/** Formatea una fecha como DD-MM-AAAA según la hora de Chile. */
export function formatoFecha(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("day")}-${valor("month")}-${valor("year")}`;
}
