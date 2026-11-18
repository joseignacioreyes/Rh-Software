import type { Metadata } from "next";
import Link from "next/link";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { balanceOchoColumnas, type Sumas } from "@/lib/contabilidad";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Etiqueta, Pagina, Vacio } from "@/components/ui/Encabezado";
import { BotonExcel } from "@/components/ui/BotonExcel";

export const metadata: Metadata = { title: "Balance de 8 columnas" };

const COLS = [
  ["debitos", "Débitos"], ["creditos", "Créditos"], ["deudor", "Deudor"], ["acreedor", "Acreedor"],
  ["activo", "Activo"], ["pasivo", "Pasivo"], ["perdidas", "Pérdidas"], ["ganancias", "Ganancias"],
] as const;

export default async function Balance({ searchParams }: PageProps<"/contabilidad/balance">) {
  const { alcance } = await searchParams;
  const soloMes = alcance === "mes";
  const { ctx, empresa, supabase } = await contextoContable();
  const { desde: inicioMes, hasta } = rangoPeriodo(ctx.periodo);
  const desde = soloMes ? inicioMes : `${ctx.periodo.anio}-01-01`;
  const [cuentas, { data: sumas }] = await Promise.all([
    cargarCuentas(supabase, empresa.id),
    supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: desde, p_hasta: hasta }),
  ]);
  const b = balanceOchoColumnas(cuentas, (sumas ?? []) as Sumas[]);
  const fecha = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));
  const valor = (n: number) => (n ? formatoPesos(n) : "");
  const titulo = `Balance de 8 columnas · ${empresa.razon_social} · del ${fecha(desde)} al ${fecha(hasta)}`;

  return (
    <Pagina>
      <Encabezado
        titulo="Balance de 8 columnas"
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {empresa.razon_social} · RUT {formatearRut(empresa.rut)} · del <span className="numeros">{fecha(desde)}</span> al <span className="numeros">{fecha(hasta)}</span>
            {b.filas.length > 0 && (b.cuadra ? <Etiqueta tono="verde">Cuadra</Etiqueta> : <Etiqueta tono="rojo">No cuadra</Etiqueta>)}
          </span>
        }
      >
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          <Link href="/contabilidad/balance" className={`px-3 py-2 ${!soloMes ? "bg-azul text-white" : "bg-white hover:bg-fondo-suave"}`}>Acumulado del año</Link>
          <Link href="/contabilidad/balance?alcance=mes" className={`px-3 py-2 ${soloMes ? "bg-azul text-white" : "bg-white hover:bg-fondo-suave"}`}>Solo {nombrePeriodo(ctx.periodo).toLowerCase()}</Link>
        </div>
        <BotonExcel
          nombreArchivo={`balance-8-columnas-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
          titulo={titulo}
          columnas={[{ titulo: "Código", ancho: 13 }, { titulo: "Cuenta", ancho: 36 }, ...COLS.map(([, t]) => ({ titulo: t, tipo: "monto" as const }))]}
          filas={[
            ...b.filas.map((f) => [f.codigo, f.nombre, ...COLS.map(([k]) => f[k] || null)]),
            ["", "Sumas", ...COLS.map(([k]) => b.sumas[k])],
            ["", b.resultado >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio", null, null, null, null,
              b.resultado < 0 ? -b.resultado : null, b.resultado > 0 ? b.resultado : null, b.resultado > 0 ? b.resultado : null, b.resultado < 0 ? -b.resultado : null],
          ]}
          totales={["", "Totales", ...COLS.map(([k]) => b.totales[k])]}
        />
      </Encabezado>

      {b.filas.length === 0 ? (
        <Vacio titulo="Sin movimientos en el rango" />
      ) : (
        <div className="overflow-auto rounded-lg border border-borde bg-white" style={{ maxHeight: "calc(100vh - 220px)" }}>
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th rowSpan={2} className="w-24 border-b border-borde px-2 py-1.5 text-left font-semibold">Código</th>
                <th rowSpan={2} className="border-b border-borde px-2 py-1.5 text-left font-semibold">Cuenta</th>
                <th colSpan={2} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Sumas</th>
                <th colSpan={2} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Saldos</th>
                <th colSpan={2} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Inventario</th>
                <th colSpan={2} className="border-l border-borde px-2 pt-1.5 text-center font-semibold">Resultados</th>
              </tr>
              <tr>
                {COLS.map(([k, t], i) => (
                  <th key={k} className={`border-b border-borde px-2 py-1.5 text-right font-semibold ${i % 2 === 0 ? "border-l" : ""}`}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.filas.map((f) => (
                <tr key={f.cuenta_id} className="border-t border-gray-100 hover:bg-celeste/40">
                  <td className="numeros px-2 py-1">{f.codigo}</td>
                  <td className="px-2 py-1"><Link href={`/contabilidad/libro-mayor?cuenta=${f.cuenta_id}`} className="hover:text-azul hover:underline">{f.nombre}</Link></td>
                  {COLS.map(([k], i) => (
                    <td key={k} className={`numeros px-2 py-1 text-right whitespace-nowrap ${i % 2 === 0 ? "border-l border-gray-100" : ""}`}>{valor(f[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white text-[13px] shadow-[0_-1px_0_#e5e7eb]">
              <tr className="font-semibold">
                <td />
                <td className="px-2 py-1.5">Sumas</td>
                {COLS.map(([k]) => <td key={k} className="numeros px-2 py-1.5 text-right whitespace-nowrap">{formatoPesos(b.sumas[k])}</td>)}
              </tr>
              <tr className={b.resultado >= 0 ? "text-verde" : "text-rojo"}>
                <td />
                <td className="px-2 py-1.5 font-semibold">{b.resultado >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}</td>
                <td colSpan={4} />
                <td className="numeros px-2 py-1.5 text-right">{b.resultado < 0 ? formatoPesos(-b.resultado) : ""}</td>
                <td className="numeros px-2 py-1.5 text-right">{b.resultado > 0 ? formatoPesos(b.resultado) : ""}</td>
                <td className="numeros px-2 py-1.5 text-right">{b.resultado > 0 ? formatoPesos(b.resultado) : ""}</td>
                <td className="numeros px-2 py-1.5 text-right">{b.resultado < 0 ? formatoPesos(-b.resultado) : ""}</td>
              </tr>
              <tr className="border-t-2 border-texto font-bold">
                <td />
                <td className="px-2 py-1.5">Totales</td>
                {COLS.map(([k]) => <td key={k} className="numeros px-2 py-1.5 text-right whitespace-nowrap">{formatoPesos(b.totales[k])}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Pagina>
  );
}
