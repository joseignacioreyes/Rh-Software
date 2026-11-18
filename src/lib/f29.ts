// Propuesta de F29 calculada desde los libros (RCV), honorarios y remuneraciones.
// Cálculo puro: recibe datos y parámetros, devuelve códigos con su explicación.
// Los códigos del formulario se dejan "POR VERIFICAR" con el instructivo vigente del SII.
import { esNotaCredito } from "@/lib/importar/rcv";
import { resumenParametro, type Parametros, type ResumenParametro } from "@/lib/parametros";

export type DocF29 = {
  libro: "compras" | "ventas";
  tipo_doc: number;
  monto_exento: number;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  monto_neto_activo_fijo: number;
  iva_activo_fijo: number;
  cantidad_documentos: number | null;
};

export type LineaF29 = {
  codigo: string;
  nombre: string;
  valor: number;
  formula: string;
  detalle?: string;
  grupo: "debitos" | "creditos" | "iva" | "ppm" | "retenciones" | "total";
  esCantidad?: boolean;
};

export type EntradaF29 = {
  anio: number;
  mes: number;
  documentos: DocF29[];
  retencionHonorarios: number;
  boletasHonorarios: number;
  impuestoUnico: number;
  fuenteImpuestoUnico: string;
  remanenteAnterior: number;
  /** UTM del mes del remanente anterior y del mes actual, para reajustarlo (art. 27 DL 825). */
  utmAnterior: number | null;
  tasaPpm: number | null;
};

export type ResultadoF29 = {
  lineas: LineaF29[];
  codigos: Record<string, number>;
  ivaDeterminado: number;
  remanenteSiguiente: number;
  totalAPagar: number;
  parametros: ResumenParametro[];
  avisos: string[];
};

const FACTURAS = [29, 30, 33, 45, 46];
const BOLETAS = [35, 39];
const COMPROBANTES_PAGO = [48];
const NOTAS_DEBITO = [55, 56];
const EXENTOS = [32, 34, 38, 41];

const suma = (docs: DocF29[], f: (d: DocF29) => number) => docs.reduce((s, d) => s + f(d), 0);
const cantidad = (docs: DocF29[]) => docs.reduce((s, d) => s + (d.cantidad_documentos ?? 1), 0);

