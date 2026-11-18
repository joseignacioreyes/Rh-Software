import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoModulo } from "@/lib/contexto-contable";
import { Encabezado, Pagina } from "@/components/ui/Encabezado";
import { FichaTrabajador } from "../FichaTrabajador";

export const metadata: Metadata = { title: "Nuevo trabajador" };

export default async function NuevoTrabajador() {
  const { empresa, puedeEditar, supabase } = await contextoModulo("remuneraciones");
  if (!puedeEditar) redirect("/remuneraciones/trabajadores");
  const { data: inst } = await supabase.from("instituciones").select("codigo, nombre, tipo").eq("activa", true).order("nombre");
  return (
    <Pagina>
      <div className="max-w-5xl">
        <Encabezado titulo="Nuevo trabajador" descripcion={empresa.razon_social} />
        <FichaTrabajador instituciones={inst ?? []} soloLectura={false} />
      </div>
    </Pagina>
  );
}
