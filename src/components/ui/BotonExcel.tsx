"use client";

import { useState } from "react";
import { descargarExcel, type ColumnaExcel } from "@/lib/excel";
import { claseBotonSecundario } from "@/components/ui/estilos";

/** Botón "Exportar a Excel" para informes armados en el servidor. */
export function BotonExcel(props: {
  nombreArchivo: string;
  titulo: string;
  columnas: ColumnaExcel[];
  filas: (string | number | null)[][];
  totales?: (string | number | null)[];
}) {
  const [generando, setGenerando] = useState(false);
  return (
    <button
      type="button"
      className={claseBotonSecundario}
      disabled={generando}
      onClick={async () => {
        setGenerando(true);
        try {
          await descargarExcel(props.nombreArchivo, props.titulo, props.columnas, props.filas, props.totales);
        } finally {
          setGenerando(false);
        }
      }}
    >
      {generando ? "Generando…" : "Exportar a Excel"}
    </button>
  );
}
