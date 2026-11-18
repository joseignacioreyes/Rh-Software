import type { Metadata } from "next";
import { ArchivoLegal } from "../ArchivoLegal";

export const metadata: Metadata = { title: "LRE" };

export default function PaginaLRE() {
  return <ArchivoLegal tipo="lre" />;
}
