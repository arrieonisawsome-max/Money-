# MoneyOS

A dark-mode personal finance dashboard: budget, goals, income, expenses,
investments, savings, analytics, a 20-year life timeline, gamified rewards,
and an AI money coach.

## Why there's a server

The AI Coach talks to the Anthropic API. That call **must** happen from a
server, not the browser — an API key embedded in client-side JavaScript is
visible to anyone who opens dev tools, and can be copied and run up on your
account. `server.js` is a small Express app that:

- serves `index.html` and other static assets, and
- exposes `POST /api/chat`, which holds the `ANTHROPIC_API_KEY` server-side
  and forwards the request to Anthropic.

The frontend never sees the key — it only ever calls `/api/chat`.

## Running locally

```bash
npm install
cp .env.example .env   # then edit .env and add your ANTHROPIC_API_KEY
npm start
```

Visit http://localhost:3000.

Everything except the AI Coach page works with no setup at all — the key
is only required for `/api/chat`.

## Deploying

This is a plain Node/Express app, so it runs on Render, Railway, Fly.io,
a VPS, or any Node host. Set `ANTHROPIC_API_KEY` as a server-side
environment variable in that host's dashboard — never in the repo, never
in `index.html`.

(A traditional static host like GitHub Pages won't work on its own since
there's no place to run `server.js` — you'd need a serverless function
platform such as Vercel or Netlify instead, with the same rule: the key
goes in that platform's environment variable settings, not in code.)

## Project structure

```
index.html     Frontend — dashboard UI, no secrets
server.js      Express server + /api/chat proxy to Anthropic
package.json   Dependencies (just express)
.env.example   Template for local environment variables
```
