import type { Metadata } from "next";
import Link from "next/link";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { libroMayor, type Sumas } from "@/lib/contabilidad";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { TablaDatos } from "@/components/ui/TablaDatos";
import { BotonExcel } from "@/components/ui/BotonExcel";
import { SelectorCuenta } from "./SelectorCuenta";

export const metadata: Metadata = { title: "Libro mayor" };

/** Día anterior a una fecha AAAA-MM-DD. */
function diaAnterior(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function LibroMayor({ searchParams }: PageProps<"/contabilidad/libro-mayor">) {
  const { cuenta: cuentaId } = await searchParams;
  const { ctx, empresa, supabase } = await contextoContable();
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const inicioAnio = `${ctx.periodo.anio}-01-01`;
  const cuentas = await cargarCuentas(supabase, empresa.id);
  const imputables = cuentas.filter((c) => c.imputable);
  const elegida = typeof cuentaId === "string" ? cuentas.find((c) => c.id === cuentaId) : undefined;

  // Saldo anterior: movimientos del año antes del periodo.
  const anteriores: Sumas[] =
    desde > inicioAnio
      ? ((await supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: inicioAnio, p_hasta: diaAnterior(desde) })).data ?? [])
      : [];
  const saldoAnteriorDe = (id: string) => {
    const s = anteriores.find((x) => x.cuenta_id === id);
    return s ? Number(s.debe) - Number(s.haber) : 0;
  };

  if (!elegida) {
    // Resumen: todas las cuentas con saldo o movimiento en el periodo.
    const { data: delPeriodo } = await supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: desde, p_hasta: hasta });
    const mov = new Map(((delPeriodo ?? []) as Sumas[]).map((s) => [s.cuenta_id, s]));
    const filas = imputables
      .map((c) => {
        const anterior = saldoAnteriorDe(c.id);
        const m = mov.get(c.id);
        const debe = Number(m?.debe ?? 0);
        const haber = Number(m?.haber ?? 0);
        return { codigo: c.codigo, nombre: c.nombre, enlace: `/contabilidad/libro-mayor?cuenta=${c.id}`, anterior, debe, haber, saldo: anterior + debe - haber };
      })
      .filter((f) => f.anterior !== 0 || f.debe !== 0 || f.haber !== 0);

    return (
      <Pagina>
        <Encabezado titulo="Libro mayor" descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)} · saldos acumulados desde el 01-01-${ctx.periodo.anio}`}>
          <SelectorCuenta cuentas={imputables.map(({ id, codigo, nombre }) => ({ id, codigo, nombre }))} />
        </Encabezado>
        <p className="mb-3 text-sm text-texto-suave">Elige una cuenta para ver su detalle. Saldo positivo = deudor; negativo = acreedor.</p>
        <TablaDatos
          nombreArchivo={`mayor-resumen-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
          tituloExcel={`Libro mayor (resumen) · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
          columnas={[
            { clave: "codigo", titulo: "Código", enlace: "enlace", ancho: "120px" },
            { clave: "nombre", titulo: "Cuenta", enlace: "enlace" },
            { clave: "anterior", titulo: "Saldo anterior", tipo: "monto", total: true },
            { clave: "debe", titulo: "Debe", tipo: "monto", total: true, ocultarCero: true },
            { clave: "haber", titulo: "Haber", tipo: "monto", total: true, ocultarCero: true },
            { clave: "saldo", titulo: "Saldo", tipo: "monto", total: true },
          ]}
          filas={filas}
          vacio="Sin movimientos."
        />
      </Pagina>
    );
  }

  const { data: lineas } = await supabase
    .from("lineas_comprobante")
    .select("debe, haber, glosa, comprobantes!inner(id, numero, tipo, fecha, glosa, estado)")
    .eq("cuenta_id", elegida.id)
    .eq("comprobantes.estado", "vigente")
    .gte("comprobantes.fecha", desde)
    .lte("comprobantes.fecha", hasta);
  type Fila = { debe: number; haber: number; glosa: string | null; comprobantes: { id: string; numero: number; tipo: string; fecha: string; glosa: string } };
  const mayor = libroMayor(
    saldoAnteriorDe(elegida.id),
    ((lineas ?? []) as unknown as Fila[]).map((l) => ({
      fecha: l.comprobantes.fecha, numero: l.comprobantes.numero, tipo: l.comprobantes.tipo, comprobante_id: l.comprobantes.id,
      glosa: l.glosa ?? l.comprobantes.glosa, debe: l.debe, haber: l.haber,
    })),
  );
  const fecha = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));

  return (
    <Pagina>
      <Encabezado titulo={`Mayor: ${elegida.codigo} ${elegida.nombre}`} descripcion={`${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}>
        <Link href="/contabilidad/libro-mayor" className="text-sm text-azul hover:underline">Ver todas las cuentas</Link>
        <SelectorCuenta cuentas={imputables.map(({ id, codigo, nombre }) => ({ id, codigo, nombre }))} actual={elegida.id} />
        <BotonExcel
          nombreArchivo={`mayor-${elegida.codigo}-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
          titulo={`Libro mayor ${elegida.codigo} ${elegida.nombre} · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
          columnas={[{ titulo: "Fecha", tipo: "fecha" }, { titulo: "N°", tipo: "numero", ancho: 7 }, { titulo: "Glosa", ancho: 44 }, { titulo: "Debe", tipo: "monto" }, { titulo: "Haber", tipo: "monto" }, { titulo: "Saldo", tipo: "monto" }]}
          filas={[["", null, "Saldo anterior", null, null, mayor.saldoAnterior], ...mayor.filas.map((f) => [fecha(f.fecha), f.numero, f.glosa, f.debe || null, f.haber || null, f.saldo])]}
          totales={["Totales", null, null, mayor.totalDebe, mayor.totalHaber, mayor.saldoFinal]}
        />
      </Encabezado>
      {mayor.filas.length === 0 && mayor.saldoAnterior === 0 ? (
        <Vacio titulo="Esta cuenta no tiene movimientos en el periodo" />
      ) : (
        <div className="overflow-auto rounded-lg border border-borde bg-white" style={{ maxHeight: "calc(100vh - 230px)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="w-28 px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="w-16 px-3 py-2 text-right font-semibold">N°</th>
                <th className="px-3 py-2 text-left font-semibold">Glosa</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Debe</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Haber</th>
                <th className="w-40 px-3 py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-fondo-suave/60 italic">
                <td className="px-3 py-1.5" colSpan={5}>Saldo anterior al {fecha(desde)}</td>
                <td className="numeros px-3 py-1.5 text-right">{formatoPesos(mayor.saldoAnterior)}</td>
              </tr>
              {mayor.filas.map((f, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-celeste/40">
                  <td className="numeros px-3 py-1.5">{fecha(f.fecha)}</td>
                  <td className="numeros px-3 py-1.5 text-right"><Link href={`/contabilidad/comprobantes/${f.comprobante_id}`} className="text-azul hover:underline">{f.numero}</Link></td>
                  <td className="px-3 py-1.5">{f.glosa}</td>
                  <td className="numeros px-3 py-1.5 text-right">{f.debe ? formatoPesos(f.debe) : ""}</td>
                  <td className="numeros px-3 py-1.5 text-right">{f.haber ? formatoPesos(f.haber) : ""}</td>
                  <td className={`numeros px-3 py-1.5 text-right ${f.saldo < 0 ? "text-rojo" : ""}`}>{formatoPesos(f.saldo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white font-semibold shadow-[0_-1px_0_#e5e7eb]">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-texto-suave">Totales y saldo final</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(mayor.totalDebe)}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(mayor.totalHaber)}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(mayor.saldoFinal)} {mayor.saldoFinal >= 0 ? "D" : "A"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Pagina>
  );
}
