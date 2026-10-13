"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createUser } from "@/lib/api";
import { buttonClass, cardClass, inputClass } from "@/components/form-styles";
import { useHydrated } from "@/lib/use-hydrated";

export default function RegisterPage() {
  const hydrated = useHydrated();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await createUser(username, password);
      setMessage("Användaren är skapad! Nu kan du logga in.");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-bold">Skapa användare</h1>

      {/* noValidate: backend kontrollerar uppgifterna och felmeddelandet visas under formuläret */}
      <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
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
            aria-describedby="password-hint"
            autoComplete="new-password"
            className={inputClass}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
          <p className="mt-1 text-sm text-gray-600" id="password-hint">
            Minst 8 tecken.
          </p>
        </div>

        <button className={buttonClass} disabled={!hydrated || loading} type="submit">
          Skapa användare
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">
          {message}{" "}
          <Link className="font-semibold underline" href="/login">
            Gå till inloggningen
          </Link>
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
