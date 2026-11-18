// Archivos legales del mes: nómina Previred (105 campos) y Libro de Remuneraciones Electrónico (LRE).
// Fuentes de los formatos (resumidas en docs/formatos/):
//  * Previred, "Formato estándar largo variable, por separador", versión 58 (abril 2022).
//  * Dirección del Trabajo, "Libro de Remuneraciones Electrónico: instrucciones de carga", Anexos 1 y 2.
// Los formatos están versionados: si Previred o la DT publican una versión nueva, se agrega otro generador.

export type CodigosInstitucion = { previred: string | null; lre: string | null };

export type FilaArchivo = {
  trabajador: {
    rut: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    sexo: string | null;
    nacionalidad: string | null;
    fecha_ingreso: string;
    fecha_termino: string | null;
    tipo_contrato: "indefinido" | "plazo_fijo" | "obra";
    jornada_horas: number;
    pensionado: boolean;
    afp: CodigosInstitucion | null;
    salud: CodigosInstitucion & { esIsapre: boolean };
    plan_isapre_uf: number | null;
    seguro_cesantia: boolean;
    cargas_familiares: number;
    trabajo_pesado: string;
    cargo: string | null;
  };
  liquidacion: {
    dias: number;
    items: { codigo: string; monto: number }[];
    total_imponible: number;
    total_no_imponible: number;
    total_haberes: number;
    renta_imponible_afp: number;
    renta_imponible_afc: number;
    cotizacion_afp: number;
    cotizacion_salud: number;
    cotizacion_afc: number;
    impuesto_unico: number;
    total_descuentos: number;
    liquido: number;
    aportes_empleador: number;
  };
  licencias: { desde: string; hasta: string; rut_pagadora: string | null }[];
  diasVacaciones: number;
  tramoAsignacion: "A" | "B" | "C" | "D";
  causalTermino: number | null;
};

export type DatosArchivo = {
  anio: number;
  mes: number;
  empresa: { rut: string; mutual: CodigosInstitucion | null; ccaf: CodigosInstitucion | null; region_lre: number | null; comuna_lre: number | null; jornadaMaxima: number };
  filas: FilaArchivo[];
};

export type Validacion = { errores: string[]; avisos: string[] };

const monto = (f: FilaArchivo, codigo: string) => f.liquidacion.items.filter((i) => i.codigo === codigo).reduce((s, i) => s + i.monto, 0);
const fechaDDMMAAAA = (iso: string, sep = "/") => `${iso.slice(8, 10)}${sep}${iso.slice(5, 7)}${sep}${iso.slice(0, 4)}`;
const sinAcentosMayus = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-ZÑ0-9 ]/g, "").trim();
const enMes = (iso: string, anio: number, mes: number) => iso.slice(0, 7) === `${anio}-${String(mes).padStart(2, "0")}`;

// ---------------------------------------------------------------------
// Previred (105 campos)
// ---------------------------------------------------------------------

