import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vencimiento } from "@/lib/f29";
import { Parametros } from "@/lib/parametros";
import { ZONA_HORARIA } from "@/lib/formato";
import { nombrePeriodo, type Periodo } from "@/lib/sesion";

export type Semaforo = "listo" | "revisar" | "atrasado" | "pronto" | "na";
export type Tarea = { estado: Semaforo; detalle: string; href?: string };
export type EstadoEmpresa = {
  empresaId: string;
  tareas: Record<string, Tarea>;
  avisos: { tono: "rojo" | "ambar"; texto: string }[];
  vencimientos: { que: string; fecha: string }[];
};

const hoySantiago = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
const mesAnterior = (p: Periodo, n = 1): Periodo => {
  const t = p.anio * 12 + (p.mes - 1) - n;
  return { anio: Math.floor(t / 12), mes: (t % 12) + 1 };
};

/** Tablas de módulos de fases posteriores: si aún no existen, se tratan como sin datos. */
async function consultaOpcional<T>(promesa: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const r = await promesa;
  return r.error ? [] : r.data ?? [];
}

/**
 * Estado del mes de varias empresas para el panel "Mi mes".
 * `modulos` indica qué puede ver el usuario en cada empresa (contabilidad, libros, impuestos, remuneraciones, documentos).
 */
