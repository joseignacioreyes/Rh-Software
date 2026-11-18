import type { Metadata } from "next";
import { ArchivoLegal } from "../ArchivoLegal";

export const metadata: Metadata = { title: "Previred" };

export default function PaginaPrevired() {
  return <ArchivoLegal tipo="previred" />;
}
