// Feature flags – styr om nya funktioner visas för användaren.
// Värdet kommer från miljövariabler (på servern: .env → docker-compose.yml).
// Allt utom exakt "true" räknas som avstängt, så standard är AV.

export function isSavingsEnabled() {
  return process.env.FEATURE_SAVINGS === "true";
}
