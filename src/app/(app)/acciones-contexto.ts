"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_EMPRESA, COOKIE_ESTUDIO, COOKIE_PERIODO } from "@/lib/sesion";

const OPCIONES = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

// Cambian la empresa, el periodo o el estudio de trabajo. Solo guardan la preferencia:
// lo que el usuario puede ver lo decide la base de datos.

export async function cambiarEmpresa(empresaId: string) {
  if (!/^[0-9a-f-]{36}$/.test(empresaId)) return;
  (await cookies()).set(COOKIE_EMPRESA, empresaId, OPCIONES);
  revalidatePath("/", "layout");
}

export async function cambiarPeriodo(anio: number, mes: number) {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12 || anio < 2000 || anio > 2100) return;
  (await cookies()).set(COOKIE_PERIODO, `${anio}-${String(mes).padStart(2, "0")}`, OPCIONES);
  revalidatePath("/", "layout");
}

export async function cambiarEstudio(estudioId: string) {
  if (!/^[0-9a-f-]{36}$/.test(estudioId)) return;
  const almacen = await cookies();
  almacen.set(COOKIE_ESTUDIO, estudioId, OPCIONES);
  almacen.delete(COOKIE_EMPRESA);
  revalidatePath("/", "layout");
}
