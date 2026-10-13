import type { NextConfig } from "next";

// Adressen till backend (Express). På AWS körs backend på samma server.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  // Bygger en fristående server med bara de filer som behövs.
  // Gör Docker-imagen mycket mindre, vilket sparar disk på servern.
  output: "standalone",

  // Testerna öppnar sidan på 127.0.0.1, så den adressen måste tillåtas i utvecklingsläget
  allowedDevOrigins: ["127.0.0.1"],

  // Om frontend anropar sin egen adress (t.ex. /users) skickar Next.js vidare
  // anropet till backend. Då behöver webbläsaren inte känna till serverns IP-adress.
  async rewrites() {
    return [
      { source: "/users", destination: `${BACKEND_URL}/users` },
      { source: "/sessions", destination: `${BACKEND_URL}/sessions` },
      { source: "/logout", destination: `${BACKEND_URL}/logout` },
      { source: "/me/:path*", destination: `${BACKEND_URL}/me/:path*` },
    ];
  },
};

export default nextConfig;