type Campo = { n: number; nombre: string; tipo: "9" | "X"; largo: number };
/** Definición de los 105 campos de la versión 58 (número, nombre, tipo y largo máximo). */
export const CAMPOS_PREVIRED_V58: Campo[] = [
  [1, "RUT Trabajador", "9", 11], [2, "DV Trabajador", "X", 1], [3, "Apellido Paterno", "X", 30], [4, "Apellido Materno", "X", 30], [5, "Nombres", "X", 30],
  [6, "Sexo", "X", 1], [7, "Nacionalidad", "9", 1], [8, "Tipo Pago", "9", 2], [9, "Período Desde", "9", 6], [10, "Período Hasta", "9", 6],
  [11, "Régimen Previsional", "X", 3], [12, "Tipo Trabajador", "9", 1], [13, "Días Trabajados", "9", 2], [14, "Tipo de Línea", "X", 2], [15, "Código Movimiento de Personal", "9", 2],
  [16, "Fecha Desde", "X", 10], [17, "Fecha Hasta", "X", 10], [18, "Tramo Asignación Familiar", "X", 1], [19, "N° Cargas Simples", "9", 2], [20, "N° Cargas Maternales", "9", 1],
  [21, "N° Cargas Inválidas", "9", 1], [22, "Asignación Familiar", "9", 6], [23, "Asignación Familiar Retroactiva", "9", 6], [24, "Reintegro Cargas Familiares", "9", 6], [25, "Solicitud Trabajador Joven", "X", 1],
  [26, "Código de la AFP", "9", 2], [27, "Renta Imponible AFP", "9", 8], [28, "Cotización Obligatoria AFP", "9", 8], [29, "Cotización SIS", "9", 8], [30, "Cuenta de Ahorro Voluntario AFP", "9", 8],
  [31, "Renta Imp. Sust. AFP", "9", 8], [32, "Tasa Pactada (Sustit.)", "X", 5], [33, "Aporte Indemn. (Sustit.)", "9", 9], [34, "N° Períodos (Sustit.)", "9", 2], [35, "Período desde (Sustit.)", "X", 10],
  [36, "Período Hasta (Sustit.)", "X", 10], [37, "Puesto de Trabajo Pesado", "X", 40], [38, "% Cotización Trabajo Pesado", "X", 5], [39, "Cotización Trabajo Pesado", "9", 6], [40, "Código Institución APVI", "9", 3],
  [41, "Número de Contrato APVI", "X", 20], [42, "Forma de Pago APVI", "9", 1], [43, "Cotización APVI", "9", 8], [44, "Cotización Depósitos Convenidos", "9", 8], [45, "Código Institución APVC", "9", 3],
  [46, "Número de Contrato APVC", "X", 20], [47, "Forma de Pago APVC", "9", 1], [48, "Cotización Trabajador APVC", "9", 8], [49, "Cotización Empleador APVC", "9", 8], [50, "RUT Afiliado Voluntario", "9", 11],
  [51, "DV Afiliado Voluntario", "X", 1], [52, "Apellido Paterno Af. Vol.", "X", 30], [53, "Apellido Materno Af. Vol.", "X", 30], [54, "Nombres Af. Vol.", "X", 30], [55, "Código Mov. Personal Af. Vol.", "9", 2],
  [56, "Fecha desde Af. Vol.", "X", 10], [57, "Fecha hasta Af. Vol.", "X", 10], [58, "Código AFP Af. Vol.", "9", 2], [59, "Monto Capitalización Voluntaria", "9", 8], [60, "Monto Ahorro Voluntario", "9", 8],
  [61, "N° periodos de cotización", "9", 2], [62, "Código EX-Caja Régimen", "9", 4], [63, "Tasa Cotización Ex-Caja", "X", 5], [64, "Renta Imponible IPS", "9", 8], [65, "Cotización Obligatoria IPS", "9", 8],
  [66, "Renta Imponible Desahucio", "9", 8], [67, "Código Ex-Caja Desahucio", "9", 4], [68, "Tasa Cotización Desahucio", "X", 5], [69, "Cotización Desahucio", "9", 8], [70, "Cotización Fonasa", "9", 8],
  [71, "Cotización Acc. Trabajo (ISL)", "9", 8], [72, "Bonificación Ley 15.386", "9", 8], [73, "Descuento cargas familiares IPS", "9", 8], [74, "Bonos Gobierno", "9", 8], [75, "Código Institución de Salud", "9", 2],
  [76, "Número del FUN", "X", 16], [77, "Renta Imponible Isapre", "9", 8], [78, "Moneda del plan pactado Isapre", "9", 1], [79, "Cotización Pactada", "X", 8], [80, "Cotización Obligatoria Isapre", "9", 8],
  [81, "Cotización Adicional Voluntaria", "9", 8], [82, "Monto GES", "9", 8], [83, "Código CCAF", "9", 2], [84, "Renta Imponible CCAF", "9", 8], [85, "Créditos Personales CCAF", "9", 8],
  [86, "Descuento Dental CCAF", "9", 8], [87, "Descuentos por Leasing", "9", 8], [88, "Descuentos por seguro", "9", 8], [89, "Otros descuentos CCAF", "9", 8], [90, "Cotización a CCAF de no afiliados a Isapres", "9", 8],
  [91, "Descuento Cargas Familiares CCAF", "9", 8], [92, "Otros descuentos CCAF 1", "9", 8], [93, "Otros descuentos CCAF 2", "9", 8], [94, "Bonos Gobierno CCAF", "9", 8], [95, "Código de Sucursal", "X", 20],
  [96, "Código Mutualidad", "9", 2], [97, "Renta Imponible Mutual", "9", 8], [98, "Cotización Accidente del Trabajo", "9", 8], [99, "Sucursal para pago Mutual", "9", 3], [100, "Renta Imponible Seguro Cesantía", "9", 8],
  [101, "Aporte Trabajador Seguro Cesantía", "9", 8], [102, "Aporte Empleador Seguro Cesantía", "9", 8], [103, "Rut Pagadora Subsidio", "9", 11], [104, "DV Pagadora Subsidio", "X", 1], [105, "Centro de Costos", "X", 20],
].map(([n, nombre, tipo, largo]) => ({ n, nombre, tipo, largo }) as Campo);

