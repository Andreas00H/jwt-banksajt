# Banksajt med säker inloggning (JWT och bcrypt)

**Publicerad sajt:** http://13.61.15.216:3007
**Gröna GitHub Actions-körningar:** [Actions – lyckade körningar](https://github.com/Andreas00H/jwt-banksajt/actions?query=is%3Asuccess)
**Workflow:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

Banksajten (Next.js + Express + MySQL i Docker Compose) från de tidigare uppgifterna, nu med säkrare inloggning:

- lösenord sparas som **bcrypt-hashar**, aldrig i klartext
- inloggningen ger en **JWT** i stället för den gamla sexsiffriga koden och tabellen `sessions`
- backend **verifierar token** med middlewaren `requireAuth` innan saldo, insättning, uttag eller historik visas
- **VG:** JWT:n ligger i en **HttpOnly-cookie** som frontend aldrig kan läsa

```
Registrera → validera (lösenord minst 8 tecken) → bcrypt.hash(lösenord, 12) → spara password_hash
Logga in   → bcrypt.compare(lösenord, password_hash) → jwt.sign({ sub: id }) → Set-Cookie (HttpOnly)
Kontoanrop → requireAuth: Bearer-header eller cookie → jwt.verify → req.userId → SQL med req.userId
Logga ut   → POST /logout rensar cookien
```

## Så fungerar det

| Del | Fil | Vad den gör |
| --- | --- | --- |
| Registrering | `backend/server.js` (`POST /users`), `backend/src/credentials.js` | Kräver användarnamn och lösenord på minst 8 tecken (högst 72 byte, bcrypts gräns). Hashar med `bcrypt.hash(password, 12)`. Svaret innehåller aldrig lösenordet eller hashen. |
| Databas | `backend/db.js`, `database/init.sql` | Kolumnen heter `password_hash` och innehåller bara bcrypt-hashar (`$2b$12$…`). Tabellen `sessions` är borttagen. |
| Inloggning | `POST /sessions` | Jämför med `bcrypt.compare`. Samma felmeddelande ("Fel användarnamn eller lösenord") oavsett om användaren saknas eller lösenordet är fel. Finns inte användaren jämförs ändå mot en låtsas-hash, så att svarstiden inte avslöjar vilka användarnamn som finns. |
| Token | `backend/src/auth.js` | `jwt.sign({ sub: String(user.id) })` med `HS256`, `issuer: "banken"`, `audience: "banken-api"` och `expiresIn` 15 minuter. Servern startar inte om `JWT_SECRET` saknas eller är kortare än 32 byte. |
| `requireAuth` | `backend/src/auth.js` | 1) Läser `Authorization: Bearer <token>` eller cookien `access_token`. 2) `jwt.verify` med samma algoritm, issuer och audience. 3) Ogiltig eller utgången token ger 401. 4) `sub` måste vara en sträng som blir ett positivt heltal (`Number.isSafeInteger`). 5) Sätter `req.userId` och anropar `next()`. Vid fel anropas aldrig `next()`. |
| Skyddade routes | `POST /me/accounts`, `POST /me/accounts/transactions`, `POST /me/accounts/withdrawals`, `GET /me/accounts/transactions` | Alla använder `requireAuth`, och SQL-frågorna använder bara `req.userId`. Ett id i request body kan aldrig bestämma vilket konto som visas eller ändras. |

## VG: JWT i HttpOnly-cookie

- **Inloggning:** Express sätter cookien `access_token` med `httpOnly: true`, `sameSite: "lax"`, `path: "/"` och samma livslängd som token (15 minuter). JSON-svaret innehåller **ingen** token.
- **Frontend** sparar aldrig token, varken i React state, `localStorage` eller `sessionStorage`. Alla anrop använder `credentials: "include"`, och webbläsaren skickar cookien automatiskt (`frontend/lib/api.ts`).
- **CORS:** `cors({ origin: <frontendens exakta adress>, credentials: true })`, styrt av `FRONTEND_ORIGIN`. Aldrig `origin: "*"` tillsammans med cookies. På EC2 går anropen via Next.js rewrites på samma adress som sajten, så cookien är en vanlig förstapartscookie.
- **`cookie-parser`** läser `req.cookies` i `requireAuth`.
- **Utloggning:** `POST /logout` rensar cookien med samma inställningar (`httpOnly`, `sameSite`, `path`) som när den sattes. Knappen **Logga ut** anropar den och skickar användaren till inloggningen.
- **`secure`:** styrs av `COOKIE_SECURE`. Sajten på EC2 körs över **HTTP** (ingen domän eller HTTPS-certifikat), och då skulle webbläsaren vägra spara en `secure`-cookie. Därför är `COOKIE_SECURE=false` där. Med HTTPS sätts `COOKIE_SECURE=true`.
- **Bearer finns kvar** i backend för API-klienter och tester (G-delen). Webbsajten använder bara cookien.

