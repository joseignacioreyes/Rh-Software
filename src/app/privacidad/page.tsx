import type { Metadata } from "next";
import { PaginaBorrador } from "@/components/legal/PaginaBorrador";

export const metadata: Metadata = { title: "Política de privacidad (borrador)" };

// Borrador de política de privacidad conforme a la Ley 21.719. Debe revisarlo un abogado antes de publicar.
export default function Privacidad() {
  return (
    <PaginaBorrador titulo="Política de privacidad">
      <p>Última actualización: noviembre de 2026.</p>

      <h2>1. Quiénes somos y qué rol cumplimos</h2>
      <p>
        RH Software (de Reyes Herrera) ofrece un servicio web de contabilidad y remuneraciones para estudios contables.
        Respecto de los datos de las empresas cliente y de sus trabajadores, <strong>el responsable del tratamiento es el
        estudio contable</strong> (o la empresa cliente, según su relación) y RH Software actúa como <strong>encargado</strong>:
        tratamos esos datos solo para prestar el servicio y según sus instrucciones, de acuerdo con un contrato de encargo.
        Respecto de los datos de las cuentas de usuario (nombre, RUT, correo), RH Software es responsable.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Usuarios: nombre, RUT, correo, clave (guardada en forma cifrada e irreversible), segundo factor y registro de actividad (fecha, hora, IP y navegador).</li>
        <li>Empresas cliente: datos tributarios, contables, bancarios y documentos que el estudio carga.</li>
        <li>Trabajadores: datos de identificación, contrato, remuneraciones, previsión, salud, cargas y licencias médicas.</li>
      </ul>

      <h2>3. Datos sensibles</h2>
      <p>
        Las liquidaciones y fichas de trabajadores pueden contener datos sensibles (salud, licencias médicas, afiliación
        sindical). Los protegemos con acceso restringido por rol y por empresa, cifrado en tránsito y en reposo, y registro
        de cada acceso. Solo los ven las personas que el estudio autoriza.
      </p>

      <h2>4. Para qué usamos los datos</h2>
      <ul>
        <li>Prestar el servicio: llevar la contabilidad, calcular impuestos y remuneraciones, generar archivos legales.</li>
        <li>Seguridad: verificar la identidad, prevenir accesos indebidos y mantener la trazabilidad exigida en fiscalizaciones.</li>
        <li>Comunicación: avisos del servicio y, solo con consentimiento, mensajes por WhatsApp.</li>
      </ul>
      <p>No vendemos datos ni los usamos para publicidad. No entrenamos modelos de inteligencia artificial con ellos.</p>

      <h2>5. Proveedores que procesan datos</h2>
      <ul>
        <li>Alojamiento de la aplicación (Vercel) y base de datos y archivos (Supabase).</li>
        <li>Envío de correos (proveedor transaccional) y, si se activa, WhatsApp Business (Meta).</li>
        <li>Lectura de documentos con IA (Anthropic), solo del documento que se procesa y sin uso para entrenamiento.</li>
      </ul>
      <p>Algunos de estos proveedores procesan datos fuera de Chile, con resguardos contractuales equivalentes.</p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras dure el servicio y, después, el tiempo necesario para cumplir plazos legales (por ejemplo, los de
        prescripción tributaria y laboral) o hasta que el estudio pida la entrega y eliminación de sus datos.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes pedir acceso, rectificación, supresión, oposición, portabilidad y bloqueo de tus datos desde la página
        “Mis datos” de tu cuenta o escribiendo a soporte. Si eres trabajador de una empresa cliente, también puedes dirigirte
        a tu empleador o a su estudio contable, que es el responsable.
      </p>

      <h2>8. Incidentes de seguridad</h2>
      <p>
        Si ocurre una vulneración de seguridad que afecte datos personales, la comunicaremos a los estudios afectados y a la
        autoridad, según lo exige la ley, siguiendo nuestro procedimiento documentado.
      </p>
    </PaginaBorrador>
  );
}
