import { describe, expect, it } from "vitest";
import { decodificar, leerCsv, leerEntero, leerFecha } from "./csv";
import { datosDesdeNombre, leerRcv, totalesLibro } from "./rcv";
import { leerHonorarios } from "./honorarios";
import { aplicarMapeoCartola, sugerirMapeo } from "./mapeo";
import { generarArchivosDemo } from "../../../scripts/demo-archivos";

describe("lectura de CSV", () => {
  it("decodifica Latin-1 cuando no es UTF-8 válido", () => {
    const bytes = new Uint8Array(Buffer.from("Razón;Año\r\n", "latin1"));
    const r = decodificar(bytes);
    expect(r.codificacion).toBe("latin1");
    expect(r.texto).toContain("Razón");
  });
  it("respeta comillas y separador punto y coma", () => {
    expect(leerCsv('a;"b;c";d\n1;2;3')).toEqual([["a", "b;c", "d"], ["1", "2", "3"]]);
  });
  it("lee montos y fechas chilenas", () => {
    expect(leerEntero("1.234.567")).toBe(1234567);
    expect(leerEntero("-1.234")).toBe(-1234);
    expect(leerEntero("1234,50")).toBe(1235);
    expect(leerFecha("05/10/2026")).toBe("2026-10-05");
    expect(leerFecha("2026-10-05")).toBe("2026-10-05");
    expect(leerFecha("31/02/2026")).toBeNull();
  });
});

describe("RCV del SII", () => {
  const archivos = generarArchivosDemo();
  it("detecta libro, RUT y periodo por el nombre del archivo", () => {
    expect(datosDesdeNombre("RCV_COMPRA_REGISTRO_76111222-8_202610.csv")).toEqual({ libro: "compras", rut: "76111222-8", anio: 2026, mes: 10 });
    expect(datosDesdeNombre("RCV_VENTA_77222333-1_202609.csv")).toMatchObject({ libro: "ventas", mes: 9 });
  });
  it("lee las compras del archivo de ejemplo sin errores", () => {
    const a = archivos.find((x) => x.nombre === "RCV_COMPRA_REGISTRO_76111222-8_202610.csv")!;
    const r = leerRcv(decodificar(a.contenido).texto, a.nombre);
    expect(r.errores).toEqual([]);
    expect(r.documentos.length).toBe(14);
    expect(r.documentos[0].monto_iva).toBeGreaterThan(0);
    const t = totalesLibro(r.documentos);
    expect(t.total).toBe(t.neto + t.iva + t.exento);
    // La nota de crédito (fila 4) resta.
    expect(r.documentos[3].tipo_doc).toBe(61);
  });
  it("lee las ventas exentas y afectas", () => {
    const a = archivos.find((x) => x.nombre === "RCV_VENTA_76333444-9_202610.csv")!;
    const r = leerRcv(decodificar(a.contenido).texto, a.nombre);
    expect(r.errores).toEqual([]);
    expect(r.documentos.some((d) => d.tipo_doc === 34 && d.monto_exento > 0)).toBe(true);
  });
  it("informa columnas faltantes", () => {
    const r = leerRcv("Columna A;Columna B\n1;2", "otro.csv");
    expect(r.errores[0].mensaje).toMatch(/No se reconocen/);
  });
  it("rechaza RUT con dígito verificador malo", () => {
    const r = leerRcv("Tipo Doc;RUT Proveedor;Folio;Fecha Docto;Monto Total\n33;76111222-9;10;01/10/2026;1190", "RCV_COMPRA_REGISTRO_76111222-8_202610.csv");
    expect(r.errores[0].mensaje).toMatch(/RUT no válido/);
  });
});

describe("honorarios", () => {
  it("lee el informe de boletas recibidas saltando el título", () => {
    const a = generarArchivosDemo().find((x) => x.tipo === "honorarios_recibidos")!;
    const r = leerHonorarios(leerCsv(decodificar(a.contenido).texto));
    expect(r.errores).toEqual([]);
    expect(r.boletas).toHaveLength(3);
    expect(r.boletas[0].monto_bruto - r.boletas[0].monto_retencion).toBe(r.boletas[0].monto_liquido);
  });
});

describe("cartolas", () => {
  it("sugiere el mapeo y convierte cargos y abonos", () => {
    const a = generarArchivosDemo().find((x) => x.tipo === "cartola")!;
    const filas = leerCsv(decodificar(a.contenido).texto);
    const mapeo = sugerirMapeo("cartola", filas[0]);
    expect(mapeo).toMatchObject({ fecha: 0, descripcion: 1, documento: 2, cargo: 3, abono: 4, saldo: 5 });
    const r = aplicarMapeoCartola(filas.slice(1), mapeo);
    expect(r.errores).toEqual([]);
    expect(r.movimientos.length).toBe(12);
    expect(new Set(r.movimientos.map((m) => m.huella)).size).toBe(12);
  });
});
