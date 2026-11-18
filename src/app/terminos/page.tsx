import type { Metadata } from "next";
import { PaginaBorrador } from "@/components/legal/PaginaBorrador";

export const metadata: Metadata = { title: "Términos de uso (borrador)" };

// Borrador de términos de uso. Debe revisarlo un abogado antes de publicar.
export default function Terminos() {
  return (
    <PaginaBorrador titulo="Términos de uso">
      <p>Última actualización: noviembre de 2026.</p>

      <h2>1. El servicio</h2>
      <p>
        RH Software es una herramienta web que asiste a contadores y estudios contables en la contabilidad, los libros,
        los impuestos y las remuneraciones de sus empresas cliente.
      </p>

      <h2>2. Responsabilidad profesional</h2>
      <p>
        <strong>RH Software asiste al contador; no lo reemplaza.</strong> Los cálculos se basan en los datos cargados y en
        los parámetros legales vigentes informados en la plataforma, cada uno con su fuente. El contador revisa y responde
        por lo que declara ante el SII, Previred, la Dirección del Trabajo y otros organismos. Cada proceso de declaración
        registra quién lo revisó.
      </p>

      <h2>3. Cuentas y seguridad</h2>
      <ul>
        <li>Cada persona usa su propia cuenta, con su RUT y su clave. No se comparten claves.</li>
        <li>Contadores y asistentes deben usar segundo factor de autenticación.</li>
        <li>RH Software no pide ni guarda claves tributarias de las empresas cliente.</li>
        <li>El estudio es responsable de dar y quitar accesos a su personal y a sus clientes.</li>
      </ul>

      <h2>4. Datos y confidencialidad</h2>
      <p>
        Los datos de las empresas pertenecen a ellas y a su estudio. RH Software los trata como encargado, según el
        contrato de encargo de tratamiento y la política de privacidad. El estudio puede exportar todos sus datos en
        cualquier momento.
      </p>

      <h2>5. Suscripción y pagos</h2>
      <p>
        El servicio se paga por suscripción según el plan contratado. Si hay atraso en el pago, la cuenta pasa a modo de
        solo lectura: <strong>los datos nunca se borran por atraso</strong> y siempre se pueden exportar.
      </p>

      <h2>6. Disponibilidad y respaldos</h2>
      <p>
        Hacemos respaldos diarios de la base de datos. Avisaremos con anticipación las mantenciones programadas.
      </p>

      <h2>7. Término</h2>
      <p>
        El estudio puede terminar el servicio cuando quiera. Al terminar, le entregamos sus datos en formatos estándar y,
        después del plazo acordado, los eliminamos de forma segura.
      </p>
    </PaginaBorrador>
  );
}
