import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app es dinámica por usuario (sesión, empresa y periodo en cookies),
  // así que no usamos Cache Components por ahora.
  // Subida de archivos (libros del SII, cartolas, documentos) por acciones del servidor.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // PDFKit lee sus fuentes desde disco: se usa tal cual, sin empaquetar.
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
