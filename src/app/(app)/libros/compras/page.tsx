import type { Metadata } from "next";
import { PaginaLibro } from "../PaginaLibro";

export const metadata: Metadata = { title: "Libro de compras" };

export default function Compras() {
  return <PaginaLibro libro="compras" />;
}
