// Estado de la suscripción de un estudio, calculado con las fechas (zona America/Santiago).
// Regla de oro: el atraso NUNCA borra ni oculta datos; solo deja la cuenta en modo de solo lectura.

export type Suscripcion = { plan: string; estado: "prueba" | "activa" | "solo_lectura" | "cancelada"; pagado_hasta: string; dias_gracia: number };

export type EstadoCuenta = {
  codigo: "prueba" | "al_dia" | "por_vencer" | "atrasada" | "solo_lectura" | "cancelada";
  diasRestantes: number; // negativo = días de atraso
  puedeEditar: boolean;
  mensaje: string;
};

/** Días que avisa antes del vencimiento. */
export const DIAS_AVISO = 7;

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10)) - Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10))) / 86_400_000);
}

const fechaCorta = (f: string) => `${f.slice(8, 10)}-${f.slice(5, 7)}-${f.slice(0, 4)}`;

/** Hoy en Chile, AAAA-MM-DD. */
export function hoyChile(ahora = new Date()) {
  // formatToParts: no depende del formato regional del entorno.
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ahora);
  const v = (t: string) => partes.find((p) => p.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}

export function estadoCuenta(s: Suscripcion | null, hoy = hoyChile()): EstadoCuenta | null {
  if (!s) return null;
  const dias = diasEntre(hoy, s.pagado_hasta);
  const limiteGracia = dias + s.dias_gracia;
  if (s.estado === "cancelada") return { codigo: "cancelada", diasRestantes: dias, puedeEditar: false, mensaje: "La suscripción está cancelada. Tus datos se conservan y puedes descargarlos." };
  if (s.estado === "solo_lectura" || limiteGracia < 0) {
    return { codigo: "solo_lectura", diasRestantes: dias, puedeEditar: false, mensaje: `Cuenta en modo de solo lectura por pago pendiente desde el ${fechaCorta(s.pagado_hasta)}. Puedes ver y descargar todo; informa tu pago para volver a editar.` };
  }
  if (dias < 0) {
    return { codigo: "atrasada", diasRestantes: dias, puedeEditar: true, mensaje: `Tu pago venció el ${fechaCorta(s.pagado_hasta)}. Tienes ${limiteGracia} ${limiteGracia === 1 ? "día" : "días"} antes de que la cuenta pase a solo lectura.` };
  }
  if (s.estado === "prueba") {
    return { codigo: "prueba", diasRestantes: dias, puedeEditar: true, mensaje: dias === 0 ? "Tu prueba gratis termina hoy." : `Te quedan ${dias} ${dias === 1 ? "día" : "días"} de prueba gratis (hasta el ${fechaCorta(s.pagado_hasta)}).` };
  }
  if (dias <= DIAS_AVISO) {
    return { codigo: "por_vencer", diasRestantes: dias, puedeEditar: true, mensaje: dias === 0 ? "Tu suscripción vence hoy." : `Tu suscripción vence en ${dias} ${dias === 1 ? "día" : "días"} (${fechaCorta(s.pagado_hasta)}).` };
  }
  return { codigo: "al_dia", diasRestantes: dias, puedeEditar: true, mensaje: `Al día hasta el ${fechaCorta(s.pagado_hasta)}.` };
}
