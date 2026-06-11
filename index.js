const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting setup
const requestCounts = {};
const RATE_LIMIT = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }
  if (now > requestCounts[ip].resetAt) {
    requestCounts[ip] = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }
  if (requestCounts[ip].count >= RATE_LIMIT) {
    return true;
  }
  requestCounts[ip].count++;
  return false;
}

app.post('/generate', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { prompt } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data));
    if (data.content && data.content[0]) {
      res.json({ result: data.content[0].text });
    } else {
      res.status(500).json({ error: 'Bad response', detail: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
console.log('Tweakr server running');
