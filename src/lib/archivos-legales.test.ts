import { describe, expect, it } from "vitest";
import { CAMPOS_PREVIRED_V58, COLUMNAS_LRE, generarLRE, generarPrevired, type DatosArchivo, type FilaArchivo } from "./archivos-legales";

const fila = (x: Partial<FilaArchivo["trabajador"]> = {}, licencias: FilaArchivo["licencias"] = []): FilaArchivo => ({
  trabajador: {
    rut: "12111222-1", nombres: "Pedro", apellido_paterno: "Demo", apellido_materno: "Alarcón", sexo: "M", nacionalidad: "Chilena",
    fecha_ingreso: "2018-06-01", fecha_termino: null, tipo_contrato: "indefinido", jornada_horas: 42, pensionado: false,
    afp: { previred: "08", lre: "6" }, salud: { previred: "07", lre: "102", esIsapre: false }, plan_isapre_uf: null, seguro_cesantia: true,
    cargas_familiares: 2, trabajo_pesado: "no", cargo: "Conductor", ...x,
  },
  liquidacion: {
    dias: 30,
    items: [
      { codigo: "sueldo_base", monto: 850000 }, { codigo: "gratificacion", monto: 219115 }, { codigo: "colacion", monto: 35000 },
      { codigo: "sis", monto: 19168 }, { codigo: "afc_empleador", monto: 25699 }, { codigo: "ley_16744", monto: 9958 },
    ],
    total_imponible: 1069115, total_no_imponible: 35000, total_haberes: 1104115, renta_imponible_afp: 1069115, renta_imponible_afc: 1069115,
    cotizacion_afp: 122414, cotizacion_salud: 74838, cotizacion_afc: 6415, impuesto_unico: 0, total_descuentos: 203667, liquido: 900448, aportes_empleador: 54825,
  },
  licencias, diasVacaciones: 0, tramoAsignacion: "C", causalTermino: null,
});

const datos = (filas: FilaArchivo[]): DatosArchivo => ({
  anio: 2026, mes: 10,
  empresa: { rut: "77222333-1", mutual: { previred: "02", lre: "2" }, ccaf: { previred: "01", lre: "1" }, region_lre: 13, comuna_lre: 13125, jornadaMaxima: 42 },
  filas,
});

describe("Previred (formato 105 campos v58)", () => {
  it("genera exactamente 105 campos por línea separados por punto y coma", () => {
    const r = generarPrevired(datos([fila()]));
    expect(CAMPOS_PREVIRED_V58).toHaveLength(105);
    expect(r.lineas[0]).toHaveLength(105);
    expect(r.contenido.split("\r\n")[0].split(";")).toHaveLength(105);
    expect(r.validacion.errores).toEqual([]);
  });
  it("informa RUT, periodo, AFP, SIS, CCAF, mutual y seguro de cesantía en sus campos", () => {
    const l = generarPrevired(datos([fila()])).lineas[0];
    expect(l[0]).toBe("12111222");
    expect(l[1]).toBe("1");
    expect(l[8]).toBe("102026");
    expect(l[25]).toBe("08");
    expect(l[26]).toBe("1069115");
    expect(l[28]).toBe("19168");
    expect(l[82]).toBe("01"); // CCAF Los Andes
    expect(l[89]).toBe(String(Math.round(1069115 * 0.042))); // 4,2% a la CCAF
    expect(l[69]).toBe(String(74838 - Math.round(1069115 * 0.042))); // resto a Fonasa
    expect(l[95]).toBe("02"); // Mutual de Seguridad
    expect(l[101]).toBe("25699");
  });
  it("informa el movimiento de personal por licencia médica (código 3) con sus fechas", () => {
    const l = generarPrevired(datos([fila({}, [{ desde: "2026-10-06", hasta: "2026-10-12", rut_pagadora: "61603000-0" }])])).lineas[0];
    expect(l[14]).toBe("3");
    expect(l[15]).toBe("06-10-2026");
    expect(l[16]).toBe("12-10-2026");
    expect(l[102]).toBe("61603000");
  });
  it("detecta campos inválidos", () => {
    const r = generarPrevired(datos([fila({ afp: null })]));
    expect(r.validacion.errores.join(" ")).toMatch(/no tiene AFP/);
  });
});

describe("LRE (Dirección del Trabajo)", () => {
  it("nombre de archivo rutempleador_aaaamm, encabezados con código y punto y coma", () => {
    const r = generarLRE(datos([fila()]));
    expect(r.nombreArchivo).toBe("772223331_202610.csv");
    const [enc, f1] = r.contenido.split("\r\n");
    expect(enc.split(";")).toHaveLength(COLUMNAS_LRE.length);
    expect(enc.startsWith("Rut trabajador(1101);Fecha inicio contrato(1102)")).toBe(true);
    expect(f1.startsWith("12111222-1;01/06/2018;")).toBe(true);
    expect(r.validacion.errores).toEqual([]);
  });
  it("usa los códigos de la DT para AFP, salud, CCAF y mutual", () => {
    const r = generarLRE(datos([fila()]));
    const col = (c: number) => r.filas[0][COLUMNAS_LRE.findIndex(([x]) => x === c)];
    expect(col(1141)).toBe("6"); // Provida
    expect(col(1143)).toBe("102"); // Fonasa
    expect(col(1110)).toBe("1"); // Los Andes
    expect(col(1152)).toBe("2"); // Mutual de Seguridad
    expect(col(5501)).toBe(900448);
  });
});
