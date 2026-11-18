// Casos de prueba de remuneraciones. Los valores esperados se calcularon a mano, paso a paso,
// con los indicadores de Previred de noviembre de 2026 y la tabla de impuesto único del SII
// (ver docs/remuneraciones/casos-de-prueba.md). DEBEN ser verificados por la socia contadora.
import { describe, expect, it } from "vitest";
import { calcularLiquidacion, diasTrabajados, NOVEDADES_VACIAS, type FichaTrabajador } from "./remuneraciones";
import { Parametros, type Parametro } from "./parametros";

const par = (codigo: string, valor: number | null, valor_json: unknown = null, desde = "2026-01-01", hasta: string | null = null): Parametro => ({
  codigo, descripcion: codigo, valor, valor_json, unidad: "", vigente_desde: desde, vigente_hasta: hasta, fuente_nombre: "prueba", fuente_url: null, estado: "por_verificar",
});

// Parámetros de noviembre de 2026 (Previred y SII).
const NOV = new Parametros([
  par("UF_FIN_MES", 41439.89, null, "2026-11-01", "2026-11-30"),
  par("UTM", 72440, null, "2026-11-01", "2026-11-30"),
  par("INGRESO_MINIMO", 553553, null, "2026-05-01"),
  par("INGRESO_MINIMO_MENORES_MAYORES", 412938, null, "2026-05-01"),
  par("TOPE_IMPONIBLE_AFP", 90), par("TOPE_IMPONIBLE_AFC", 135.2),
  par("AFP_TASA_TRABAJADOR", null, { capital: 11.44, cuprum: 11.44, habitat: 11.27, planvital: 11.16, provida: 11.45, modelo: 10.58, uno: 10.46 }),
  par("SALUD_TASA", 7),
  par("AFC_TASAS", null, { indefinido: { empleador: 2.4, trabajador: 0.6 }, plazo_fijo: { empleador: 3, trabajador: 0 }, obra: { empleador: 3, trabajador: 0 }, indefinido_11_anios: { empleador: 0.8, trabajador: 0 } }),
  par("ASIGNACION_FAMILIAR_TRAMOS", null, [{ tramo: "A", hasta: 649039, monto: 22601 }, { tramo: "B", hasta: 947990, monto: 13870 }, { tramo: "C", hasta: 1478539, monto: 4382 }, { tramo: "D", hasta: null, monto: 0 }]),
  par("GRATIFICACION_PORCENTAJE", 25), par("GRATIFICACION_TOPE_IMM", 4.75), par("HORAS_EXTRA_RECARGO", 50),
  par("IMPUESTO_UNICO_TABLA", null, [{ desde: 0, hasta: 13.5, factor: 0, rebaja: 0 }, { desde: 13.5, hasta: 30, factor: 0.04, rebaja: 0.54 }, { desde: 30, hasta: 50, factor: 0.08, rebaja: 1.74 }, { desde: 50, hasta: 70, factor: 0.135, rebaja: 4.49 }, { desde: 70, hasta: 90, factor: 0.23, rebaja: 11.14 }, { desde: 90, hasta: 120, factor: 0.304, rebaja: 17.8 }, { desde: 120, hasta: 310, factor: 0.35, rebaja: 23.32 }, { desde: 310, hasta: null, factor: 0.4, rebaja: 38.82 }]),
  par("SIS_TASA", 1.79, null, "2026-11-01"), par("EMPLEADOR_CUENTA_INDIVIDUAL", 0.1), par("EMPLEADOR_RENTABILIDAD_PROTEGIDA", 0.9),
  par("EMPLEADOR_EXPECTATIVA_VIDA", 0.71, null, "2026-11-01"), par("LEY16744_BASICA", 0.93),
  par("JORNADA_MAXIMA", 42, null, "2026-04-26", "2028-04-25"),
  par("TRABAJO_PESADO", null, { pesado: { empleador: 2, trabajador: 2 }, menos_pesado: { empleador: 1, trabajador: 1 } }),
]);

const base: FichaTrabajador = {
  id: "t", rut: "1-9", nombre: "Prueba", fecha_nacimiento: "1990-05-10", fecha_ingreso: "2020-03-01", fecha_termino: null,
  tipo_contrato: "indefinido", jornada_horas: 42, sueldo_base: 553553, gratificacion: "art50_mensual", colacion: 0, movilizacion: 0,
  afp: "afp_modelo", pensionado: false, salud: "fonasa", plan_isapre_uf: null, plan_isapre_pesos: null, seguro_cesantia: true,
  trabajo_pesado: "no", cargas_familiares: 0,
};
const NOVIEMBRE = { anio: 2026, mes: 11 };
const ISL = { tasa_cotizacion_adicional: 0 };

