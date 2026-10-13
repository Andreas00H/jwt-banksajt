import { describe, expect, test, vi } from "vitest";
import jwt from "jsonwebtoken";
// Testar de riktiga funktionerna som server.js använder
import {
  COOKIE_NAME,
  createRequireAuth,
  createToken,
  getJwtSecret,
  userIdFromPayload,
  verifyToken,
} from "../src/auth.js";

// Testnyckel som bara finns i testerna, aldrig produktionsnyckeln
const SECRET = "test-nyckel-som-bara-anvands-i-vitest-0123456789";

// Ändrar ett tecken mitt i payload-delen, så att signaturen inte längre stämmer
function tamper(token) {
  const [header, payload, signature] = token.split(".");
  const middle = Math.floor(payload.length / 2);
  const changed = payload[middle] === "A" ? "B" : "A";
  return [header, payload.slice(0, middle) + changed + payload.slice(middle + 1), signature].join(".");
}

// Enkla låtsas-objekt för Express req/res
function fakeReq({ authorization, cookie } = {}) {
  return {
    get: (name) => (name.toLowerCase() === "authorization" ? authorization : undefined),
    cookies: cookie ? { [COOKIE_NAME]: cookie } : {},
  };
}
function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe("getJwtSecret", () => {
  test("godkänner en nyckel på minst 32 byte", () => {
    expect(getJwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
  });

  test("kastar fel om nyckeln saknas eller är för kort", () => {
    expect(() => getJwtSecret({})).toThrow("minst 32 byte");
    expect(() => getJwtSecret({ JWT_SECRET: "för-kort" })).toThrow("minst 32 byte");
  });
});

describe("createToken och verifyToken", () => {
  test("en token innehåller användar-id i sub, issuer, audience och utgångstid", () => {
    const payload = verifyToken(createToken(42, SECRET), SECRET);
    expect(payload.sub).toBe("42");
    expect(payload.iss).toBe("banken");
    expect(payload.aud).toBe("banken-api");
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  test("payload innehåller inga lösenord", () => {
    const payload = jwt.decode(createToken(42, SECRET));
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "sub"]);
  });

  test("nekar en token där innehållet har ändrats", () => {
    expect(() => verifyToken(tamper(createToken(42, SECRET)), SECRET)).toThrow();
  });

  test("nekar en token signerad med en annan nyckel", () => {
    const other = createToken(42, "en-helt-annan-nyckel-som-ar-minst-32-byte");
    expect(() => verifyToken(other, SECRET)).toThrow();
  });

  test("nekar en utgången token", () => {
    const expired = jwt.sign({ sub: "42", exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, {
      algorithm: "HS256",
      issuer: "banken",
      audience: "banken-api",
    });
    expect(() => verifyToken(expired, SECRET)).toThrow(/expired/);
  });

  test("nekar fel issuer eller audience", () => {
    const wrongIssuer = jwt.sign({ sub: "42" }, SECRET, { issuer: "annan-app", audience: "banken-api" });
    const wrongAudience = jwt.sign({ sub: "42" }, SECRET, { issuer: "banken", audience: "annat-api" });
    expect(() => verifyToken(wrongIssuer, SECRET)).toThrow();
    expect(() => verifyToken(wrongAudience, SECRET)).toThrow();
  });

  test("nekar en osignerad token (alg: none)", () => {
    const unsigned = jwt.sign({ sub: "42" }, null, {
      algorithm: "none",
      issuer: "banken",
      audience: "banken-api",
    });
    expect(() => verifyToken(unsigned, SECRET)).toThrow();
  });
});

describe("userIdFromPayload", () => {
  test("godkänner ett positivt heltal som text", () => {
    expect(userIdFromPayload({ sub: "101" })).toBe(101);
  });

  test("nekar sub som saknas, inte är text eller inte är ett positivt heltal", () => {
    expect(userIdFromPayload({})).toBeNull();
    expect(userIdFromPayload({ sub: 101 })).toBeNull();
    expect(userIdFromPayload({ sub: "abc" })).toBeNull();
    expect(userIdFromPayload({ sub: "0" })).toBeNull();
    expect(userIdFromPayload({ sub: "-5" })).toBeNull();
    expect(userIdFromPayload({ sub: "1.5" })).toBeNull();
    expect(userIdFromPayload("101")).toBeNull();
  });
});

describe("requireAuth", () => {
  const requireAuth = createRequireAuth(SECRET);

  test("släpper igenom en giltig Bearer-token och sätter req.userId", () => {
    const req = fakeReq({ authorization: `Bearer ${createToken(7, SECRET)}` });
    const next = vi.fn();
    requireAuth(req, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(7);
  });

  test("släpper igenom en giltig token i cookien (VG)", () => {
    const req = fakeReq({ cookie: createToken(8, SECRET) });
    const next = vi.fn();
    requireAuth(req, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(8);
  });

  test("svarar 401 och anropar inte next() utan token", () => {
    const res = fakeRes();
    const next = vi.fn();
    requireAuth(fakeReq(), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("svarar 401 om headern har fel format", () => {
    const res = fakeRes();
    const next = vi.fn();
    requireAuth(fakeReq({ authorization: `Token ${createToken(7, SECRET)}` }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("svarar 401 för en ändrad token", () => {
    const res = fakeRes();
    const next = vi.fn();
    requireAuth(fakeReq({ authorization: `Bearer ${tamper(createToken(7, SECRET))}` }), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Ogiltig eller utgången token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("svarar 401 om sub inte är ett giltigt id", () => {
    const badSub = jwt.sign({ sub: "abc" }, SECRET, { issuer: "banken", audience: "banken-api" });
    const res = fakeRes();
    const next = vi.fn();
    requireAuth(fakeReq({ authorization: `Bearer ${badSub}` }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
