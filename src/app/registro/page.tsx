import type { Metadata } from "next";
import Link from "next/link";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { BotonWhatsApp } from "@/components/marca/BotonWhatsApp";
import { FormularioRegistro } from "./Formulario";

export const metadata: Metadata = { title: "Crear mi cuenta" };

export default function Registro() {
  return (
    <MarcoAcceso titulo="Crea la cuenta de tu estudio" subtitulo="30 días gratis, con todas las funciones.">
      <FormularioRegistro />
      <div className="mt-5 border-t border-borde pt-4 text-center text-sm text-texto-suave">
        ¿Ya tienes cuenta? <Link href="/ingresar" className="text-azul underline">Ingresa con tu RUT</Link>
        <div className="mt-3"><BotonWhatsApp texto="Prefiero que me ayuden" mensaje="Hola, quiero crear la cuenta de mi estudio contable en RH Software." /></div>
      </div>
    </MarcoAcceso>
  );
}
