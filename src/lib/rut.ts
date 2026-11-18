// RUT chileno: validación con dígito verificador (módulo 11), normalización y formato.
// Se guarda normalizado: sin puntos, con guion y K mayúscula ("12345678-K").

/** Calcula el dígito verificador de un cuerpo de RUT (solo números). */
export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}

/**
 * Normaliza un RUT escrito de cualquier forma ("15.111.222-6", "151112226", "15111222-6").
 * Devuelve null si no tiene forma de RUT o si el dígito verificador no corresponde.
 */
export function normalizarRut(entrada: string): string | null {
  const limpio = entrada.replace(/[^0-9kK]/g, "").toUpperCase();
  if (limpio.length < 2 || limpio.length > 9) return null;
  const cuerpo = limpio.slice(0, -1).replace(/^0+/, "");
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo) || cuerpo.length === 0) return null;
  if (digitoVerificador(cuerpo) !== dv) return null;
  return `${cuerpo}-${dv}`;
}

export function rutValido(entrada: string): boolean {
  return normalizarRut(entrada) !== null;
}

/** Formatea un RUT normalizado con puntos: "15111222-6" → "15.111.222-6". */
export function formatearRut(rut: string): string {
  const [cuerpo, dv] = rut.split("-");
  if (!dv) return rut;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
