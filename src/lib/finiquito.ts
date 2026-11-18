// Vacaciones (feriado legal y progresivo) y finiquitos (indemnizaciones). Cálculo puro y explicado.
// Siempre revisado por el contador antes de usarse.
import Decimal from "decimal.js";
import { resumenParametro, type Parametros, type ResumenParametro } from "@/lib/parametros";

const peso = (d: Decimal.Value) => new Decimal(d).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
const $ = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const num = (n: number, d = 2) => n.toLocaleString("es-CL", { maximumFractionDigits: d });

/** ¿Es día hábil? (lunes a viernes que no sea feriado; para el feriado legal el sábado es inhábil). */
export const esHabil = (iso: string, feriados: Set<string>) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6 && !feriados.has(iso);
};

const sumarDias = (iso: string, n: number) => {
  const f = new Date(`${iso}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
};

/** Días hábiles entre dos fechas (ambas incluidas). */
export function diasHabiles(desde: string, hasta: string, feriados: Set<string>) {
  let n = 0;
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) if (esHabil(d, feriados)) n++;
  return n;
}

/** Años y meses completos entre dos fechas. */
export function antiguedad(ingreso: string, alFecha: string) {
  const [a1, m1, d1] = ingreso.split("-").map(Number);
  const [a2, m2, d2] = alFecha.split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) meses = 0;
  const diasExtra = d2 >= d1 ? d2 - d1 : new Date(Date.UTC(a2, m2 - 1, 0)).getUTCDate() - d1 + d2;
  return { anios: Math.floor(meses / 12), meses: meses % 12, mesesTotales: meses, diasExtra };
}

export type SaldoVacaciones = {
  ganadosLegales: number;
  progresivos: number;
  tomados: number;
  saldo: number;
  proporcionalAnioEnCurso: number;
  detalle: string;
};

/**
 * Saldo de vacaciones: 15 días hábiles por cada año completo, más el feriado progresivo
 * (un día por cada 3 años trabajados sobre 10, con a lo más 10 años de empleadores anteriores),
 * menos los días tomados. También informa la parte proporcional del año en curso.
 */
export function saldoVacaciones(ingreso: string, alFecha: string, aniosPrevios: number, tomados: number, params: Parametros): SaldoVacaciones {
  const base = params.numero("FERIADO_DIAS_HABILES", alFecha);
  const cada = params.numero("FERIADO_PROGRESIVO_CADA", alFecha);
  const a = antiguedad(ingreso, alFecha);
  const ganadosLegales = a.anios * base;
  // Progresivo: por cada año completo en la empresa, se suma 1 día si los años totales ya superan 10 por bloques de 3.
  let progresivos = 0;
  for (let k = 1; k <= a.anios; k++) {
    const totales = Math.min(aniosPrevios, 10) + k;
    if (totales > 10) progresivos += Math.floor((totales - 10) / cada);
  }
  const proporcional = Number(new Decimal(base).mul(a.meses).div(12).toFixed(2));
  return {
    ganadosLegales,
    progresivos,
    tomados,
    saldo: ganadosLegales + progresivos - tomados,
    proporcionalAnioEnCurso: proporcional,
    detalle: `${a.anios} años completos × ${base} días = ${ganadosLegales}; progresivos ${progresivos}; tomados ${num(tomados, 1)}. Año en curso: ${a.meses} meses → ${num(proporcional)} días proporcionales.`,
  };
}

export const CAUSALES = [
  { codigo: 3, texto: "Art. 159 N°1: mutuo acuerdo de las partes", indemniza: false },
  { codigo: 4, texto: "Art. 159 N°2: renuncia del trabajador", indemniza: false },
  { codigo: 5, texto: "Art. 159 N°3: muerte del trabajador", indemniza: false },
  { codigo: 6, texto: "Art. 159 N°4: vencimiento del plazo convenido", indemniza: false },
  { codigo: 7, texto: "Art. 159 N°5: conclusión del trabajo o servicio", indemniza: false },
  { codigo: 13, texto: "Art. 160 N°4: abandono del trabajo", indemniza: false },
  { codigo: 16, texto: "Art. 160 N°7: incumplimiento grave de las obligaciones", indemniza: false },
  { codigo: 18, texto: "Art. 161 inciso 1°: necesidades de la empresa", indemniza: true },
  { codigo: 19, texto: "Art. 161 inciso 2°: desahucio escrito del empleador", indemniza: true },
] as const;

export type LineaFiniquito = { concepto: string; monto: number; formula: string; calculo: string; parametros: ResumenParametro[] };

export type ResultadoFiniquito = { lineas: LineaFiniquito[]; total: number; baseTopada: number; avisos: string[] };

/**
 * Finiquito: indemnización por años de servicio y sustitutiva del aviso previo (solo causales del art. 161),
 * feriado proporcional y pendiente (siempre). La remuneración base es la última remuneración mensual (art. 172).
 */
export function calcularFiniquito(
  e: {
    fechaIngreso: string;
    fechaTermino: string;
    causal: number;
    avisoPrevioDado: boolean;
    remuneracionBase: number;
    tipoContrato: string;
    diasVacacionesPendientes: number;
    aniosPrevios: number;
  },
  params: Parametros,
  feriados: Set<string>,
): ResultadoFiniquito {
  const lineas: LineaFiniquito[] = [];
  const avisos: string[] = [];
  const f = e.fechaTermino;
  const p = (c: string) => params.exigir(c, f);
  const r = resumenParametro;
  const causal = CAUSALES.find((c) => c.codigo === e.causal);
  if (!causal) avisos.push("Causal no reconocida: revisa el código.");

  // Base con tope de 90 UF.
  const topeUf = p("INDEMNIZACION_TOPE_UF");
  const uf = params.buscar("UF_FIN_MES", `${f.slice(0, 7)}-01`) ?? params.buscar("UF_FIN_MES", f);
  let base = e.remuneracionBase;
  let calculoBase = `Última remuneración mensual ${$(e.remuneracionBase)}`;
  if (uf?.valor) {
    const tope = peso(new Decimal(uf.valor).mul(topeUf.valor!));
    if (base > tope) {
      base = tope;
      calculoBase += `, topada en ${num(topeUf.valor!)} UF = ${$(tope)}`;
    }
  } else avisos.push("No hay UF cargada para el mes del término: no se pudo aplicar el tope de 90 UF.");

  const a = antiguedad(e.fechaIngreso, f);
  if (causal?.indemniza) {
    if (a.mesesTotales >= 12) {
      const diasAnio = p("INDEMNIZACION_DIAS_POR_ANIO");
      const topeAnios = p("INDEMNIZACION_TOPE_ANIOS");
      // Año de servicio y fracción superior a seis meses.
      const anios = Math.min(a.anios + (a.meses > 6 || (a.meses === 6 && a.diasExtra > 0) ? 1 : 0), topeAnios.valor!);
      const monto = peso(new Decimal(base).mul(diasAnio.valor!).div(30).mul(anios));
      lineas.push({
        concepto: `Indemnización por años de servicio (${anios} ${anios === 1 ? "año" : "años"})`, monto,
        formula: "30 días de la última remuneración por cada año de servicio y fracción superior a 6 meses, con tope de 11 años (art. 163) y base topada en 90 UF (art. 172)",
        calculo: `${calculoBase}; antigüedad ${a.anios} años y ${a.meses} meses → ${anios} años; ${$(base)} × ${anios} = ${$(monto)}`,
        parametros: [r(diasAnio), r(topeAnios), r(topeUf)],
      });
    } else avisos.push("Menos de un año de servicio: no corresponde indemnización por años de servicio.");
    if (!e.avisoPrevioDado) {
      lineas.push({
        concepto: "Indemnización sustitutiva del aviso previo", monto: base,
        formula: "Una remuneración mensual cuando no se dio aviso con 30 días de anticipación (art. 161 y 162)",
        calculo: `${calculoBase} = ${$(base)}`, parametros: [r(topeUf)],
      });
    }
  }
  if (e.tipoContrato !== "indefinido" && causal?.indemniza) avisos.push("Contrato a plazo fijo o por obra con causal del art. 161: revisa la procedencia de las indemnizaciones.");

  // Feriado: pendiente + proporcional (días hábiles), pagado en días corridos.
  const base15 = params.numero("FERIADO_DIAS_HABILES", f);
  const proporcional = new Decimal(base15).mul(a.meses * 30 + Math.min(a.diasExtra, 30)).div(360);
  const habiles = new Decimal(e.diasVacacionesPendientes).add(proporcional);
  // Conversión a días corridos: se cuentan los días desde el día siguiente al término hasta completar los hábiles.
  let corridos = 0;
  let restantes = habiles.toNumber();
  let d = sumarDias(f, 1);
  while (restantes > 0 && corridos < 400) {
    corridos++;
    if (esHabil(d, feriados)) restantes -= 1;
    d = sumarDias(d, 1);
  }
  const fraccion = restantes < 0 ? 1 + restantes : 0; // si el último día hábil se usó solo en parte
  const corridosExactos = Math.max(0, corridos - (fraccion > 0 ? 1 - fraccion : 0));
  const valorDia = new Decimal(e.remuneracionBase).div(30);
  const montoFeriado = peso(valorDia.mul(corridosExactos));
  lineas.push({
    concepto: `Feriado pendiente y proporcional (${num(habiles.toNumber())} días hábiles = ${num(corridosExactos)} días corridos)`, monto: montoFeriado,
    formula: "Días hábiles pendientes + 15 × fracción del año en curso / 12; se convierten a días corridos contando desde el día siguiente al término y se pagan a la remuneración diaria (art. 73)",
    calculo: `Pendientes ${num(e.diasVacacionesPendientes, 1)} + proporcional ${num(proporcional.toNumber())} = ${num(habiles.toNumber())} hábiles → ${num(corridosExactos)} corridos × ${$(valorDia.toNumber())} = ${$(montoFeriado)}`,
    parametros: [r(p("FERIADO_DIAS_HABILES"))],
  });
  avisos.push("Revisa y agrega remuneraciones pendientes del mes, descuentos y otros haberes antes de emitir el finiquito. El finiquito debe ser revisado por el contador y ratificado ante ministro de fe.");
  return { lineas, total: lineas.reduce((s, l) => s + l.monto, 0), baseTopada: base, avisos };
}
