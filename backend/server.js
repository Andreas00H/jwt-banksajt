import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initDatabase, query, withTransaction } from "./db.js";
import { validateAmount } from "./src/validateAmount.js";
import { validateWithdrawal } from "./src/validateWithdrawal.js";
import {
  COOKIE_NAME,
  TOKEN_LIFETIME_SECONDS,
  cookieOptions,
  createRequireAuth,
  createToken,
  getJwtSecret,
} from "./src/auth.js";
import { checkPassword, hashPassword, validateRegistration } from "./src/credentials.js";

// Signeringsnyckeln måste finnas och vara minst 32 byte, annars startar inte servern
let secret;
try {
  secret = getJwtSecret();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3001;

// secure-cookies kräver HTTPS. Sajten på EC2 körs över HTTP, därför styrs det av en variabel.
const secureCookies = process.env.COOKIE_SECURE === "true";

// Bara frontendens exakta adresser får anropa API:t med cookies (aldrig origin: "*")
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Kontrollerar JWT (Bearer-header eller cookie) före alla skyddade routes
const requireAuth = createRequireAuth(secret);

// Hjälpfunktion: hämta kontot för den inloggade användaren.
// Id:t kommer ALLTID från den verifierade token (req.userId), aldrig från request body.
async function findAccountByUserId(userId) {
  const rows = await query("SELECT id, amount FROM accounts WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0] ?? null;
}

// Skapa användare – lösenordet hashas med bcrypt innan INSERT
app.post("/users", async (req, res) => {
  const check = validateRegistration(req.body?.username, req.body?.password);
  if (!check.ok) {
    return res.status(400).json({ error: check.error });
  }

  try {
    const passwordHash = await hashPassword(req.body.password);
    const result = await query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [
      check.username,
      passwordHash,
    ]);

    // Varje ny användare får ett bankkonto med 0 kr
    await query("INSERT INTO accounts (user_id, amount) VALUES (?, 0)", [result.insertId]);

    // Svaret innehåller aldrig lösenordet eller hashen
    res.status(201).json({ id: result.insertId, username: check.username });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Användarnamnet är redan taget." });
    }
    console.error(error);
    res.status(500).json({ error: "Kunde inte skapa användaren." });
  }
});

// Logga in – jämför lösenordet med hashen och skapa en JWT
app.post("/sessions", async (req, res) => {
  const { username, password } = req.body ?? {};

  try {
    const users = await query("SELECT id, password_hash FROM users WHERE username = ? LIMIT 1", [
      String(username ?? "").trim(),
    ]);
    const user = users[0];

    // Samma felmeddelande oavsett om användarnamnet saknas eller lösenordet är fel
    const passwordIsCorrect = await checkPassword(password, user?.password_hash);
    if (!user || !passwordIsCorrect) {
      return res.status(401).json({ error: "Fel användarnamn eller lösenord" });
    }

    const token = createToken(user.id, secret);

    // VG: token skickas som HttpOnly-cookie. Frontend kan aldrig läsa den,
    // och den finns inte med i JSON-svaret.
    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions(secureCookies),
      maxAge: TOKEN_LIFETIME_SECONDS * 1000,
    });
    res.json({ message: "Inloggningen lyckades" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kunde inte logga in." });
  }
});

// Logga ut – rensa cookien med samma inställningar som när den sattes
app.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions(secureCookies));
  res.json({ message: "Du är utloggad" });
});

// Visa saldo – skyddad med requireAuth
app.post("/me/accounts", requireAuth, async (req, res) => {
  try {
    const account = await findAccountByUserId(req.userId);
    if (!account) {
      return res.status(404).json({ error: "Kontot hittades inte." });
    }
    res.json({ amount: Number(account.amount) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kunde inte hämta saldot." });
  }
});

// Kontroll att servern och databasen svarar (används av Docker healthcheck)
app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error" });
  }
});

