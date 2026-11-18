import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { contextoContable, cargarCuentas, mesesCerrados } from "@/lib/contexto-contable";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { EditorComprobante } from "../../EditorComprobante";

export const metadata: Metadata = { title: "Editar comprobante" };

export default async function EditarComprobante({ params }: PageProps<"/contabilidad/comprobantes/[id]/editar">) {
  const { id } = await params;
  const { empresa, puedeEditar, supabase } = await contextoContable();
  if (!puedeEditar) redirect(`/contabilidad/comprobantes/${id}`);
  const { data: c } = await supabase
    .from("comprobantes")
    .select("id, numero, tipo, fecha, glosa, estado")
    .eq("id", id)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!c) notFound();
  if (c.estado !== "vigente") redirect(`/contabilidad/comprobantes/${id}`);

  const anio = Number(c.fecha.slice(0, 4));
  const [{ data: lineas }, cuentas, { data: centros }, cerrados] = await Promise.all([
    supabase.from("lineas_comprobante").select("cuenta_id, glosa, debe, haber, centro_costo_id").eq("comprobante_id", id).order("orden"),
    cargarCuentas(supabase, empresa.id),
    supabase.from("centros_costo").select("id, codigo, nombre").eq("empresa_id", empresa.id).eq("activo", true).order("codigo"),
    mesesCerrados(supabase, empresa.id, anio),
  ]);
  if (cerrados.has(Number(c.fecha.slice(5, 7)))) redirect(`/contabilidad/comprobantes/${id}`);

  // Incluye cuentas inactivas que ya estaban usadas para poder mostrarlas.
  const usadas = new Set((lineas ?? []).map((l) => l.cuenta_id));
  const opciones = cuentas.filter((x) => x.imputable && (x.activa || usadas.has(x.id))).map(({ id, codigo, nombre }) => ({ id, codigo, nombre }));

  return (
    <Pagina>
      <Encabezado titulo={`Editar comprobante N° ${c.numero}`} descripcion={empresa.razon_social} />
      <EditorComprobante
        cuentas={opciones}
        centros={centros ?? []}
        fechaInicial={c.fecha}
        inicial={{ ...c, lineas: lineas ?? [] }}
        mesesCerrados={[...cerrados].map((m) => `${anio}-${String(m).padStart(2, "0")}`)}
      />
    </Pagina>
  );
}
