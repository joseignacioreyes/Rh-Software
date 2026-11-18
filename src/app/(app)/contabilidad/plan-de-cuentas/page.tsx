import type { Metadata } from "next";
import { contextoContable, cargarCuentas } from "@/lib/contexto-contable";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { PlanDeCuentas } from "./PlanDeCuentas";

export const metadata: Metadata = { title: "Plan de cuentas" };

export default async function PaginaPlan() {
  const { ctx, empresa, puedeEditar, supabase } = await contextoContable();
  const cuentas = await cargarCuentas(supabase, empresa.id);
  // Cuentas con movimientos (no se pueden desactivar sin revisar).
  const { data: usadas } = await supabase.from("lineas_comprobante").select("cuenta_id").eq("empresa_id", empresa.id).limit(20000);
  const conMovimientos = [...new Set((usadas ?? []).map((u) => u.cuenta_id))];

  return (
    <Pagina>
      <Encabezado
        titulo="Plan de cuentas"
        descripcion={`${empresa.razon_social} · ${cuentas.length} cuentas (${cuentas.filter((c) => c.imputable).length} imputables)`}
      />
      <PlanDeCuentas
        cuentas={cuentas}
        conMovimientos={conMovimientos}
        puedeEditar={puedeEditar}
        otrasEmpresas={ctx.empresas.filter((e) => e.id !== empresa.id && e.activa).map((e) => ({ id: e.id, nombre: e.razon_social }))}
        nombreEmpresa={empresa.razon_social}
      />
    </Pagina>
  );
}
