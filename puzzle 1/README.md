# Phish or Legit? — The Email Detective Game

A single-file, offline HTML game for employee cyber-awareness sessions. Teams read 10 emails, mark each one **Phish** or **Legit**, collect the Answer Hint letters from the emails they marked Phish, and unjumble them into a password. The right password unlocks a debrief of every email.

## Files

| File | What it is | Share it? |
| --- | --- | --- |
| `template.html` | The game: layout, styles, logic and the public email content (emails, headers, the simulated DNS/WHOIS/URL-scan data, briefing, hint letters) | Yes |
| `build.js` | Encrypts the answers and writes `dist/game.html`, then checks it for leaks | Yes |
| `answers.private.json` | Verdicts, giveaways, "why it was hard" text and teaching notes for both sets | **No** (git-ignored) |
| `.env` | Optional local file holding the passwords | **No** (git-ignored) |
| `docs/` | The facilitator source documents, which contain the answer keys | **No** (git-ignored) |
| `dist/game.html` | The built game. This is the only file players get | Yes |
| `tests/game.test.js` | Headless browser tests (Edge or Chrome via `playwright-core`) | Yes |

## Build

Needs Node.js 18 or later. No other dependencies are needed to build.

PowerShell:

```powershell
$env:SET_A_PASSWORD='SENTRY'; $env:SET_B_PASSWORD='WARDEN'; node build.js
```

Bash:

```bash
SET_A_PASSWORD=SENTRY SET_B_PASSWORD=WARDEN node build.js
```

Or put the two lines below in a `.env` file next to `build.js` and run `node build.js`:

```
SET_A_PASSWORD=SENTRY
SET_B_PASSWORD=WARDEN
```

The build:

1. Checks `template.html` itself for answer material.
2. Checks that the hint letters in `template.html` match `answers.private.json`, and that each password is an anagram of that set's Phish hint letters.
3. Encrypts each set's debrief with AES-256-GCM. The key comes from the password via PBKDF2-SHA-256, 600,000 iterations, with a new random 16-byte salt and 12-byte IV per set on every build.
4. Writes `dist/game.html` containing only salt, IV, iteration count and ciphertext.
5. Scans the output and refuses to write it if it finds either password, any sentence of giveaway, why-hard or teaching text, the Phish/decoy hint sequences, or Phish/Legit used in a verdict context (e.g. `"verdict": "Phish"`, a list of verdicts, or a numbered answer table).

To re-run only the leak check on an existing build: `node build.js --check`.

Set `PBKDF2_ITERATIONS` to use more than 600,000 iterations (fewer is refused). Each extra 100,000 iterations adds roughly 0.1 s per password check on a laptop.

## Using new passwords

The password must be spelled by the hint letters of the Phish emails, so changing it means changing hint letters in two places:

1. In `template.html`, edit the `hint: 'X'` letter on the affected emails (inside `SETS.A.emails` or `SETS.B.emails`). Give legit emails decoy letters that don't fit the new word.
2. In `answers.private.json`, make the same `hint` change, and update `hintSummary` (it names the word).
3. Build with the new passwords: `SET_A_PASSWORD=NEWWORD SET_B_PASSWORD=OTHERWORD node build.js`.

The build stops with a clear message if the template and private file disagree, or if the password isn't an anagram of the Phish hints. Every build uses fresh salts, so a rebuild with the same password still produces a different file.

To change verdicts or debrief text, edit `answers.private.json` only and rebuild.

## Running the tests

```bash
npm install
```

```bash
SET_A_PASSWORD=SENTRY SET_B_PASSWORD=WARDEN node build.js && SET_A_PASSWORD=SENTRY SET_B_PASSWORD=WARDEN node --test tests/game.test.js
```

The tests use the Edge or Chrome already installed on the machine (no browser download). They cover: correct markings and password unlocking the debrief for both sets; wrong markings producing the wrong letters and failing; the 5-try, 30-second cooldown (including that it survives a refresh and repeats); progress surviving a refresh, inert links and Reset; the investigation tools (Show original headers, SPF test pass/fail, DKIM, DMARC, WHOIS, IP lookup, URL scan, and that the Email details box is gone); the phone layout; and the plaintext check passing on `dist/game.html` and catching planted leaks.

## Running the game

