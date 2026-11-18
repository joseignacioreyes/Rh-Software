import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerContexto, esContador } from "@/lib/sesion";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { FormularioEmpresa } from "../FormularioEmpresa";

export const metadata: Metadata = { title: "Nueva empresa" };

export default async function NuevaEmpresa() {
  const ctx = await obtenerContexto();
  if (!esContador(ctx)) redirect("/empresas");
  return (
    <Pagina>
      <div className="max-w-4xl">
        <Encabezado titulo="Nueva empresa" descripcion="Se crea con el plan de cuentas base, que después puedes ajustar." />
        <FormularioEmpresa />
      </div>
    </Pagina>
  );
}
