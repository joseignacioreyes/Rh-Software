import type { Metadata } from "next";
import { MarcoAcceso } from "@/components/ui/MarcoAcceso";
import { BotonWhatsApp } from "@/components/marca/BotonWhatsApp";

export const metadata: Metadata = { title: "Crear mi cuenta" };

// El registro con planes y pagos llega en la Fase 8. Mientras tanto, se crea la cuenta por WhatsApp.
export default function Registro() {
  return (
    <MarcoAcceso titulo="Crea la cuenta de tu estudio" subtitulo="Estamos abriendo cupos para los primeros estudios contables.">
      <p className="mb-5 text-sm text-texto-suave">
        Escríbenos y te creamos la cuenta del estudio con tu RUT. Te acompañamos a cargar tus primeras empresas.
      </p>
      <BotonWhatsApp texto="Quiero crear mi cuenta" mensaje="Hola, quiero crear la cuenta de mi estudio contable en RH Software." />
    </MarcoAcceso>
  );
}
