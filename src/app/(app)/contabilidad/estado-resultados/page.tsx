import type { Metadata } from "next";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { nombrePeriodo, rangoPeriodo } from "@/lib/sesion";
import { estadoResultados, type Sumas } from "@/lib/contabilidad";
import { formatoPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { BotonExcel } from "@/components/ui/BotonExcel";

export const metadata: Metadata = { title: "Estado de resultados" };

export default async function EstadoResultados() {
  const { ctx, empresa, supabase } = await contextoContable();
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const [cuentas, mes, acumulado] = await Promise.all([
    cargarCuentas(supabase, empresa.id),
    supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: desde, p_hasta: hasta }),
    supabase.rpc("sumas_por_cuenta", { p_empresa: empresa.id, p_desde: `${ctx.periodo.anio}-01-01`, p_hasta: hasta }),
  ]);
  const eMes = estadoResultados(cuentas, (mes.data ?? []) as Sumas[]);
  const eAcum = estadoResultados(cuentas, (acumulado.data ?? []) as Sumas[]);
  const montoMes = new Map(eMes.lineas.map((l) => [l.codigo, l.monto]));
  // Las filas salen del acumulado (incluye todo lo del mes).
  const lineas = eAcum.lineas.filter((l) => l.nivel <= 4);
  const mostrar = (n: number | undefined) => (n ? formatoPesos(n) : "");

  return (
    <Pagina>
      <Encabezado titulo="Estado de resultados" descripcion={`${empresa.razon_social} · RUT ${formatearRut(empresa.rut)} · ${nombrePeriodo(ctx.periodo)}`}>
        <BotonExcel
          nombreArchivo={`estado-resultados-${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`}
          titulo={`Estado de resultados · ${empresa.razon_social} · ${nombrePeriodo(ctx.periodo)}`}
          columnas={[{ titulo: "Código", ancho: 13 }, { titulo: "Concepto", ancho: 44 }, { titulo: nombrePeriodo(ctx.periodo), tipo: "monto" }, { titulo: `Acumulado ${ctx.periodo.anio}`, tipo: "monto" }]}
          filas={lineas.map((l) => [l.codigo, `${"  ".repeat(l.nivel - 1)}${l.nombre}`, montoMes.get(l.codigo) ?? null, l.monto])}
          totales={["", eAcum.resultado >= 0 ? "Utilidad" : "Pérdida", eMes.resultado, eAcum.resultado]}
        />
      </Encabezado>
      {lineas.length === 0 ? (
        <Vacio titulo="Sin ingresos ni gastos registrados en el año" />
      ) : (
        <div className="max-w-4xl overflow-hidden rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="w-28 px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                <th className="w-40 px-3 py-2 text-right font-semibold">{nombrePeriodo(ctx.periodo)}</th>
                <th className="w-40 px-3 py-2 text-right font-semibold">Acumulado {ctx.periodo.anio}</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.codigo} className={`border-t border-gray-100 ${l.nivel === 1 ? "bg-celeste/40 font-bold" : l.esGrupo ? "font-semibold" : ""}`}>
                  <td className="numeros px-3 py-1.5 text-texto-suave">{l.codigo}</td>
                  <td className="px-3 py-1.5" style={{ paddingLeft: `${12 + (l.nivel - 1) * 16}px` }}>{l.nombre}</td>
                  <td className={`numeros px-3 py-1.5 text-right ${(montoMes.get(l.codigo) ?? 0) < 0 ? "text-texto-suave" : ""}`}>{mostrar(montoMes.get(l.codigo))}</td>
                  <td className={`numeros px-3 py-1.5 text-right ${l.monto < 0 ? "text-texto-suave" : ""}`}>{mostrar(l.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-texto">
              <tr className={`font-bold ${eAcum.resultado >= 0 ? "text-verde" : "text-rojo"}`}>
                <td />
                <td className="px-3 py-2">{eAcum.resultado >= 0 ? "Utilidad del periodo" : "Pérdida del periodo"}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(eMes.resultado)}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(eAcum.resultado)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="border-t border-borde px-3 py-2 text-xs text-texto-suave">Ingresos en positivo; costos y gastos en negativo. Resultado antes de los ajustes de cierre anual.</p>
        </div>
      )}
    </Pagina>
  );
}
