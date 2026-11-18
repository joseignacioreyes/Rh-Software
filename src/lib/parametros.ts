// Parámetros legales vigentes a una fecha. Se leen de la tabla parametros_legales (nunca del código).
import type { SupabaseClient } from "@supabase/supabase-js";

export type Parametro = {
  codigo: string;
  descripcion: string;
  valor: number | null;
  valor_json: unknown;
  unidad: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  fuente_nombre: string;
  fuente_url: string | null;
  estado: "por_verificar" | "verificado";
  notas?: string | null;
};

export class Parametros {
  constructor(private readonly filas: Parametro[]) {}

  static async cargar(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from("parametros_legales")
      .select("codigo, descripcion, valor, valor_json, unidad, vigente_desde, vigente_hasta, fuente_nombre, fuente_url, estado, notas");
    if (error) throw new Error(`No se pudieron leer los parámetros legales: ${error.message}`);
    return new Parametros((data ?? []).map((p) => ({ ...p, valor: p.valor === null ? null : Number(p.valor) })) as Parametro[]);
  }

  /** Parámetro vigente a la fecha (AAAA-MM-DD), o null si no hay. */
  buscar(codigo: string, fecha: string): Parametro | null {
    return (
      this.filas
        .filter((p) => p.codigo === codigo && p.vigente_desde <= fecha && (!p.vigente_hasta || p.vigente_hasta >= fecha))
        .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0] ?? null
    );
  }

  /** Igual que buscar, pero si falta lanza un error claro (el cálculo no debe seguir sin el dato). */
  exigir(codigo: string, fecha: string): Parametro {
    const p = this.buscar(codigo, fecha);
    if (!p) throw new FaltaParametro(codigo, fecha);
    return p;
  }

  numero(codigo: string, fecha: string): number {
    const p = this.exigir(codigo, fecha);
    if (p.valor === null) throw new FaltaParametro(codigo, fecha);
    return p.valor;
  }

  todos() {
    return this.filas;
  }
}

export class FaltaParametro extends Error {
  constructor(public codigo: string, public fecha: string) {
    super(`Falta el parámetro legal ${codigo} vigente al ${fecha.split("-").reverse().join("-")}. Cárgalo en Parámetros legales antes de calcular.`);
  }
}

/** Resumen de un parámetro para guardarlo junto al cálculo ("Ver cómo se calculó"). */
export function resumenParametro(p: Parametro) {
  return {
    codigo: p.codigo,
    descripcion: p.descripcion,
    valor: p.valor ?? p.valor_json,
    unidad: p.unidad,
    vigente_desde: p.vigente_desde,
    vigente_hasta: p.vigente_hasta,
    fuente: p.fuente_nombre,
    fuente_url: p.fuente_url,
    estado: p.estado,
  };
}
export type ResumenParametro = ReturnType<typeof resumenParametro>;