## Miljövariabler

Ingen av dem checkas in i Git (`.env` står i `.gitignore`). Värdena står aldrig i README:n, i koden eller i workflowen.

| Variabel | Var | Beskrivning |
| --- | --- | --- |
| `JWT_SECRET` | `.env` i projektets rot (lokalt och på EC2) | Signeringsnyckel, minst 32 byte. Skapa med `openssl rand -hex 32`. Lokalt, i tester och på EC2 används **olika** nycklar. |
| `COOKIE_SECURE` | `.env` (valfri) | `true` bara när sajten körs med HTTPS. Standard är `false`. |
| `FRONTEND_ORIGIN` | `.env` (valfri) | Frontendens exakta adress för CORS. Standard är `http://localhost:3000`. |
| `FRONTEND_PORT`, `MYSQL_PORT` | `.env` på EC2 | Portar, så att projektet inte krockar med mina tidigare inlämningar på samma server. |
| `HOST`, `USERNAME`, `SSH_KEY` | GitHub Secrets | Används bara av deploy-jobbet för att logga in på EC2. |

**I GitHub Actions** skapar E2E-jobbet en egen slumpad `JWT_SECRET` för varje körning (`openssl rand -hex 32`, dold i loggen med `::add-mask::`). Den finns bara under testkörningen. Produktionsnyckeln finns bara i `.env` på EC2 och används aldrig i tester.

## Starta projektet lokalt

Krav: Node 24 och Docker Desktop.

```bash
# 1. Skapa .env i projektets rot med en egen nyckel
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# 2. Starta frontend, backend och databas
docker compose up -d --build
```

Sajten: http://localhost:3000. Stoppa med `docker compose down`.

## Köra testerna

```bash
# Enhetstester (backend): JWT, requireAuth, bcrypt, belopp och uttag – 45 tester
cd backend && npm ci && npm test

# Lint och build (frontend)
cd ../frontend && npm ci && npm run lint && npm run build

# E2E-tester mot en tom testdatabas i Docker – 11 tester
npx playwright install chromium   # första gången
npm run e2e:up                    # startar testmiljön med en egen slumpad JWT_SECRET
npm run test:e2e
npm run e2e:down
```

### Vad testerna visar

| Test | Typ | Kontrollerar |
| --- | --- | --- |
| `auth.test.js` | Vitest | Token innehåller `sub`, `iss`, `aud` och 15 minuters livslängd men inga lösenord. Ändrad token, fel nyckel, utgången token, fel issuer/audience och `alg: none` nekas. `requireAuth` släpper igenom Bearer och cookie, men svarar 401 och anropar aldrig `next()` utan token, vid fel format, ändrad token eller ogiltigt `sub`. |
| `credentials.test.js` | Vitest | Lösenord måste vara minst 8 tecken. Hashen är en bcrypt-hash, samma lösenord ger olika hashar (salt), och rätt lösenord godkänns medan fel nekas. |
| API: giltig Bearer-token | Playwright | Ett kontoanrop med giltig `Authorization: Bearer` ger saldot. Utan token och med en ändrad token blir svaret 401, och en insättning med ändrad token ändrar inte saldot. Fel lösenord ger ingen token, och inloggningssvaret innehåller ingen token i JSON. |
| VG: HttpOnly-cookie | Playwright | Inloggad användare ser kontot via cookien. Cookien är `HttpOnly` och `SameSite=Lax` och syns inte i `document.cookie`. Efter **Logga ut** är cookien borta, kontoanropet ger 401 och `/account` skickar till inloggningen. |
| Fel lösenord, kort lösenord | Playwright | Ingen inloggning och ingen cookie. Registrering med under 8 tecken nekas. |
| Tidigare flöden | Playwright | Utloggad besökare stoppas, insättning, historik efter omladdning och ny inloggning, ogiltigt belopp, två användare med separat historik, lyckat och nekat uttag. |

