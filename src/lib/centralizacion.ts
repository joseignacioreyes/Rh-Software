// Centralizaciones: arman el comprobante contable del mes desde los libros.
// Las cuentas de destino se configuran una vez por empresa (config_centralizacion.cuentas).
import { esNotaCredito } from "@/lib/importar/rcv";

export const CUENTAS_CENTRALIZACION = [
  { clave: "compras_neto", nombre: "Compras: neto y exento (gasto o existencias)", codigo: "1.1.04.001", grupo: "compras" },
  { clave: "compras_activo_fijo", nombre: "Compras: activo fijo", codigo: "1.2.01.003", grupo: "compras" },
  { clave: "iva_credito", nombre: "IVA crédito fiscal", codigo: "1.1.05.001", grupo: "compras" },
  { clave: "compras_otros", nombre: "Compras: IVA no recuperable y otros impuestos", codigo: "4.2.02.010", grupo: "compras" },
  { clave: "proveedores", nombre: "Proveedores", codigo: "2.1.02.001", grupo: "compras" },
  { clave: "clientes", nombre: "Clientes (facturas)", codigo: "1.1.03.001", grupo: "ventas" },
  { clave: "caja_boletas", nombre: "Caja (boletas y comprobantes de pago)", codigo: "1.1.01.001", grupo: "ventas" },
  { clave: "ventas_neto", nombre: "Ventas afectas", codigo: "5.1.01.001", grupo: "ventas" },
  { clave: "ventas_exentas", nombre: "Ventas exentas", codigo: "5.1.01.003", grupo: "ventas" },
  { clave: "iva_debito", nombre: "IVA débito fiscal", codigo: "2.1.04.001", grupo: "ventas" },
  { clave: "honorarios_gasto", nombre: "Gasto en honorarios", codigo: "4.2.01.007", grupo: "honorarios" },
  { clave: "honorarios_retencion", nombre: "Retención de honorarios por pagar", codigo: "2.1.04.003", grupo: "honorarios" },
  { clave: "honorarios_por_pagar", nombre: "Honorarios por pagar", codigo: "2.1.02.004", grupo: "honorarios" },
] as const;

export type ClaveCuenta = (typeof CUENTAS_CENTRALIZACION)[number]["clave"];
export type ConfigCuentas = Partial<Record<ClaveCuenta, string>>;

/** Acumula montos por cuenta (positivo = debe) y los convierte en líneas debe/haber. */
class Asiento {
  private saldos = new Map<string, number>();
  constructor(private readonly config: ConfigCuentas) {}
  mover(clave: ClaveCuenta, monto: number) {
    if (!monto) return;
    const cuenta = this.config[clave];
    if (!cuenta) throw new Error(`Falta configurar la cuenta "${CUENTAS_CENTRALIZACION.find((c) => c.clave === clave)?.nombre}".`);
    this.saldos.set(cuenta, (this.saldos.get(cuenta) ?? 0) + monto);
  }
  lineas(glosa: string) {
    return [...this.saldos.entries()]
      .filter(([, v]) => v !== 0)
      .map(([cuenta_id, v]) => ({ cuenta_id, glosa, debe: v > 0 ? v : 0, haber: v < 0 ? -v : 0 }))
      .sort((a, b) => b.debe - a.debe);
  }
}

type Doc = { tipo_doc: number; monto_exento: number; monto_neto: number; monto_iva: number; monto_iva_no_recuperable: number; otros_impuestos: number; monto_total: number; monto_neto_activo_fijo: number; iva_activo_fijo: number };

export function asientoCompras(docs: Doc[], config: ConfigCuentas) {
  const a = new Asiento(config);
  for (const d of docs) {
    const s = esNotaCredito(d.tipo_doc) ? -1 : 1;
    const activoFijo = d.monto_neto_activo_fijo || 0;
    a.mover("compras_neto", s * (d.monto_neto - activoFijo + d.monto_exento));
    a.mover("compras_activo_fijo", s * activoFijo);
    a.mover("iva_credito", s * d.monto_iva);
    a.mover("compras_otros", s * (d.monto_iva_no_recuperable + d.otros_impuestos));
    a.mover("proveedores", -s * d.monto_total);
  }
  return a.lineas("Centralización libro de compras");
}

export function asientoVentas(docs: Doc[], config: ConfigCuentas) {
  const a = new Asiento(config);
  for (const d of docs) {
    const s = esNotaCredito(d.tipo_doc) ? -1 : 1;
    const boleta = [35, 38, 39, 41, 48].includes(d.tipo_doc);
    a.mover(boleta ? "caja_boletas" : "clientes", s * d.monto_total);
    a.mover("ventas_neto", -s * (d.monto_neto + d.otros_impuestos));
    a.mover("ventas_exentas", -s * d.monto_exento);
    a.mover("iva_debito", -s * d.monto_iva);
  }
  return a.lineas("Centralización libro de ventas");
}

export function asientoHonorarios(boletas: { monto_bruto: number; monto_retencion: number; monto_liquido: number; retencion_por: string | null }[], config: ConfigCuentas) {
  const a = new Asiento(config);
  for (const b of boletas) {
    a.mover("honorarios_gasto", b.monto_bruto);
    if (b.retencion_por === "emisor") {
      a.mover("honorarios_por_pagar", -b.monto_bruto);
    } else {
      a.mover("honorarios_retencion", -b.monto_retencion);
      a.mover("honorarios_por_pagar", -b.monto_liquido);
    }
  }
  return a.lineas("Centralización boletas de honorarios recibidas");
}
