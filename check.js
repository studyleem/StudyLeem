// LeemAI Paper Checker: the student uploads photos of their answer sheet; Gemini marks it.
// PRIVACY: images exist only in memory during this request. They are forwarded to the Gemini API
// and then discarded – nothing is saved to disk, a database, a bucket or the logs.
const { FBISE_CONTEXT, limiter, guard, callGemini, parseJson, clean, cleanClass, stripDataUrl, fbiseGrade } = require('./_lib');
const limited = limiter(5);

const SYSTEM = FBISE_CONTEXT + `

PAPER CHECKER RULES
- You act as a fair, careful FBISE examiner. You receive photos of a student's handwritten ANSWER SHEET (and sometimes the QUESTION PAPER and/or a marking scheme).
- Read every page. Identify each question/part (use the student's numbering such as Q1, Q2(a), Q3(b)).
- Award marks like an FBISE examiner: correct definition/idea = marks; stepwise marking for numericals (formula, substitution, answer with unit); partial credit for partially correct answers; deduct for wrong units, missing labels on diagrams, unbalanced equations, missing working.
- If a marking scheme or marks per question are given, use them exactly. Otherwise use the usual FBISE weights (MCQ 1 mark, short question 2 marks, long question 4-8 marks) and make the sum of "marks_max" equal the total marks given.
- If the question text is not visible, infer the question from the answer and say so in the feedback. If handwriting is unreadable, set verdict "unreadable", give 0 marks for that part and say so honestly. Never invent answers the student did not write.
- Be strict but fair and consistent; do not give full marks for incomplete answers. Marks must never exceed marks_max.
- Give for each question: what was right, what was wrong, and a short model answer (max 3 sentences or the key formula steps) so the student can learn.
- Respond with JSON ONLY, no markdown, in exactly this shape:
{"readable":true,"note":"anything the student should know (blur, missing pages, assumptions)","questions":[{"label":"Q1 (a)","question":"short restatement","marks_awarded":0,"marks_max":0,"verdict":"correct|partial|incorrect|unreadable|not_attempted","feedback":"...","mistakes":["..."],"model_answer":"..."}],"strengths":["..."],"improvements":["..."],"presentation_tips":["..."],"study_next":["chapter/topic to revise"]}`;

