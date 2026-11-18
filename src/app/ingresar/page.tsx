import type { Metadata } from "next";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingresar" };

export default function Ingresar() {
  return (
    <MarcoAcceso titulo="Ingresar" subtitulo="Con tu RUT y tu clave de RH Software.">
      <FormularioIngreso />
    </MarcoAcceso>
  );
}