export function calcularF29(e: EntradaF29, params: Parametros): ResultadoF29 {
  const fecha = `${e.anio}-${String(e.mes).padStart(2, "0")}-01`;
  const usados: ResumenParametro[] = [];
  const avisos: string[] = [];
  const usar = (codigo: string) => {
    const p = params.exigir(codigo, fecha);
    usados.push(resumenParametro(p));
    return p;
  };
  const tasaIva = usar("IVA_TASA").valor!;
  const ventas = e.documentos.filter((d) => d.libro === "ventas");
  const compras = e.documentos.filter((d) => d.libro === "compras");
  const de = (docs: DocF29[], tipos: number[]) => docs.filter((d) => tipos.includes(d.tipo_doc));
  const lineas: LineaF29[] = [];
  const add = (l: LineaF29) => lineas.push(l);

  // --- Débitos ---
  const vFact = de(ventas, FACTURAS);
  const vBol = de(ventas, BOLETAS);
  const vComp = de(ventas, COMPROBANTES_PAGO);
  const vNC = ventas.filter((d) => esNotaCredito(d.tipo_doc));
  const vND = de(ventas, NOTAS_DEBITO);
  const vExe = de(ventas, EXENTOS);
  add({ codigo: "503", nombre: "Cantidad de facturas emitidas", valor: cantidad(vFact), formula: "Facturas afectas del libro de ventas", grupo: "debitos", esCantidad: true });
  add({ codigo: "502", nombre: "Débito de facturas emitidas", valor: suma(vFact, (d) => d.monto_iva), formula: "Suma del IVA de las facturas emitidas", grupo: "debitos" });
  add({ codigo: "110", nombre: "Cantidad de boletas", valor: cantidad(vBol), formula: "Boletas del resumen de ventas", grupo: "debitos", esCantidad: true });
  add({ codigo: "111", nombre: "Débito de boletas", valor: suma(vBol, (d) => d.monto_iva), formula: "IVA del resumen de boletas", grupo: "debitos" });
  add({ codigo: "758", nombre: "Cantidad de comprobantes de pago electrónico", valor: cantidad(vComp), formula: "Vouchers (tipo 48)", grupo: "debitos", esCantidad: true });
  add({ codigo: "759", nombre: "Débito de comprobantes de pago electrónico", valor: suma(vComp, (d) => d.monto_iva), formula: "IVA de los vouchers", grupo: "debitos" });
  add({ codigo: "512", nombre: "Cantidad de notas de débito emitidas", valor: cantidad(vND), formula: "Notas de débito del libro de ventas", grupo: "debitos", esCantidad: true });
  add({ codigo: "513", nombre: "Débito de notas de débito emitidas", valor: suma(vND, (d) => d.monto_iva), formula: "IVA de las notas de débito", grupo: "debitos" });
  add({ codigo: "509", nombre: "Cantidad de notas de crédito emitidas", valor: cantidad(vNC), formula: "Notas de crédito del libro de ventas", grupo: "debitos", esCantidad: true });
  add({ codigo: "510", nombre: "Débito de notas de crédito emitidas (resta)", valor: suma(vNC, (d) => d.monto_iva), formula: "IVA de las notas de crédito emitidas", grupo: "debitos" });
  add({ codigo: "142", nombre: "Ventas y servicios exentos", valor: suma(vExe, (d) => d.monto_exento) + suma(ventas.filter((d) => !EXENTOS.includes(d.tipo_doc) && !esNotaCredito(d.tipo_doc)), (d) => d.monto_exento), formula: "Monto exento de las ventas", grupo: "debitos" });
  const debitos = lineaValor(lineas, "502") + lineaValor(lineas, "111") + lineaValor(lineas, "759") + lineaValor(lineas, "513") - lineaValor(lineas, "510");
  add({ codigo: "538", nombre: "Total débitos", valor: debitos, formula: "502 + 111 + 759 + 513 − 510", grupo: "debitos" });

  // --- Créditos ---
  const cFact = compras.filter((d) => FACTURAS.includes(d.tipo_doc));
  const cNC = compras.filter((d) => esNotaCredito(d.tipo_doc));
  const cND = de(compras, NOTAS_DEBITO);
  const ivaAF = suma(cFact, (d) => d.iva_activo_fijo);
  add({ codigo: "519", nombre: "Cantidad de facturas recibidas del giro", valor: cFact.filter((d) => !d.iva_activo_fijo).length, formula: "Facturas de compra sin activo fijo", grupo: "creditos", esCantidad: true });
  add({ codigo: "520", nombre: "Crédito de facturas del giro", valor: suma(cFact, (d) => d.monto_iva) - ivaAF, formula: "IVA recuperable de facturas de compra − IVA de activo fijo", grupo: "creditos" });
  add({ codigo: "524", nombre: "Cantidad de facturas de activo fijo", valor: cFact.filter((d) => d.iva_activo_fijo > 0).length, formula: "Facturas con IVA de activo fijo", grupo: "creditos", esCantidad: true });
  add({ codigo: "525", nombre: "Crédito por activo fijo", valor: ivaAF, formula: "IVA de activo fijo", grupo: "creditos" });
  add({ codigo: "531", nombre: "Cantidad de notas de débito recibidas", valor: cND.length, formula: "Notas de débito del libro de compras", grupo: "creditos", esCantidad: true });
  add({ codigo: "532", nombre: "Crédito de notas de débito recibidas", valor: suma(cND, (d) => d.monto_iva), formula: "IVA de las notas de débito recibidas", grupo: "creditos" });
  add({ codigo: "527", nombre: "Cantidad de notas de crédito recibidas", valor: cNC.length, formula: "Notas de crédito del libro de compras", grupo: "creditos", esCantidad: true });
  add({ codigo: "528", nombre: "Notas de crédito recibidas (resta)", valor: suma(cNC, (d) => d.monto_iva), formula: "IVA de las notas de crédito recibidas", grupo: "creditos" });

  // Remanente del mes anterior reajustado por la variación de la UTM.
  let remanente = e.remanenteAnterior;
  let detalleRemanente = "Sin remanente del mes anterior";
  if (e.remanenteAnterior > 0) {
    const utmActual = params.buscar("UTM", fecha);
    if (utmActual?.valor && e.utmAnterior) {
      usados.push(resumenParametro(utmActual));
      remanente = Math.round((e.remanenteAnterior * utmActual.valor) / e.utmAnterior);
      detalleRemanente = `${e.remanenteAnterior.toLocaleString("es-CL")} × UTM actual ${utmActual.valor.toLocaleString("es-CL")} / UTM anterior ${e.utmAnterior.toLocaleString("es-CL")}`;
    } else {
      detalleRemanente = "Sin reajuste: falta la UTM de uno de los meses en parámetros legales";
      avisos.push("El remanente del mes anterior no se reajustó porque falta la UTM de uno de los meses.");
    }
  }
  add({ codigo: "504", nombre: "Remanente de crédito fiscal del mes anterior (reajustado)", valor: remanente, formula: "Código 77 del F29 anterior × variación de la UTM", detalle: detalleRemanente, grupo: "creditos" });
  const creditos = lineaValor(lineas, "520") + lineaValor(lineas, "525") + lineaValor(lineas, "532") - lineaValor(lineas, "528") + remanente;
  add({ codigo: "537", nombre: "Total créditos", valor: creditos, formula: "520 + 525 + 532 − 528 + 504", grupo: "creditos" });

  // --- IVA determinado o remanente ---
  const diferencia = debitos - creditos;
  const ivaDeterminado = Math.max(diferencia, 0);
  const remanenteSiguiente = Math.max(-diferencia, 0);
  add({ codigo: "89", nombre: "IVA determinado a pagar", valor: ivaDeterminado, formula: "538 − 537, si es positivo", grupo: "iva" });
  add({ codigo: "77", nombre: "Remanente de crédito para el mes siguiente", valor: remanenteSiguiente, formula: "537 − 538, si los créditos superan a los débitos", grupo: "iva" });

  // Control: el IVA de las facturas debería ser cercano a neto × tasa.
  const netoAfecto = suma(vFact, (d) => d.monto_neto);
  const ivaEsperado = Math.round((netoAfecto * tasaIva) / 100);
  if (netoAfecto > 0 && Math.abs(ivaEsperado - lineaValor(lineas, "502")) > vFact.length * 2) {
    avisos.push(`El débito de facturas (${lineaValor(lineas, "502").toLocaleString("es-CL")}) no calza con neto × ${tasaIva}% (${ivaEsperado.toLocaleString("es-CL")}): revisa documentos con impuestos especiales o errores.`);
  }

  // --- PPM ---
  const ingresos = suma(ventas.filter((d) => !esNotaCredito(d.tipo_doc)), (d) => d.monto_neto + d.monto_exento) - suma(vNC, (d) => d.monto_neto + d.monto_exento);
  add({ codigo: "563", nombre: "Base imponible PPM (ingresos brutos del mes)", valor: ingresos, formula: "Neto + exento de las ventas − notas de crédito", grupo: "ppm" });
  let ppm = 0;
  if (e.tasaPpm === null) {
    avisos.push("La empresa no tiene tasa de PPM en su ficha: el PPM quedó en 0.");
  } else {
    ppm = Math.round((ingresos * e.tasaPpm) / 100);
  }
  add({ codigo: "115", nombre: "Tasa de PPM (%)", valor: e.tasaPpm ?? 0, formula: "Tasa de la ficha de la empresa", grupo: "ppm", esCantidad: true });
  add({ codigo: "62", nombre: "PPM neto determinado", valor: ppm, formula: "563 × 115 / 100, redondeado al peso", grupo: "ppm" });

  // --- Retenciones ---
  if (e.retencionHonorarios > 0) usar("RETENCION_HONORARIOS");
  add({ codigo: "151", nombre: "Retención de honorarios (art. 42 N°2)", valor: e.retencionHonorarios, formula: "Retenciones de las boletas de honorarios recibidas", detalle: `${e.boletasHonorarios} boletas vigentes`, grupo: "retenciones" });
  add({ codigo: "48", nombre: "Impuesto único de segunda categoría", valor: e.impuestoUnico, formula: "Suma del impuesto único de las liquidaciones del mes", detalle: e.fuenteImpuestoUnico, grupo: "retenciones" });

  const total = ivaDeterminado + ppm + e.retencionHonorarios + e.impuestoUnico;
  add({ codigo: "91", nombre: "Total a pagar dentro del plazo legal", valor: total, formula: "89 + 62 + 151 + 48", grupo: "total" });

  const codigos = Object.fromEntries(lineas.map((l) => [l.codigo, l.valor]));
  return { lineas, codigos, ivaDeterminado, remanenteSiguiente, totalAPagar: total, parametros: dedupe(usados), avisos };
}

