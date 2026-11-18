import { describe, expect, it } from "vitest";
import { balanceOchoColumnas, compararCodigos, estadoResultados, leerMonto, libroMayor, type Cuenta } from "./contabilidad";
import { formatoPesos } from "./formato";
import { normalizarRut, formatearRut } from "./rut";

const cuentas: Cuenta[] = [
  { id: "caja", codigo: "1.1.01.001", nombre: "Caja", tipo: "activo", imputable: true, activa: true },
  { id: "banco", codigo: "1.1.01.003", nombre: "Banco", tipo: "activo", imputable: true, activa: true },
  { id: "prov", codigo: "2.1.02.001", nombre: "Proveedores", tipo: "pasivo", imputable: true, activa: true },
  { id: "cap", codigo: "3.1.01.001", nombre: "Capital", tipo: "patrimonio", imputable: true, activa: true },
  { id: "gasto", codigo: "4.2.02.001", nombre: "Arriendos", tipo: "perdida", imputable: true, activa: true },
  { id: "venta", codigo: "5.1.01.001", nombre: "Ventas", tipo: "ganancia", imputable: true, activa: true },
  { id: "g4", codigo: "4", nombre: "PÉRDIDAS", tipo: "perdida", imputable: false, activa: true },
  { id: "g5", codigo: "5", nombre: "GANANCIAS", tipo: "ganancia", imputable: false, activa: true },
];

describe("balance de 8 columnas", () => {
  // Apertura: caja 1.000.000 / capital. Venta 500.000 a caja. Arriendo 200.000 pagado por banco
  // (banco queda acreedor: sobregiro). Compra a crédito: caja / proveedores 100.000.
  const sumas = [
    { cuenta_id: "caja", debe: 1_600_000, haber: 0 },
    { cuenta_id: "cap", debe: 0, haber: 1_000_000 },
    { cuenta_id: "venta", debe: 0, haber: 500_000 },
    { cuenta_id: "gasto", debe: 200_000, haber: 0 },
    { cuenta_id: "banco", debe: 0, haber: 200_000 },
    { cuenta_id: "prov", debe: 0, haber: 100_000 },
  ];
  const b = balanceOchoColumnas(cuentas, sumas);

  it("suma débitos y créditos", () => {
    expect(b.sumas.debitos).toBe(1_800_000);
    expect(b.sumas.creditos).toBe(1_800_000);
  });
  it("clasifica saldos en inventario y resultados", () => {
    const banco = b.filas.find((f) => f.cuenta_id === "banco")!;
    expect(banco.acreedor).toBe(200_000);
    expect(banco.pasivo).toBe(200_000);
    expect(b.filas.find((f) => f.cuenta_id === "gasto")!.perdidas).toBe(200_000);
    expect(b.filas.find((f) => f.cuenta_id === "venta")!.ganancias).toBe(500_000);
  });
  it("calcula la utilidad y cuadra las 4 parejas de columnas", () => {
    expect(b.resultado).toBe(300_000);
    expect(b.totales.activo).toBe(b.totales.pasivo);
    expect(b.totales.perdidas).toBe(b.totales.ganancias);
    expect(b.cuadra).toBe(true);
  });
  it("con pérdida, la pone en Activo y Ganancias", () => {
    const p = balanceOchoColumnas(cuentas, [
      { cuenta_id: "gasto", debe: 300_000, haber: 0 },
      { cuenta_id: "caja", debe: 0, haber: 300_000 },
    ]);
    expect(p.resultado).toBe(-300_000);
    expect(p.totales.activo).toBe(300_000);
    expect(p.totales.ganancias).toBe(300_000);
    expect(p.cuadra).toBe(true);
  });
});

describe("estado de resultados", () => {
  it("agrupa por jerarquía y calcula el resultado", () => {
    const e = estadoResultados(cuentas, [
      { cuenta_id: "venta", debe: 0, haber: 500_000 },
      { cuenta_id: "gasto", debe: 200_000, haber: 0 },
      { cuenta_id: "caja", debe: 300_000, haber: 0 },
    ]);
    expect(e.ingresos).toBe(500_000);
    expect(e.gastos).toBe(-200_000);
    expect(e.resultado).toBe(300_000);
    expect(e.lineas.find((l) => l.codigo === "4")!.monto).toBe(-200_000);
  });
});

describe("libro mayor", () => {
  it("lleva el saldo acumulado desde el saldo anterior", () => {
    const m = libroMayor(100_000, [
      { fecha: "2026-10-05", numero: 2, tipo: "egreso", comprobante_id: "b", glosa: "", debe: 0, haber: 30_000 },
      { fecha: "2026-10-01", numero: 1, tipo: "ingreso", comprobante_id: "a", glosa: "", debe: 50_000, haber: 0 },
    ]);
    expect(m.filas.map((f) => f.saldo)).toEqual([150_000, 120_000]);
    expect(m.saldoFinal).toBe(120_000);
  });
});

describe("utilidades", () => {
  it("lee montos con puntos y símbolos", () => {
    expect(leerMonto("$ 1.234.567")).toBe(1_234_567);
    expect(leerMonto("")).toBe(0);
  });
  it("ordena códigos por segmento numérico", () => {
    expect(["1.1.10", "1.1.2", "1.2", "1"].sort(compararCodigos)).toEqual(["1", "1.1.2", "1.1.10", "1.2"]);
  });
  it("formatea pesos con punto de miles", () => {
    expect(formatoPesos(1234567)).toBe("$1.234.567");
    expect(formatoPesos(-500)).toBe("-$500");
    expect(() => formatoPesos(1.5)).toThrow();
  });
  it("valida y normaliza RUT con módulo 11", () => {
    expect(normalizarRut("15.111.222-6")).toBe("15111222-6");
    expect(normalizarRut("16.222.333-k")).toBe("16222333-K");
    expect(normalizarRut("76.111.222-9")).toBeNull();
    expect(formatearRut("77222333-1")).toBe("77.222.333-1");
  });
});
