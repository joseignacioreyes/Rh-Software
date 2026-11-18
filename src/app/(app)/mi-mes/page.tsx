import type { Metadata } from "next";
import Link from "next/link";
import { obtenerContexto, nombrePeriodo, permiso, rangoPeriodo } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatearRut } from "@/lib/rut";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";

export const metadata: Metadata = { title: "Mi mes" };

type Estado = "listo" | "revisar" | "atrasado" | "pronto" | "na";

const ESTILO: Record<Estado, { punto: string; texto: string }> = {
  listo: { punto: "bg-verde", texto: "Al día" },
  revisar: { punto: "bg-ambar", texto: "Revisar" },
  atrasado: { punto: "bg-rojo", texto: "Atrasado" },
  pronto: { punto: "bg-gray-200", texto: "Disponible en una próxima fase" },
  na: { punto: "bg-gray-200", texto: "No aplica" },
};

// Tareas del mes. Las que aún no existen se muestran en gris con la fase en que llegan.
const TAREAS = [
  { clave: "libros", titulo: "Libros importados", fase: 3 },
  { clave: "comprobantes", titulo: "Comprobantes", fase: 2 },
  { clave: "f29", titulo: "F29", fase: 4 },
  { clave: "remuneraciones", titulo: "Remuneraciones", fase: 5 },
  { clave: "previred", titulo: "Previred", fase: 6 },
  { clave: "lre", titulo: "LRE", fase: 6 },
  { clave: "documentos", titulo: "Documentos del cliente", fase: 7 },
  { clave: "cierre", titulo: "Cierre del mes", fase: 2 },
] as const;

export default async function MiMes() {
  const ctx = await obtenerContexto();
  const supabase = await clienteServidor();
  const empresas = ctx.empresas.filter((e) => e.activa);
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const clavePeriodo = `${ctx.periodo.anio}-${String(ctx.periodo.mes).padStart(2, "0")}`;
  const ids = empresas.map((e) => e.id);

  // Comprobantes vigentes del periodo y estado del periodo, por empresa (RLS filtra lo que no se puede ver).
  const [{ data: comprobantes }, { data: periodos }] = await Promise.all([
    supabase.from("comprobantes").select("empresa_id").in("empresa_id", ids).eq("estado", "vigente").gte("fecha", desde).lte("fecha", hasta),
    supabase.from("periodos").select("empresa_id, estado").in("empresa_id", ids).eq("anio", ctx.periodo.anio).eq("mes", ctx.periodo.mes),
  ]);
  const cantidad = new Map<string, number>();
  for (const c of comprobantes ?? []) cantidad.set(c.empresa_id, (cantidad.get(c.empresa_id) ?? 0) + 1);
  const cerrado = new Set((periodos ?? []).filter((p) => p.estado === "cerrado").map((p) => p.empresa_id));

  const filas = empresas.map((e) => {
    const verConta = permiso(ctx, e.id, "contabilidad").ver;
    const n = cantidad.get(e.id) ?? 0;
    const estados: Record<string, { estado: Estado; detalle: string; href?: string }> = {};
    for (const t of TAREAS) estados[t.clave] = { estado: "pronto", detalle: `Llega en la Fase ${t.fase}` };
    if (verConta) {
      estados.comprobantes = n > 0
        ? { estado: "listo", detalle: `${n} comprobantes, todos cuadrados`, href: "/contabilidad/comprobantes" }
        : { estado: "revisar", detalle: "Sin comprobantes este mes", href: "/contabilidad/comprobantes" };
      estados.cierre = cerrado.has(e.id)
        ? { estado: "listo", detalle: "Mes cerrado", href: "/contabilidad/cierre" }
        : { estado: n > 0 ? "revisar" : "na", detalle: "Mes abierto", href: "/contabilidad/cierre" };
    } else {
      estados.comprobantes = { estado: "na", detalle: "Sin acceso a contabilidad" };
      estados.cierre = { estado: "na", detalle: "Sin acceso a contabilidad" };
    }
    return { empresa: e, estados, n };
  });

  const sinMovimiento = filas.filter((f) => permiso(ctx, f.empresa.id, "contabilidad").ver && f.n === 0);
  const abiertas = filas.filter((f) => permiso(ctx, f.empresa.id, "contabilidad").ver && f.n > 0 && !cerrado.has(f.empresa.id));

  return (
    <Pagina>
      <Encabezado
        titulo={`Mi mes · ${nombrePeriodo(ctx.periodo)}`}
        descripcion="Todas tus empresas y el estado de cada tarea del mes. Haz clic en un punto para ir directo a la tarea."
      />

      {/* Avisos útiles */}
      {(sinMovimiento.length > 0 || abiertas.length > 0) && (
        <ul className="mb-4 space-y-1.5">
          {sinMovimiento.map((f) => (
            <li key={f.empresa.id} className="rounded-md border border-ambar/30 bg-amber-50 px-3 py-2 text-sm text-texto">
              <strong className="text-ambar">Revisar:</strong> {f.empresa.razon_social} no tiene comprobantes en {nombrePeriodo(ctx.periodo).toLowerCase()}.
            </li>
          ))}
          {abiertas.length > 0 && (
            <li className="rounded-md border border-borde bg-white px-3 py-2 text-sm text-texto-suave">
              {abiertas.length === 1 ? "1 empresa tiene" : `${abiertas.length} empresas tienen`} el mes abierto con movimientos:{" "}
              {abiertas.map((f) => f.empresa.razon_social).join(", ")}. Ciérralo cuando esté revisado.
            </li>
          )}
        </ul>
      )}

      {filas.length === 0 ? (
        <Vacio titulo="No tienes empresas asignadas">
          {ctx.rolEstudio === "contador" ? <Link href="/empresas/nueva" className="text-azul underline">Crea la primera empresa</Link> : "Pide a tu contador que te asigne empresas."}
        </Vacio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">Empresa</th>
                {TAREAS.map((t) => (
                  <th key={t.clave} scope="col" className="px-2 py-2.5 text-center font-semibold">{t.titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ empresa, estados }) => (
                <tr key={empresa.id} className={`border-t border-borde ${ctx.empresa?.id === empresa.id ? "bg-celeste/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/ir?empresa=${empresa.id}&a=/empresas/${empresa.id}`} className="font-medium text-texto hover:text-azul hover:underline">
                      {empresa.razon_social}
                    </Link>
                    <div className="numeros text-xs text-texto-suave">{formatearRut(empresa.rut)}</div>
                  </td>
                  {TAREAS.map((t) => {
                    const s = estados[t.clave];
                    const punto = (
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className={`inline-block h-3.5 w-3.5 rounded-full ${ESTILO[s.estado].punto}`} aria-hidden="true" />
                        <span className="sr-only">{t.titulo}: {ESTILO[s.estado].texto}. {s.detalle}</span>
                      </span>
                    );
                    return (
                      <td key={t.clave} className="px-2 py-2.5 text-center" title={`${ESTILO[s.estado].texto}: ${s.detalle}`}>
                        {s.href ? (
                          <Link href={`/ir?empresa=${empresa.id}&periodo=${clavePeriodo}&a=${s.href}`} className="inline-block rounded p-1 hover:bg-celeste">
                            {punto}
                          </Link>
                        ) : punto}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-borde bg-fondo-suave px-4 py-2 text-xs text-texto-suave">
            {(["listo", "revisar", "atrasado", "pronto"] as Estado[]).map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${ESTILO[e].punto}`} aria-hidden="true" />
                {ESTILO[e].texto}
              </span>
            ))}
          </div>
        </div>
      )}
    </Pagina>
  );
}