module.exports = async (req, res) => {
  const g = guard(req, res, limited, { busyMsg: 'The paper checker is busy. Please wait a minute and try again.' });
  if (!g) return;
  const b = g.body;

  const cls = cleanClass(b.class), subject = clean(b.subject, 60);
  if (!cls || !subject) return res.status(400).json({ detail: 'Please select a class and a subject.' });
  const totalMarks = Math.min(200, Math.max(1, Math.round(Number(b.totalMarks) || 0)));
  if (!Number(b.totalMarks)) return res.status(400).json({ detail: 'Please enter the total marks of the paper.' });

  const imgs = (Array.isArray(b.answerImages) ? b.answerImages : []).slice(0, 4).map(stripDataUrl).filter(Boolean);
  const qImgs = (Array.isArray(b.questionImages) ? b.questionImages : []).slice(0, 2).map(stripDataUrl).filter(Boolean);
  if (!imgs.length) return res.status(400).json({ detail: 'Please upload at least one photo of the answer sheet.' });
  const sizeOk = [...imgs, ...qImgs].every(s => s.length <= 1_600_000) && [...imgs, ...qImgs].reduce((n, s) => n + s.length, 0) <= 4_000_000;
  if (!sizeOk) return res.status(413).json({ detail: 'The photos are too large. Please upload clearer but smaller photos.' });

  const questionText = clean(b.questionText, 3000), scheme = clean(b.markingScheme, 2000);
  const strict = ['lenient', 'normal', 'strict'].includes(b.strictness) ? b.strictness : 'normal';

  const parts = [];
  if (qImgs.length) { parts.push({ text: 'QUESTION PAPER photos follow:' }); qImgs.forEach(d => parts.push({ inlineData: { mimeType: 'image/jpeg', data: d } })); }
  parts.push({ text: `STUDENT ANSWER SHEET photos follow (${imgs.length} page${imgs.length > 1 ? 's' : ''}):` });
  imgs.forEach((d, i) => { parts.push({ text: `Answer sheet page ${i + 1}:` }); parts.push({ inlineData: { mimeType: 'image/jpeg', data: d } }); });
  parts.push({ text: `Check this paper.
Class: ${cls} (${cls === '9' || cls === '10' ? 'SSC' : 'HSSC'})
Subject: ${subject}
Total marks of the paper: ${totalMarks}
Marking strictness: ${strict}
${questionText ? 'Questions / paper text typed by the student:\n' + questionText + '\n' : ''}${scheme ? 'Marking scheme / marks per question:\n' + scheme + '\n' : ''}Language of feedback: ${b.lang === 'ur' ? 'Urdu (keep technical terms in English)' : b.lang === 'roman' ? 'Roman Urdu' : 'English'}.` });

  try {
    const out = await callGemini({ key: g.key, system: SYSTEM, contents: [{ role: 'user', parts }], json: true, maxTokens: 8192, temperature: 0.2 });
    if (!out.ok) return res.status(502).json({ detail: out.detail });
    const d = parseJson(out.text);
    if (!d || !Array.isArray(d.questions)) return res.status(502).json({ detail: 'LeemAI could not read this paper. Try clearer, well-lit photos and check again.' });

    const arr = (v, n, m) => (Array.isArray(v) ? v : []).slice(0, n).map(s => clean(s, m)).filter(Boolean);
    const VERDICTS = ['correct', 'partial', 'incorrect', 'unreadable', 'not_attempted'];
    const questions = d.questions.slice(0, 60).map((q, i) => {
      const max = Math.max(0, Math.round(Number(q.marks_max) * 2) / 2 || 0);
      let got = Math.max(0, Math.round(Number(q.marks_awarded) * 2) / 2 || 0);
      if (got > max) got = max;
      return {
        label: clean(q.label, 40) || ('Q' + (i + 1)), question: clean(q.question, 300),
        marks_awarded: got, marks_max: max, verdict: VERDICTS.includes(q.verdict) ? q.verdict : (got >= max ? 'correct' : got > 0 ? 'partial' : 'incorrect'),
        feedback: clean(q.feedback, 700), mistakes: arr(q.mistakes, 5, 250), model_answer: clean(q.model_answer, 700)
      };
    });
    if (!questions.length) return res.status(502).json({ detail: 'No answers could be found on the photos. Please upload clear photos of the answer sheet.' });

    const sumMax = questions.reduce((n, q) => n + q.marks_max, 0);
    const obtainedRaw = questions.reduce((n, q) => n + q.marks_awarded, 0);
    // scale to the paper's total marks if the model's maximums do not add up to it
    let obtained = obtainedRaw, total = sumMax, scaled = false;
    if (sumMax > 0 && sumMax !== totalMarks) { obtained = Math.round(obtainedRaw / sumMax * totalMarks * 2) / 2; total = totalMarks; scaled = true; }
    if (!sumMax) { total = totalMarks; obtained = 0; }
    const pct = total ? Math.round(obtained / total * 1000) / 10 : 0;

    return res.status(200).json({
      readable: d.readable !== false, note: clean(d.note, 500) + (scaled ? ' (Marks were scaled to the total marks you entered.)' : ''),
      obtained, total, percentage: pct, grade: fbiseGrade(pct), questions,
      strengths: arr(d.strengths, 4, 250), improvements: arr(d.improvements, 5, 300),
      presentation_tips: arr(d.presentation_tips, 4, 250), study_next: arr(d.study_next, 5, 150),
      disclaimer: 'AI-estimated marks for practice only. They are not official FBISE marks.'
    });
  } catch (e) {
    console.error('check error', e && e.message); // never log the images
    return res.status(502).json({ detail: 'LeemAI had a problem. Please try again.' });
  }
};
