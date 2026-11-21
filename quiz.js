// LeemAI Quiz: action "generate" builds an FBISE MCQ quiz for a class + subject (+ chapter/topic);
// action "review" turns the finished quiz result into score feedback and a study plan.
const { FBISE_CONTEXT, limiter, guard, callGemini, parseJson, clean, cleanClass, fbiseGrade } = require('./_lib');
const limited = limiter(8);

const LANGS = { en: 'English', ur: 'Urdu (Urdu script), keeping technical terms in English', roman: 'Roman Urdu (Urdu written in English letters), keeping technical terms in English' };
const LEVELS = { easy: 'easy (recall and definitions)', medium: 'medium (understanding and short application)', hard: 'hard (multi-step reasoning, calculations and tricky concepts)', mixed: 'a mix: about 40% easy, 40% medium, 20% hard' };

const GEN_SYSTEM = FBISE_CONTEXT + `

QUIZ WRITER RULES
- Write exam-quality multiple-choice questions in the style of FBISE objective papers for the given class and subject.
- Exactly 4 options per question, exactly ONE clearly correct option, plausible distractors based on common student mistakes.
- Never use "all of the above", "none of the above" or "both A and B" (options will be shuffled).
- Cover the chapter/topic given; if none is given, spread questions across the class syllabus of that subject. No two questions may test the same fact.
- For Physics/Chemistry/Maths include calculation-based questions at medium/hard level (use SI units and give clean numbers).
- For the subjects English and Urdu, write the questions in that subject's own language (Urdu subject in Urdu script) – grammar, vocabulary, comprehension, literature.
- Each explanation is 1-3 sentences: why the right answer is right and, where useful, the common mistake.
- "topic" is a short label (2-5 words) of the sub-topic/chapter the question belongs to.
- Respond with JSON ONLY, no markdown, in exactly this shape:
{"title":"...","questions":[{"q":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","topic":"..."}]}
"answer" is the index (0-3) of the correct option.`;

const REVIEW_SYSTEM = FBISE_CONTEXT + `

QUIZ COACH RULES
- You receive a student's finished MCQ quiz result. Give honest, encouraging, specific feedback like a good teacher.
- Base weak topics ONLY on the questions answered wrongly. Do not invent topics that were not in the quiz.
- Respond with JSON ONLY, no markdown, in exactly this shape:
{"summary":"2-3 sentence overall review","strengths":["..."],"weak_topics":[{"topic":"...","tip":"how to fix it in one or two sentences"}],"study_plan":["short actionable step","..."],"next_quiz":{"difficulty":"easy|medium|hard|mixed","focus":"topic(s) to practise next"},"encouragement":"one motivating line"}
Keep strengths to max 3, weak_topics max 4, study_plan 3-5 steps.`;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function generate(g, b, res) {
  const cls = cleanClass(b.class), subject = clean(b.subject, 60);
  if (!cls || !subject) return res.status(400).json({ detail: 'Please select a class and a subject.' });
  const chapter = clean(b.chapter, 140);
  const count = Math.min(20, Math.max(3, parseInt(b.count, 10) || 10));
  const level = LEVELS[b.difficulty] ? b.difficulty : 'mixed';
  const lang = LANGS[b.lang] ? b.lang : 'en';
  const avoid = (Array.isArray(b.avoid) ? b.avoid : []).slice(0, 30).map(x => clean(x, 90)).filter(Boolean);

  const prompt = `Create ${count} multiple-choice questions.
Class: ${cls} (${cls === '9' || cls === '10' ? 'SSC' : 'HSSC'})
Subject: ${subject}
Chapter / topic: ${chapter || 'whole syllabus of this class (spread across chapters)'}
Difficulty: ${LEVELS[level]}
Language of explanations: ${LANGS[lang]}
Variation code: ${Math.random().toString(36).slice(2, 8)}
${avoid.length ? 'Do NOT repeat these earlier questions:\n- ' + avoid.join('\n- ') : ''}`;

  const out = await callGemini({ key: g.key, system: GEN_SYSTEM, contents: [{ role: 'user', parts: [{ text: prompt }] }], json: true, maxTokens: 8192, temperature: 0.8 });
  if (!out.ok) return res.status(502).json({ detail: out.detail });
  const data = parseJson(out.text);
  const raw = data && Array.isArray(data.questions) ? data.questions : [];
  const questions = [];
  for (const x of raw) {
    const opts = Array.isArray(x.options) ? x.options.map(o => clean(o, 300)).filter(Boolean) : [];
    const ans = Number.isInteger(x.answer) ? x.answer : parseInt(x.answer, 10);
    if (!x.q || opts.length !== 4 || !(ans >= 0 && ans < 4)) continue;
    const order = shuffle([0, 1, 2, 3]);
    questions.push({
      q: clean(x.q, 700),
      options: order.map(i => opts[i]),
      answer: order.indexOf(ans),
      explanation: clean(x.explanation, 600),
      topic: clean(x.topic, 60) || (chapter || subject)
    });
    if (questions.length >= count) break;
  }
  if (questions.length < 3) return res.status(502).json({ detail: 'LeemAI could not build the quiz this time. Please try again.' });
  return res.status(200).json({
    title: clean(data.title, 120) || `Class ${cls} ${subject} Quiz`,
    class: cls, subject, chapter, difficulty: level, questions
  });
}

