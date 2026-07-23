// Minimal static-file server + AI Coach proxy.
//
// The Anthropic API key lives only here, in a server-side environment
// variable. It is never sent to the browser. The frontend (index.html)
// calls POST /api/chat, and this server relays that to the Anthropic
// Messages API with the key attached.
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are MoneyOS AI Coach — a brutally honest, motivating financial coach for Arrieon, a 20-something fitness trainer building his business.

His financial snapshot:
- Income: $667 bi-weekly ($1,334/month) from gym job
- Cash available: $87 safe to spend today
- Savings: $1,240 total
- Investments: $350
- Net worth: $2,024
- Goals: Fitness business fund ($420/$1,000), Bahamas trip ($500/$2,000), Creator gear ($340/$500), Emergency fund ($540/$3,000), NASM cert ($600/$750)
- Side hustle: $0 currently — but has potential to add PT clients and online coaching
- Works 1pm-9pm, 5 days/week at a gym
- Making fitness content on social media

Be direct, specific, motivating. Give real actionable advice. Keep responses under 150 words. Use numbers and specifics. End with one clear action step.`;

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an ANTHROPIC_API_KEY.' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'Missing "message" in request body.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long.' });
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
        system: SYSTEM_PROMPT,
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

app.listen(PORT, () => {
  console.log(`MoneyOS running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set — the AI Coach page will return errors until it is.');
  }
});
