// Cálculos contables puros (sin base de datos), probados con Vitest.
// Montos siempre en pesos enteros.

export type TipoCuenta = "activo" | "pasivo" | "patrimonio" | "perdida" | "ganancia";

export const NOMBRE_TIPO: Record<TipoCuenta, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  perdida: "Pérdida (gasto/costo)",
  ganancia: "Ganancia (ingreso)",
};

export const TIPOS_COMPROBANTE = [
  { codigo: "ingreso", nombre: "Ingreso" },
  { codigo: "egreso", nombre: "Egreso" },
  { codigo: "traspaso", nombre: "Traspaso" },
  { codigo: "apertura", nombre: "Apertura" },
] as const;

export type Cuenta = { id: string; codigo: string; nombre: string; tipo: TipoCuenta; imputable: boolean; activa: boolean };
export type Sumas = { cuenta_id: string; debe: number; haber: number };

/** Lee un monto escrito por el usuario ("1.234.567", "$ 1234567") como entero en pesos. */
export function leerMonto(texto: string): number {
  const limpio = texto.replace(/[^\d-]/g, "");
  if (!limpio || limpio === "-") return 0;
  const n = Number(limpio);
  return Number.isSafeInteger(n) ? n : 0;
}

/** ¿La cuenta es de balance (inventario) o de resultado? */
export const esDeBalance = (t: TipoCuenta) => t === "activo" || t === "pasivo" || t === "patrimonio";

export type FilaBalance = {
  cuenta_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  debitos: number;
  creditos: number;
  deudor: number;
  acreedor: number;
  activo: number;
  pasivo: number;
  perdidas: number;
  ganancias: number;
};

export type Balance8 = {
  filas: FilaBalance[];
  sumas: Omit<FilaBalance, "cuenta_id" | "codigo" | "nombre" | "tipo">;
  /** Utilidad (positiva) o pérdida (negativa) del ejercicio. */
  resultado: number;
  totales: Omit<FilaBalance, "cuenta_id" | "codigo" | "nombre" | "tipo">;
  cuadra: boolean;
};

/**
 * Balance de 8 columnas (balance tributario):
 *  Débitos y Créditos = sumas de movimientos.
 *  Saldo deudor / acreedor = diferencia por cuenta.
 *  Inventario: Activo (saldos deudores) y Pasivo (saldos acreedores) de cuentas de balance.
 *  Resultados: Pérdidas (saldos deudores) y Ganancias (saldos acreedores) de cuentas de resultado.
 *  La utilidad se suma a Pasivo y Pérdidas (o la pérdida a Activo y Ganancias) para cuadrar.
 */
export function balanceOchoColumnas(cuentas: Cuenta[], sumas: Sumas[]): Balance8 {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const filas: FilaBalance[] = [];
  for (const s of sumas) {
    const c = porId.get(s.cuenta_id);
    if (!c) continue;
    const debitos = Number(s.debe);
    const creditos = Number(s.haber);
    if (debitos === 0 && creditos === 0) continue;
    const saldo = debitos - creditos;
    const deudor = saldo > 0 ? saldo : 0;
    const acreedor = saldo < 0 ? -saldo : 0;
    const balance = esDeBalance(c.tipo);
    filas.push({
      cuenta_id: c.id, codigo: c.codigo, nombre: c.nombre, tipo: c.tipo,
      debitos, creditos, deudor, acreedor,
      activo: balance ? deudor : 0,
      pasivo: balance ? acreedor : 0,
      perdidas: balance ? 0 : deudor,
      ganancias: balance ? 0 : acreedor,
    });
  }
  filas.sort((a, b) => compararCodigos(a.codigo, b.codigo));

  const sumar = (k: keyof Balance8["sumas"]) => filas.reduce((t, f) => t + f[k], 0);
  const sumasCol = {
    debitos: sumar("debitos"), creditos: sumar("creditos"), deudor: sumar("deudor"), acreedor: sumar("acreedor"),
    activo: sumar("activo"), pasivo: sumar("pasivo"), perdidas: sumar("perdidas"), ganancias: sumar("ganancias"),
  };
  const resultado = sumasCol.ganancias - sumasCol.perdidas;
  const totales = {
    ...sumasCol,
    activo: sumasCol.activo + (resultado < 0 ? -resultado : 0),
    pasivo: sumasCol.pasivo + (resultado > 0 ? resultado : 0),
    perdidas: sumasCol.perdidas + (resultado > 0 ? resultado : 0),
    ganancias: sumasCol.ganancias + (resultado < 0 ? -resultado : 0),
  };
  const cuadra =
    totales.debitos === totales.creditos &&
    totales.deudor === totales.acreedor &&
    totales.activo === totales.pasivo &&
    totales.perdidas === totales.ganancias;
  return { filas, sumas: sumasCol, resultado, totales, cuadra };
}

