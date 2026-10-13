"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { deposit, formatKr, getAccount, isUnauthorized, logout, withdraw } from "@/lib/api";
import { buttonClass, cardClass, inputClass } from "@/components/form-styles";
import { useHydrated } from "@/lib/use-hydrated";
import { SavingsPanel } from "@/components/savings-panel";

// Knapp för uttag: samma form som vanliga knappen men med ram i stället för fylld
const secondaryButtonClass =
  "w-full rounded-full border-2 border-emerald-700 px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50";

// Klientdelen av kontosidan (saldo, insättning, uttag, utloggning).
// Inloggningen sköts av en HttpOnly-cookie som webbläsaren skickar automatiskt.
// showSavings kommer från feature flaggan FEATURE_SAVINGS via page.tsx.
export default function AccountClient({ showSavings }: { showSavings: boolean }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [message, setMessage] = useState("");
  // Fel vid inloggning (t.ex. ogiltig token) och fel i formulären visas olika
  const [authError, setAuthError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hämta saldot när sidan öppnas. Utan giltig inloggning (401) skickas
  // besökaren till inloggningen.
  useEffect(() => {
    getAccount()
      .then((data) => setBalance(data.amount))
      .catch((err) => {
        if (isUnauthorized(err)) {
          router.replace("/login");
          return;
        }
        setAuthError(err instanceof Error ? err.message : "Kunde inte hämta saldot.");
      });
  }, [router]);

  // Gemensam hantering för insättning och uttag
  async function runTransaction(
    action: (amount: string) => Promise<{ amount: number }>,
    amount: string,
    successText: string,
    clear: () => void,
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await action(amount);
      setBalance(data.amount);
      setMessage(successText);
      clear();
    } catch (err) {
      // Token har gått ut eller är ogiltig: logga in igen
      if (isUnauthorized(err)) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setLoading(false);
    }
  }

  function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return runTransaction(
      deposit,
      depositAmount,
      `Du satte in ${formatKr(Number(depositAmount))}.`,
      () => setDepositAmount(""),
    );
  }

  function handleWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return runTransaction(
      withdraw,
      withdrawAmount,
      `Du tog ut ${formatKr(Number(withdrawAmount))}.`,
      () => setWithdrawAmount(""),
    );
  }

  // Logga ut: servern rensar cookien, sedan till inloggningen
  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-bold">Mitt konto</h1>

      <div aria-labelledby="balance-label" className="mt-6 rounded-xl bg-emerald-50 p-6" role="region">
        <p className="text-sm font-medium text-emerald-800" id="balance-label">
          Saldo
        </p>
        <p className="mt-1 text-4xl font-bold text-emerald-900">
          {balance === null ? "Hämtar…" : formatKr(balance)}
        </p>
      </div>

      {/* Feature flag från förra uppgiften: visas bara när FEATURE_SAVINGS=true */}
      {showSavings ? <SavingsPanel balance={balance} /> : null}

      <Link
        className="mt-4 inline-block font-semibold text-emerald-800 underline"
        href="/transactions"
      >
        Visa transaktionshistorik
      </Link>

      {/* noValidate: backend kontrollerar beloppet och frontend visar felmeddelandet */}
      <form className="mt-6 space-y-4" noValidate onSubmit={handleDeposit}>
        <div>
          <label className="mb-1 block font-medium" htmlFor="deposit-amount">
            Belopp att sätta in
          </label>
          <input
            className={inputClass}
            id="deposit-amount"
            inputMode="decimal"
            onChange={(e) => setDepositAmount(e.target.value)}
            step="0.01"
            type="number"
            value={depositAmount}
          />
        </div>

        <button className={buttonClass} disabled={!hydrated || loading} type="submit">
          Sätt in
        </button>
      </form>

      {/* VG: uttag. Backend nekar uttag som är större än saldot. */}
      <form className="mt-6 space-y-4 border-t border-gray-200 pt-6" noValidate onSubmit={handleWithdraw}>
        <div>
          <label className="mb-1 block font-medium" htmlFor="withdraw-amount">
            Belopp att ta ut
          </label>
          <input
            className={inputClass}
            id="withdraw-amount"
            inputMode="decimal"
            onChange={(e) => setWithdrawAmount(e.target.value)}
            step="0.01"
            type="number"
            value={withdrawAmount}
          />
        </div>

        <button className={secondaryButtonClass} disabled={!hydrated || loading} type="submit">
          Ta ut
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {authError ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {authError}{" "}
          <Link className="font-semibold underline" href="/login">
            Logga in igen
          </Link>
        </p>
      ) : null}

      <button
        className="mt-6 text-sm font-semibold text-gray-600 underline"
        onClick={handleLogout}
        type="button"
      >
        Logga ut
      </button>
    </section>
  );
}