/** Movimiento de personal del mes (Tabla N°7) y sus fechas. */
function movimientoPersonal(f: FilaArchivo, anio: number, mes: number): { codigo: number; desde: string; hasta: string } {
  const t = f.trabajador;
  if (t.fecha_termino && enMes(t.fecha_termino, anio, mes)) return { codigo: 2, desde: "", hasta: fechaDDMMAAAA(t.fecha_termino, "-") };
  if (enMes(t.fecha_ingreso, anio, mes)) return { codigo: t.tipo_contrato === "indefinido" ? 1 : 7, desde: fechaDDMMAAAA(t.fecha_ingreso, "-"), hasta: "" };
  const lic = f.licencias.find((l) => l.desde.slice(0, 7) <= `${anio}-${String(mes).padStart(2, "0")}` && l.hasta.slice(0, 7) >= `${anio}-${String(mes).padStart(2, "0")}`);
  if (lic) {
    const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const fin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
    return { codigo: 3, desde: fechaDDMMAAAA(lic.desde < inicio ? inicio : lic.desde, "-"), hasta: fechaDDMMAAAA(lic.hasta > fin ? fin : lic.hasta, "-") };
  }
  return { codigo: 0, desde: "", hasta: "" };
}

export function generarPrevired(d: DatosArchivo): { contenido: string; lineas: string[][]; validacion: Validacion } {
  const validacion: Validacion = { errores: [], avisos: [] };
  const periodo = `${String(d.mes).padStart(2, "0")}${d.anio}`;
  const lineas: string[][] = [];

  for (const f of d.filas) {
    const t = f.trabajador;
    const l = f.liquidacion;
    const nombre = `${t.nombres} ${t.apellido_paterno}`;
    const [cuerpo, dv] = t.rut.split("-");
    const v: Record<number, string | number> = {};
    for (const c of CAMPOS_PREVIRED_V58) v[c.n] = c.tipo === "9" ? 0 : "";
    const mov = movimientoPersonal(f, d.anio, d.mes);
    const enAfp = !!t.afp?.previred && !t.pensionado;
    Object.assign(v, {
      1: Number(cuerpo), 2: dv, 3: sinAcentosMayus(t.apellido_paterno), 4: sinAcentosMayus(t.apellido_materno ?? ""), 5: sinAcentosMayus(t.nombres),
      6: t.sexo === "F" ? "F" : "M", 7: (t.nacionalidad ?? "Chilena").toLowerCase().startsWith("chilen") ? 0 : 1, 8: "01", 9: periodo, 10: "",
      11: enAfp ? "AFP" : "SIP", 12: t.pensionado ? 1 : 0, 13: l.dias, 14: "00", 15: mov.codigo, 16: mov.desde, 17: mov.hasta,
      18: f.tramoAsignacion, 19: t.cargas_familiares, 22: monto(f, "asignacion_familiar"), 25: "N",
      26: enAfp ? t.afp!.previred! : "00", 27: enAfp ? l.renta_imponible_afp : 0, 28: enAfp ? l.cotizacion_afp : 0, 29: enAfp ? monto(f, "sis") : 0,
      39: monto(f, "trabajo_pesado"), 37: t.trabajo_pesado !== "no" ? sinAcentosMayus(t.cargo ?? "Trabajo pesado") : "",
      38: t.trabajo_pesado === "pesado" ? "04,00" : t.trabajo_pesado === "menos_pesado" ? "02,00" : "",
      75: t.salud.previred ?? "00",
      96: d.empresa.mutual?.previred && d.empresa.mutual.previred !== "00" ? d.empresa.mutual.previred : "00",
      100: t.seguro_cesantia && !t.pensionado ? l.renta_imponible_afc : 0, 101: t.seguro_cesantia ? l.cotizacion_afc : 0, 102: monto(f, "afc_empleador"),
    });
    // Salud: Fonasa (con CCAF se divide 7% en Fonasa y CCAF) o Isapre.
    if (t.salud.esIsapre) {
      const siete = Math.round(l.renta_imponible_afp * 0.07);
      Object.assign(v, { 77: l.renta_imponible_afp, 78: t.plan_isapre_uf ? 2 : 1, 79: t.plan_isapre_uf ? String(t.plan_isapre_uf).replace(".", ",") : l.cotizacion_salud, 80: Math.min(siete, l.cotizacion_salud), 81: Math.max(0, l.cotizacion_salud - siete) });
      validacion.avisos.push(`${nombre}: confirma el N° de FUN de la Isapre (campo 76) y el formato del plan en UF (campo 79).`);
    } else if (d.empresa.ccaf?.previred) {
      // Distribución del 7%: 4,2% CCAF y 2,8% Fonasa (Previred).
      const ccaf = Math.round(l.renta_imponible_afp * 0.042);
      Object.assign(v, { 70: l.cotizacion_salud - ccaf, 90: ccaf });
    } else {
      v[70] = l.cotizacion_salud;
    }
    if (d.empresa.ccaf?.previred) Object.assign(v, { 83: d.empresa.ccaf.previred, 84: l.total_imponible });
    if (v[96] === "00") v[71] = monto(f, "ley_16744");
    else Object.assign(v, { 97: l.renta_imponible_afp, 98: monto(f, "ley_16744") });
    if (mov.codigo === 3) {
      const lic = f.licencias[0];
      if (lic?.rut_pagadora) {
        const [rp, dvp] = lic.rut_pagadora.split("-");
        Object.assign(v, { 103: Number(rp), 104: dvp });
      } else validacion.avisos.push(`${nombre}: tiene licencia médica y falta el RUT de la entidad pagadora del subsidio (campos 103 y 104).`);
    }
    if (monto(f, "apv") > 0) validacion.avisos.push(`${nombre}: tiene APV; indica la institución y el contrato (campos 40 a 43) antes de subir el archivo.`);
    if (monto(f, "empleador_ci") + monto(f, "empleador_crp") + monto(f, "empleador_ev") > 0) {
      // La versión 58 no tiene campos para la Reforma de Pensiones.
    }

    // Validación campo por campo.
    for (const c of CAMPOS_PREVIRED_V58) {
      const valor = String(v[c.n]);
      if (valor.length > c.largo) validacion.errores.push(`${nombre}: el campo ${c.n} (${c.nombre}) supera ${c.largo} caracteres.`);
      if (c.tipo === "9" && valor !== "" && !/^\d+$/.test(valor)) validacion.errores.push(`${nombre}: el campo ${c.n} (${c.nombre}) debe ser numérico entero.`);
      if (c.tipo === "X" && /\s{2,}|^\s|\s$/.test(valor)) validacion.errores.push(`${nombre}: el campo ${c.n} tiene espacios sobrantes.`);
    }
    if (l.dias < 0 || l.dias > 30) validacion.errores.push(`${nombre}: días trabajados fuera de rango (0 a 30).`);
    if (l.dias === 0 && mov.codigo === 0) validacion.errores.push(`${nombre}: con 0 días trabajados debe informarse un movimiento de personal.`);
    if (!enAfp && !t.pensionado) validacion.errores.push(`${nombre}: no tiene AFP (régimen SIP). Revisa la ficha.`);
    if (!/^\d{1,8}$/.test(cuerpo) || !dv) validacion.errores.push(`${nombre}: RUT mal formado.`);
    lineas.push(CAMPOS_PREVIRED_V58.map((c) => String(v[c.n])));
  }
  validacion.avisos.push(
    "Formato Previred versión 58 (abril 2022): los aportes del empleador de la Reforma de Pensiones (cuenta individual, rentabilidad protegida y expectativa de vida) no tienen campo en esta versión. Confirma con el formato vigente publicado por Previred antes de declarar.",
  );
  return { contenido: lineas.map((l) => l.join(";")).join("\r\n") + "\r\n", lineas, validacion };
}