/** Ordena códigos jerárquicos por segmento numérico: 1.1.2 antes que 1.1.10. */
export function compararCodigos(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

export type MovimientoMayor = {
  fecha: string;
  numero: number;
  tipo: string;
  comprobante_id: string;
  glosa: string;
  debe: number;
  haber: number;
};

/** Libro mayor de una cuenta: saldo anterior y saldo acumulado línea a línea (deudor positivo). */
export function libroMayor(saldoAnterior: number, movimientos: MovimientoMayor[]) {
  let saldo = saldoAnterior;
  const filas = [...movimientos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
    .map((m) => {
      saldo += m.debe - m.haber;
      return { ...m, saldo };
    });
  return {
    saldoAnterior,
    filas,
    totalDebe: movimientos.reduce((s, m) => s + m.debe, 0),
    totalHaber: movimientos.reduce((s, m) => s + m.haber, 0),
    saldoFinal: saldo,
  };
}

export type LineaEstado = { codigo: string; nombre: string; monto: number; nivel: number; esGrupo: boolean };

/**
 * Estado de resultados agrupado por la jerarquía del plan:
 * ingresos (ganancias) y costos/gastos (pérdidas), con subtotales por grupo.
 * Monto positivo = aporta al resultado (ingresos), negativo = lo reduce (gastos).
 */
export function estadoResultados(cuentas: Cuenta[], sumas: Sumas[]) {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const montoPorCodigo = new Map<string, number>();
  for (const s of sumas) {
    const c = porId.get(s.cuenta_id);
    if (!c || esDeBalance(c.tipo)) continue;
    // Ganancia: haber - debe. Pérdida: también haber - debe (queda negativo).
    const monto = Number(s.haber) - Number(s.debe);
    if (monto === 0) continue;
    // Sumar a la cuenta y a todos sus grupos superiores.
    const partes = c.codigo.split(".");
    for (let i = 1; i <= partes.length; i++) {
      const cod = partes.slice(0, i).join(".");
      montoPorCodigo.set(cod, (montoPorCodigo.get(cod) ?? 0) + monto);
    }
  }
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]));
  const lineas: LineaEstado[] = [...montoPorCodigo.entries()]
    .filter(([cod]) => porCodigo.has(cod))
    .map(([cod, monto]) => {
      const c = porCodigo.get(cod)!;
      return { codigo: cod, nombre: c.nombre, monto, nivel: cod.split(".").length, esGrupo: !c.imputable };
    })
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));

  const ingresos = cuentas
    .filter((c) => c.tipo === "ganancia" && !c.codigo.includes("."))
    .reduce((s, c) => s + (montoPorCodigo.get(c.codigo) ?? 0), 0);
  const gastos = cuentas
    .filter((c) => c.tipo === "perdida" && !c.codigo.includes("."))
    .reduce((s, c) => s + (montoPorCodigo.get(c.codigo) ?? 0), 0);
  return { lineas, ingresos, gastos, resultado: ingresos + gastos };
}
