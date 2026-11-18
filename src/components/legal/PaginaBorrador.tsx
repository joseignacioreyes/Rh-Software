import Link from "next/link";
import { Logo } from "@/components/marca/Logo";
import { PiePagina } from "@/components/marca/PiePagina";

type Props = {
  titulo: string;
  children: React.ReactNode;
};

/** Plantilla para páginas legales que aún son borrador. */
export function PaginaBorrador({ titulo, children }: Props) {
  return (
    <>
      <header className="border-b border-borde">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Volver a la portada">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p
          role="note"
          className="mb-6 rounded-md border border-ambar/40 bg-amber-50 px-4 py-3 text-sm font-semibold text-ambar"
        >
          BORRADOR: revisar antes de publicar
        </p>
        <h1 className="text-3xl font-bold text-azul">{titulo}</h1>
        <div className="mt-6 space-y-4 leading-relaxed text-texto-suave [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-texto [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <PiePagina />
    </>
  );
}
