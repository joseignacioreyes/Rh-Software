// Logo de RH Software.
// Se dibuja como SVG en línea (mismo diseño de public/brand/) para que el texto
// use la fuente Poppins cargada con next/font, que un <img> de SVG no puede usar.

type Props = {
  /** Muestra el eslogan bajo el nombre. */
  conEslogan?: boolean;
  /** Versión para fondo azul (texto blanco). */
  sobreAzul?: boolean;
  className?: string;
};

export function IconoRH({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#1E3A8A" />
      <path d="M96 150 Q176 120 248 150 L248 392 Q176 362 96 392 Z" fill="#FFFFFF" />
      <path d="M416 150 Q336 120 264 150 L264 392 Q336 362 416 392 Z" fill="#DBEAFE" />
      <rect x="124" y="190" width="96" height="14" rx="7" fill="#93C5FD" />
      <rect x="124" y="228" width="96" height="14" rx="7" fill="#93C5FD" />
      <rect x="124" y="266" width="72" height="14" rx="7" fill="#93C5FD" />
      <rect x="124" y="304" width="96" height="14" rx="7" fill="#93C5FD" />
      <rect x="290" y="290" width="26" height="62" rx="6" fill="#1E3A8A" />
      <rect x="330" y="258" width="26" height="94" rx="6" fill="#1E3A8A" />
      <rect x="370" y="222" width="26" height="130" rx="6" fill="#1E3A8A" />
      <circle cx="392" cy="140" r="54" fill="#10B981" stroke="#1E3A8A" strokeWidth="12" />
      <path
        d="M368 141 L386 159 L418 124"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ conEslogan = false, sobreAzul = false, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="RH Software">
      <IconoRH
        className={`${conEslogan ? "h-14 w-14" : "h-9 w-9"} ${sobreAzul ? "rounded-lg ring-1 ring-white/40" : ""}`}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-titulo font-bold tracking-tight whitespace-nowrap ${conEslogan ? "text-3xl" : "text-xl"} ${
            sobreAzul ? "text-white" : "text-azul"
          }`}
        >
          RH <span className={sobreAzul ? "text-emerald-300" : "text-verde"}>Software</span>
        </span>
        {conEslogan && (
          <span
            className={`mt-1.5 font-titulo text-sm font-normal ${
              sobreAzul ? "text-blue-100" : "text-texto-suave"
            }`}
          >
            Contabilidad y remuneraciones al día
          </span>
        )}
      </span>
    </span>
  );
}
