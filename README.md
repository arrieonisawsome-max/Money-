# MoneyOS

A fast, motivating personal finance "Money OS" — not just a budget tracker.
Every time you open it, the dashboard answers one question: **"Can I afford
this right now?"**

## Running it

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm start
```

Visit http://localhost:3000. All your data lives in your browser's
localStorage — nothing is sent anywhere except the two AI-powered features
below, which call your own server.

## Why there's a server

The AI Coach and Receipt Scanner call the Anthropic API. That call **must**
happen from a server, not the browser — an API key embedded in client-side
JavaScript is visible to anyone who opens dev tools. `server.js` is a small
Express app that holds `ANTHROPIC_API_KEY` server-side and exposes:

- `POST /api/chat` — the AI Coach. The browser sends your question plus a
  live snapshot of *your* numbers (computed from your local data); the
  server grounds Claude's system prompt in that snapshot so answers are
  based on your real data, not a hardcoded demo profile.
- `POST /api/scan-receipt` — sends a photo to Claude's vision model and
  gets back a structured `{merchant, amount, date, category}` guess to
  pre-fill a transaction.

Everything else works with zero setup and zero network calls.

## Feature coverage

Nearly everything in the spec is implemented as **real, working logic**
against your local data — not hardcoded numbers:

- **Core dashboard**: cash available, savings, investments, net worth,
  goal progress, bills due soon, a computed Health Score (0–100) and an
  "afford this?" calculator.
- **Budgeting**: custom + starter categories, monthly limits, left to
  spend today/week/month (computed from real days-remaining math),
  rollover of unused budget (triggered from the Budget page).
- **Saving**: goals with progress bars and milestone celebrations,
  emergency fund tracker, sinking funds, an automatic-transfer rule
  (Auto-Save), badges for savings milestones.
- **Investing**: holdings CRUD, day/week/month/year performance computed
  from real price history, dividend log, retirement projection (compound
  growth formula), asset allocation donut chart, risk score.
- **Income**: multiple sources, paycheck calendar, expected monthly
  income, side-hustle tracking.
- **Expenses**: recurring bills with due-date reminders and simulated
  autopay, subscription tracker with real price-increase and duplicate
  detection.
- **AI assistant**: explains spending, predicts next month (linear trend
  off your last 3 months), recommends budget adjustments, flags unusual
  transactions (statistical outlier detection), answers free-form
  questions — plus voice input/output via the browser's Web Speech API.
- **Analytics**: spending/income trend charts, savings rate, net worth
  graph, cash flow — all hand-rolled inline SVG charts driven by your
  transaction history, no charting library needed.
- **Goals**: house/car/vacation/wedding/business/debt-payoff/retirement
  templates.
- **Gamification**: daily streaks, XP/levels, badges, weekly missions,
  theme/avatar unlocks by level. The friends leaderboard is local demo
  data (see limitations).
- **Automation**: auto-categorization by keyword, smart if/then rules,
  simulated autopay and auto-invest/auto-save rules.
- **Security**: real AES-256-GCM local encryption (App Lock), real
  browser WebAuthn biometric unlock (Face ID/Touch ID/Windows Hello), real
  RFC 6238 TOTP two-factor auth, fraud/unusual-activity alerts.
- **Notifications**: in-app bell + browser Notification API alerts for
  overspending, bills due, milestones, and unusual activity.
- **Extras**: life timeline with a live goal simulator (sliders recompute
  a 20-year compound-growth projection), monthly report generator (with
  an AI-written narrative), family/business mode with member tagging,
  manual credit-score trend tracking, a US federal tax estimator, a
  Claude-vision receipt scanner, a financial journal, offline support via
  a service worker + PWA manifest, dark/light/extra themes, multi-currency
  display, and a customizable dashboard card order.

## What's intentionally stubbed, and why

A few items in the spec need infrastructure that can't exist inside a
plain web app without a paid provider, a native app shell, or a
multi-user backend. These are clearly labeled in the UI rather than
faked:

| Feature | Status | To make it real |
|---|---|---|
| **Bank account connection** | Manual accounts only; a banner explains why | Integrate a licensed aggregator (e.g. Plaid), add a backend endpoint to exchange/store access tokens |
| **Push notifications when the app is closed** | In-app + foreground browser notifications only | Add a push server + service worker push subscription (Web Push API) |
| **Native home-screen widgets** | PWA "Add to Home Screen" + Android app shortcuts (in `manifest.json`) | Requires a native iOS/Android app shell — not achievable from a web page |
| **Real credit bureau data** | Manual score entry + trend chart | Integrate a bureau API (Experian/Equifax/TransUnion), which requires a business agreement and the user's SSN |
| **Friends leaderboard** | Local demo data, labeled as such | Needs user accounts + a shared backend so "friends" can be real people |
| **WebAuthn / TOTP as full production auth** | Real crypto, but no server-side challenge issuance or signature verification | Add an accounts backend that issues per-request WebAuthn challenges and verifies assertions server-side |
| **Tax estimate** | Rough estimate using approximate current federal brackets | Not tax advice; a production version would need state tax tables and yearly bracket updates |

## Project structure

```
index.html          App shell (boot/lock screen + sidebar + page container)
css/style.css        All styling, incl. themes and responsive rules
js/app.js             State, seed data, all financial calculations
js/app-pages.js       UI rendering for every page + CRUD forms
js/app-init.js        Boot sequence, security gates, PWA wiring
js/crypto.js          AES-GCM encryption + TOTP (Web Crypto API, no deps)
js/webauthn.js        Biometric unlock via the browser WebAuthn API
js/voice.js           Voice input/output via the Web Speech API
server.js              Express server + /api/chat + /api/scan-receipt
manifest.json / sw.js  PWA manifest + offline service worker
```

## Deploying

Plain Node/Express — runs on Render, Railway, Fly.io, a VPS, or any Node
host. Set `ANTHROPIC_API_KEY` as a server-side environment variable in
that host's dashboard, never in the repo. Serve over HTTPS — WebAuthn
(biometric unlock) requires a secure context.
