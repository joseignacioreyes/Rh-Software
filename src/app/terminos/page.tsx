import type { Metadata } from "next";
import { PaginaBorrador } from "@/components/legal/PaginaBorrador";

export const metadata: Metadata = { title: "Términos de uso (borrador)" };

// Esqueleto de los términos de uso. Se completa en la Fase 1 y debe ser revisado
// por un abogado antes de publicar.
export default function Terminos() {
  return (
    <PaginaBorrador titulo="Términos de uso">
      <p>
        Estos términos regularán el uso de RH Software por parte de los estudios contables, sus usuarios y los
        clientes que acceden al portal.
      </p>
      <h2>Contenido que tendrá</h2>
      <ul>
        <li>
          Responsabilidad: RH Software asiste al contador. El contador revisa y responde por lo que declara al SII,
          a Previred y a la Dirección del Trabajo.
        </li>
        <li>Suscripción, planes, pagos y modo de solo lectura por atraso (los datos nunca se borran por atraso).</li>
        <li>Uso aceptable: no compartir claves y no cargar datos sin autorización del titular.</li>
        <li>Disponibilidad del servicio, respaldos y exportación completa de los datos.</li>
        <li>Contrato de encargo de tratamiento de datos entre RH Software y cada estudio.</li>
        <li>Término del servicio y entrega de los datos.</li>
      </ul>
    </PaginaBorrador>
  );
}