function lineaValor(lineas: LineaF29[], codigo: string) {
  return lineas.find((l) => l.codigo === codigo)?.valor ?? 0;
}

function dedupe(p: ResumenParametro[]) {
  const vistos = new Set<string>();
  return p.filter((x) => {
    const k = `${x.codigo}|${x.vigente_desde}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Explicaciones típicas de diferencias con la propuesta del SII, por código. */
export const EXPLICACION_DIFERENCIA: Record<string, string> = {
  "502": "Revisa si hay facturas emitidas en el RCV del SII que no están importadas, o documentos reclamados.",
  "111": "El resumen de boletas ingresado no coincide con el del SII: revisa el total del mes.",
  "520": "Puede haber facturas de compra pendientes de aceptar o reclamadas en el RCV, o compras no importadas.",
  "525": "Revisa qué facturas se clasificaron como activo fijo.",
  "504": "El remanente anterior no coincide: revisa el código 77 del F29 del mes pasado o el reajuste por UTM.",
  "62": "La tasa de PPM o la base (ingresos del mes) difieren: confirma la tasa vigente de la empresa.",
  "151": "Revisa las boletas de honorarios recibidas del mes (anuladas o con retención del emisor).",
  "48": "El impuesto único debe coincidir con las liquidaciones del mes.",
};

/** Vencimiento del F29 de un periodo: día 12 (o 20 si es facturador electrónico) del mes siguiente, corrido al día hábil. */
export function vencimiento(anio: number, mes: number, dia: number, feriados: Set<string>, correrAlHabil = true): string {
  const sig = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 };
  const f = new Date(Date.UTC(sig.a, sig.m - 1, dia));
  if (correrAlHabil) {
    while (f.getUTCDay() === 0 || f.getUTCDay() === 6 || feriados.has(f.toISOString().slice(0, 10))) {
      f.setUTCDate(f.getUTCDate() + 1);
    }
  }
  return f.toISOString().slice(0, 10);
}
