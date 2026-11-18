import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app es dinámica por usuario (sesión, empresa y periodo en cookies),
  // así que no usamos Cache Components por ahora.
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
