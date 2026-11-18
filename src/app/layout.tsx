import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { urlDelSitio } from "@/lib/config";
import "./globals.css";

// Inter: todo el contenido y las tablas.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Poppins (700 y 400): solo títulos y el logo.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: urlDelSitio(),
  title: {
    default: "RH Software | Contabilidad y remuneraciones al día",
    template: "%s | RH Software",
  },
  description:
    "Contabilidad, libros, F29 y remuneraciones para contadores y estudios contables en Chile. Todas tus empresas en una sola pantalla, con el mes al día y sin digitar dos veces.",
  applicationName: "RH Software",
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "RH Software",
    title: "RH Software | Contabilidad y remuneraciones al día",
    description: "Todas tus empresas en una sola pantalla, con el mes al día y sin digitar dos veces.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
