// Minimal static-file server + AI Coach proxy + receipt scanner proxy.
//
// The Anthropic API key lives only here, in a server-side environment
// variable. It is never sent to the browser. The frontend calls
// POST /api/chat and POST /api/scan-receipt; this server relays those to
// the Anthropic Messages API with the key attached.
//
// The AI coach is grounded per-request in the actual signed-in user's data
// (sent as `context` from the browser, computed live from their local
// state) rather than hardcoded numbers, so this works for any user, not
// just a single demo profile.
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const BASE_SYSTEM_PROMPT = `You are the MoneyOS AI Coach — a brutally honest, motivating financial coach.
Be direct, specific, and motivating. Give real actionable advice grounded in the numbers you're given.
Keep responses under 150 words. Use numbers and specifics from the user's data. End with one clear action step.
Never invent numbers that weren't provided to you — if you don't have a figure, say so instead of guessing.`;

const app = express();
app.use(express.json({ limit: '8mb' })); // receipt images are base64-encoded
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Missing "message" in request body.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

  const context = req.body?.context;
  const profileName = typeof req.body?.profileName === 'string' ? req.body.profileName.slice(0, 60) : 'there';

  let system = BASE_SYSTEM_PROMPT + `\n\nThe user's name is ${profileName}.`;
  if (context && typeof context === 'object') {
    // Cap size so an oversized/malformed payload can't blow up the request.
    const snapshot = JSON.stringify(context).slice(0, 6000);
    system += `\n\nHere is their current financial snapshot as JSON (all figures in ${context.currency || 'USD'}):\n${snapshot}`;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: 'AI coach is unavailable right now. Try again shortly.' });
    }

    const reply = data.content?.[0]?.text || "I couldn't come up with a response. Try rephrasing.";
    res.json({ reply });
  } catch (err) {
    console.error('AI coach proxy error:', err);
    res.status(502).json({ error: 'AI coach is unavailable right now. Try again shortly.' });
  }
});

const RECEIPT_SYSTEM_PROMPT = `You extract structured data from receipt photos. Respond with ONLY a JSON object
(no markdown fences, no commentary) with keys: merchant (string), amount (number, the total paid),
date (string, YYYY-MM-DD if visible else empty string), category (one of: Housing, Food & Dining, Transport,
Fitness / Business, Subscriptions, Personal, Entertainment, Other). If a field can't be read, use a sensible
default (amount: 0, merchant: "Unknown", date: "", category: "Other").`;

app.post('/api/scan-receipt', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
  }
  const { image, mediaType } = req.body || {};
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Missing receipt image.' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: RECEIPT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: type, data: image } },
            { type: 'text', text: 'Extract the receipt data as instructed.' }
          ]
        }]
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Anthropic API error (receipt):', data);
      return res.status(502).json({ error: 'Receipt scanning is unavailable right now.' });
    }

    const text = data.content?.[0]?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      return res.status(502).json({ error: 'Could not read the receipt clearly. Try a clearer photo.' });
    }
    res.json({
      merchant: String(parsed.merchant || 'Unknown').slice(0, 100),
      amount: Number(parsed.amount) || 0,
      date: String(parsed.date || ''),
      category: String(parsed.category || 'Other').slice(0, 40)
    });
  } catch (err) {
    console.error('Receipt scan proxy error:', err);
    res.status(502).json({ error: 'Receipt scanning is unavailable right now.' });
  }
});

app.listen(PORT, () => {
  console.log(`MoneyOS running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set — AI Coach and Receipt Scanner will return errors until it is.');
  }
});
