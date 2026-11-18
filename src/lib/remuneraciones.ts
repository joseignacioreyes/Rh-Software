// Cálculo de la liquidación de sueldo mensual (Chile).
// Puro y verificable: recibe la ficha, las novedades del mes y los parámetros legales vigentes,
// y devuelve cada línea con su fórmula, los valores usados y los parámetros (con vigencia y fuente).
//
// Redondeo: cada monto se redondea al peso (mitad hacia arriba) en el momento en que se calcula,
// como se informa en Previred. Las tasas se multiplican con aritmética decimal (sin errores de coma flotante).
import Decimal from "decimal.js";
import { resumenParametro, type Parametro, type Parametros, type ResumenParametro } from "@/lib/parametros";

export type FichaTrabajador = {
  id: string;
  rut: string;
  nombre: string;
  fecha_nacimiento: string | null;
  fecha_ingreso: string;
  fecha_termino: string | null;
  tipo_contrato: "indefinido" | "plazo_fijo" | "obra";
  jornada_horas: number;
  sueldo_base: number;
  gratificacion: "art50_mensual" | "sin";
  colacion: number;
  movilizacion: number;
  afp: string | null;
  pensionado: boolean;
  salud: string;
  plan_isapre_uf: number | null;
  plan_isapre_pesos: number | null;
  seguro_cesantia: boolean;
  trabajo_pesado: "no" | "pesado" | "menos_pesado";
  cargas_familiares: number;
};

export type NovedadesMes = {
  horas_extra: number;
  dias_licencia: number;
  dias_ausencia: number;
  bono_imponible: number;
  comisiones: number;
  bono_no_imponible: number;
  anticipo: number;
  prestamo: number;
  cuota_sindical: number;
  apv: number;
  otros_descuentos: number;
};

export const NOVEDADES_VACIAS: NovedadesMes = {
  horas_extra: 0, dias_licencia: 0, dias_ausencia: 0, bono_imponible: 0, comisiones: 0, bono_no_imponible: 0,
  anticipo: 0, prestamo: 0, cuota_sindical: 0, apv: 0, otros_descuentos: 0,
};

export type TipoItem = "haber_imponible" | "haber_no_imponible" | "descuento_legal" | "descuento_otro" | "aporte_empleador" | "informativo";
export type ItemLiquidacion = {
  codigo: string;
  nombre: string;
  tipo: TipoItem;
  monto: number;
  formula: string;
  calculo: string;
  parametros: ResumenParametro[];
};

export type ResultadoLiquidacion = {
  diasTrabajados: number;
  items: ItemLiquidacion[];
  totalImponible: number;
  totalNoImponible: number;
  totalHaberes: number;
  rentaImponibleAfp: number;
  rentaImponibleAfc: number;
  baseTributable: number;
  cotizacionAfp: number;
  cotizacionSalud: number;
  cotizacionAfc: number;
  impuestoUnico: number;
  totalDescuentosLegales: number;
  totalOtrosDescuentos: number;
  totalDescuentos: number;
  liquido: number;
  aportesEmpleador: number;
  costoEmpresa: number;
  alertas: { tono: "rojo" | "ambar"; texto: string }[];
  parametros: ResumenParametro[];
};

/** Redondea al peso, mitad hacia arriba. */
const peso = (d: Decimal.Value) => new Decimal(d).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
const pct = (base: number, tasa: number) => peso(new Decimal(base).mul(tasa).div(100));
const $ = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const num = (n: number, d = 2) => n.toLocaleString("es-CL", { maximumFractionDigits: d });

/** Días del mes trabajados (mes comercial de 30 días), considerando ingreso o término a mitad de mes, licencias y ausencias. */
export function diasTrabajados(t: Pick<FichaTrabajador, "fecha_ingreso" | "fecha_termino">, nov: Pick<NovedadesMes, "dias_licencia" | "dias_ausencia">, anio: number, mes: number) {
  const inicioMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const finMes = `${anio}-${String(mes).padStart(2, "0")}-${ultimo}`;
  if (t.fecha_ingreso > finMes || (t.fecha_termino && t.fecha_termino < inicioMes)) return { dias: 0, contratados: 0, detalle: "No tuvo contrato vigente en el mes" };
  const desde = t.fecha_ingreso >= inicioMes ? Number(t.fecha_ingreso.slice(8, 10)) : 1;
  const hasta = t.fecha_termino && t.fecha_termino <= finMes ? Math.min(Number(t.fecha_termino.slice(8, 10)), 30) : 30;
  const contratados = Math.max(0, hasta - Math.min(desde, 30) + 1);
  const dias = Math.max(0, contratados - nov.dias_licencia - nov.dias_ausencia);
  const partes = [`${contratados} días con contrato en el mes (mes de 30 días${desde > 1 ? `, ingresó el día ${desde}` : ""}${hasta < 30 ? `, terminó el día ${hasta}` : ""})`];
  if (nov.dias_licencia) partes.push(`− ${nov.dias_licencia} días de licencia médica`);
  if (nov.dias_ausencia) partes.push(`− ${nov.dias_ausencia} días de ausencia`);
  return { dias, contratados, detalle: partes.join(" ") };
}

