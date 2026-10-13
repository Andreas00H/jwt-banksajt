import { describe, expect, test } from "vitest";
// Testar den riktiga funktionen som server.js använder vid uttag
import { validateWithdrawal } from "../src/validateWithdrawal.js";

const NOT_ENOUGH = "Du har inte tillräckligt med pengar på kontot.";

describe("validateWithdrawal", () => {
  test("godkänner ett uttag som är mindre än saldot", () => {
    expect(validateWithdrawal(200, 500)).toEqual({ ok: true, amount: 200 });
  });

  test("godkänner att hela saldot tas ut", () => {
    expect(validateWithdrawal(500, 500)).toEqual({ ok: true, amount: 500 });
    expect(validateWithdrawal(19.99, 19.99).ok).toBe(true);
  });

  test("nekar ett uttag som är större än saldot", () => {
    expect(validateWithdrawal(600, 500)).toEqual({ ok: false, error: NOT_ENOUGH });
  });

  test("nekar även ett uttag som bara är ett öre för mycket", () => {
    expect(validateWithdrawal(100.01, 100)).toEqual({ ok: false, error: NOT_ENOUGH });
  });

  test("nekar alla uttag när saldot är 0", () => {
    expect(validateWithdrawal(1, 0)).toEqual({ ok: false, error: NOT_ENOUGH });
  });

  test("nekar ogiltiga belopp med samma regler som insättning", () => {
    expect(validateWithdrawal(0, 500).ok).toBe(false);
    expect(validateWithdrawal(-50, 500).ok).toBe(false);
    expect(validateWithdrawal(NaN, 500).ok).toBe(false);
    expect(validateWithdrawal(Infinity, 500).ok).toBe(false);
    expect(validateWithdrawal("abc", 500).ok).toBe(false);
  });

  test("ett ogiltigt belopp ger beloppsfelet, inte saldofelet", () => {
    expect(validateWithdrawal(-50, 500)).toEqual({
      ok: false,
      error: "Beloppet måste vara större än noll.",
    });
  });

  test("klarar saldo som kommer från databasen som text", () => {
    // mysql2 returnerar DECIMAL som text, t.ex. "500.00"
    expect(validateWithdrawal(200, "500.00")).toEqual({ ok: true, amount: 200 });
    expect(validateWithdrawal(600, "500.00").ok).toBe(false);
  });
});
