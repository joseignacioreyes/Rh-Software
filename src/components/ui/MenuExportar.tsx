/** Botones de exportación de un libro (Excel, PDF, CSV y, si aplica, el formato del importador del SII). */
export function MenuExportar({ que, sii = false }: { que: string; sii?: boolean }) {
  const enlace = (formato: string) => `/exportar?que=${que}&formato=${formato}`;
  const clase = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-texto hover:bg-fondo-suave";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={enlace("xlsx")} className={clase}>Excel</a>
      <a href={enlace("pdf")} className={clase}>PDF</a>
      <a href={enlace("csv")} className={clase}>CSV</a>
      {sii && (
        <a href={enlace("sii")} className={clase} title="CSV separado por punto y coma para el importador de libros del SII (por verificar con la estructura oficial)">
          CSV importador SII
        </a>
      )}
    </div>
  );
}