const edad = (nacimiento: string | null, alFecha: string) => {
  if (!nacimiento) return null;
  const [a, m, d] = nacimiento.split("-").map(Number);
  const [x, y, z] = alFecha.split("-").map(Number);
  return x - a - (y < m || (y === m && z < d) ? 1 : 0);
};
const aniosServicio = (ingreso: string, alFecha: string) => edad(ingreso, alFecha) ?? 0;

export function calcularLiquidacion(
  t: FichaTrabajador,
  nov: NovedadesMes,
  periodo: { anio: number; mes: number },
  params: Parametros,
  empresa: { tasa_cotizacion_adicional: number | null },
): ResultadoLiquidacion {
  const fecha = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
  const finMes = new Date(Date.UTC(periodo.anio, periodo.mes, 0)).toISOString().slice(0, 10);
  const usados = new Map<string, ResumenParametro>();
  const p = (codigo: string): Parametro => {
    const x = params.exigir(codigo, fecha);
    usados.set(`${x.codigo}|${x.vigente_desde}`, resumenParametro(x));
    return x;
  };
  const r = (x: Parametro) => resumenParametro(x);
  const items: ItemLiquidacion[] = [];
  const alertas: ResultadoLiquidacion["alertas"] = [];
  const add = (i: ItemLiquidacion) => {
    if (i.monto !== 0 || i.tipo === "informativo") items.push(i);
  };

  // --- Días trabajados ---
  const d = diasTrabajados(t, nov, periodo.anio, periodo.mes);
  const dias = d.dias;
  add({ codigo: "dias", nombre: "Días trabajados", tipo: "informativo", monto: dias, formula: "Días con contrato − licencias − ausencias", calculo: d.detalle, parametros: [] });

  // --- Haberes imponibles ---
  const sueldo = peso(new Decimal(t.sueldo_base).mul(dias).div(30));
  add({ codigo: "sueldo_base", nombre: "Sueldo base", tipo: "haber_imponible", monto: sueldo, formula: "Sueldo base mensual × días trabajados / 30", calculo: `${$(t.sueldo_base)} × ${dias} / 30 = ${$(sueldo)}`, parametros: [] });

  let horasExtra = 0;
  if (nov.horas_extra > 0) {
    const recargo = p("HORAS_EXTRA_RECARGO");
    const valorHora = new Decimal(t.sueldo_base).div(30).mul(28).div(new Decimal(t.jornada_horas).mul(4));
    const valorExtra = valorHora.mul(new Decimal(1).add(new Decimal(recargo.valor!).div(100)));
    horasExtra = peso(valorExtra.mul(nov.horas_extra));
    add({
      codigo: "horas_extra", nombre: `Horas extraordinarias (${num(nov.horas_extra)} h)`, tipo: "haber_imponible", monto: horasExtra,
      formula: "Valor hora = sueldo base / 30 × 28 / (jornada semanal × 4); hora extra = valor hora × (1 + recargo)",
      calculo: `${$(t.sueldo_base)} / 30 × 28 / (${num(t.jornada_horas)} × 4) = ${num(valorHora.toNumber(), 4)} por hora; × ${1 + recargo.valor! / 100} = ${num(valorExtra.toNumber(), 4)}; × ${num(nov.horas_extra)} h = ${$(horasExtra)}`,
      parametros: [r(recargo)],
    });
  }
  add({ codigo: "comisiones", nombre: "Comisiones", tipo: "haber_imponible", monto: nov.comisiones, formula: "Informado en las novedades del mes", calculo: $(nov.comisiones), parametros: [] });
  add({ codigo: "bono_imponible", nombre: "Bonos imponibles", tipo: "haber_imponible", monto: nov.bono_imponible, formula: "Informado en las novedades del mes", calculo: $(nov.bono_imponible), parametros: [] });

  let gratificacion = 0;
  if (t.gratificacion === "art50_mensual" && dias > 0) {
    const porc = p("GRATIFICACION_PORCENTAJE");
    const topeImm = p("GRATIFICACION_TOPE_IMM");
    const imm = p("INGRESO_MINIMO");
    const base = sueldo + horasExtra + nov.comisiones + nov.bono_imponible;
    const veinticinco = new Decimal(base).mul(porc.valor!).div(100);
    const topeMensual = new Decimal(imm.valor!).mul(topeImm.valor!).div(12).mul(dias).div(30);
    gratificacion = peso(Decimal.min(veinticinco, topeMensual));
    add({
      codigo: "gratificacion", nombre: "Gratificación legal (art. 50)", tipo: "haber_imponible", monto: gratificacion,
      formula: "El menor entre el 25% de las remuneraciones del mes y el tope de 4,75 ingresos mínimos al año (mensual, proporcional a los días trabajados)",
      calculo: `25% × ${$(base)} = ${$(veinticinco.toNumber())}; tope = ${$(imm.valor!)} × ${num(topeImm.valor!)} / 12 × ${dias} / 30 = ${$(topeMensual.toNumber())}; se paga ${$(gratificacion)}`,
      parametros: [r(porc), r(topeImm), r(imm)],
    });
  }
  const totalImponible = sueldo + horasExtra + nov.comisiones + nov.bono_imponible + gratificacion;

  // --- Haberes no imponibles ---
  const colacion = peso(new Decimal(t.colacion).mul(dias).div(30));
  const movilizacion = peso(new Decimal(t.movilizacion).mul(dias).div(30));
  add({ codigo: "colacion", nombre: "Asignación de colación", tipo: "haber_no_imponible", monto: colacion, formula: "Monto pactado × días trabajados / 30", calculo: `${$(t.colacion)} × ${dias} / 30 = ${$(colacion)}`, parametros: [] });
  add({ codigo: "movilizacion", nombre: "Asignación de movilización", tipo: "haber_no_imponible", monto: movilizacion, formula: "Monto pactado × días trabajados / 30", calculo: `${$(t.movilizacion)} × ${dias} / 30 = ${$(movilizacion)}`, parametros: [] });
  let asignacionFamiliar = 0;
  if (t.cargas_familiares > 0) {
    const tramos = p("ASIGNACION_FAMILIAR_TRAMOS");
    const lista = tramos.valor_json as { tramo: string; hasta: number | null; monto: number }[];
    const tramo = lista.find((x) => x.hasta === null || totalImponible <= x.hasta)!;
    asignacionFamiliar = tramo.monto * t.cargas_familiares;
    add({
      codigo: "asignacion_familiar", nombre: `Asignación familiar (tramo ${tramo.tramo}, ${t.cargas_familiares} ${t.cargas_familiares === 1 ? "carga" : "cargas"})`, tipo: "haber_no_imponible", monto: asignacionFamiliar,
      formula: "Monto del tramo según la renta × número de cargas",
      calculo: `Renta del mes ${$(totalImponible)} → tramo ${tramo.tramo} (${$(tramo.monto)} por carga) × ${t.cargas_familiares} = ${$(asignacionFamiliar)}. POR VERIFICAR: el tramo se determina con la renta promedio del semestre anterior; aquí se usa la del mes.`,
      parametros: [r(tramos)],
    });
  }
  add({ codigo: "bono_no_imponible", nombre: "Bonos no imponibles", tipo: "haber_no_imponible", monto: nov.bono_no_imponible, formula: "Informado en las novedades del mes", calculo: $(nov.bono_no_imponible), parametros: [] });
  const totalNoImponible = colacion + movilizacion + asignacionFamiliar + nov.bono_no_imponible;
  const totalHaberes = totalImponible + totalNoImponible;

  // --- Topes imponibles ---
  const uf = p("UF_FIN_MES");
  const topeAfpUf = p("TOPE_IMPONIBLE_AFP");
  const topeAfcUf = p("TOPE_IMPONIBLE_AFC");
  const topeAfp = peso(new Decimal(uf.valor!).mul(topeAfpUf.valor!));
  const topeAfc = peso(new Decimal(uf.valor!).mul(topeAfcUf.valor!));
  const rentaAfp = Math.min(totalImponible, topeAfp);
  const rentaAfc = Math.min(totalImponible, topeAfc);
  add({
    codigo: "renta_imponible", nombre: "Renta imponible AFP y salud", tipo: "informativo", monto: rentaAfp,
    formula: "Total imponible, con tope de 90 UF (UF del último día del mes)",
    calculo: `Total imponible ${$(totalImponible)}; tope ${num(topeAfpUf.valor!)} UF × ${num(uf.valor!)} = ${$(topeAfp)} → ${$(rentaAfp)}`,
    parametros: [r(uf), r(topeAfpUf)],
  });

  // --- Descuentos legales ---
  let cotAfp = 0;
  if (t.afp && !t.pensionado) {
    const tasas = p("AFP_TASA_TRABAJADOR");
    const tasa = (tasas.valor_json as Record<string, number>)[t.afp.replace("afp_", "")];
    if (tasa === undefined) throw new Error(`No hay tasa para ${t.afp} en los parámetros legales.`);
    cotAfp = pct(rentaAfp, tasa);
    add({ codigo: "afp", nombre: `AFP ${t.afp.replace("afp_", "").replace(/^\w/, (c) => c.toUpperCase())} (${num(tasa)}%)`, tipo: "descuento_legal", monto: cotAfp, formula: "Renta imponible × (10% + comisión de la AFP)", calculo: `${$(rentaAfp)} × ${num(tasa)}% = ${$(cotAfp)}`, parametros: [r(tasas)] });
  } else if (!t.afp && !t.pensionado) {
    alertas.push({ tono: "rojo", texto: `Falta la AFP de ${t.nombre}.` });
  }

  const tasaSalud = p("SALUD_TASA");
  const salud7 = pct(rentaAfp, tasaSalud.valor!);
  let cotSalud = salud7;
  let calculoSalud = `${$(rentaAfp)} × ${num(tasaSalud.valor!)}% = ${$(salud7)}`;
  if (t.salud.startsWith("isapre")) {
    let plan = 0;
    if (t.plan_isapre_uf) plan = peso(new Decimal(t.plan_isapre_uf).mul(uf.valor!).mul(dias).div(30));
    else if (t.plan_isapre_pesos) plan = peso(new Decimal(t.plan_isapre_pesos).mul(dias).div(30));
    else alertas.push({ tono: "ambar", texto: `${t.nombre} está en Isapre pero no tiene el valor del plan.` });
    if (plan > salud7) {
      cotSalud = plan;
      calculoSalud += `; plan ${t.plan_isapre_uf ? `${num(t.plan_isapre_uf, 4)} UF × ${num(uf.valor!)}` : $(t.plan_isapre_pesos ?? 0)} × ${dias}/30 = ${$(plan)} es mayor: se descuenta el plan (adicional de ${$(plan - salud7)})`;
    } else if (plan) {
      calculoSalud += `; el plan (${$(plan)}) es menor que el 7%: se descuenta el 7%`;
    }
  }
  add({ codigo: "salud", nombre: `Salud (${t.salud === "fonasa" ? "Fonasa" : "Isapre"})`, tipo: "descuento_legal", monto: cotSalud, formula: "7% de la renta imponible (con tope), o el plan de la Isapre si es mayor", calculo: calculoSalud, parametros: [r(tasaSalud), r(uf)] });

  let cotAfc = 0;
  const anios = aniosServicio(t.fecha_ingreso, finMes);
  const claveAfc = t.tipo_contrato === "indefinido" ? (anios >= 11 ? "indefinido_11_anios" : "indefinido") : t.tipo_contrato;
  const tasasAfc = t.seguro_cesantia && !t.pensionado ? p("AFC_TASAS") : null;
  const afcTabla = tasasAfc ? (tasasAfc.valor_json as Record<string, { empleador: number; trabajador: number }>)[claveAfc] : null;
  if (afcTabla && afcTabla.trabajador > 0) {
    cotAfc = pct(rentaAfc, afcTabla.trabajador);
    add({
      codigo: "afc_trabajador", nombre: `Seguro de cesantía (${num(afcTabla.trabajador)}%)`, tipo: "descuento_legal", monto: cotAfc,
      formula: "Renta imponible (tope 135,2 UF) × tasa del trabajador según contrato",
      calculo: `Tope ${num(topeAfcUf.valor!)} UF = ${$(topeAfc)}; ${$(rentaAfc)} × ${num(afcTabla.trabajador)}% = ${$(cotAfc)}`,
      parametros: [r(tasasAfc!), r(topeAfcUf)],
    });
  }

  // Trabajo pesado: cotización del trabajador.
  let pesadoTrab = 0;
  let pesadoEmp = 0;
  if (t.trabajo_pesado !== "no") {
    const tp = p("TRABAJO_PESADO");
    const tabla = (tp.valor_json as Record<string, { empleador: number; trabajador: number }>)[t.trabajo_pesado === "pesado" ? "pesado" : "menos_pesado"];
    pesadoTrab = pct(rentaAfp, tabla.trabajador);
    pesadoEmp = pct(rentaAfp, tabla.empleador);
    add({ codigo: "trabajo_pesado", nombre: "Cotización trabajo pesado (trabajador)", tipo: "descuento_legal", monto: pesadoTrab, formula: "Renta imponible × tasa del trabajador", calculo: `${$(rentaAfp)} × ${num(tabla.trabajador)}% = ${$(pesadoTrab)}`, parametros: [r(tp)] });
  }

  // --- Impuesto único ---
  const saludTributable = Math.min(cotSalud, salud7);
  const baseTributable = Math.max(0, totalImponible - cotAfp - saludTributable - cotAfc - pesadoTrab);
  const utm = p("UTM");
  const tabla = p("IMPUESTO_UNICO_TABLA");
  const tramos = tabla.valor_json as { desde: number; hasta: number | null; factor: number; rebaja: number }[];
  const enUtm = new Decimal(baseTributable).div(utm.valor!);
  const tramo = tramos.find((x) => enUtm.gt(x.desde) && (x.hasta === null || enUtm.lte(x.hasta))) ?? tramos[0];
  const impuesto = Math.max(0, peso(new Decimal(baseTributable).mul(tramo.factor).sub(new Decimal(tramo.rebaja).mul(utm.valor!))));
  // Se muestra siempre (aunque sea $0) para que se vea por qué está exento.
  items.push({
    codigo: "impuesto_unico", nombre: "Impuesto único de segunda categoría", tipo: "descuento_legal", monto: impuesto,
    formula: "(Total imponible − AFP − salud (hasta 7%) − seguro de cesantía) × factor − cantidad a rebajar, según la tabla mensual en UTM",
    calculo: `Base ${$(totalImponible)} − ${$(cotAfp)} − ${$(saludTributable)} − ${$(cotAfc)}${pesadoTrab ? ` − ${$(pesadoTrab)}` : ""} = ${$(baseTributable)} (${num(enUtm.toNumber(), 2)} UTM de ${$(utm.valor!)}); tramo hasta ${tramo.hasta ?? "más"} UTM: × ${tramo.factor} − ${num(tramo.rebaja)} UTM = ${$(impuesto)}`,
    parametros: [r(utm), r(tabla)],
  });

  // --- Otros descuentos ---
  const otros: [string, string, number][] = [
    ["anticipo", "Anticipo de sueldo", nov.anticipo], ["prestamo", "Cuota de préstamo", nov.prestamo],
    ["cuota_sindical", "Cuota sindical", nov.cuota_sindical], ["apv", "Ahorro previsional voluntario (APV)", nov.apv],
    ["otros_descuentos", "Otros descuentos", nov.otros_descuentos],
  ];
  for (const [codigo, nombre, monto] of otros) add({ codigo, nombre, tipo: "descuento_otro", monto, formula: "Informado en las novedades del mes", calculo: $(monto), parametros: [] });

  const totalDescuentosLegales = cotAfp + cotSalud + cotAfc + impuesto + pesadoTrab;
  const totalOtrosDescuentos = otros.reduce((s, x) => s + x[2], 0);
  const totalDescuentos = totalDescuentosLegales + totalOtrosDescuentos;
  const liquido = totalHaberes - totalDescuentos;

  // --- Aportes del empleador ---
  let aportes = 0;
  const aporte = (codigo: string, nombre: string, base: number, param: Parametro, tasa: number, formula: string, extra: ResumenParametro[] = []) => {
    const monto = pct(base, tasa);
    aportes += monto;
    add({ codigo, nombre, tipo: "aporte_empleador", monto, formula, calculo: `${$(base)} × ${num(tasa, 4)}% = ${$(monto)}`, parametros: [r(param), ...extra] });
  };
  if (t.afp && !t.pensionado) {
    const sis = p("SIS_TASA");
    aporte("sis", "Seguro de Invalidez y Sobrevivencia (SIS)", rentaAfp, sis, sis.valor!, "Renta imponible × tasa SIS");
    const ci = p("EMPLEADOR_CUENTA_INDIVIDUAL");
    const crp = p("EMPLEADOR_RENTABILIDAD_PROTEGIDA");
    const ev = p("EMPLEADOR_EXPECTATIVA_VIDA");
    aporte("empleador_ci", "Reforma de pensiones: cuenta individual", rentaAfp, ci, ci.valor!, "Renta imponible × tasa vigente del periodo (Ley 21.735)");
    aporte("empleador_crp", "Reforma de pensiones: rentabilidad protegida", rentaAfp, crp, crp.valor!, "Renta imponible × tasa vigente del periodo (Ley 21.735)");
    aporte("empleador_ev", "Reforma de pensiones: expectativa de vida", rentaAfp, ev, ev.valor!, "Renta imponible × tasa vigente del periodo (Ley 21.735)");
  }
  if (afcTabla && afcTabla.empleador > 0) aporte("afc_empleador", `Seguro de cesantía empleador (${num(afcTabla.empleador)}%)`, rentaAfc, tasasAfc!, afcTabla.empleador, "Renta imponible (tope 135,2 UF) × tasa del empleador según contrato");
  const basica = p("LEY16744_BASICA");
  const adicional = Number(empresa.tasa_cotizacion_adicional ?? 0);
  aporte("ley_16744", `Ley 16.744 (básica ${num(basica.valor!)}% + adicional ${num(adicional)}%)`, rentaAfp, basica, basica.valor! + adicional, "Renta imponible × (cotización básica + adicional de la empresa)");
  if (pesadoEmp) {
    aportes += pesadoEmp;
    add({ codigo: "trabajo_pesado_empleador", nombre: "Cotización trabajo pesado (empleador)", tipo: "aporte_empleador", monto: pesadoEmp, formula: "Renta imponible × tasa del empleador", calculo: $(pesadoEmp), parametros: [] });
  }

  // --- Alertas ---
  const imm = params.buscar("INGRESO_MINIMO", fecha);
  const jornadaMax = params.buscar("JORNADA_MAXIMA", finMes);
  const anios_edad = edad(t.fecha_nacimiento, finMes);
  const immAplicable = anios_edad !== null && (anios_edad < 18 || anios_edad > 65) ? params.buscar("INGRESO_MINIMO_MENORES_MAYORES", fecha) : imm;
  if (immAplicable?.valor && jornadaMax?.valor) {
    const minimo = (immAplicable.valor * Math.min(t.jornada_horas, jornadaMax.valor)) / jornadaMax.valor;
    if (t.sueldo_base < Math.round(minimo)) {
      alertas.push({ tono: "rojo", texto: `Sueldo base de ${t.nombre} (${$(t.sueldo_base)}) bajo el ingreso mínimo para su jornada (${$(minimo)}).` });
    }
  }
  if (jornadaMax?.valor && t.jornada_horas > jornadaMax.valor) {
    alertas.push({ tono: "rojo", texto: `La jornada de ${t.nombre} (${num(t.jornada_horas)} h) supera la máxima legal vigente (${num(jornadaMax.valor)} h).` });
  }
  if (t.tipo_contrato === "plazo_fijo" && t.fecha_termino && t.fecha_termino < finMes && !d.detalle.includes("terminó")) {
    alertas.push({ tono: "ambar", texto: `El contrato a plazo fijo de ${t.nombre} terminó el ${t.fecha_termino.split("-").reverse().join("-")}.` });
  }
  if (nov.dias_licencia > 0) {
    alertas.push({ tono: "ambar", texto: `${t.nombre} tuvo ${nov.dias_licencia} días de licencia médica: informa el movimiento de personal en Previred y revisa la cotización del seguro de cesantía del empleador por esos días.` });
  }
  if (liquido < 0) alertas.push({ tono: "rojo", texto: `El líquido de ${t.nombre} es negativo: revisa los descuentos.` });
  if (dias === 0) alertas.push({ tono: "ambar", texto: `${t.nombre} no tiene días trabajados en el mes.` });

  return {
    diasTrabajados: dias,
    items,
    totalImponible,
    totalNoImponible,
    totalHaberes,
    rentaImponibleAfp: rentaAfp,
    rentaImponibleAfc: rentaAfc,
    baseTributable,
    cotizacionAfp: cotAfp,
    cotizacionSalud: cotSalud,
    cotizacionAfc: cotAfc,
    impuestoUnico: impuesto,
    totalDescuentosLegales,
    totalOtrosDescuentos,
    totalDescuentos,
    liquido,
    aportesEmpleador: aportes,
    costoEmpresa: totalHaberes + aportes,
    alertas,
    parametros: [...usados.values()],
  };
}
