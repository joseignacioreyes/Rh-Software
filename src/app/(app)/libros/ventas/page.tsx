import type { Metadata } from "next";
import { PaginaLibro } from "../PaginaLibro";

export const metadata: Metadata = { title: "Libro de ventas" };

export default function Ventas() {
  return <PaginaLibro libro="ventas" />;
}