async function review(g, b, res) {
  const cls = cleanClass(b.class), subject = clean(b.subject, 60);
  const results = (Array.isArray(b.results) ? b.results : []).slice(0, 20).map(r => ({
    topic: clean(r.topic, 60), q: clean(r.q, 220), correct: !!r.correct, skipped: !!r.skipped,
    chosen: clean(r.chosen, 120), right: clean(r.right, 120)
  }));
  if (!results.length) return res.status(400).json({ detail: 'No quiz results to review.' });
  const total = results.length, score = results.filter(r => r.correct).length;
  const pct = Math.round(score / total * 100);
  const lang = LANGS[b.lang] ? b.lang : 'en';

  const lines = results.map((r, i) => `${i + 1}. [${r.topic}] ${r.q} -> ${r.correct ? 'CORRECT' : (r.skipped ? 'SKIPPED' : 'WRONG (chose: ' + r.chosen + '; right: ' + r.right + ')')}`).join('\n');
  const prompt = `Class ${cls || '?'} ${subject}${b.chapter ? ' – ' + clean(b.chapter, 120) : ''}\nScore: ${score}/${total} (${pct}%), approx. FBISE grade ${fbiseGrade(pct)}\nTime taken: ${parseInt(b.seconds, 10) || 0} seconds\nWrite the feedback in: ${LANGS[lang]}\n\nQuestions:\n${lines}`;

  const out = await callGemini({ key: g.key, system: REVIEW_SYSTEM, contents: [{ role: 'user', parts: [{ text: prompt }] }], json: true, maxTokens: 3000, temperature: 0.5 });
  if (!out.ok) return res.status(502).json({ detail: out.detail });
  const d = parseJson(out.text);
  if (!d) return res.status(502).json({ detail: 'Could not prepare the review. Please try again.' });
  const arr = (v, n, m) => (Array.isArray(v) ? v : []).slice(0, n).map(s => clean(s, m)).filter(Boolean);
  return res.status(200).json({
    score, total, percentage: pct, grade: fbiseGrade(pct),
    summary: clean(d.summary, 700),
    strengths: arr(d.strengths, 3, 200),
    weak_topics: (Array.isArray(d.weak_topics) ? d.weak_topics : []).slice(0, 4).map(w => ({ topic: clean(w && w.topic, 80), tip: clean(w && w.tip, 300) })).filter(w => w.topic),
    study_plan: arr(d.study_plan, 5, 250),
    next_quiz: { difficulty: ['easy', 'medium', 'hard', 'mixed'].includes(d.next_quiz && d.next_quiz.difficulty) ? d.next_quiz.difficulty : 'mixed', focus: clean(d.next_quiz && d.next_quiz.focus, 150) },
    encouragement: clean(d.encouragement, 250)
  });
}

module.exports = async (req, res) => {
  const g = guard(req, res, limited, { busyMsg: 'Too many quiz requests. Please wait a minute and try again.' });
  if (!g) return;
  try {
    if (g.body.action === 'review') return await review(g, g.body, res);
    return await generate(g, g.body, res);
  } catch (e) {
    console.error('quiz error', e && e.message);
    return res.status(502).json({ detail: 'LeemAI had a problem. Please try again.' });
  }
};
