import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banken",
  description: "En enkel banksajt byggd med Next.js och Express.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv">
      <body className="min-h-screen">
        <header className="bg-emerald-800 text-white">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
            <span className="mr-auto text-lg font-bold">🏦 Banken</span>
            <Link className="hover:underline" href="/">
              Hem
            </Link>
            <Link className="hover:underline" href="/register">
              Skapa användare
            </Link>
            <Link className="hover:underline" href="/login">
              Logga in
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
