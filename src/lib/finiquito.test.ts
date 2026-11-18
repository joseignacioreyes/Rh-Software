import { describe, expect, it } from "vitest";
import { antiguedad, calcularFiniquito, diasHabiles, saldoVacaciones } from "./finiquito";
import { Parametros, type Parametro } from "./parametros";

const par = (codigo: string, valor: number, desde = "2000-01-01", hasta: string | null = null): Parametro => ({
  codigo, descripcion: codigo, valor, valor_json: null, unidad: "", vigente_desde: desde, vigente_hasta: hasta, fuente_nombre: "prueba", fuente_url: null, estado: "por_verificar",
});
const P = new Parametros([
  par("FERIADO_DIAS_HABILES", 15), par("FERIADO_PROGRESIVO_CADA", 3), par("INDEMNIZACION_DIAS_POR_ANIO", 30),
  par("INDEMNIZACION_TOPE_ANIOS", 11), par("INDEMNIZACION_TOPE_UF", 90), par("UF_FIN_MES", 41439.89, "2026-11-01", "2026-11-30"),
]);
const FERIADOS = new Set(["2026-12-08", "2026-12-25"]);

describe("vacaciones", () => {
  it("cuenta días hábiles sin fines de semana ni feriados", () => {
    // Lunes 7 al viernes 11 de diciembre de 2026, con feriado el 8.
    expect(diasHabiles("2026-12-07", "2026-12-11", FERIADOS)).toBe(4);
  });
  it("15 días por año completo, menos los tomados", () => {
    const s = saldoVacaciones("2021-02-01", "2026-11-30", 0, 60, P);
    expect(s.ganadosLegales).toBe(75); // 5 años
    expect(s.progresivos).toBe(0);
    expect(s.saldo).toBe(15);
  });
  it("feriado progresivo con años anteriores acreditados", () => {
    // 10 años previos + 6 años en la empresa: los años 13 y 16 suman 1 día cada uno desde el año 13 → 1+1+1+2 = ... (por año)
    const s = saldoVacaciones("2020-01-01", "2026-06-30", 10, 0, P);
    // Años totales por año en la empresa: 11,12,13,14,15,16 → floor((t−10)/3) = 0,0,1,1,1,2 → 5
    expect(s.progresivos).toBe(5);
  });
});

describe("finiquito", () => {
  it("necesidades de la empresa: años de servicio, aviso previo y feriado", () => {
    const r = calcularFiniquito(
      { fechaIngreso: "2019-03-01", fechaTermino: "2026-11-30", causal: 18, avisoPrevioDado: false, remuneracionBase: 1200000, tipoContrato: "indefinido", diasVacacionesPendientes: 5, aniosPrevios: 0 },
      P, FERIADOS,
    );
    // 7 años y 8 meses (fracción > 6 meses) → 8 años × 1.200.000
    expect(r.lineas[0].monto).toBe(9_600_000);
    expect(r.lineas[1].monto).toBe(1_200_000);
    expect(r.lineas[2].concepto).toMatch(/Feriado/);
    expect(r.total).toBe(r.lineas.reduce((s, l) => s + l.monto, 0));
  });
  it("aplica el tope de 90 UF a la base", () => {
    const r = calcularFiniquito(
      { fechaIngreso: "2015-01-01", fechaTermino: "2026-11-30", causal: 18, avisoPrevioDado: true, remuneracionBase: 5000000, tipoContrato: "indefinido", diasVacacionesPendientes: 0, aniosPrevios: 0 },
      P, FERIADOS,
    );
    expect(r.baseTopada).toBe(3729590);
    expect(r.lineas[0].monto).toBe(3729590 * 11); // tope 11 años
  });
  it("renuncia: solo feriado", () => {
    const r = calcularFiniquito(
      { fechaIngreso: "2024-01-01", fechaTermino: "2026-11-30", causal: 4, avisoPrevioDado: true, remuneracionBase: 900000, tipoContrato: "indefinido", diasVacacionesPendientes: 0, aniosPrevios: 0 },
      P, FERIADOS,
    );
    expect(r.lineas).toHaveLength(1);
  });
  it("antigüedad en años y meses", () => {
    expect(antiguedad("2019-03-01", "2026-11-30")).toMatchObject({ anios: 7, meses: 8 });
  });
});
