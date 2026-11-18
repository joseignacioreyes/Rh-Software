import type { Metadata } from "next";
import Link from "next/link";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { BotonExcel } from "@/components/ui/BotonExcel";

export const metadata: Metadata = { title: "Libro diario" };

const TIPO: Record<string, string> = { ingreso: "Ingreso", egreso: "Egreso", traspaso: "Traspaso", apertura: "Apertura" };

export default async function LibroDiario() {
  const { ctx, empresa, supabase } = await contextoContable();
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const [{ data: comprobantes }, cuentas] = await Promise.all([
    supabase
      .from("comprobantes")
      .select("id, numero, tipo, fecha, glosa, lineas_comprobante(orden, cuenta_id, glosa, debe, haber)")
      .eq("empresa_id", empresa.id)
      .eq("estado", "vigente")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero"),
    cargarCuentas(supabase, empresa.id),
  ]);
  const cuenta = new Map(cuentas.map((c) => [c.id, c]));
  const fecha = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));

  type Lin = { orden: number; cuenta_id: string; glosa: string | null; debe: number; haber: number };
  const lista = (comprobantes ?? []).map((c) => ({
    ...c,
    lineas: ((c.lineas_comprobante ?? []) as Lin[]).sort((a, b) => a.orden - b.orden),
  }));
  const totalDebe = lista.reduce((s, c) => s + c.lineas.reduce((t, l) => t + l.debe, 0), 0);
  const totalHaber = lista.reduce((s, c) => s + c.lineas.reduce((t, l) => t + l.haber, 0), 0);

  const filasExcel = lista.flatMap((c) =>
    c.lineas.map((l) => [fecha(c.fecha), c.numero, TIPO[c.tipo], cuenta.get(l.cuenta_id)?.codigo ?? "", cuenta.get(l.cuenta_id)?.nombre ?? "", l.glosa ?? c.glosa, l.debe || null, l.haber || null]),
  );

  return (
    <Pagina>
      <Encabezado titulo="Libro diario" descripcion={`${empresa.razon_social} · RUT ${formatearRut(empresa.rut)} · ${nombrePeriodo(ctx.periodo)}`}>
        <BotonExcel
          nombreArchivo={`libro-diario-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
          titulo={`Libro diario · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
          columnas={[
            { titulo: "Fecha", tipo: "fecha" }, { titulo: "N°", tipo: "numero", ancho: 7 }, { titulo: "Tipo", ancho: 11 },
            { titulo: "Código", ancho: 13 }, { titulo: "Cuenta", ancho: 34 }, { titulo: "Glosa", ancho: 40 },
            { titulo: "Debe", tipo: "monto" }, { titulo: "Haber", tipo: "monto" },
          ]}
          filas={filasExcel}
          totales={["Totales", null, null, null, null, null, totalDebe, totalHaber]}
        />
      </Encabezado>

      {lista.length === 0 ? (
        <Vacio titulo={`Sin comprobantes en ${nombrePeriodo(ctx.periodo).toLowerCase()}`} />
      ) : (
        <div className="overflow-auto rounded-lg border border-borde bg-white" style={{ maxHeight: "calc(100vh - 230px)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="w-28 px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
                <th className="px-3 py-2 text-left font-semibold">Glosa</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Debe</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Haber</th>
              </tr>
            </thead>
            {lista.map((c) => (
              <tbody key={c.id} className="border-t-2 border-borde">
                <tr className="bg-celeste/40">
                  <td colSpan={5} className="px-3 py-1.5 text-xs">
                    <Link href={`/contabilidad/comprobantes/${c.id}`} className="font-semibold text-azul hover:underline">
                      N° {c.numero} · {TIPO[c.tipo]}
                    </Link>
                    <span className="numeros ml-3 text-texto-suave">{fecha(c.fecha)}</span>
                    <span className="ml-3 text-texto">{c.glosa}</span>
                  </td>
                </tr>
                {c.lineas.map((l) => (
                  <tr key={l.orden} className="border-t border-gray-100">
                    <td className="numeros px-3 py-1">{cuenta.get(l.cuenta_id)?.codigo}</td>
                    <td className={`px-3 py-1 ${l.haber ? "pl-10" : ""}`}>{cuenta.get(l.cuenta_id)?.nombre}</td>
                    <td className="px-3 py-1 text-texto-suave">{l.glosa ?? ""}</td>
                    <td className="numeros px-3 py-1 text-right">{l.debe ? formatoPesos(l.debe) : ""}</td>
                    <td className="numeros px-3 py-1 text-right">{l.haber ? formatoPesos(l.haber) : ""}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot className="sticky bottom-0 bg-white font-semibold shadow-[0_-1px_0_#e5e7eb]">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-texto-suave">Totales del periodo ({lista.length} comprobantes)</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(totalDebe)}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(totalHaber)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Pagina>
  );
}
