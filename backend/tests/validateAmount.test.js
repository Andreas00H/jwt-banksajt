import { describe, expect, test } from "vitest";
// Testar den riktiga funktionen som server.js använder (ingen kopia)
import { MAX_AMOUNT, validateAmount } from "../src/validateAmount.js";

describe("validateAmount", () => {
  test("godkänner ett vanligt belopp", () => {
    expect(validateAmount(500)).toEqual({ ok: true, amount: 500 });
  });

  test("godkänner ören (två decimaler)", () => {
    expect(validateAmount(99.5)).toEqual({ ok: true, amount: 99.5 });
    expect(validateAmount(0.01)).toEqual({ ok: true, amount: 0.01 });
    // Tal som blir lite fel i JavaScript (1.1 * 100 = 110.00000000000001)
    expect(validateAmount(1.1).ok).toBe(true);
    expect(validateAmount(19.99).ok).toBe(true);
    expect(validateAmount(0.07).ok).toBe(true);
  });

  test("godkänner ett tal skickat som text", () => {
    expect(validateAmount("250")).toEqual({ ok: true, amount: 250 });
  });

  test("nekar noll", () => {
    expect(validateAmount(0).ok).toBe(false);
  });

  test("nekar negativa tal", () => {
    expect(validateAmount(-100).ok).toBe(false);
  });

  test("nekar NaN", () => {
    expect(validateAmount(NaN).ok).toBe(false);
  });

  test("nekar Infinity och -Infinity", () => {
    expect(validateAmount(Infinity).ok).toBe(false);
    expect(validateAmount(-Infinity).ok).toBe(false);
  });

  test("nekar text som inte är ett tal, tom text och saknat värde", () => {
    expect(validateAmount("abc").ok).toBe(false);
    expect(validateAmount("").ok).toBe(false);
    expect(validateAmount(undefined).ok).toBe(false);
    expect(validateAmount(null).ok).toBe(false);
  });

  test("nekar andra typer än tal och text", () => {
    expect(validateAmount(true).ok).toBe(false);
    expect(validateAmount([100]).ok).toBe(false);
  });

  test("nekar fler än två decimaler", () => {
    expect(validateAmount(10.005).ok).toBe(false);
  });

  test("godkänner maxbeloppet men inte mer", () => {
    expect(validateAmount(MAX_AMOUNT).ok).toBe(true);
    expect(validateAmount(MAX_AMOUNT + 1).ok).toBe(false);
  });

  test("ger ett begripligt felmeddelande", () => {
    expect(validateAmount(-5)).toEqual({
      ok: false,
      error: "Beloppet måste vara större än noll.",
    });
  });
});
