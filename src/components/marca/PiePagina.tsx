import Link from "next/link";
import { Logo } from "./Logo";
import { WHATSAPP_SOPORTE, linkWhatsApp } from "@/lib/config";

/** Formatea 56977766584 como "+56 9 7776 6584". */
function numeroLegible(numero: string): string {
  const m = numero.match(/^56(9)(\d{4})(\d{4})$/);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : `+${numero}`;
}

export function PiePagina() {
  return (
    <footer className="bg-azul text-blue-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <Logo sobreAzul />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/privacidad" className="hover:text-white">
            Privacidad
          </Link>
          <Link href="/terminos" className="hover:text-white">
            Términos
          </Link>
          <a
            href={linkWhatsApp(WHATSAPP_SOPORTE)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white"
          >
            Soporte y ventas: {numeroLegible(WHATSAPP_SOPORTE)}
          </a>
        </nav>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-blue-200">
        RH Software, de Reyes Herrera. Empresa hermana de RH Stock.
      </div>
    </footer>
  );
}
