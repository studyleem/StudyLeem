// Vercel function: "Ask LeemAI" on PDF pages (summary / questions about the page currently open).
// Uses the same GEMINI_API_KEY (and optional GEMINI_MODEL) as api/ask.js. Does not change api/ask.js.
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
  .filter((m, i, a) => m && a.indexOf(m) === i);
let working = null;

const SYSTEM = `You are LeemAI, the study assistant of StudyLeem for FBISE (Federal Board, Pakistan) students, Classes 9-12.
You are given ONE page of a student's PDF (as an image and/or extracted text) plus the document title.
- Base your answer on that page. If the page is blank, unreadable or unrelated, say so briefly.
- If the question needs knowledge beyond the page, answer from FBISE-level knowledge and say that this part is not on the page.
- Explain simply and accurately, in the language the student uses (English, Urdu or Roman Urdu).
- Formatting: short paragraphs, **bold** key terms, lists starting with "- " or "1.". No tables, no # headings.
- Never invent page numbers, exam years or content that is not visible.`;

const PROMPTS = {
  summary: 'Summarize this page for exam revision. Format: one line naming the topic, then 4-6 bullet points of the key ideas (include important formulas, definitions or steps exactly as shown), then "Exam tip:" with one short tip.',
  simple: 'Explain the content of this page in very simple words, like a friendly teacher, using one small example if helpful.',
  exam: 'From this page, list the key points to memorize and write 3 likely exam questions with short model answers.'
};

const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr); if (hits.size > 5000) hits.clear();
  return arr.length > 12;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', configured: Boolean(process.env.GEMINI_API_KEY), models: MODELS });
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });

  const origin = req.headers.origin || '';
  if (origin) {
    let host = ''; try { host = new URL(origin).hostname; } catch (_) {}
    if (!(host === String(req.headers.host).split(':')[0] || host === 'localhost')) return res.status(403).json({ detail: 'Forbidden' });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ detail: 'LeemAI is not configured yet (missing GEMINI_API_KEY).' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ detail: 'Too many requests. Please wait a minute and try again.' });

  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (_) { return {}; } })() : (req.body || {});
  const mode = ['summary', 'simple', 'exam', 'ask'].includes(b.mode) ? b.mode : 'ask';
  const title = String(b.title || '').slice(0, 200), page = parseInt(b.page, 10) || null;
  const pageText = String(b.pageText || '').slice(0, 6000);
  let image = String(b.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (image.length > 3_000_000) image = '';                       // too large -> ignore image
  const q = String(b.question || '').trim().slice(0, 1000);
  const task = mode === 'ask' ? q : PROMPTS[mode];
  if (!task) return res.status(400).json({ detail: 'Please type a question.' });
  if (!image && !pageText && mode !== 'ask') return res.status(400).json({ detail: 'Could not read this page. Try another page.' });

  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image } });
  parts.push({ text: `Document: ${title || 'PDF'}${page ? ' — page ' + page : ''}\n${pageText ? 'Extracted text of the page:\n' + pageText + '\n\n' : ''}Student request: ${task}` });

  try {
    const order = working ? [working, ...MODELS.filter(m => m !== working)] : MODELS;
    let r, data, last = 0;
    for (const model of order) {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 1400 } })
      });
      data = await r.json().catch(() => ({}));
      if (r.ok) { working = model; break; }
      last = r.status; console.error('Gemini error', model, r.status, JSON.stringify(data).slice(0, 300));
      if (r.status === 403 || (r.status === 400 && /api key/i.test(JSON.stringify(data)))) break;
    }
    if (!r.ok) return res.status(502).json({ detail: last === 429 ? 'LeemAI is busy right now. Please try again in a minute.' : last === 404 ? 'LeemAI model is unavailable. Set GEMINI_MODEL in Vercel.' : (last === 400 || last === 403) ? 'LeemAI could not be reached (check the API key / image).' : 'LeemAI had a problem. Please try again.' });
    const c = data.candidates && data.candidates[0];
    const text = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || '').join('').trim() : '';
    return res.status(200).json({ answer: text || 'I could not produce an answer for this page. Please try again.' });
  } catch (e) {
    console.error('pdf-ai error', e);
    return res.status(502).json({ detail: 'LeemAI had a problem. Please try again.' });
  }
};
