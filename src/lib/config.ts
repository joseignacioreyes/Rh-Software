// Configuración pública de la app, leída desde variables de entorno.
// Ver .env.example para el detalle de cada variable.

/** Número de soporte y ventas de RH Software, sin "+" ni espacios (formato wa.me). */
export const WHATSAPP_SOPORTE = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "56977766584";

/** URL pública del sitio, usada para los links al compartir (imagen de vista previa). */
export function urlDelSitio(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  // En Vercel, cada versión de prueba tiene su propia URL.
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}

/** Arma un link wa.me con un mensaje prellenado. */
export function linkWhatsApp(numero: string, mensaje?: string): string {
  const base = `https://wa.me/${numero.replace(/\D/g, "")}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
