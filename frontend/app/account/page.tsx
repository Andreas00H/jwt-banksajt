import { connection } from "next/server";
import { isSavingsEnabled } from "@/lib/features";
import AccountClient from "./account-client";

// Serverdelen av kontosidan. Den läser feature flaggan på servern
// och skickar vidare till klientdelen om Sparmål ska visas.
export default async function AccountPage() {
  // Läs flaggan vid varje besök (inte bara när sajten byggs).
  // Då räcker det att ändra .env och starta om containern för att
  // slå på eller av funktionen, utan att bygga om koden.
  await connection();

  return <AccountClient showSavings={isSavingsEnabled()} />;
}
