import jwt from "jsonwebtoken";

// Inställningar för bankens JWT. Samma värden används när token skapas
// och när den verifieras, annars nekas den.
export const JWT_ISSUER = "banken";
export const JWT_AUDIENCE = "banken-api";
export const TOKEN_LIFETIME_SECONDS = 15 * 60; // 15 minuter
export const COOKIE_NAME = "access_token";

// Hämtar signeringsnyckeln. Servern ska inte starta med en saknad eller för kort nyckel.
export function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("JWT_SECRET måste vara minst 32 byte");
  }
  return secret;
}

// Skapar en kortlivad, signerad token. Payload innehåller bara användar-id:t (sub),
// aldrig lösenord eller andra hemligheter – payload går att läsa för alla som har token.
export function createToken(userId, secret) {
  return jwt.sign({ sub: String(userId) }, secret, {
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: TOKEN_LIFETIME_SECONDS,
  });
}

// Verifierar signatur, algoritm, utfärdare, mottagare och utgångstid.
// Kastar ett fel om något inte stämmer.
export function verifyToken(token, secret) {
  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

// Plockar ut ett giltigt användar-id ur en verifierad payload, annars null.
export function userIdFromPayload(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    return null;
  }
  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return null;
  }
  return userId;
}

// Token kan komma på två sätt:
// 1. Headern "Authorization: Bearer <token>" (API-anrop och tester)
// 2. HttpOnly-cookien access_token (webbläsaren, VG)
export function tokenFromRequest(req) {
  const header = req.get?.("authorization") ?? "";
  if (header) {
    const match = /^Bearer (.+)$/.exec(header);
    return match ? match[1].trim() : null;
  }
  return req.cookies?.[COOKIE_NAME] ?? null;
}

// Inställningar för cookien. secure styrs av COOKIE_SECURE, eftersom sajten
// på EC2 körs över HTTP och webbläsaren annars inte sparar cookien.
export function cookieOptions(secure) {
  return {
    httpOnly: true, // JavaScript i webbläsaren kan inte läsa cookien
    secure,
    sameSite: "lax",
    path: "/",
  };
}

// Middleware för skyddade routes. Skapas med signeringsnyckeln så att den
// går att testa med Vitest utan att starta servern.
export function createRequireAuth(secret) {
  return function requireAuth(req, res, next) {
    // 1. Hämta token från headern (Bearer) eller cookien
    const token = tokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Du måste vara inloggad." });
    }

    // 2–3. Verifiera token. Ogiltig eller utgången token ger 401.
    let payload;
    try {
      payload = verifyToken(token, secret);
    } catch {
      return res.status(401).json({ error: "Ogiltig eller utgången token" });
    }

    // 4. sub måste vara ett positivt heltal
    const userId = userIdFromPayload(payload);
    if (userId === null) {
      return res.status(401).json({ error: "Ogiltig token" });
    }

    // 5. Spara id:t och låt routen köras
    req.userId = userId;
    next();
  };
}
