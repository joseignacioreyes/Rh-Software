"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

const TIPOS = ["activo", "pasivo", "patrimonio", "perdida", "ganancia"] as const;

/** Si el código empieza con 1-5, sugiere el tipo de cuenta (estructura de la plantilla). */
function tipoPorCodigo(codigo: string): (typeof TIPOS)[number] | null {
  return ({ "1": "activo", "2": "pasivo", "3": "patrimonio", "4": "perdida", "5": "ganancia" } as const)[codigo[0]] ?? null;
}

async function verificar() {
  const ctx = await obtenerContexto();
  if (!ctx.empresa || !permiso(ctx, ctx.empresa.id, "contabilidad").editar) {
    throw new Error("No tienes permiso para modificar el plan de cuentas de esta empresa.");
  }
  return { ctx, empresa: ctx.empresa, supabase: await clienteServidor() };
}

const esquemaCuenta = z.object({
  codigo: z.string().trim().regex(/^\d+(\.\d+)*$/, "El código va con números separados por puntos, por ejemplo 1.1.01.005"),
  nombre: z.string().trim().min(2, "Escribe el nombre de la cuenta"),
  tipo: z.enum(TIPOS),
  imputable: z.boolean(),
});

export async function crearCuenta(_p: { error?: string; ok?: string } | undefined, datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const r = esquemaCuenta.safeParse({
      codigo: datos.get("codigo"),
      nombre: datos.get("nombre"),
      tipo: datos.get("tipo"),
      imputable: datos.get("imputable") === "on",
    });
    if (!r.success) return { error: r.error.issues[0].message };
    const { error } = await supabase.from("plan_cuentas").insert({
      ...r.data, estudio_id: ctx.estudio!.id, empresa_id: empresa.id, created_by: ctx.usuario.id,
    });
    if (error) return { error: error.code === "23505" ? `Ya existe la cuenta ${r.data.codigo}.` : error.message };
    revalidatePath("/contabilidad/plan-de-cuentas");
    return { ok: `Cuenta ${r.data.codigo} ${r.data.nombre} creada.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function editarCuenta(id: string, cambios: { nombre?: string; activa?: boolean }) {
  try {
    const { supabase } = await verificar();
    const limpio: { nombre?: string; activa?: boolean } = {};
    if (typeof cambios.nombre === "string") {
      if (cambios.nombre.trim().length < 2) return { error: "El nombre es muy corto." };
      limpio.nombre = cambios.nombre.trim();
    }
    if (typeof cambios.activa === "boolean") limpio.activa = cambios.activa;
    const { error } = await supabase.from("plan_cuentas").update(limpio).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/contabilidad/plan-de-cuentas");
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Copia la plantilla base o el plan de otra empresa del estudio. No pisa cuentas existentes. */
export async function copiarPlan(origen: string | null) {
  try {
    const { empresa, supabase } = await verificar();
    const { data, error } = await supabase.rpc("copiar_plan_cuentas", { p_destino: empresa.id, p_origen: origen });
    if (error) return { error: error.message };
    revalidatePath("/contabilidad/plan-de-cuentas");
    return { ok: data === 0 ? "No había cuentas nuevas que copiar." : `Se agregaron ${data} cuentas.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Importa cuentas desde Excel. Columnas esperadas (en la primera hoja, con encabezado):
 * Código | Nombre | Tipo (opcional) | Imputable (opcional: Sí/No).
 * Devuelve una vista previa si `confirmar` es falso.
 */
export async function importarPlanExcel(datos: FormData) {
  try {
    const { ctx, empresa, supabase } = await verificar();
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo Excel (.xlsx)." };
    if (archivo.size > 5_000_000) return { error: "El archivo es muy grande (máximo 5 MB)." };

    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(await archivo.arrayBuffer()) as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];
    if (!hoja) return { error: "El archivo no tiene hojas." };

    const filas: { codigo: string; nombre: string; tipo: (typeof TIPOS)[number]; imputable: boolean }[] = [];
    const errores: string[] = [];
    const existentes = new Set<string>();
    hoja.eachRow((fila, n) => {
      const valores = (fila.values as unknown[]).slice(1).map((v) => (v === null || v === undefined ? "" : String((v as { text?: string }).text ?? v).trim()));
      if (n === 1 && /c[oó]digo/i.test(valores[0])) return; // encabezado
      const [codigo, nombre, tipoTexto, imputableTexto] = valores;
      if (!codigo && !nombre) return;
      if (!/^\d+(\.\d+)*$/.test(codigo)) {
        errores.push(`Fila ${n}: código "${codigo}" no válido.`);
        return;
      }
      const t = (tipoTexto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const tipo = (TIPOS.find((x) => t.startsWith(x.slice(0, 4))) ?? tipoPorCodigo(codigo));
      if (!tipo) {
        errores.push(`Fila ${n}: no se reconoce el tipo de la cuenta ${codigo}.`);
        return;
      }
      if (!nombre) {
        errores.push(`Fila ${n}: falta el nombre de la cuenta ${codigo}.`);
        return;
      }
      if (existentes.has(codigo)) {
        errores.push(`Fila ${n}: la cuenta ${codigo} está repetida en el archivo.`);
        return;
      }
      existentes.add(codigo);
      const imputable = imputableTexto ? /^(s|si|sí|x|1|true)$/i.test(imputableTexto) : true;
      filas.push({ codigo, nombre, tipo, imputable });
    });

    // Las cuentas que tienen subcuentas no pueden recibir movimientos.
    for (const f of filas) {
      if (filas.some((o) => o.codigo.startsWith(f.codigo + "."))) f.imputable = false;
    }

    if (datos.get("confirmar") !== "1") {
      return { vista: filas.slice(0, 200), total: filas.length, errores };
    }
    if (errores.length > 0) return { error: "Corrige los errores del archivo antes de importar.", errores };

    const { error } = await supabase.from("plan_cuentas").upsert(
      filas.map((f) => ({ ...f, estudio_id: ctx.estudio!.id, empresa_id: empresa.id, created_by: ctx.usuario.id })),
      { onConflict: "empresa_id,codigo", ignoreDuplicates: true },
    );
    if (error) return { error: error.message };
    revalidatePath("/contabilidad/plan-de-cuentas");
    return { ok: `Importación lista: ${filas.length} cuentas revisadas (las que ya existían no se modificaron).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
