/** Encabezado de cada pantalla: título, descripción corta y acciones a la derecha. */
export function Encabezado({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-azul">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-sm text-texto-suave">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Contenedor estándar de una pantalla. */
export function Pagina({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1400px] px-6 py-5">{children}</div>;
}

/** Mensaje cuando la pantalla no tiene datos o falta elegir algo. */
export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-texto">{titulo}</p>
      {children && <div className="mt-2 text-sm text-texto-suave">{children}</div>}
    </div>
  );
}

/** Etiqueta de estado con los colores de la marca. */
export function Etiqueta({ tono, children }: { tono: "verde" | "ambar" | "rojo" | "gris" | "azul"; children: React.ReactNode }) {
  const clases = {
    verde: "bg-emerald-50 text-verde ring-verde/30",
    ambar: "bg-amber-50 text-ambar ring-ambar/30",
    rojo: "bg-red-50 text-rojo ring-rojo/30",
    gris: "bg-gray-100 text-texto-suave ring-gray-300",
    azul: "bg-celeste text-azul ring-azul/20",
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${clases}`}>{children}</span>;
}
