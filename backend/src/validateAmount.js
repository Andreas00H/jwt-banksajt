// Regler för belopp vid insättning (och senare uttag).
// Ligger i en egen fil så att reglerna kan testas med Vitest
// utan att starta servern eller databasen.

export const MAX_AMOUNT = 1_000_000;

// Kontrollerar ett belopp som kommer från användaren.
// Returnerar { ok: true, amount } eller { ok: false, error }.
export function validateAmount(value) {
  // Bara riktiga tal och siffror i text godkänns, inte t.ex. true, [] eller ""
  if (typeof value !== "number" && typeof value !== "string") {
    return { ok: false, error: "Beloppet måste vara ett tal." };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { ok: false, error: "Beloppet måste vara ett tal." };
  }

  const amount = Number(value);

  // Number.isFinite är falskt för NaN, Infinity och -Infinity
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "Beloppet måste vara ett tal." };
  }
  if (amount <= 0) {
    return { ok: false, error: "Beloppet måste vara större än noll." };
  }
  if (amount > MAX_AMOUNT) {
    return { ok: false, error: "Beloppet får vara högst 1 000 000 kr." };
  }
  // Högst två decimaler (hela ören), eftersom databasen sparar två decimaler.
  // Liten tolerans behövs eftersom t.ex. 1.1 * 100 blir 110.00000000000001 i JavaScript.
  const oren = amount * 100;
  if (Math.abs(oren - Math.round(oren)) > 1e-6) {
    return { ok: false, error: "Beloppet får ha högst två decimaler." };
  }

  return { ok: true, amount };
}
