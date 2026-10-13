import { useSyncExternalStore } from "react";

// Returnerar false när sidan precis har laddats (innan React har tagit över
// sidan i webbläsaren) och true när React är redo. Används för att hålla
// knapparna avstängda tills de faktiskt fungerar, annars kan ett snabbt klick
// skicka formuläret på det vanliga HTML-sättet istället för via vår kod.
const subscribe = () => () => {};

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
