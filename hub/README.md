# Escape the Breach: Hub

One web app in front of the 7 puzzles. A team signs in with a one-word team name and the shared password, sees all 7 puzzles, plays them in the browser, and every result (pass/fail, score, time, hints, attempts) is saved on the server in a JSON file. Signing in with the same team name on another device shows the same results.

No database and no npm packages. Needs Node.js 18 or later.

## Run it

```bash
cp hub/.env.example hub/.env      # then edit TEAM_PASSWORD (and the rest)
node hub/server.js
```

Open `http://localhost:3000/` (or `http://localhost:3000<BASE_PATH>/`).

The hub serves the games straight from the `puzzle N` folders next to it, so deploy the **whole folder** (hub + puzzle folders). Only the game files listed in `hub/puzzles.json` are reachable over the web. Answer keys, `docs/`, `.env` files and build scripts are never served.

To keep it running on a server, use pm2 (`pm2 start hub/server.js --name escape-hub`) or a systemd service.

## .env

| Key | Meaning |
| --- | --- |
| `TEAM_PASSWORD` | The one password teams type. Required. |
| `PORT` | Default `3000`. |
| `HOST` | Default `0.0.0.0`. Use `127.0.0.1` when nginx is on the same machine. |
| `BASE_PATH` | Sub-path behind nginx, e.g. `/escape`. Empty = site root. |
| `SESSION_SECRET` | Signs login cookies. If empty, teams must sign in again after a restart. |
| `COOKIE_SECURE` | `true` when served over HTTPS. |
| `DATA_FILE` | Results file, default `data/results.json` (inside `hub/`). |
| `DEPLOY_BRANCH` | Branch the Deploy button pulls. Default `master`. |
| `PM2_APP` | pm2 id or name the Deploy button restarts. Default `10`. |

## Deploying updates

`deploy.sh` (in the top folder) runs `git pull origin master` and then `pm2 restart 10`. Run it on the server with `bash deploy.sh`, or use the **Deploy update** link under the sign-in form. It asks for the same `TEAM_PASSWORD`, runs the script, waits for the app to come back and reloads the page. If the pull fails, the dialog shows the git output and nothing is restarted.

- Change the branch or pm2 app with `DEPLOY_BRANCH` / `PM2_APP` in `hub/.env` (defaults `master` / `10`). `PM2_APP` must be this app's pm2 id or name; check with `pm2 list`.
- The server's working copy must be able to `git pull` without prompting (a deploy key or saved credentials) and must have no local edits to tracked files.
- Every run is appended to `hub/data/deploy.log`.
- Wrong passwords count toward the same sign-in throttle.
- Anyone who knows the password can trigger a deploy. Teams type it on their devices to sign in, so change it if you don't want them to have that.

## nginx

```nginx
location /escape/ {
    proxy_pass http://127.0.0.1:3000;     # no trailing slash: the /escape prefix is passed through
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

With `BASE_PATH=/escape`. The hub also works if nginx strips the prefix (`proxy_pass http://127.0.0.1:3000/;`).

HTTPS matters: puzzles 1 and 2 use the browser's Web Crypto, which only works on `https://` or `localhost`, and puzzle 7's YouTube clips need http(s).

## Rules the hub enforces

- Team names are one word: 2–24 letters, numbers, `-` or `_`. Case doesn't matter (`Falcon` and `falcon` are the same team).
- The **first** result a team records for a puzzle is final. The puzzle is then locked for that team.
- **Finish & see results** asks for confirmation, then locks the team: unfinished puzzles become *Not attempted* and nothing more can be played on any device.
- When every playable puzzle has a result, the team is finished automatically and sent to the results page.
- Wrong passwords are throttled (10 per IP per 10 minutes).

## Results file

`hub/data/results.json` is created on first sign-in and updated after each result (written atomically):

```json
{
  "teams": {
    "falcon": {
      "name": "Falcon",
      "createdAt": "2026-10-30T09:00:00.000Z",
      "finishedAt": null,
      "puzzles": {
        "2": {
          "status": "pass",
          "startedAt": "...", "completedAt": "...",
          "durationSec": 612, "wallClockSec": 640,
          "score": 780, "maxScore": 1000,
          "hints": 1, "attempts": 2,
          "details": {}
        }
      }
    }
  }
}
```

`status` is `pass`, `fail`, `completed` (puzzle 7, which has no right answers), `in_progress` or `not_attempted`. `durationSec` is the time the game measured; `wallClockSec` is from the moment the team first opened the puzzle in the hub. To reset the event, stop the server and delete the file.

Results are reported by the game running in the player's browser, so a technical player could forge one. That's fine for an awareness event; don't use this for anything with real stakes.

## What each puzzle reports

| # | Puzzle | Recorded |
| --- | --- | --- |
| 1 | Phish or Legit? | pass when the password unlocks; score = correct verdicts /10; password attempts; set A/B |
| 2 | Ransomware Recovery | pass (score /1000) or fail when time runs out; hints; wrong keys as attempts |
| 3 | Breaking News | pass; score /15; wrong attempts; questions that needed a retry hint; rank |
| 4 | Cyber Timeline | pass; hints; moves |
| 5 | Picture This | pass when the vault opens, fail when the case freezes (time up); score /970; hints; wrong answers as attempts; rank |
| 6 | Log Detective | pass, or fail when the 15-minute timer runs out first; report attempts |
| 7 | Hollywood Hacked | completed; the team's tier board |

## Adding or replacing a game

1. In `hub/puzzles.json`, either:
   - a single-file game: set `file` to its path (relative to `hub/`), or
   - a game made of several files: set `dir` to its folder, `file` to the entry page inside it, and `allow` to the sub-folders players need (puzzle 5 uses `["css/", "js/", "data/", "assets/"]`). Anything outside those folders, such as `tools/`, `tests/` or `package.json`, is never served.
2. When the game ends, call:

```js
function reportToHub(r) {
  try { if (window.parent !== window) window.parent.postMessage(Object.assign({ type: 'escape-hub:result', puzzle: 5 }, r), '*'); } catch (_) {}
}

reportToHub({
  status: 'pass',          // 'pass' | 'fail' | 'completed'
  score: 42, maxScore: 50, // optional
  durationSec: 1800,       // optional
  hints: 2, attempts: 3,   // optional
  details: { rank: 'Threat Hunter' } // optional, small JSON object
});
```

The game still works on its own: outside the hub `reportToHub` does nothing. The hub opens games at `games/<id>/?team=<name>` in case a game wants to prefill the team name (puzzle 1 does).

## Changes made to the games

Each game got the small `reportToHub` function above and one call at each end state. Nothing else changed.

- Puzzle 1: `template.html` and `dist/game.html` both patched (so no rebuild is needed). `node build.js --check` passes. A later rebuild from the template keeps the bridge.
- Puzzle 4: `build/game-template.html` patched, `cyber-timeline-game.html` regenerated with `node build/build-game.js`.
- Puzzles 2, 3, 6, 7: patched in place.
- Puzzle 5: `js/main.js` reports when the vault opens or the case freezes. Inside the hub it also pre-fills the team name and discards a saved game left on the device by a different team.
