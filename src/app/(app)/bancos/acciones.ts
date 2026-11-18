"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { leerFilasArchivo } from "@/lib/importar/excel";
import { aplicarMapeoCartola, firmaEncabezados, sugerirMapeo, type Mapeo } from "@/lib/importar/mapeo";
import { guardarCartola } from "@/lib/importar/guardar";

async function verificar() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "contabilidad").editar) throw new Error("No tienes permiso en esta empresa.");
  return { ctx, empresa: ctx.empresa, supabase: await clienteServidor() };
}

export async function crearCuentaBancaria(_p: { error?: string } | undefined, datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const banco = String(datos.get("banco") ?? "").trim();
    const numero = String(datos.get("numero") ?? "").trim();
    const cuenta = String(datos.get("cuenta_contable_id") ?? "") || null;
    if (!banco || !numero) return { error: "Escribe el banco y el número de cuenta." };
    const { error } = await supabase.from("cuentas_bancarias").insert({ estudio_id: ctx.estudio!.id, empresa_id: empresa.id, banco, numero, cuenta_contable_id: cuenta });
    if (error) return { error: error.code === "23505" ? "Esa cuenta ya existe." : error.message };
    revalidatePath("/bancos");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type AnalisisCartola = { error?: string; encabezados?: string[]; mapeo?: Mapeo; guardado?: boolean; ejemplos?: string[][] };

export async function analizarCartola(datos: FormData): Promise<AnalisisCartola> {
  const { ctx, supabase } = await verificar();
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File)) return { error: "Elige el archivo de la cartola." };
  const { encabezados, filas } = await leerFilasArchivo(archivo);
  if (encabezados.length < 3) return { error: "No se reconoce el encabezado de la cartola." };
  const { data } = await supabase.from("mapeos_importacion").select("mapeo").eq("estudio_id", ctx.estudio!.id).eq("tipo", "cartola").eq("firma_encabezados", firmaEncabezados(encabezados)).maybeSingle();
  const txt = (c: unknown) => (c instanceof Date ? c.toISOString().slice(0, 10) : c === null || c === undefined ? "" : String(c));
  return {
    encabezados,
    mapeo: (data?.mapeo as Mapeo) ?? sugerirMapeo("cartola", encabezados),
    guardado: !!data,
    ejemplos: filas.slice(0, 5).map((f) => encabezados.map((_, i) => txt(f[i]))),
  };
}

export async function importarCartola(datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const archivo = datos.get("archivo");
    const cuenta = String(datos.get("cuenta_bancaria_id") ?? "");
    if (!(archivo instanceof File) || !cuenta) return { error: "Elige la cuenta y el archivo." };
    const mapeo = JSON.parse(String(datos.get("mapeo"))) as Mapeo;
    if (mapeo.fecha == null || mapeo.descripcion == null || (mapeo.monto == null && mapeo.cargo == null && mapeo.abono == null)) {
      return { error: "Indica al menos las columnas de fecha, descripción y montos (cargo/abono o monto)." };
    }
    const { encabezados, filas } = await leerFilasArchivo(archivo);
    const { movimientos, errores } = aplicarMapeoCartola(filas, mapeo);
    const hash = createHash("sha256").update(new Uint8Array(await archivo.arrayBuffer())).digest("hex");
    const r = await guardarCartola({ supabase, estudioId: ctx.estudio!.id, empresaId: empresa.id, nombreArchivo: archivo.name, hash }, cuenta, movimientos, errores, mapeo);
    // Recordar el mapeo de este formato de banco.
    await supabase.from("mapeos_importacion").upsert(
      { estudio_id: ctx.estudio!.id, nombre: `Cartola ${archivo.name.slice(0, 40)}`, tipo: "cartola", firma_encabezados: firmaEncabezados(encabezados), mapeo },
      { onConflict: "estudio_id,tipo,firma_encabezados" },
    );
    revalidatePath("/bancos");
    return { ok: `Cartola importada: ${r.nuevos} movimientos nuevos (${r.duplicados} ya estaban)${errores.length ? `, ${errores.length} filas con error` : ""}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Parea movimientos con líneas contables (uno o varios a la vez). */
export async function parear(pares: { movimiento_id: string; linea_id: string }[], automatica = false) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    if (!pares.length) return {};
    const { error } = await supabase.from("conciliaciones").insert(
      pares.map((p) => ({ ...p, estudio_id: ctx.estudio!.id, empresa_id: empresa.id, tipo: "pareo", automatica })),
    );
    if (error) return { error: error.code === "23505" ? "Uno de los movimientos o líneas ya estaba conciliado." : error.message };
    revalidatePath("/bancos");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function marcarDiferencia(movimientoId: string, nota: string) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    if (nota.trim().length < 3) return { error: "Escribe una nota." };
    const { error } = await supabase.from("conciliaciones").insert({ movimiento_id: movimientoId, estudio_id: ctx.estudio!.id, empresa_id: empresa.id, tipo: "diferencia", nota: nota.trim() });
    if (error) return { error: error.message };
    revalidatePath("/bancos");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deshacer(movimientoId: string) {
  try {
    const { supabase } = await verificar();
    const { error } = await supabase.from("conciliaciones").delete().eq("movimiento_id", movimientoId);
    if (error) return { error: error.message };
    revalidatePath("/bancos");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
