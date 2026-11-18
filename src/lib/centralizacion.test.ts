import { describe, expect, it } from "vitest";
import { asientoCompras, asientoRemuneraciones, asientoVentas, CUENTAS_CENTRALIZACION } from "./centralizacion";

const config = Object.fromEntries(CUENTAS_CENTRALIZACION.map((c) => [c.clave, `cta-${c.clave}`]));
const cuadra = (lineas: { debe: number; haber: number }[]) => lineas.reduce((s, l) => s + l.debe - l.haber, 0);

describe("centralizaciones", () => {
  it("compras cuadra y las notas de crédito restan", () => {
    const l = asientoCompras([
      { tipo_doc: 33, monto_exento: 0, monto_neto: 100000, monto_iva: 19000, monto_iva_no_recuperable: 0, otros_impuestos: 0, monto_total: 119000, monto_neto_activo_fijo: 0, iva_activo_fijo: 0 },
      { tipo_doc: 61, monto_exento: 0, monto_neto: 10000, monto_iva: 1900, monto_iva_no_recuperable: 0, otros_impuestos: 0, monto_total: 11900, monto_neto_activo_fijo: 0, iva_activo_fijo: 0 },
    ], config);
    expect(cuadra(l)).toBe(0);
    expect(l.find((x) => x.cuenta_id === "cta-proveedores")!.haber).toBe(107100);
  });
  it("ventas con boletas van a caja", () => {
    const l = asientoVentas([{ tipo_doc: 39, monto_exento: 0, monto_neto: 1000000, monto_iva: 190000, monto_iva_no_recuperable: 0, otros_impuestos: 0, monto_total: 1190000, monto_neto_activo_fijo: 0, iva_activo_fijo: 0 }], config);
    expect(cuadra(l)).toBe(0);
    expect(l.find((x) => x.cuenta_id === "cta-caja_boletas")!.debe).toBe(1190000);
  });
  it("remuneraciones cuadra: gasto + aportes = líquido + cotizaciones + impuesto + descuentos − asignación familiar", () => {
    const items = [
      { codigo: "sueldo_base", monto: 553553 }, { codigo: "gratificacion", monto: 138388 }, { codigo: "colacion", monto: 30000 },
      { codigo: "asignacion_familiar", monto: 13870 }, { codigo: "afp", monto: 73207 }, { codigo: "salud", monto: 48436 },
      { codigo: "afc_trabajador", monto: 4152 }, { codigo: "impuesto_unico", monto: 0 }, { codigo: "anticipo", monto: 50000 },
      { codigo: "sis", monto: 12386 }, { codigo: "afc_empleador", monto: 16607 }, { codigo: "ley_16744", monto: 6435 },
      { codigo: "empleador_ci", monto: 692 }, { codigo: "empleador_crp", monto: 6227 }, { codigo: "empleador_ev", monto: 4913 },
    ];
    const l = asientoRemuneraciones([{ items, liquido: 735811 - 125795 - 50000 }], config);
    expect(cuadra(l)).toBe(0);
  });
});