## GitHub Actions

Körs vid push och pull request till `main`:

- **Kontrollera frontend:** `npm ci`, `npm run lint`, `npm run build`
- **Kontrollera backend (Vitest):** `npm ci`, `node --check`, `npm test`
- **E2E-tester (Playwright):** egen slumpad `JWT_SECRET`, Docker Compose med tom testdatabas, `npm run test:e2e`
- **Deploy till EC2:** `needs: [frontend, backend, e2e]`, bara vid push till `main`. Loggar in med SSH, kör `git pull` och `docker compose up -d --build`.

## Publicering på EC2

- Egen mapp `~/jwt-banksajt`, frontend på port **3007** och MySQL på `127.0.0.1:3310`. Mina tidigare inlämningar på samma server rörs inte.
- `.env` på servern innehåller portarna och en egen `JWT_SECRET` som skapades direkt på servern med `openssl rand -hex 32` och aldrig har visats eller kopierats någon annanstans.
- Eftersom kolumnen bytte namn till `password_hash` startar projektet med en **ny, tom databasvolym**. Inga gamla lösenord i klartext följde med.

## Säkerhetsfrågor

**1. Varför kan du läsa en JWT-payload utan signeringsnyckeln, och vad skyddar signaturen?**
Payload är bara Base64url-kodad, inte krypterad, så vem som helst som har token kan avkoda den. Signaturen skyddar mot **ändringar**: servern räknar ut signaturen igen med sin hemliga nyckel, och om någon har ändrat header eller payload stämmer den inte. Därför får hemligheter aldrig ligga i payloaden.

**2. Vad händer om någon stjäl en giltig token innan den går ut? Stoppar en signatur den personen?**
Nej. Signaturen bevisar bara att token är äkta och oförändrad, inte vem som skickar den. Den som stjäl token kan använda den tills den går ut. Därför är token kortlivad (15 minuter), ligger i en HttpOnly-cookie som JavaScript inte kan läsa, och bör skickas över HTTPS.

**3. Vad är skillnaden mellan att hasha ett lösenord och att signera en token?**
Hashning är **envägs**: lösenordet kan inte räknas tillbaka, och vid inloggning jämförs bara lösenordet mot hashen. bcrypt är dessutom medvetet långsamt och använder salt mot gissningsattacker. Signering skapar ett **bevis på äkthet** för data som fortfarande är läsbar: innehållet ska användas, men servern ska kunna upptäcka om det har ändrats.

**4. Vilken risk finns med att lagra en token i localStorage om sidan får en XSS-sårbarhet?**
Vid XSS kör en angripare egen JavaScript på sidan och kan läsa allt i `localStorage`, alltså stjäla token och använda den var som helst tills den går ut. En HttpOnly-cookie kan inte läsas av JavaScript, vilket är skälet till VG-delen. Med cookies måste man i stället tänka på **CSRF**, alltså att en annan sajt får webbläsaren att skicka cookien. Det begränsas här med `SameSite=Lax` och CORS som bara tillåter frontendens exakta adress.

**5. Varför kan servern inte automatiskt veta att en JWT ska sluta gälla när användaren klickar på Logga ut?**
En JWT är **tillståndslös**: servern sparar ingenting om utfärdade tokens, utan kontrollerar bara signatur och utgångstid. Utloggning rensar cookien i webbläsaren, men en kopia av token som någon redan har fortsätter gälla tills `exp`. Lösningar är kort livslängd, en spärrlista med token-id:n (`jti`) i databasen, eller kortlivade access-tokens tillsammans med refresh-tokens som kan återkallas.

**6. Vilka hemligheter finns i projektet, och var ska de lagras?**
- `JWT_SECRET`: **lokalt** i `.env` (i `.gitignore`), **i GitHub Actions** som en slumpad nyckel som bara finns under testkörningen, och **på EC2** i `.env` i projektmappen med en egen nyckel.
- Databaslösenordet: lokalt och på EC2 i Docker Compose-miljön. I en riktig app ska även det ligga i `.env` och vara unikt.
- `HOST`, `USERNAME` och `SSH_KEY` för deploy: **GitHub Secrets**.
- SSH-nyckeln för att logga in på servern: bara på min dator, i `~/.ssh`.
