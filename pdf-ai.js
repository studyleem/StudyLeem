// "Ask LeemAI" on PDF pages (summary / questions about the page currently open). Page image is never stored.
const { FBISE_CONTEXT, limiter, guard, callGemini, clean, stripDataUrl } = require('./_lib');
const limited = limiter(12);

const SYSTEM = FBISE_CONTEXT + `

PDF PAGE RULES
- You are given ONE page of a student's PDF (as an image and/or extracted text) plus the document title.
- Base your answer on that page. If the page is blank, unreadable or unrelated, say so briefly.
- If the question needs knowledge beyond the page, answer from FBISE-level knowledge and say that this part is not on the page.
- Formatting: short paragraphs, **bold** key terms, lists starting with "- " or "1.". No tables, no # headings.
- Never invent page numbers, exam years or content that is not visible.`;

const PROMPTS = {
  summary: 'Summarize this page for exam revision. Format: one line naming the topic, then 4-6 bullet points of the key ideas (include important formulas, definitions or steps exactly as shown), then "Exam tip:" with one short tip.',
  simple: 'Explain the content of this page in very simple words, like a friendly teacher, using one small example if helpful.',
  exam: 'From this page, list the key points to memorize and write 3 likely exam questions with short model answers.'
};

module.exports = async (req, res) => {
  const g = guard(req, res, limited);
  if (!g) return;
  const b = g.body;
  const mode = ['summary', 'simple', 'exam', 'ask'].includes(b.mode) ? b.mode : 'ask';
  const title = clean(b.title, 200), page = parseInt(b.page, 10) || null;
  const pageText = clean(b.pageText, 6000);
  let image = stripDataUrl(b.image);
  if (image.length > 3_000_000) image = '';
  const q = clean(b.question, 1000);
  const task = mode === 'ask' ? q : PROMPTS[mode];
  if (!task) return res.status(400).json({ detail: 'Please type a question.' });
  if (!image && !pageText && mode !== 'ask') return res.status(400).json({ detail: 'Could not read this page. Try another page.' });

  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image } });
  parts.push({ text: `Document: ${title || 'PDF'}${page ? ' — page ' + page : ''}\n${pageText ? 'Extracted text of the page:\n' + pageText + '\n\n' : ''}Student request: ${task}` });

  try {
    const out = await callGemini({ key: g.key, system: SYSTEM, contents: [{ role: 'user', parts }], maxTokens: 2048, temperature: 0.3 });
    if (!out.ok) return res.status(502).json({ detail: out.detail });
    return res.status(200).json({ answer: out.text || 'I could not produce an answer for this page. Please try again.' });
  } catch (e) {
    console.error('pdf-ai error', e && e.message);
    return res.status(502).json({ detail: 'LeemAI had a problem. Please try again.' });
  }
};
