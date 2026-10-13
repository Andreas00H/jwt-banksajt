import { describe, expect, test } from "vitest";
import { checkPassword, hashPassword, validateRegistration } from "../src/credentials.js";

describe("validateRegistration", () => {
  test("godkänner användarnamn och lösenord med minst 8 tecken", () => {
    expect(validateRegistration(" anna ", "hemligt123")).toEqual({ ok: true, username: "anna" });
  });

  test("kräver användarnamn och lösenord", () => {
    expect(validateRegistration("", "hemligt123").ok).toBe(false);
    expect(validateRegistration("anna", "").ok).toBe(false);
    expect(validateRegistration(undefined, undefined).ok).toBe(false);
  });

  test("nekar lösenord kortare än 8 tecken", () => {
    expect(validateRegistration("anna", "1234567")).toEqual({
      ok: false,
      error: "Lösenordet måste vara minst 8 tecken.",
    });
    expect(validateRegistration("anna", "12345678").ok).toBe(true);
  });

  test("nekar lösenord längre än 72 byte (bcrypts gräns)", () => {
    expect(validateRegistration("anna", "a".repeat(73)).ok).toBe(false);
  });
});

describe("hashPassword och checkPassword", () => {
  test("hashen är en bcrypt-hash och inte lösenordet", async () => {
    const hash = await hashPassword("hemligt123");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain("hemligt123");
  });

  test("samma lösenord ger olika hashar (salt)", async () => {
    const [first, second] = await Promise.all([hashPassword("hemligt123"), hashPassword("hemligt123")]);
    expect(first).not.toBe(second);
  });

  test("rätt lösenord godkänns och fel lösenord nekas", async () => {
    const hash = await hashPassword("hemligt123");
    expect(await checkPassword("hemligt123", hash)).toBe(true);
    expect(await checkPassword("hemligt124", hash)).toBe(false);
  });

  test("nekar när användaren saknas eller lösenordet inte är text", async () => {
    expect(await checkPassword("hemligt123", undefined)).toBe(false);
    expect(await checkPassword(undefined, await hashPassword("hemligt123"))).toBe(false);
  });
});
