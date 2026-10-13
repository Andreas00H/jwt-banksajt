// Frontend anropar sajtens egen adress (t.ex. /sessions) och Next.js skickar vidare
// till backend (se rewrites i next.config.ts). Då ligger inloggnings-cookien på samma
// adress som sajten. NEXT_PUBLIC_API_URL kan sättas om backend ligger på en egen adress.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Fel från API:t med HTTP-status, så att sidorna kan se skillnad på
// "inte inloggad" (401) och andra fel.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// VG: JWT:n ligger i en HttpOnly-cookie som JavaScript inte kan läsa.
// credentials: "include" gör att webbläsaren skickar med cookien automatiskt.
async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? `Något gick fel (status ${response.status}).`, response.status);
  }

  return data as T;
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function createUser(username: string, password: string) {
  return request<{ id: number; username: string }>("POST", "/users", { username, password });
}

// Servern sätter cookien. Svaret innehåller ingen token.
export function login(username: string, password: string) {
  return request<{ message: string }>("POST", "/sessions", { username, password });
}

// Servern rensar cookien
export function logout() {
  return request<{ message: string }>("POST", "/logout");
}

export function getAccount() {
  return request<{ amount: number }>("POST", "/me/accounts");
}

// Beloppet skickas som det står i fältet. Backend kontrollerar att det är giltigt.
// Vilket konto som ändras bestäms av token, aldrig av något i body.
export function deposit(amount: number | string) {
  return request<{ amount: number }>("POST", "/me/accounts/transactions", { amount });
}

// Ta ut pengar. Backend nekar om beloppet är ogiltigt eller större än saldot.
export function withdraw(amount: number | string) {
  return request<{ amount: number }>("POST", "/me/accounts/withdrawals", { amount });
}

export type Transaction = {
  id: number;
  type: "deposit" | "withdrawal";
  amount: number;
  createdAt: string;
};

// Hämtar den inloggade användarens transaktioner (senaste först)
export async function getTransactions() {
  const data = await request<{ transactions: Transaction[] }>("GET", "/me/accounts/transactions");
  return data.transactions;
}

export function formatKr(amount: number) {
  return `${amount.toLocaleString("sv-SE")} kr`;
}

// T.ex. "30 sep. 2026 13:45" i svensk tid
export function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
