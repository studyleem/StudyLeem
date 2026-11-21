// LeemAI chat -> Google Gemini, personalised for FBISE. Supports class/subject context,
// short conversation memory and an optional photo of a question (never stored).
const { FBISE_CONTEXT, limiter, guard, callGemini, clean, cleanClass, stripDataUrl } = require('./_lib');
const limited = limiter(14);

const SYSTEM = FBISE_CONTEXT + `

CHAT RULES
- Keep answers focused (usually under 250 words). Short paragraphs, **bold** for key terms, simple lists starting with "- " or "1.". No tables, no # headings.
- For numerical problems show: Given, Formula, Substitution, Answer with unit.
- If the student sends a photo of a question, read it carefully, solve it step by step and mention any part you cannot read.
- Where it helps, suggest the matching chapter notes on StudyLeem or offer a short practice quiz (the student can open the Quiz tab).`;

module.exports = async (req, res) => {
  const g = guard(req, res, limited, { busyMsg: 'Too many questions. Please wait a minute and try again.' });
  if (!g) return;
  const b = g.body;

  const question = clean(b.question, 1500);
  let image = stripDataUrl(b.image);
  if (image.length > 2_000_000) image = '';
  if (!question && !image) return res.status(400).json({ detail: 'Please type a question.' });

  const cls = cleanClass(b.class), subject = clean(b.subject, 60);
  const ctx = [cls ? `Class ${cls}` : '', subject && subject !== 'all' ? subject : ''].filter(Boolean).join(' · ');

  // short memory: last 8 turns
  const contents = [];
  (Array.isArray(b.history) ? b.history.slice(-8) : []).forEach(h => {
    const t = clean(h && h.text, 1200);
    if (t && (h.role === 'user' || h.role === 'ai')) contents.push({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: t }] });
  });
  while (contents.length && contents[0].role !== 'user') contents.shift();      // must start with user
  const merged = [];
  contents.forEach(c => { const l = merged[merged.length - 1]; if (l && l.role === c.role) l.parts[0].text += '\n' + c.parts[0].text; else merged.push(c); });
  if (merged.length && merged[merged.length - 1].role === 'user') merged.pop();  // next message is the new user turn

  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image } });
  parts.push({ text: (ctx ? `[Student context: ${ctx}]\n` : '') + (question || 'Please solve the question shown in the photo.') });
  merged.push({ role: 'user', parts });

  try {
    const out = await callGemini({ key: g.key, system: SYSTEM, contents: merged, maxTokens: 2048, temperature: 0.4 });
    if (!out.ok) return res.status(502).json({ detail: out.detail });
    if (!out.text) return res.status(200).json({ answer: out.blocked ? "Sorry, I can't help with that question. Please ask something about your studies." : 'I could not produce an answer. Please rephrase your question.' });
    return res.status(200).json({ answer: out.text });
  } catch (e) {
    console.error('LeemAI ask error', e && e.message);
    return res.status(502).json({ detail: 'LeemAI had a problem. Please try again.' });
  }
};
