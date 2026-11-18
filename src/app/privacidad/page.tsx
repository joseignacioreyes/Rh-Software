import type { Metadata } from "next";
import { PaginaBorrador } from "@/components/legal/PaginaBorrador";

export const metadata: Metadata = { title: "Política de privacidad (borrador)" };

// Esqueleto de la política de privacidad. El texto definitivo se completa en la Fase 1
// y debe ser revisado por un abogado antes de publicar (Ley 21.719).
export default function Privacidad() {
  return (
    <PaginaBorrador titulo="Política de privacidad">
      <p>
        Esta página explicará qué datos personales trata RH Software, para qué los usa, cómo los protege y cómo
        puedes ejercer tus derechos, de acuerdo con la Ley 21.719 de protección de datos personales.
      </p>
      <h2>Contenido que tendrá</h2>
      <ul>
        <li>Quién es el responsable y quién es el encargado del tratamiento (RH Software actúa por encargo de cada estudio contable).</li>
        <li>Qué datos se tratan: de usuarios, de empresas cliente y de trabajadores.</li>
        <li>Datos sensibles (salud, licencias médicas, afiliación sindical) y sus resguardos: acceso restringido, cifrado y registro de accesos.</li>
        <li>Plazos de conservación y respaldos.</li>
        <li>Derechos de acceso, rectificación, supresión, oposición y portabilidad, y la página “Mis datos”.</li>
        <li>Proveedores que procesan datos (alojamiento, base de datos, correo, IA) y dónde lo hacen.</li>
        <li>Procedimiento ante una filtración de datos.</li>
      </ul>
    </PaginaBorrador>
  );
}
