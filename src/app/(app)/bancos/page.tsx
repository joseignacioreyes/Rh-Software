import type { Metadata } from "next";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { sugerirPareos, type LineaBanco, type MovimientoBanco } from "@/lib/conciliacion";
import { formatoPesos } from "@/lib/formato";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { CuentasBancarias } from "./CuentasBancarias";
import { ImportarCartola } from "./ImportarCartola";
import { Conciliacion, type FilaConciliacion } from "./Conciliacion";

export const metadata: Metadata = { title: "Bancos y conciliación" };

export default async function Bancos({ searchParams }: PageProps<"/bancos">) {
  const { cuenta: cuentaParam } = await searchParams;
  const { ctx, empresa, puedeEditar, supabase } = await contextoContable();
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const [{ data: cuentasBanco }, plan] = await Promise.all([
    supabase.from("cuentas_bancarias").select("id, banco, numero, cuenta_contable_id").eq("empresa_id", empresa.id).eq("activa", true).order("banco"),
    cargarCuentas(supabase, empresa.id),
  ]);
  const lista = cuentasBanco ?? [];
  const actual = lista.find((c) => c.id === cuentaParam) ?? lista[0];
  const opcionesCuenta = plan.filter((c) => c.imputable && c.activa && c.codigo.startsWith("1.1.01")).map((c) => ({ id: c.id, nombre: `${c.codigo} ${c.nombre}` }));

  let filas: FilaConciliacion[] = [];
  let resumen = { movimientos: 0, conciliados: 0, saldoCartola: null as number | null, saldoContable: 0, pendientesContables: 0 };
  let lineasLibres: { id: string; texto: string; monto: number }[] = [];

  if (actual) {
    const [{ data: movs }, { data: lineas }, { data: conc }, { data: cartola }] = await Promise.all([
      supabase.from("movimientos_bancarios").select("id, fecha, descripcion, documento, monto").eq("cuenta_bancaria_id", actual.id).gte("fecha", desde).lte("fecha", hasta).order("fecha"),
      actual.cuenta_contable_id
        ? supabase.from("lineas_comprobante").select("id, debe, haber, glosa, comprobantes!inner(numero, fecha, glosa, estado)").eq("cuenta_id", actual.cuenta_contable_id).eq("comprobantes.estado", "vigente").gte("comprobantes.fecha", desde).lte("comprobantes.fecha", hasta)
        : Promise.resolve({ data: [] }),
      supabase.from("conciliaciones").select("movimiento_id, linea_id, tipo, nota, automatica").eq("empresa_id", empresa.id),
      supabase.from("cartolas").select("saldo_final").eq("cuenta_bancaria_id", actual.id).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes).order("created_at", { ascending: false }).limit(1),
    ]);
    type L = { id: string; debe: number; haber: number; glosa: string | null; comprobantes: { numero: number; fecha: string; glosa: string } };
    const ls: LineaBanco[] = ((lineas ?? []) as unknown as L[]).map((l) => ({ id: l.id, fecha: l.comprobantes.fecha, debe: l.debe, haber: l.haber, glosa: l.glosa ?? l.comprobantes.glosa, numero: l.comprobantes.numero }));
    const porMov = new Map((conc ?? []).map((c) => [c.movimiento_id, c]));
    const lineasUsadas = new Set((conc ?? []).map((c) => c.linea_id).filter(Boolean));
    const pendientes = ((movs ?? []) as MovimientoBanco[]).filter((m) => !porMov.has(m.id));
    const libres = ls.filter((l) => !lineasUsadas.has(l.id));
    const sugerencias = sugerirPareos(pendientes, libres);
    const lineaPorId = new Map(ls.map((l) => [l.id, l]));
    const textoLinea = (l: LineaBanco) => `N° ${l.numero} · ${l.fecha.slice(8, 10)}-${l.fecha.slice(5, 7)} · ${l.glosa}`;

    filas = ((movs ?? []) as MovimientoBanco[]).map((m) => {
      const c = porMov.get(m.id);
      const sug = sugerencias.get(m.id);
      return {
        id: m.id, fecha: m.fecha, descripcion: m.descripcion, documento: m.documento, monto: m.monto,
        estado: c ? (c.tipo === "diferencia" ? "diferencia" : "conciliado") : sug ? "sugerido" : "pendiente",
        detalle: c ? (c.tipo === "diferencia" ? c.nota ?? "" : c.linea_id && lineaPorId.get(c.linea_id) ? textoLinea(lineaPorId.get(c.linea_id)!) : "") : sug ? textoLinea(lineaPorId.get(sug)!) : "",
        sugerencia: sug ?? null,
        automatica: !!c?.automatica,
      };
    });
    lineasLibres = libres.map((l) => ({ id: l.id, texto: textoLinea(l), monto: l.debe - l.haber }));
    resumen = {
      movimientos: filas.length,
      conciliados: filas.filter((f) => f.estado === "conciliado" || f.estado === "diferencia").length,
      saldoCartola: cartola?.[0]?.saldo_final ?? null,
      saldoContable: ls.reduce((s, l) => s + l.debe - l.haber, 0),
      pendientesContables: libres.length,
    };
  }

  return (
    <Pagina>
      <Encabezado titulo="Bancos y conciliación" descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`} />
      <CuentasBancarias
        cuentas={lista.map((c) => ({ id: c.id, nombre: `${c.banco} ${c.numero}` }))}
        actual={actual?.id ?? null}
        opcionesCuenta={opcionesCuenta}
        puedeEditar={puedeEditar}
      />
      {!actual ? (
        <Vacio titulo="Agrega la cuenta bancaria de la empresa">Luego importa la cartola en Excel o CSV y la conciliamos con la contabilidad.</Vacio>
      ) : (
        <>
          {puedeEditar && <ImportarCartola cuentaId={actual.id} />}
          <div className="my-4 grid grid-cols-4 gap-3">
            {[
              ["Movimientos de la cartola", resumen.movimientos.toLocaleString("es-CL")],
              ["Conciliados", `${resumen.conciliados} de ${resumen.movimientos}`],
              ["Movimiento contable del mes", formatoPesos(resumen.saldoContable)],
              ["Asientos sin pareo en el banco", resumen.pendientesContables.toLocaleString("es-CL")],
            ].map(([t, v]) => (
              <div key={t} className="rounded-lg border border-borde bg-white px-4 py-3">
                <p className="text-xs text-texto-suave">{t}</p>
                <p className="numeros text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>
          {!actual.cuenta_contable_id && <p className="mb-3 text-sm text-ambar">Esta cuenta bancaria no tiene cuenta contable asociada: no se pueden sugerir pareos.</p>}
          <Conciliacion filas={filas} lineasLibres={lineasLibres} puedeEditar={puedeEditar} />
        </>
      )}
    </Pagina>
  );
}
