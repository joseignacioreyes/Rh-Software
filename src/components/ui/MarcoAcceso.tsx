import Link from "next/link";
import { Logo } from "@/components/marca/Logo";

/** Marco de las pantallas de acceso (ingresar, segundo factor). */
export function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-fondo-suave px-4 py-10">
      <Link href="/" className="mb-8" aria-label="Ir a la portada">
        <Logo conEslogan />
      </Link>
      <main className="w-full max-w-sm rounded-xl border border-borde bg-white p-7 shadow-sm">
        <h1 className="text-xl font-bold text-azul">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
      </main>
      <p className="mt-6 text-xs text-texto-suave">
        <Link href="/privacidad" className="hover:underline">Privacidad</Link> ·{" "}
        <Link href="/terminos" className="hover:underline">Términos</Link>
      </p>
    </div>
  );
}