export async function estadoDelMes(
  supabase: SupabaseClient,
  empresas: { id: string; razon_social: string }[],
  periodo: Periodo,
  modulos: (empresaId: string) => Record<string, boolean>,
): Promise<EstadoEmpresa[]> {
  const ids = empresas.map((e) => e.id);
  if (!ids.length) return [];
  const p2 = mesAnterior(periodo, 2);

  const [docs, comprobantes, periodos, f29s, emps, feriados, params, liqs, archivos, bandeja] = await Promise.all([
    supabase.from("documentos_rcv").select("empresa_id, libro, anio, mes, rut_contraparte, razon_social, monto_iva, tipo_doc").in("empresa_id", ids).gte("anio", p2.anio).limit(50000),
    supabase.from("comprobantes").select("empresa_id").in("empresa_id", ids).eq("estado", "vigente").eq("anio", periodo.anio).eq("mes", periodo.mes),
    supabase.from("periodos").select("empresa_id, estado").in("empresa_id", ids).eq("anio", periodo.anio).eq("mes", periodo.mes),
    supabase.from("f29_propuestas").select("empresa_id, estado, total_a_pagar").in("empresa_id", ids).eq("anio", periodo.anio).eq("mes", periodo.mes),
    supabase.from("empresas").select("id, emite_factura_electronica").in("id", ids),
    supabase.from("feriados").select("fecha"),
    Parametros.cargar(supabase),
    consultaOpcional<{ empresa_id: string; estado: string }>(supabase.from("liquidaciones").select("empresa_id, estado").in("empresa_id", ids).eq("anio", periodo.anio).eq("mes", periodo.mes)),
    supabase.from("archivos_generados").select("empresa_id, tipo").in("empresa_id", ids).eq("anio", periodo.anio).eq("mes", periodo.mes),
    consultaOpcional<{ empresa_id: string; estado: string }>(supabase.from("documentos_bandeja").select("empresa_id, estado").in("empresa_id", ids).eq("estado", "pendiente")),
  ]);
  const trabajadores = await consultaOpcional<{ empresa_id: string }>(supabase.from("trabajadores").select("empresa_id").in("empresa_id", ids).eq("activo", true));
  const solicitudes = await consultaOpcional<{ empresa_id: string }>(supabase.from("solicitudes_cliente").select("empresa_id").in("empresa_id", ids).eq("estado", "pendiente"));

  const hoy = hoySantiago();
  const setFeriados = new Set((feriados.data ?? []).map((f) => f.fecha));
  const fechaRef = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
  const dia = (codigo: string) => params.buscar(codigo, fechaRef)?.valor ?? null;
  const vPrevired = dia("VENC_PREVIRED_DIA_ELECTRONICO");
  const vLre = dia("VENC_LRE_DIA");
  const nombreMes = nombrePeriodo(periodo).split(" ")[0].toLowerCase();

  return empresas.map((e) => {
    const m = modulos(e.id);
    const tareas: Record<string, Tarea> = {};
    const avisos: EstadoEmpresa["avisos"] = [];
    const vencimientos: EstadoEmpresa["vencimientos"] = [];
    const elec = (emps.data ?? []).find((x) => x.id === e.id)?.emite_factura_electronica ?? true;
    const diaF29 = dia(elec ? "VENC_F29_DIA_ELECTRONICO" : "VENC_F29_DIA");
    const vF29 = diaF29 ? vencimiento(periodo.anio, periodo.mes, diaF29, setFeriados) : null;
    if (vF29) vencimientos.push({ que: "F29", fecha: vF29 });
    const vPrev = vPrevired ? vencimiento(periodo.anio, periodo.mes, vPrevired, setFeriados, false) : null;
    const vLibro = vLre ? vencimiento(periodo.anio, periodo.mes, vLre, setFeriados) : null;
    const pasado = (f: string | null) => !!f && hoy > f;

    // --- Libros importados ---
    const misDocs = (docs.data ?? []).filter((d) => d.empresa_id === e.id);
    const delMes = misDocs.filter((d) => d.anio === periodo.anio && d.mes === periodo.mes);
    const compras = delMes.filter((d) => d.libro === "compras");
    const ventas = delMes.filter((d) => d.libro === "ventas");
    if (!m.libros) tareas.libros = { estado: "na", detalle: "Sin acceso a libros" };
    else if (compras.length && ventas.length) tareas.libros = { estado: "listo", detalle: `${compras.length} compras y ${ventas.length} ventas`, href: "/libros/compras" };
    else if (compras.length || ventas.length) tareas.libros = { estado: "revisar", detalle: `Falta el libro de ${compras.length ? "ventas" : "compras"}`, href: "/libros/importar" };
    else tareas.libros = { estado: vF29 && hoy >= vF29.slice(0, 8) + "01" ? "atrasado" : "revisar", detalle: "Sin libros importados", href: "/libros/importar" };

    if (m.libros) {
      // Proveedores habituales (en los dos meses anteriores) sin factura este mes.
      const ruts = (p: Periodo) => new Set(misDocs.filter((d) => d.libro === "compras" && d.anio === p.anio && d.mes === p.mes).map((d) => d.rut_contraparte));
      const r1 = ruts(mesAnterior(periodo, 1));
      const r2 = ruts(mesAnterior(periodo, 2));
      const actuales = new Set(compras.map((d) => d.rut_contraparte));
      // Menos facturas de compra que el promedio de los dos meses anteriores.
      const cuenta = (p: Periodo) => misDocs.filter((d) => d.libro === "compras" && d.anio === p.anio && d.mes === p.mes && d.tipo_doc === 33).length;
      const promedio = (cuenta(mesAnterior(periodo, 1)) + cuenta(mesAnterior(periodo, 2))) / 2;
      const facturasMes = compras.filter((d) => d.tipo_doc === 33).length;
      let avisoCantidad = false;
      if (compras.length && promedio >= 4 && promedio - facturasMes >= 2 && facturasMes < promedio * 0.8) {
        avisoCantidad = true;
        avisos.push({ tono: "ambar", texto: `Faltan ${Math.round(promedio - facturasMes)} facturas de compra de ${nombreMes} en ${e.razon_social}: hay ${facturasMes} y el promedio de los meses anteriores es ${Math.round(promedio)}.` });
      }
      if (!avisoCantidad && r1.size && r2.size) {
        const faltan = [...r1].filter((r) => r2.has(r) && !actuales.has(r));
        if (faltan.length && compras.length) {
          const nombres = faltan.map((r) => misDocs.find((d) => d.rut_contraparte === r)?.razon_social ?? r);
          avisos.push({ tono: "ambar", texto: `Faltan ${faltan.length} facturas de compra de ${nombreMes} en ${e.razon_social}: no llegaron las de ${nombres.slice(0, 3).join(", ")}${nombres.length > 3 ? "…" : ""}, que facturan todos los meses.` });
        }
      }
      // IVA crédito inusual respecto del promedio de los dos meses anteriores.
      const iva = (p: Periodo) => misDocs.filter((d) => d.libro === "compras" && d.anio === p.anio && d.mes === p.mes).reduce((s, d) => s + (d.tipo_doc === 61 || d.tipo_doc === 60 ? -1 : 1) * Number(d.monto_iva), 0);
      const prom = (iva(mesAnterior(periodo, 1)) + iva(mesAnterior(periodo, 2))) / 2;
      const actual = iva(periodo);
      if (prom > 0 && actual > prom * 1.4) {
        avisos.push({ tono: "ambar", texto: `El IVA crédito de ${nombreMes} en ${e.razon_social} es ${Math.round((actual / prom - 1) * 100)}% mayor que el promedio de los dos meses anteriores: revisa.` });
      }
    }

    // --- Comprobantes y cierre ---
    const nComp = (comprobantes.data ?? []).filter((c) => c.empresa_id === e.id).length;
    const cerrado = (periodos.data ?? []).some((p) => p.empresa_id === e.id && p.estado === "cerrado");
    if (!m.contabilidad) {
      tareas.comprobantes = { estado: "na", detalle: "Sin acceso a contabilidad" };
      tareas.cierre = { estado: "na", detalle: "Sin acceso a contabilidad" };
    } else {
      tareas.comprobantes = nComp ? { estado: "listo", detalle: `${nComp} comprobantes, todos cuadrados`, href: "/contabilidad/comprobantes" } : { estado: "revisar", detalle: "Sin comprobantes este mes", href: "/contabilidad/comprobantes" };
      tareas.cierre = cerrado ? { estado: "listo", detalle: "Mes cerrado", href: "/contabilidad/cierre" } : { estado: nComp ? "revisar" : "na", detalle: "Mes abierto", href: "/contabilidad/cierre" };
    }

    // --- F29 ---
    const f = (f29s.data ?? []).find((x) => x.empresa_id === e.id);
    if (!m.impuestos) tareas.f29 = { estado: "na", detalle: "Sin acceso a impuestos" };
    else if (f?.estado === "pagado" || f?.estado === "declarado") tareas.f29 = { estado: "listo", detalle: "Declarado y pagado", href: "/impuestos/f29" };
    else if (pasado(vF29)) tareas.f29 = { estado: "atrasado", detalle: `Venció el ${vF29!.split("-").reverse().join("-")}`, href: "/impuestos/f29" };
    else tareas.f29 = { estado: "revisar", detalle: f ? (f.estado === "revisado" ? "Revisado, falta declarar" : "Calculado, falta revisar") : "Sin calcular", href: "/impuestos/f29" };
    if (m.impuestos && !(f?.estado === "pagado" || f?.estado === "declarado") && vF29 && pasado(vF29)) {
      avisos.push({ tono: "rojo", texto: `El F29 de ${nombreMes} de ${e.razon_social} venció el ${vF29.split("-").reverse().join("-")} y no está marcado como declarado.` });
    }

    // --- Remuneraciones, Previred y LRE (Fases 5 y 6) ---
    const nTrab = trabajadores.filter((t) => t.empresa_id === e.id).length;
    const misLiq = liqs.filter((l) => l.empresa_id === e.id);
    const misArch = (archivos.data ?? []).filter((a) => a.empresa_id === e.id);
    if (!m.remuneraciones) {
      for (const k of ["remuneraciones", "previred", "lre"]) tareas[k] = { estado: "na", detalle: "Sin acceso a remuneraciones" };
    } else if (!nTrab) {
      for (const k of ["remuneraciones", "previred", "lre"]) tareas[k] = { estado: "na", detalle: "Sin trabajadores" };
    } else {
      if (vPrev) vencimientos.push({ que: "Previred", fecha: vPrev });
      if (vLibro) vencimientos.push({ que: "LRE", fecha: vLibro });
      tareas.remuneraciones = misLiq.length >= nTrab
        ? { estado: "listo", detalle: `${misLiq.length} liquidaciones calculadas`, href: "/remuneraciones/liquidaciones" }
        : { estado: pasado(vPrev) ? "atrasado" : "revisar", detalle: `${misLiq.length} de ${nTrab} liquidaciones`, href: "/remuneraciones/liquidaciones" };
      tareas.previred = misArch.some((a) => a.tipo === "previred")
        ? { estado: "listo", detalle: "Archivo generado", href: "/remuneraciones/previred" }
        : { estado: pasado(vPrev) ? "atrasado" : "revisar", detalle: "Archivo no generado", href: "/remuneraciones/previred" };
      tareas.lre = misArch.some((a) => a.tipo === "lre")
        ? { estado: "listo", detalle: "Archivo generado", href: "/remuneraciones/lre" }
        : { estado: pasado(vLibro) ? "atrasado" : "revisar", detalle: "Archivo no generado", href: "/remuneraciones/lre" };
    }

    // --- Documentos pendientes del cliente (Fase 7) ---
    const pendientesBandeja = bandeja.filter((b) => b.empresa_id === e.id).length;
    const pendientesSolicitudes = solicitudes.filter((s) => s.empresa_id === e.id).length;
    if (!m.documentos) tareas.documentos = { estado: "na", detalle: "Sin acceso a documentos" };
    else if (pendientesSolicitudes) tareas.documentos = { estado: "atrasado", detalle: `${pendientesSolicitudes} solicitudes sin responder por el cliente`, href: "/documentos" };
    else if (pendientesBandeja) tareas.documentos = { estado: "revisar", detalle: `${pendientesBandeja} documentos por revisar en la bandeja`, href: "/documentos" };
    else tareas.documentos = { estado: "listo", detalle: "Sin pendientes", href: "/documentos" };

    return { empresaId: e.id, tareas, avisos, vencimientos };
  });
}