// Sätt in pengar – Update (UPDATE) + Create (INSERT i transactions)
app.post("/me/accounts/transactions", requireAuth, async (req, res) => {
  try {
    const account = await findAccountByUserId(req.userId);
    if (!account) {
      return res.status(404).json({ error: "Kontot hittades inte." });
    }

    // Samma funktion som testas med Vitest (src/validateAmount.js)
    const result = validateAmount(req.body?.amount);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    // Saldo och transaktion sparas tillsammans. Om något går fel
    // ångras båda, så historiken och saldot kan aldrig visa olika saker.
    const newAmount = await withTransaction(async (tx) => {
      // FOR UPDATE låser kontot tills transaktionen är klar
      await tx("SELECT amount FROM accounts WHERE id = ? FOR UPDATE", [account.id]);
      await tx("UPDATE accounts SET amount = amount + ? WHERE id = ?", [result.amount, account.id]);
      await tx("INSERT INTO transactions (account_id, type, amount) VALUES (?, 'deposit', ?)", [
        account.id,
        result.amount,
      ]);
      const rows = await tx("SELECT amount FROM accounts WHERE id = ?", [account.id]);
      return Number(rows[0].amount);
    });

    res.json({ amount: newAmount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Insättningen misslyckades." });
  }
});

// VG: Ta ut pengar – Update (UPDATE) + Create (INSERT i transactions)
// Nekas om beloppet är ogiltigt eller större än saldot. Ett nekat uttag
// ändrar varken saldot eller historiken.
app.post("/me/accounts/withdrawals", requireAuth, async (req, res) => {
  try {
    const account = await findAccountByUserId(req.userId);
    if (!account) {
      return res.status(404).json({ error: "Kontot hittades inte." });
    }

    // Snabb kontroll av beloppet innan databasen låses
    const amountCheck = validateAmount(req.body?.amount);
    if (!amountCheck.ok) {
      return res.status(400).json({ error: amountCheck.error });
    }

    const result = await withTransaction(async (tx) => {
      // FOR UPDATE låser kontot, så att två uttag samtidigt inte kan övertrassera
      const rows = await tx("SELECT amount FROM accounts WHERE id = ? FOR UPDATE", [account.id]);
      const check = validateWithdrawal(amountCheck.amount, rows[0].amount);
      if (!check.ok) {
        // Inget har ändrats, så transaktionen avslutas utan ändringar
        return { error: check.error };
      }

      await tx("UPDATE accounts SET amount = amount - ? WHERE id = ?", [check.amount, account.id]);
      await tx("INSERT INTO transactions (account_id, type, amount) VALUES (?, 'withdrawal', ?)", [
        account.id,
        check.amount,
      ]);
      const updated = await tx("SELECT amount FROM accounts WHERE id = ?", [account.id]);
      return { amount: Number(updated[0].amount) };
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ amount: result.amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Uttaget misslyckades." });
  }
});

// Transaktionshistorik – Read (SELECT)
// Skyddad med requireAuth. Visar bara den inloggade användarens egna
// transaktioner, senaste först.
app.get("/me/accounts/transactions", requireAuth, async (req, res) => {
  try {
    const account = await findAccountByUserId(req.userId);
    if (!account) {
      return res.status(404).json({ error: "Kontot hittades inte." });
    }

    // UNIX_TIMESTAMP ger tiden i sekunder oberoende av serverns tidszon
    const rows = await query(
      `SELECT id, type, amount, UNIX_TIMESTAMP(created_at) AS created
       FROM transactions
       WHERE account_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
      [account.id],
    );

    res.json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        createdAt: new Date(Number(row.created) * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kunde inte hämta transaktionerna." });
  }
});

// Anslut till databasen först, starta sedan servern
try {
  await initDatabase();
} catch (error) {
  console.error("Kunde inte ansluta till databasen. Är MySQL (t.ex. MAMP) igång?");
  console.error(error.message);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});
