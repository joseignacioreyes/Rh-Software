"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/marca/Logo";

export type ItemMenu = { href: string; texto: string; atajo?: string };
export type GrupoMenu = { titulo?: string; items: ItemMenu[] };

/** Barra lateral azul con la navegación principal. */
export function BarraLateral({ grupos }: { grupos: GrupoMenu[] }) {
  const ruta = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col bg-azul text-blue-100">
      <Link href="/mi-mes" className="px-4 py-3" aria-label="Ir a Mi mes">
        <Logo sobreAzul />
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navegación principal">
        {grupos.map((g, i) => (
          <div key={g.titulo ?? i} className="mt-2.5">
            {g.titulo && (
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-blue-300 uppercase">{g.titulo}</p>
            )}
            <ul>
              {g.items.map((it) => {
                const activo = ruta === it.href || (it.href !== "/mi-mes" && ruta.startsWith(it.href + "/"));
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={activo ? "page" : undefined}
                      className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                        activo ? "bg-white/15 font-semibold text-white" : "hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {it.texto}
                      {it.atajo && <kbd className="font-mono text-[10px] text-blue-300">{it.atajo}</kbd>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