// ---------------------------------------------------------------------
// Libro de Remuneraciones Electrónico (LRE)
// ---------------------------------------------------------------------

/** Columnas del LRE (código DT, nombre del concepto). */
export const COLUMNAS_LRE: [number, string][] = [
  [1101, "Rut trabajador"], [1102, "Fecha inicio contrato"], [1103, "Fecha de término de contrato"], [1104, "Causal de término del contrato"],
  [1105, "Región de prestación de los servicios"], [1106, "Comuna de prestación de los servicios"], [1170, "Tipo de impuesto a la renta"],
  [1146, "Técnico extranjero exención de cotizaciones previsionales (ley 18.156)"], [1107, "Código tipo de jornada"],
  [1108, "Persona con discapacidad/pensionado por invalidez"], [1109, "Pensionado por vejez"], [1141, "AFP"], [1142, "IPS (ExINP)"],
  [1143, "FONASA / ISAPRE"], [1151, "AFC"], [1110, "CCAF"], [1152, "Org. administrador ley 16.744"], [1111, "Número cargas familiares legales autorizadas"],
  [1112, "Número de cargas familiares maternales"], [1113, "Número de cargas familiares invalidez"], [1114, "Tramo asignación familiar"],
  [1115, "Número días trabajados en el mes"], [1116, "Número días de licencia médica en el mes"], [1117, "Número días de vacaciones en el mes"],
  [1118, "Subsidio trabajador joven"], [1154, "Puesto trabajo pesado"], [1155, "Ahorro previsional voluntario individual"],
  [1157, "Ahorro previsional voluntario colectivo"], [1131, "Indemnización a todo evento (Art. 164)"], [1132, "Tasa indemnización a todo evento (Art. 164)"],
  [2101, "Sueldo"], [2102, "Sobresueldo"], [2103, "Comisiones (mensual)"], [2106, "Gratificación (mensual)"],
  [2113, "Bonos u otras remuneraciones variables mensuales o superiores a un mes"], [2301, "Colación total mensual (Art. 41)"],
  [2302, "Movilización total mensual (Art. 41)"], [2311, "Asignación familiar legal total mensual (Art. 41)"], [2204, "Otros ingresos no constitutivos de renta (Art. 17 N°29 LIR)"],
  [3141, "Cotización obligatoria previsional (AFP o IPS)"], [3143, "Cotización obligatoria salud 7%"], [3144, "Cotización voluntaria para salud"],
  [3151, "Cotización AFC - trabajador"], [3154, "Cotización adicional trabajo pesado - trabajador"], [3155, "Cotización ahorro previsional voluntario individual modalidad A"],
  [3161, "Impuesto retenido por remuneraciones"], [3171, "Cuota sindical 1"], [3183, "Otros descuentos autorizados y solicitados por el trabajador"],
  [3188, "Descuentos por anticipos y préstamos"], [4151, "Aporte AFC - empleador"], [4152, "Aporte empleador seguro accidentes del trabajo y Ley SANNA (Ley 16.744)"],
  [4154, "Aporte adicional trabajo pesado - empleador"], [4155, "Aporte empleador seguro invalidez y sobrevivencia"],
  [5201, "Total haberes"], [5210, "Total haberes imponibles y tributables"], [5220, "Total haberes imponibles no tributables"],
  [5230, "Total haberes no imponibles y no tributables"], [5240, "Total haberes no imponibles y tributables"], [5301, "Total descuentos"],
  [5361, "Total descuentos impuestos a las remuneraciones"], [5341, "Total descuentos por cotizaciones del trabajador"], [5302, "Total otros descuentos"],
  [5410, "Total aportes empleador"], [5501, "Total líquido"], [5564, "Total indemnizaciones tributables"],
];