Open `dist/game.html` directly in a browser (double-click, or copy it to each player's laptop or a USB stick). It makes no network requests, loads no fonts or scripts, and its Content-Security-Policy blocks any connection.

Web Crypto only works in a secure context. Opening the file from disk (`file://`), `localhost` or `https://` is fine. Serving it from a plain `http://` address on the office network will not work: the game shows a message saying so.

Progress (set, team name, markings, timer, attempt count, cooldown) is saved in `sessionStorage`, so a refresh keeps it. Closing the tab ends the session. The password and the decrypted debrief are never stored.

## Security limits (please read)

The encryption keeps the answers out of view-source, browser dev tools and casual file inspection. It is a deterrent for a training game, not strong secrecy:

- **The password space is tiny.** The hint letters are public, and the password is an anagram of 6 of the 10 letters. That's about 151,000 candidates, fewer if the attacker guesses it's an English word. Each guess costs 600,000 PBKDF2 rounds (around 0.3 to 1 s in a browser, much less on a GPU), so a determined, technical player could brute-force it offline in minutes to hours. The per-set random salt stops precomputed tables and stops one cracked build from unlocking another, but it can't fix a small search space.
- **The cooldown is client-side.** Clearing `sessionStorage` or editing the page removes it. It slows teams at the table, not an attacker with a script.
- **The public content isn't secret.** The emails, briefing and hint letters are in plain text by design. Someone who already knows the answer key can obviously still play perfectly.

For a classroom or event this is the right trade-off. Don't reuse this design to protect anything that matters.

## How players investigate

The game looks and behaves like a typical webmail inbox (generic styling, no Google branding). There is no "Email details" summary; players gather the evidence themselves:

| Where | What it shows |
| --- | --- |
| Hover over (or click) a link or button | The real destination in a status bar. Clicking never navigates; it offers **Scan this URL** |
| **to me ▾** | From, Reply-To, To, Cc, date, subject |
| **⋮ → Show original** | Raw headers: the Received chain with the sending IP, Return-Path, X-Originating-IP, DKIM-Signature (`d=`, `s=`), Message-ID and MIME parts. No Authentication-Results header, so nothing is pre-judged |
| Attachments | Encrypted-file warnings, PDF and spreadsheet previews (the CV's portfolio link lives inside the PDF), the raw `.ics` invite |
| **Lookup** panel | SPF test (domain + IP, evaluated step by step through includes), SPF record, DKIM key and signature check for the open email, DMARC policy, WHOIS (domain age and owner), IP owner and reverse DNS, URL scan (redirects and what the page does) |

### The simulated internet

Every lookup runs inside the page against a built-in dataset (`NET` in `template.html`). Nothing goes online. All domains use the reserved `.example` TLD and all IP addresses come from the documentation ranges `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24` (RFC 2606 / RFC 5737). This means:

- answers never drift because someone changed a real DNS record,
- no real company, IP address or lookalike domain is implicated, and
- players never visit a live, possibly malicious, site while "verifying".

**Simplification:** the DKIM check confirms that the selector's key is published and that the open email carries a signature for that `d=`/`s=` pair. It does not do the RSA maths (the `b=` and `bh=` values are illustrative).

## Notes on content

The game is self-contained: there is no case file. These changes from the source documents make every verdict reachable from the email, its headers and the lookups (the `docs/` files describe an earlier version):

- **Set A email 7 is now a spoof.** It arrives from a rented VPS (198.51.100.200) that isn't in Northwind's SPF record, with no DKIM signature. Northwind's DMARC is `p=none`, so it still reaches the inbox.
- **Set B email 8 now shows From: chro.office@corvus.example.** It is relayed through mailer-calendar.example, so SPF and DKIM pass for the relay only and DMARC fails for corvus.example (Corvus is also `p=none`).
- Everything the old "Email details" lines said now lives where a real analyst would find it: link destinations on hover, Reply-To in the header details, an encrypted-attachment warning, the CV's portfolio link inside the PDF preview, the earlier thread in Set A email 5's trimmed content, and app permissions, redirects and login forms in URL scans.
- Set A email 2: the briefing says Riya signed in at 08:52 this morning. Set A email 6 offers the intranet HR page as an alternative to the link.
- All 20 debrief giveaways were rewritten to cite this evidence (SPF/DKIM results, domain ages, scan findings). Verdicts, hint letters and passwords are unchanged.

Otherwise, the email text is copied word for word from the source documents. Markdown escapes were removed (`Q4\_Forecast` → `Q4_Forecast`), `[Button text]` renders as an inert button, and a few labelled lines and sign-offs (for example "Time: … Device: …" and "Regards, Priya") are shown on separate lines. The words themselves are unchanged. The `[QR CODE IMAGE]` in Set A email 7 is drawn as a decorative pattern that can't be scanned.
