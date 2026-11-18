import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoContable, cargarCuentas, mesesCerrados } from "@/lib/contexto-contable";
import { rangoPeriodo } from "@/lib/sesion";
import { ZONA_HORARIA } from "@/lib/formato";
import { Encabezado, Pagina, Vacio } from "@/components/ui/Encabezado";
import { EditorComprobante } from "../EditorComprobante";

export const metadata: Metadata = { title: "Nuevo comprobante" };

export default async function NuevoComprobante() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoContable();
  if (!puedeEditar) redirect("/contabilidad/comprobantes");
  const [cuentas, { data: centros }, cerradosAnio, cerradosPrevio] = await Promise.all([
    cargarCuentas(supabase, empresa.id),
    supabase.from("centros_costo").select("id, codigo, nombre").eq("empresa_id", empresa.id).eq("activo", true).order("codigo"),
    mesesCerrados(supabase, empresa.id, ctx.periodo.anio),
    mesesCerrados(supabase, empresa.id, ctx.periodo.anio - 1),
  ]);

  // Fecha sugerida: hoy si estamos en el periodo elegido; si no, el último día del periodo.
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
  const { desde, hasta } = rangoPeriodo(ctx.periodo);
  const fechaInicial = hoy >= desde && hoy <= hasta ? hoy : hasta;
  const cerrados = [
    ...[...cerradosAnio].map((m) => `${ctx.periodo.anio}-${String(m).padStart(2, "0")}`),
    ...[...cerradosPrevio].map((m) => `${ctx.periodo.anio - 1}-${String(m).padStart(2, "0")}`),
  ];
  const imputables = cuentas.filter((c) => c.imputable && c.activa).map(({ id, codigo, nombre }) => ({ id, codigo, nombre }));

  return (
    <Pagina>
      <Encabezado titulo="Nuevo comprobante" descripcion={empresa.razon_social} />
      {imputables.length === 0 ? (
        <Vacio titulo="Esta empresa no tiene cuentas imputables">Primero carga su plan de cuentas.</Vacio>
      ) : (
        <EditorComprobante cuentas={imputables} centros={centros ?? []} fechaInicial={fechaInicial} mesesCerrados={cerrados} />
      )}
    </Pagina>
  );
}
