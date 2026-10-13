"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate, formatKr, getTransactions, isUnauthorized, type Transaction } from "@/lib/api";
import { cardClass } from "@/components/form-styles";

// Transaktionshistorik för den inloggade användaren, senaste först.
export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTransactions()
      .then(setTransactions)
      .catch((err) => {
        // Utan giltig inloggning skickas besökaren till inloggningen
        if (isUnauthorized(err)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Kunde inte hämta transaktionerna.");
      });
  }, [router]);

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-bold">Transaktioner</h1>

      <Link className="mt-2 inline-block font-semibold text-emerald-800 underline" href="/account">
        Tillbaka till kontot
      </Link>

      {error ? (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {error}{" "}
          <Link className="font-semibold underline" href="/login">
            Logga in igen
          </Link>
        </p>
      ) : transactions === null ? (
        <p className="mt-6 text-gray-600">Hämtar transaktioner…</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 rounded-lg bg-gray-50 p-4 text-gray-700">
          Inga transaktioner än. Gör en insättning på kontosidan så syns den här.
        </p>
      ) : (
        <ul aria-label="Transaktioner" className="mt-6 divide-y divide-gray-200">
          {transactions.map((transaction) => {
            const isDeposit = transaction.type === "deposit";
            return (
              <li className="flex items-center justify-between gap-4 py-3" key={transaction.id}>
                <div>
                  <p className="font-medium">{isDeposit ? "Insättning" : "Uttag"}</p>
                  <p className="text-sm text-gray-600">{formatDate(transaction.createdAt)}</p>
                </div>
                <p className={`font-semibold ${isDeposit ? "text-emerald-700" : "text-red-700"}`}>
                  {isDeposit ? "+" : "-"}
                  {formatKr(transaction.amount)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