export function generarLRE(d: DatosArchivo): { contenido: string; nombreArchivo: string; filas: (string | number)[][]; validacion: Validacion } {
  const validacion: Validacion = { errores: [], avisos: [] };
  if (!d.empresa.region_lre || !d.empresa.comuna_lre) validacion.errores.push("Falta la región o la comuna de prestación de servicios de la empresa (ficha de la empresa, códigos LRE).");
  const filas: (string | number)[][] = [];
  for (const f of d.filas) {
    const t = f.trabajador;
    const l = f.liquidacion;
    const nombre = `${t.nombres} ${t.apellido_paterno}`;
    const m = (c: string) => monto(f, c);
    const cotTrab = l.cotizacion_afp + l.cotizacion_salud + l.cotizacion_afc + m("trabajo_pesado");
    const otros = m("anticipo") + m("prestamo") + m("cuota_sindical") + m("apv") + m("otros_descuentos");
    const parcial = t.jornada_horas <= (d.empresa.jornadaMaxima * 2) / 3;
    const siete = Math.min(l.cotizacion_salud, Math.round(l.renta_imponible_afp * 0.07));
    const termina = t.fecha_termino && enMes(t.fecha_termino, d.anio, d.mes);
    const valores: Record<number, string | number> = {
      1101: t.rut, 1102: fechaDDMMAAAA(t.fecha_ingreso), 1103: termina ? fechaDDMMAAAA(t.fecha_termino!) : "", 1104: termina && f.causalTermino ? f.causalTermino : "",
      1105: d.empresa.region_lre ?? "", 1106: d.empresa.comuna_lre ?? "", 1170: 1, 1146: 0, 1107: parcial ? 201 : 101, 1108: 0, 1109: t.pensionado ? 1 : 0,
      1141: t.afp?.lre ?? 100, 1142: 0, 1143: t.salud.lre ?? 102, 1151: t.seguro_cesantia ? 1 : 0, 1110: d.empresa.ccaf?.lre ?? 0, 1152: d.empresa.mutual?.lre ?? 0,
      1111: t.cargas_familiares || "", 1112: "", 1113: "", 1114: f.tramoAsignacion, 1115: l.dias,
      1116: f.licencias.length ? licenciaDias(f, d.anio, d.mes) || "" : "", 1117: f.diasVacaciones || "", 1118: 0, 1154: t.trabajo_pesado !== "no" ? (t.cargo ?? "") : "",
      1155: m("apv") > 0 ? 1 : 0, 1157: 0, 1131: 0, 1132: "",
      2101: m("sueldo_base"), 2102: m("horas_extra") || "", 2103: m("comisiones") || "", 2106: m("gratificacion") || "", 2113: m("bono_imponible") || "",
      2301: m("colacion") || "", 2302: m("movilizacion") || "", 2311: m("asignacion_familiar") || "", 2204: m("bono_no_imponible") || "",
      3141: l.cotizacion_afp, 3143: siete, 3144: l.cotizacion_salud - siete || "", 3151: l.cotizacion_afc || "", 3154: m("trabajo_pesado") || "",
      3155: m("apv") || "", 3161: l.impuesto_unico, 3171: m("cuota_sindical") || "", 3183: m("otros_descuentos") || "", 3188: m("anticipo") + m("prestamo") || "",
      4151: m("afc_empleador") || "", 4152: m("ley_16744"), 4154: m("trabajo_pesado_empleador") || "", 4155: m("sis"),
      5201: l.total_haberes, 5210: l.total_imponible, 5220: 0, 5230: l.total_no_imponible, 5240: 0, 5301: l.total_descuentos, 5361: l.impuesto_unico,
      5341: cotTrab, 5302: otros, 5410: l.aportes_empleador, 5501: l.liquido, 5564: 0,
    };
    // Validaciones del manual de la DT.
    if (!/^[1-9]\d{6,7}-[\dK]$/.test(t.rut)) validacion.errores.push(`${nombre}: el RUT debe ir sin puntos, con guion y sin ceros a la izquierda.`);
    for (const [cod] of COLUMNAS_LRE) {
      const x = valores[cod];
      if (typeof x === "number" && (x < 0 || !Number.isInteger(x))) validacion.errores.push(`${nombre}: el concepto ${cod} debe ser un entero positivo.`);
      if (String(x).length > 40) validacion.errores.push(`${nombre}: el concepto ${cod} supera 40 caracteres.`);
    }
    if (l.total_haberes - l.total_descuentos !== l.liquido) validacion.errores.push(`${nombre}: total haberes − total descuentos no da el líquido.`);
    filas.push(COLUMNAS_LRE.map(([c]) => valores[c] ?? ""));
  }
  validacion.avisos.push("Los aportes del empleador de la Reforma de Pensiones se incluyen en el total de aportes (5410). Confirma con el manual vigente de la DT si existen códigos específicos para ellos.");
  const encabezado = COLUMNAS_LRE.map(([c, n]) => `${n}(${c})`);
  const contenido = [encabezado, ...filas].map((f) => f.join(";")).join("\r\n") + "\r\n";
  const nombreArchivo = `${d.empresa.rut.replace("-", "")}_${d.anio}${String(d.mes).padStart(2, "0")}.csv`;
  return { contenido, nombreArchivo, filas, validacion };
}

function licenciaDias(f: FilaArchivo, anio: number, mes: number) {
  const inicio = Date.UTC(anio, mes - 1, 1);
  const fin = Date.UTC(anio, mes, 0);
  return f.licencias.reduce((s, l) => {
    const a = Math.max(inicio, Date.parse(l.desde));
    const b = Math.min(fin, Date.parse(l.hasta));
    return s + (b >= a ? Math.round((b - a) / 86400000) + 1 : 0);
  }, 0);
}
