"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/api";
import { buttonClass, cardClass, inputClass } from "@/components/form-styles";
import { useHydrated } from "@/lib/use-hydrated";

export default function LoginPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Servern sparar JWT:n i en HttpOnly-cookie. Frontend ser aldrig själva token.
      await login(username, password);
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
      setLoading(false);
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-bold">Logga in</h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block font-medium" htmlFor="username">
            Användarnamn
          </label>
          <input
            autoComplete="username"
            className={inputClass}
            id="username"
            onChange={(e) => setUsername(e.target.value)}
            required
            value={username}
          />
        </div>

        <div>
          <label className="mb-1 block font-medium" htmlFor="password">
            Lösenord
          </label>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </div>

        <button className={buttonClass} disabled={!hydrated || loading} type="submit">
          Logga in
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
