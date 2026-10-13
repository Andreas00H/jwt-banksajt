import { validateAmount } from "./validateAmount.js";

// Regler för uttag (VG):
// 1. Beloppet måste vara giltigt (samma regler som insättning).
// 2. Man får inte ta ut mer än saldot – ingen övertrassering.
// Returnerar { ok: true, amount } eller { ok: false, error }.
export function validateWithdrawal(value, balance) {
  const result = validateAmount(value);
  if (!result.ok) return result;

  // Jämför i hela ören för att slippa avrundningsfel med decimaltal
  const amountInOren = Math.round(result.amount * 100);
  const balanceInOren = Math.round(Number(balance) * 100);

  if (!Number.isFinite(balanceInOren) || amountInOren > balanceInOren) {
    return { ok: false, error: "Du har inte tillräckligt med pengar på kontot." };
  }

  return { ok: true, amount: result.amount };
}
