import { describe, expect, it } from "vitest";
import { calcularF29, vencimiento, type DocF29 } from "./f29";
import { Parametros, type Parametro } from "./parametros";

const p = (codigo: string, valor: number, desde = "2000-01-01", hasta: string | null = null): Parametro => ({
  codigo, descripcion: codigo, valor, valor_json: null, unidad: "", vigente_desde: desde, vigente_hasta: hasta,
  fuente_nombre: "prueba", fuente_url: null, estado: "por_verificar",
});
const params = new Parametros([
  p("IVA_TASA", 19), p("RETENCION_HONORARIOS", 15.25, "2026-01-01", "2026-12-31"),
  p("UTM", 72151, "2026-10-01", "2026-10-31"), p("UTM", 72440, "2026-11-01", "2026-11-30"),
]);
const doc = (libro: "compras" | "ventas", tipo: number, neto: number, extra: Partial<DocF29> = {}): DocF29 => ({
  libro, tipo_doc: tipo, monto_exento: 0, monto_neto: neto, monto_iva: Math.round(neto * 0.19), monto_total: neto + Math.round(neto * 0.19),
  monto_neto_activo_fijo: 0, iva_activo_fijo: 0, cantidad_documentos: null, ...extra,
});

describe("F29", () => {
  const base = { anio: 2026, mes: 11, retencionHonorarios: 0, boletasHonorarios: 0, impuestoUnico: 0, fuenteImpuestoUnico: "", remanenteAnterior: 0, utmAnterior: null, tasaPpm: 1 };

  it("calcula débito, crédito, IVA a pagar, PPM y total", () => {
    const r = calcularF29({
      ...base,
      documentos: [doc("ventas", 33, 1_000_000), doc("ventas", 33, 500_000), doc("ventas", 61, 100_000), doc("compras", 33, 600_000), doc("compras", 61, 50_000)],
      retencionHonorarios: 15_250,
      impuestoUnico: 12_000,
    }, params);
    expect(r.codigos["502"]).toBe(285_000);
    expect(r.codigos["510"]).toBe(19_000);
    expect(r.codigos["538"]).toBe(266_000);
    expect(r.codigos["520"]).toBe(114_000);
    expect(r.codigos["528"]).toBe(9_500);
    expect(r.codigos["537"]).toBe(104_500);
    expect(r.codigos["89"]).toBe(161_500);
    expect(r.codigos["563"]).toBe(1_400_000);
    expect(r.codigos["62"]).toBe(14_000);
    expect(r.totalAPagar).toBe(161_500 + 14_000 + 15_250 + 12_000);
  });

  it("deja remanente cuando el crédito supera al débito y reajusta el remanente anterior por UTM", () => {
    const r = calcularF29({ ...base, documentos: [doc("ventas", 33, 100_000), doc("compras", 33, 300_000)], remanenteAnterior: 100_000, utmAnterior: 72151 }, params);
    // 100.000 × 72.440 / 72.151 = 100.400,55 → 100.401
    expect(r.codigos["504"]).toBe(100_401);
    expect(r.codigos["89"]).toBe(0);
    expect(r.codigos["77"]).toBe(57_000 + 100_401 - 19_000);
    expect(r.totalAPagar).toBe(1_000);
  });

  it("usa la cantidad del resumen de boletas", () => {
    const r = calcularF29({ ...base, documentos: [doc("ventas", 39, 1_000_000, { cantidad_documentos: 850 })] }, params);
    expect(r.codigos["110"]).toBe(850);
    expect(r.codigos["111"]).toBe(190_000);
  });

  it("exige los parámetros legales", () => {
    expect(() => calcularF29({ ...base, anio: 1999, documentos: [] }, new Parametros([]))).toThrow(/IVA_TASA/);
  });
});

describe("vencimientos", () => {
  const feriados = new Set(["2026-12-08", "2026-12-25"]);
  it("F29 de octubre 2026 (día 20) vence el viernes 20-11-2026", () => {
    expect(vencimiento(2026, 10, 20, feriados)).toBe("2026-11-20");
  });
  it("corre al día hábil siguiente", () => {
    // 12-12-2026 es sábado → lunes 14-12-2026
    expect(vencimiento(2026, 11, 12, feriados)).toBe("2026-12-14");
  });
});
