import type { Metadata } from "next";
import { contextoContable } from "@/lib/contexto-contable";
import { esContador, NOMBRES_MES } from "@/lib/sesion";
import { formatoFecha } from "@/lib/formato";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { MesesCierre, type MesCierre } from "./MesesCierre";

export const metadata: Metadata = { title: "Cierre de periodo" };

export default async function Cierre() {
  const { ctx, empresa, supabase } = await contextoContable();
  const anio = ctx.periodo.anio;
  const [{ data: periodos }, { data: comprobantes }, { data: eventos }] = await Promise.all([
    supabase.from("periodos").select("id, mes, estado, cerrado_at").eq("empresa_id", empresa.id).eq("anio", anio),
    supabase.from("comprobantes").select("mes").eq("empresa_id", empresa.id).eq("anio", anio).eq("estado", "vigente"),
    supabase
      .from("periodo_eventos")
      .select("accion, motivo, created_at, created_by, periodos(anio, mes)")
      .eq("empresa_id", empresa.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const cantidad = new Map<number, number>();
  for (const c of comprobantes ?? []) cantidad.set(c.mes, (cantidad.get(c.mes) ?? 0) + 1);

  const meses: MesCierre[] = NOMBRES_MES.map((nombre, i) => {
    const p = (periodos ?? []).find((x) => x.mes === i + 1);
    return {
      mes: i + 1,
      nombre,
      cerrado: p?.estado === "cerrado",
      cerradoEl: p?.cerrado_at ? formatoFecha(new Date(p.cerrado_at)) : null,
      comprobantes: cantidad.get(i + 1) ?? 0,
    };
  });

  // Nombres de quienes cerraron o reabrieron (si el usuario puede verlos).
  const ids = [...new Set((eventos ?? []).map((e) => e.created_by).filter(Boolean))] as string[];
  const { data: usuarios } = ids.length ? await supabase.from("usuarios").select("id, nombre").in("id", ids) : { data: [] };
  const nombre = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  return (
    <Pagina>
      <Encabezado
        titulo={`Cierre de periodo ${anio}`}
        descripcion={`${empresa.razon_social}. Un mes cerrado no admite comprobantes nuevos, cambios ni anulaciones. Reabrirlo exige un motivo, que queda registrado.`}
      />
      <MesesCierre anio={anio} meses={meses} mesActual={ctx.periodo.mes} puedeCerrar={esContador(ctx)} />

      <h2 className="mt-6 mb-2 text-base font-bold text-azul">Historial de cierres y reaperturas</h2>
      <div className="max-w-4xl overflow-hidden rounded-lg border border-borde bg-white">
        <table className="w-full text-sm">
          <thead className="bg-fondo-suave text-xs text-texto-suave">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Periodo</th>
              <th className="px-3 py-2 text-left font-semibold">Acción</th>
              <th className="px-3 py-2 text-left font-semibold">Por</th>
              <th className="px-3 py-2 text-left font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(eventos ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-texto-suave">Aún no hay cierres registrados desde RH Software.</td></tr>
            )}
            {(eventos ?? []).map((e, i) => {
              const p = e.periodos as unknown as { anio: number; mes: number } | null;
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="numeros px-3 py-1.5">{formatoFecha(new Date(e.created_at))}</td>
                  <td className="px-3 py-1.5">{p ? `${NOMBRES_MES[p.mes - 1]} ${p.anio}` : ""}</td>
                  <td className={`px-3 py-1.5 font-medium ${e.accion === "reabrir" ? "text-ambar" : "text-verde"}`}>{e.accion === "reabrir" ? "Reabrió" : "Cerró"}</td>
                  <td className="px-3 py-1.5">{(e.created_by && nombre.get(e.created_by)) ?? ""}</td>
                  <td className="px-3 py-1.5 text-texto-suave">{e.motivo ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Pagina>
  );
}
