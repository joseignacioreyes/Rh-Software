import type { Metadata } from "next";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { claseExito } from "@/components/ui/estilos";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({ searchParams }: PageProps<"/ingresar">) {
  const { nuevo } = await searchParams;
  return (
    <MarcoAcceso titulo="Ingresar" subtitulo="Con tu RUT y tu clave de RH Software.">
      {nuevo && <p className={`${claseExito} mb-4`}>¡Tu estudio está creado! Ingresa con tu RUT y tu clave. Luego configurarás tu segundo factor.</p>}
      <FormularioIngreso />
    </MarcoAcceso>
  );
}
