import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt använder bara de första 72 byten av ett lösenord, så längre lösenord nekas
export const MAX_PASSWORD_BYTES = 72;

// Kontrollerar uppgifterna vid registrering.
// Returnerar { ok: true, username } eller { ok: false, error }.
export function validateRegistration(username, password) {
  if (typeof username !== "string" || !username.trim()) {
    return { ok: false, error: "Användarnamn krävs." };
  }
  if (username.trim().length > 50) {
    return { ok: false, error: "Användarnamnet får vara högst 50 tecken." };
  }
  if (typeof password !== "string" || !password) {
    return { ok: false, error: "Lösenord krävs." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "Lösenordet måste vara minst 8 tecken." };
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return { ok: false, error: "Lösenordet får vara högst 72 byte." };
  }
  return { ok: true, username: username.trim() };
}

// Hashar lösenordet med bcrypt. Varje hash får ett eget slumpat salt.
export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// En giltig bcrypt-hash som inte hör till något lösenord. Används när användaren
// inte finns, så att inloggningen tar lika lång tid oavsett om användarnamnet finns.
const DUMMY_HASH = bcrypt.hashSync("ingen-anvandare-har-detta-losenord", BCRYPT_ROUNDS);

// Jämför lösenordet med hashen. Returnerar false om något saknas.
export async function checkPassword(password, passwordHash) {
  if (typeof password !== "string") return false;
  const match = await bcrypt.compare(password, passwordHash ?? DUMMY_HASH);
  return Boolean(passwordHash) && match;
}