describe("Caso 1: sueldo mínimo, Fonasa, AFP Modelo, 1 carga, colación", () => {
  const r = calcularLiquidacion({ ...base, cargas_familiares: 1, colacion: 30000 }, NOVEDADES_VACIAS, NOVIEMBRE, NOV, ISL);
  const item = (c: string) => r.items.find((i) => i.codigo === c)?.monto ?? 0;
  it("haberes", () => {
    expect(item("sueldo_base")).toBe(553553);
    expect(item("gratificacion")).toBe(138388); // 25% de 553.553 = 138.388,25 (bajo el tope de 219.114,73)
    expect(r.totalImponible).toBe(691941);
    expect(item("asignacion_familiar")).toBe(13870); // tramo B
    expect(r.totalHaberes).toBe(735811);
  });
  it("descuentos legales y líquido", () => {
    expect(r.cotizacionAfp).toBe(73207); // 10,58% de 691.941 = 73.207,36
    expect(r.cotizacionSalud).toBe(48436); // 7% = 48.435,87
    expect(r.cotizacionAfc).toBe(4152); // 0,6% = 4.151,65
    expect(r.baseTributable).toBe(566146);
    expect(r.impuestoUnico).toBe(0); // bajo 13,5 UTM ($977.940)
    expect(r.totalDescuentos).toBe(125795);
    expect(r.liquido).toBe(610016);
  });
  it("aportes del empleador (incluye la Reforma de Pensiones)", () => {
    expect(item("sis")).toBe(12386);
    expect(item("afc_empleador")).toBe(16607);
    expect(item("ley_16744")).toBe(6435);
    expect(item("empleador_ci")).toBe(692);
    expect(item("empleador_crp")).toBe(6227);
    expect(item("empleador_ev")).toBe(4913);
    expect(r.aportesEmpleador).toBe(47260);
    expect(r.costoEmpresa).toBe(783071);
  });
});

describe("Caso 2: sueldo alto, Isapre 5,8 UF, tope de gratificación, impuesto único", () => {
  const r = calcularLiquidacion(
    { ...base, sueldo_base: 2400000, afp: "afp_cuprum", salud: "isapre_banmedica", plan_isapre_uf: 5.8, colacion: 40000, movilizacion: 40000 },
    NOVEDADES_VACIAS, NOVIEMBRE, NOV, ISL,
  );
  it("gratificación con tope", () => {
    expect(r.items.find((i) => i.codigo === "gratificacion")!.monto).toBe(219115); // tope 553.553 × 4,75 / 12 = 219.114,73
    expect(r.totalImponible).toBe(2619115);
  });
  it("salud con plan de Isapre mayor al 7% y base tributable con el 7%", () => {
    expect(r.cotizacionAfp).toBe(299627); // 11,44% de 2.619.115 = 299.626,76
    expect(r.cotizacionSalud).toBe(240351); // 5,8 × 41.439,89 = 240.351,36
    expect(r.cotizacionAfc).toBe(15715); // 0,6% = 15.714,69
    expect(r.baseTributable).toBe(2120435); // 2.619.115 − 299.627 − 183.338 (7%) − 15.715
  });
  it("impuesto único según la tabla de noviembre", () => {
    expect(r.impuestoUnico).toBe(45700); // 2.120.435 × 0,04 − 39.117,60 = 45.699,80
    expect(r.liquido).toBe(2699115 - (299627 + 240351 + 15715 + 45700));
  });
});

describe("días trabajados y casos especiales", () => {
  it("ingreso a mitad de mes", () => {
    expect(diasTrabajados({ fecha_ingreso: "2026-11-16", fecha_termino: null }, { dias_licencia: 0, dias_ausencia: 0 }, 2026, 11).dias).toBe(15);
  });
  it("licencia médica descuenta días", () => {
    const r = calcularLiquidacion({ ...base, sueldo_base: 900000 }, { ...NOVEDADES_VACIAS, dias_licencia: 7 }, NOVIEMBRE, NOV, ISL);
    expect(r.diasTrabajados).toBe(23);
    expect(r.items.find((i) => i.codigo === "sueldo_base")!.monto).toBe(690000);
    expect(r.alertas.some((a) => a.texto.includes("licencia"))).toBe(true);
  });
  it("horas extra con la fórmula de la Dirección del Trabajo", () => {
    // 850.000 / 30 × 28 / (42 × 4) = 4.722,22 por hora; × 1,5 = 7.083,33; × 10 h = 70.833
    const r = calcularLiquidacion({ ...base, sueldo_base: 850000, afp: "afp_provida" }, { ...NOVEDADES_VACIAS, horas_extra: 10 }, NOVIEMBRE, NOV, ISL);
    expect(r.items.find((i) => i.codigo === "horas_extra")!.monto).toBe(70833);
  });
  it("plazo fijo: el trabajador no paga seguro de cesantía y el empleador paga 3%", () => {
    const r = calcularLiquidacion({ ...base, tipo_contrato: "plazo_fijo", sueldo_base: 750000 }, NOVEDADES_VACIAS, NOVIEMBRE, NOV, ISL);
    expect(r.cotizacionAfc).toBe(0);
    expect(r.items.find((i) => i.codigo === "afc_empleador")!.monto).toBe(Math.round(r.rentaImponibleAfc * 0.03));
  });
  it("alerta si falta la AFP o el sueldo está bajo el mínimo", () => {
    const r = calcularLiquidacion({ ...base, afp: null, sueldo_base: 400000 }, NOVEDADES_VACIAS, NOVIEMBRE, NOV, ISL);
    expect(r.alertas.map((a) => a.texto).join(" ")).toMatch(/Falta la AFP/);
    expect(r.alertas.map((a) => a.texto).join(" ")).toMatch(/bajo el ingreso mínimo/);
  });
  it("cada línea trae fórmula y parámetros con fuente", () => {
    const r = calcularLiquidacion(base, NOVEDADES_VACIAS, NOVIEMBRE, NOV, ISL);
    const afp = r.items.find((i) => i.codigo === "afp")!;
    expect(afp.formula).toMatch(/comisión/);
    expect(afp.parametros[0].codigo).toBe("AFP_TASA_TRABAJADOR");
  });
});
