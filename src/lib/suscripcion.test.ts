import { describe, expect, it } from "vitest";
import { estadoCuenta } from "./suscripcion";

const base = { plan: "inicial", estado: "activa" as const, pagado_hasta: "2026-11-30", dias_gracia: 10 };

describe("estado de la suscripción", () => {
  it("al día con más de 7 días", () => expect(estadoCuenta(base, "2026-11-10")?.codigo).toBe("al_dia"));
  it("por vencer en los últimos 7 días", () => expect(estadoCuenta(base, "2026-11-25")).toMatchObject({ codigo: "por_vencer", diasRestantes: 5 }));
  it("atrasada dentro de la gracia sigue editando", () => expect(estadoCuenta(base, "2026-12-05")).toMatchObject({ codigo: "atrasada", puedeEditar: true }));
  it("último día de gracia todavía edita", () => expect(estadoCuenta(base, "2026-12-10")?.puedeEditar).toBe(true));
  it("pasada la gracia queda en solo lectura (sin borrar nada)", () => expect(estadoCuenta(base, "2026-12-11")).toMatchObject({ codigo: "solo_lectura", puedeEditar: false }));
  it("prueba gratis", () => expect(estadoCuenta({ ...base, estado: "prueba" }, "2026-11-20")?.mensaje).toContain("10 días de prueba"));
  it("sin suscripción (demo) no muestra avisos", () => expect(estadoCuenta(null)).toBeNull());
});
