"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerContexto, permiso } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { decodificar, leerCsv } from "@/lib/importar/csv";
import { leerRcv, totalesLibro } from "@/lib/importar/rcv";
import { leerHonorarios } from "@/lib/importar/honorarios";
import { guardarDocumentosRcv, guardarHonorarios } from "@/lib/importar/guardar";
import { formatearRut } from "@/lib/rut";

export type ResultadoArchivo = {
  archivo: string;
  tipo: "rcv_compras" | "rcv_ventas" | "honorarios_recibidos" | "honorarios_emitidos" | "desconocido";
  empresa: { id: string; nombre: string } | null;
  periodo: string | null;
  documentos: number;
  nuevos: number;
  duplicados: number;
  total: number;
  errores: { fila: number; mensaje: string }[];
  avisos: string[];
  problema: string | null;
  importado: boolean;
};

/**
 * Analiza (y si `confirmar`, importa) varios archivos de varias empresas a la vez.
 * Cada archivo se asigna a la empresa por el RUT de su nombre; si no lo trae, a la empresa elegida.
 */
export async function procesarArchivos(datos: FormData): Promise<ResultadoArchivo[]> {
  const ctx = await obtenerContexto();
  const confirmar = datos.get("confirmar") === "1";
  const supabase = await clienteServidor();
  const archivos = datos.getAll("archivos").filter((a): a is File => a instanceof File);
  const resultados: ResultadoArchivo[] = [];

  for (const archivo of archivos) {
    const r: ResultadoArchivo = {
      archivo: archivo.name, tipo: "desconocido", empresa: null, periodo: null, documentos: 0, nuevos: 0, duplicados: 0,
      total: 0, errores: [], avisos: [], problema: null, importado: false,
    };
    resultados.push(r);
    if (archivo.size > 15_000_000) {
      r.problema = "El archivo supera 15 MB.";
      continue;
    }
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const nombre = archivo.name.toUpperCase();
    if (/\.(xlsx|xls)$/i.test(archivo.name)) {
      r.problema = "Es un Excel: impórtalo con el asistente de mapeo (libros de otros softwares).";
      continue;
    }
    if (nombre.includes("CARTOLA")) {
      r.problema = "Es una cartola bancaria: impórtala en Bancos y conciliación.";
      continue;
    }
    const { texto } = decodificar(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");

    // Empresa: por el RUT del nombre del archivo, o la empresa elegida.
    const rutNombre = nombre.match(/(\d{7,8}-[\dK])/)?.[1] ?? null;
    const empresa = rutNombre ? ctx.empresas.find((e) => e.rut === rutNombre) : ctx.empresa;
    if (!empresa) {
      r.problema = rutNombre
        ? `El RUT ${formatearRut(rutNombre)} del archivo no corresponde a ninguna empresa de tu estudio.`
        : "Elige primero una empresa.";
      continue;
    }
    r.empresa = { id: empresa.id, nombre: empresa.razon_social };
    if (!permiso(ctx, empresa.id, "libros").editar) {
      r.problema = "No tienes permiso para importar libros en esta empresa.";
      continue;
    }
    const base = { supabase, estudioId: ctx.estudio!.id, empresaId: empresa.id, nombreArchivo: archivo.name, hash };

    try {
      if (nombre.includes("BHE") || nombre.includes("HONORARIO")) {
        const tipo = nombre.includes("EMITIDA") ? "emitidas" : "recibidas";
        r.tipo = tipo === "emitidas" ? "honorarios_emitidos" : "honorarios_recibidos";
        const { boletas, errores } = leerHonorarios(leerCsv(texto));
        r.documentos = boletas.length;
        r.errores = errores;
        r.total = boletas.reduce((s, x) => s + x.monto_bruto, 0);
        const fechas = boletas.map((x) => x.fecha.slice(0, 7)).sort();
        r.periodo = fechas.length ? `${fechas[0].slice(5, 7)}-${fechas[0].slice(0, 4)}` : null;
        const { data: previas } = await supabase.from("honorarios").select("folio, rut_contraparte").eq("empresa_id", empresa.id).eq("tipo", tipo).in("folio", boletas.map((x) => x.folio));
        const ex = new Set((previas ?? []).map((p) => `${p.folio}|${p.rut_contraparte}`));
        r.duplicados = boletas.filter((x) => ex.has(`${x.folio}|${x.rut_contraparte}`)).length;
        r.nuevos = boletas.length - r.duplicados;
        if (confirmar && boletas.length) {
          await guardarHonorarios(base, tipo, boletas, errores);
          r.importado = true;
        }
        continue;
      }

      const lectura = leerRcv(texto, archivo.name);
      if (!lectura.libro) {
        r.problema = "No se reconoce si es libro de compras o de ventas. Usa el asistente de mapeo.";
        continue;
      }
      r.tipo = lectura.libro === "compras" ? "rcv_compras" : "rcv_ventas";
      r.periodo = lectura.mes && lectura.anio ? `${String(lectura.mes).padStart(2, "0")}-${lectura.anio}` : null;
      r.documentos = lectura.documentos.length;
      r.errores = lectura.errores;
      r.avisos = lectura.avisos;
      r.total = totalesLibro(lectura.documentos).total;
      const folios = lectura.documentos.map((d) => d.folio);
      const { data: previos } = folios.length
        ? await supabase.from("documentos_rcv").select("tipo_doc, folio, rut_contraparte").eq("empresa_id", empresa.id).eq("libro", lectura.libro).in("folio", folios)
        : { data: [] };
      const ex = new Set((previos ?? []).map((d) => `${d.tipo_doc}|${d.folio}|${d.rut_contraparte}`));
      r.duplicados = lectura.documentos.filter((d) => ex.has(`${d.tipo_doc}|${d.folio}|${d.rut_contraparte}`)).length;
      r.nuevos = r.documentos - r.duplicados;
      if (confirmar && lectura.documentos.length) {
        await guardarDocumentosRcv(base, lectura.libro, lectura.documentos, lectura.errores, { anio: lectura.anio, mes: lectura.mes });
        r.importado = true;
      }
    } catch (e) {
      r.problema = (e as Error).message;
    }
  }
  if (confirmar) {
    revalidatePath("/libros", "layout");
    revalidatePath("/mi-mes");
  }
  return resultados;
}
