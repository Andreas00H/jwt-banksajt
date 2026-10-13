import { formatKr } from "@/lib/api";

// VG: Sparmål-panel. Visar hur nära användaren är ett sparmål.
// Styrs av feature flaggan FEATURE_SAVINGS.
const SAVINGS_GOAL = 10000;

export function SavingsPanel({ balance }: { balance: number | null }) {
  const saved = balance ?? 0;
  const percent = Math.min(100, Math.round((saved / SAVINGS_GOAL) * 100));
  const left = Math.max(0, SAVINGS_GOAL - saved);

  return (
    <div className="mt-6 rounded-xl border border-emerald-200 p-6">
      <div className="flex items-center justify-between">
        <p className="font-semibold">🎯 Sparmål</p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          Nyhet
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">Mål: {formatKr(SAVINGS_GOAL)}</p>

      {balance === null ? (
        <p className="mt-4 text-sm text-gray-600">Hämtar…</p>
      ) : (
        <>
          <div
            aria-label={`${percent} procent av sparmålet`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-gray-700">
            {left === 0
              ? "🎉 Du har nått ditt sparmål!"
              : `${percent} % klart – ${formatKr(left)} kvar till målet.`}
          </p>
        </>
      )}
    </div>
  );
}
