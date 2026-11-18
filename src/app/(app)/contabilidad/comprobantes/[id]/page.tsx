import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoContable, cargarCuentas, mesesCerrados } from "@/lib/contexto-contable";
import { formatoFecha, formatoPesos } from "@/lib/formato";
import { Encabezado, Etiqueta, Pagina } from "@/components/ui/Encabezado";
import { claseBotonSecundario, claseExito } from "@/components/ui/estilos";
import { BotonAnular } from "./BotonAnular";

export const metadata: Metadata = { title: "Comprobante" };

const TIPO: Record<string, string> = { ingreso: "Ingreso", egreso: "Egreso", traspaso: "Traspaso", apertura: "Apertura" };

export default async function VerComprobante({ params, searchParams }: PageProps<"/contabilidad/comprobantes/[id]">) {
  const { id } = await params;
  const { guardado } = await searchParams;
  const { empresa, puedeEditar, supabase } = await contextoContable();
  const { data: c } = await supabase
    .from("comprobantes")
    .select("id, numero, tipo, fecha, glosa, estado, motivo_anulacion, total_debe, total_haber, origen, created_at, created_by, updated_at")
    .eq("id", id)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: lineas }, cuentas, { data: centros }, cerrados] = await Promise.all([
    supabase.from("lineas_comprobante").select("orden, cuenta_id, glosa, debe, haber, centro_costo_id").eq("comprobante_id", id).order("orden"),
    cargarCuentas(supabase, empresa.id),
    supabase.from("centros_costo").select("id, codigo").eq("empresa_id", empresa.id),
    mesesCerrados(supabase, empresa.id, Number(c.fecha.slice(0, 4))),
  ]);
  const cuenta = new Map(cuentas.map((x) => [x.id, x]));
  const centro = new Map((centros ?? []).map((x) => [x.id, x.codigo]));
  const cerrado = cerrados.has(Number(c.fecha.slice(5, 7)));
  const editable = puedeEditar && !cerrado && c.estado === "vigente";
  const fecha = (iso: string) => formatoFecha(new Date(`${iso}T12:00:00-04:00`));

  return (
    <Pagina>
      <div className="max-w-5xl">
        <Encabezado
          titulo={`Comprobante N° ${c.numero}`}
          descripcion={
            <span className="flex flex-wrap items-center gap-2">
              {empresa.razon_social} · {TIPO[c.tipo]} · <span className="numeros">{fecha(c.fecha)}</span>
              {c.estado === "anulado" ? <Etiqueta tono="rojo">Anulado</Etiqueta> : <Etiqueta tono="verde">Cuadra</Etiqueta>}
              {cerrado && <Etiqueta tono="gris">Mes cerrado</Etiqueta>}
            </span>
          }
        >
          <Link href="/contabilidad/comprobantes" className={claseBotonSecundario}>Volver</Link>
          {editable && <Link href={`/contabilidad/comprobantes/${c.id}/editar`} className={claseBotonSecundario}>Editar</Link>}
          {editable && <BotonAnular id={c.id} />}
        </Encabezado>

        {guardado && <p className={`${claseExito} mb-3`}>Cambios guardados.</p>}
        {c.estado === "anulado" && (
          <p className="mb-3 rounded-md border border-rojo/30 bg-red-50 px-3 py-2 text-sm text-rojo">
            Anulado: {c.motivo_anulacion}. No suma en los libros ni en los informes.
          </p>
        )}

        <p className="mb-3 rounded-lg border border-borde bg-white px-4 py-3 text-sm"><span className="text-texto-suave">Glosa:</span> {c.glosa}</p>

        <div className="overflow-hidden rounded-lg border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo-suave text-xs text-texto-suave">
              <tr>
                <th className="w-28 px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
                <th className="px-3 py-2 text-left font-semibold">Glosa</th>
                <th className="w-20 px-3 py-2 text-left font-semibold">C. costo</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Debe</th>
                <th className="w-36 px-3 py-2 text-right font-semibold">Haber</th>
              </tr>
            </thead>
            <tbody>
              {(lineas ?? []).map((l) => (
                <tr key={l.orden} className="border-t border-gray-100">
                  <td className="numeros px-3 py-1.5">{cuenta.get(l.cuenta_id)?.codigo}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/contabilidad/libro-mayor?cuenta=${l.cuenta_id}`} className="hover:text-azul hover:underline">{cuenta.get(l.cuenta_id)?.nombre}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-texto-suave">{l.glosa ?? ""}</td>
                  <td className="px-3 py-1.5 text-texto-suave">{l.centro_costo_id ? centro.get(l.centro_costo_id) : ""}</td>
                  <td className="numeros px-3 py-1.5 text-right">{l.debe ? formatoPesos(l.debe) : ""}</td>
                  <td className="numeros px-3 py-1.5 text-right">{l.haber ? formatoPesos(l.haber) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-borde bg-fondo-suave font-semibold">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-xs text-texto-suave">Totales</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(c.total_debe)}</td>
                <td className="numeros px-3 py-2 text-right">{formatoPesos(c.total_haber)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-texto-suave">
          Origen: {c.origen === "manual" ? "ingreso manual" : c.origen} · Creado el {formatoFecha(new Date(c.created_at))}
          {c.updated_at !== c.created_at && ` · Última modificación el ${formatoFecha(new Date(c.updated_at))}`}. El historial completo está en Auditoría.
        </p>
      </div>
    </Pagina>
  );
}
