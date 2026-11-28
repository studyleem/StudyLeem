/**
 * StudyLeem Weekly Blog  (add as a NEW file named "Blog.gs" in the SAME Apps Script project as the Auto-Publisher)
 *
 * Every week it asks Gemini to write one study-related article for FBISE students, checks it,
 * and saves it to Firestore collection `blogPosts` (document id = URL slug) with the same service account.
 * The website shows it at https://studyleem.vercel.app/blog/<slug> and in sitemap-blog.xml automatically.
 *
 * Articles are PUBLISHED AUTOMATICALLY – no admin approval step. (You can still edit / unpublish / delete any post in Admin -> Blog.)
 * It re-uses the script properties and helpers you already have:
 *   GEMINI_API_KEY, SERVICE_ACCOUNT_JSON, GEMINI_MODEL (optional), NOTIFY_EMAIL (optional)
 *
 * SETUP:  1) paste this file   2) run blogSetupCheck()   3) run createBlogTrigger()  -> one new article every Monday ~8:00
 *         (optional) run generateBlogNow() once to publish the first article immediately
 */

const BLOG = {
  SITE: 'https://studyleem.vercel.app',
  MIN_WORDS: 650,            // shorter articles are rejected and regenerated
  MIN_DAYS_BETWEEN: 5,       // safety: the weekly trigger never publishes twice within 5 days
  ATTEMPTS: 3,
  CATEGORIES: [
    'Study Tips', 'Exam Preparation', 'Subject Guides', 'Time Management',
    'Smart Learning with AI', 'Student Wellbeing', 'Career & Guidance'
  ],
  IDEAS: {
    'Study Tips': ['active recall and spaced repetition', 'making chapter notes that actually help', 'how to memorise definitions and formulas', 'the Feynman technique for hard concepts', 'how to read a textbook chapter effectively'],
    'Exam Preparation': ['a 4-week revision plan for FBISE exams', 'how to solve MCQs faster and avoid silly mistakes', 'how to write long answers that earn full marks', 'how to use exercises and past-style questions for practice', 'the night before the exam checklist'],
    'Subject Guides': ['how to study Physics numericals step by step', 'how to learn Chemistry equations and reactions', 'how to revise Biology diagrams and terms', 'how to improve in Mathematics with daily practice', 'how to get better marks in English and Urdu writing', 'how to prepare Islamiat and Pakistan Studies answers', 'how to learn Computer Science programming basics'],
    'Time Management': ['building a realistic daily study timetable', 'the Pomodoro technique for students', 'balancing school, tuition and self-study', 'how to stop procrastinating before exams'],
    'Smart Learning with AI': ['how to use an AI tutor safely and effectively', 'turning AI quizzes into a revision habit', 'how to check your own answers and learn from mistakes', 'using AI to explain difficult topics in simple words'],
    'Student Wellbeing': ['managing exam stress and anxiety', 'why sleep improves memory and marks', 'staying focused and avoiding phone distractions', 'healthy study breaks and routines'],
    'Career & Guidance': ['how to choose subjects after Class 10 (general guidance)', 'building good study habits for college', 'how to set goals and track progress', 'skills every student should build besides marks']
  },
  // subject pages that exist on the website (used to validate internal links)
  SUBJECTS: {
    '9': ['biology', 'chemistry', 'english', 'islamiat', 'mathematics', 'pakistan-studies', 'physics', 'urdu'],
    '10': ['biology', 'chemistry', 'computer-science', 'english', 'mathematics', 'physics'],
    '11': ['biology', 'chemistry', 'economics', 'english', 'mathematics', 'physics', 'statistics'],
    '12': ['biology', 'chemistry', 'computer-science', 'economics', 'english', 'mathematics', 'physics']
  }
};

/* ───────────────────────── triggers & helpers you run by hand ───────────────────────── */

/** Run once: one new article every Monday at about 8:00. */
function createBlogTrigger() {
  removeBlogTrigger();
  ScriptApp.newTrigger('generateWeeklyBlog').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Weekly blog trigger created (every Monday ~8:00, script time zone).');
}
function removeBlogTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'generateWeeklyBlog') ScriptApp.deleteTrigger(t); });
}

/** Checks Gemini + Firestore access for the blog. */
function blogSetupCheck() {
  const out = [];
  try { fsGet_('blogPosts?pageSize=1'); out.push('Firestore blogPosts access: OK'); } catch (e) { out.push('Firestore: FAILED - ' + e.message); }
  try { out.push('Gemini: OK (' + String(blogGemini_('Reply with the single word: ok', false, 50)).trim().slice(0, 20) + ')'); } catch (e) { out.push('Gemini: FAILED - ' + e.message); }
  const t = ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'generateWeeklyBlog');
  out.push('Weekly trigger: ' + (t.length ? 'active' : 'MISSING - run createBlogTrigger()'));
  out.push('Publishing: automatic (no approval needed)');
  Logger.log(out.join('\n'));
}

/** Lists the posts saved so far and when the last one was created. */
function blogDiagnose() {
  const posts = blogExisting_(), last = Number(props_().getProperty('BLOG_LAST_RUN') || 0);
  Logger.log('Posts in Firestore: ' + posts.length + '\nLast automatic run: ' + (last ? new Date(last).toString() : 'never') +
    '\nNext category in rotation: ' + BLOG.CATEGORIES[Number(props_().getProperty('BLOG_CAT_IDX') || 0) % BLOG.CATEGORIES.length] +
    '\n' + posts.map(p => ' - [' + p.category + '] ' + p.title + '  (' + p.slug + ')').join('\n'));
}

/** Writes and publishes one article right now. */
function generateBlogNow() { return runBlog_({ force: true }); }
/** The weekly trigger calls this. */
function generateWeeklyBlog() { return runBlog_({ force: false }); }

/* ───────────────────────── main job ───────────────────────── */

function runBlog_(o) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { Logger.log('Another run is active - skipped.'); return; }
  const p = props_();
  try {
    if (!o.force) {
      const last = Number(p.getProperty('BLOG_LAST_RUN') || 0);
      if (last && Date.now() - last < BLOG.MIN_DAYS_BETWEEN * 86400000) { Logger.log('Skipped: an article was already created in the last ' + BLOG.MIN_DAYS_BETWEEN + ' days.'); return; }
    }
    const existing = blogExisting_();
    const idx = Number(p.getProperty('BLOG_CAT_IDX') || 0), category = BLOG.CATEGORIES[idx % BLOG.CATEGORIES.length];
    Logger.log('Writing an article in category: ' + category + ' (' + existing.length + ' existing posts)');

    let post = null, lastErr = '';
    for (let a = 1; a <= BLOG.ATTEMPTS && !post; a++) {
      try { post = blogGenerate_(category, existing); } catch (e) { lastErr = e.message; Logger.log('Attempt ' + a + ' failed: ' + e.message); }
    }
    if (!post) throw new Error('Gemini could not produce a valid article after ' + BLOG.ATTEMPTS + ' attempts (' + lastErr + ')');

    const status = 'published';                       // always live – no approval step
    let slug = post.slug;
    if (existing.some(x => x.slug === slug)) slug = (slug.slice(0, 70) + '-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd'));
    let res = blogSave_(slug, post, status);
    if (res === 'exists') { slug = slug + '-' + Math.floor(Math.random() * 900 + 100); res = blogSave_(slug, post, status); }
    if (res !== 'created') throw new Error('Could not save the article (' + res + ')');

    p.setProperty('BLOG_LAST_RUN', String(Date.now()));
    p.setProperty('BLOG_CAT_IDX', String(idx + 1));
    Logger.log('Saved "' + post.title + '" as ' + status + ': ' + BLOG.SITE + '/blog/' + slug + '  (' + post.wordCount + ' words)');
    blogMail_('New blog article published',
      'PUBLISHED:\n' + post.title + '\n' + BLOG.SITE + '/blog/' + slug +
      '\n\nCategory: ' + post.category + ' | ' + post.wordCount + ' words\n\n' + post.excerpt);
  } catch (e) {
    Logger.log('BLOG FAILED: ' + e.message);
    blogMail_('Blog generation FAILED', e.message + '\n\nOpen the Apps Script editor -> Executions to see details, or run generateBlogNow() manually.');
  } finally { lock.releaseLock(); }
}

/* ───────────────────────── Gemini: write + validate ───────────────────────── */

function blogAllowedLinks_() {
  const L = ['/', '/fbise', '/fbise/notes', '/fbise/books', '/leemai', '/leemai#chat', '/leemai#quiz', '/leemai#checker', '/blog'];
  Object.keys(BLOG.SUBJECTS).forEach(c => { L.push('/fbise/' + c, '/fbise/notes/' + c, '/fbise/books/' + c); BLOG.SUBJECTS[c].forEach(s => L.push('/fbise/' + c + '/' + s)); });
  return L;
}

function blogGenerate_(category, existing) {
  const ideas = (BLOG.IDEAS[category] || []).join('; ');
  const recent = existing.slice(-60).map(x => x.title).join('\n- ');
  const links = blogAllowedLinks_();
  const prompt =
    'You are the editor of the StudyLeem blog. StudyLeem (studyleem.vercel.app) is a free study website for FBISE (Federal Board of Intermediate and Secondary Education, Islamabad, Pakistan) students in Classes 9-12. ' +
    'It offers free chapter-wise notes and books and LeemAI, an AI tutor personalised for FBISE (ask questions, AI quizzes with score and review, AI paper checker).\n\n' +
    'Write ONE new blog article.\n' +
    'Category: ' + category + '\n' +
    'Topic inspiration (pick ONE angle, or choose a better one in the same category): ' + ideas + '\n' +
    (recent ? 'Do NOT repeat or closely rephrase these existing article titles:\n- ' + recent + '\n' : '') +
    '\nRULES\n' +
    '- Audience: Pakistani students aged 14-18. Friendly, clear, practical, encouraging. Simple English.\n' +
    '- Must be useful, evergreen, study-related advice. Mention FBISE naturally where it helps.\n' +
    '- NEVER invent statistics, studies, quotes, dates, exam rules, marks distributions, fees, admission policies or results. If official details matter, say "check the official FBISE website for the latest syllabus and date sheet".\n' +
    '- No medical or legal advice; for wellbeing topics give general habits and suggest talking to a parent, teacher or counsellor when stressed.\n' +
    '- Length: 800 to 1100 words. Markdown only: use "## " for section headings (4 to 6 sections, NO "# " title inside the content), short paragraphs, bullet or numbered lists, one "## Quick checklist" section and one "## Key takeaways" section.\n' +
    '- Include 3 to 5 internal links in markdown form [anchor text](/path) chosen ONLY from this exact list (no other links of any kind, no external links, no HTML):\n  ' + links.join('  ') + '\n' +
    '  Use /leemai#quiz or /leemai#checker or /leemai#chat where natural, and subject pages such as /fbise/10/physics when relevant.\n' +
    '- End with a short encouraging closing paragraph that invites the reader to practise with a free LeemAI quiz.\n\n' +
    'Return ONLY JSON with exactly these keys:\n' +
    '{"title": string (max 65 characters, includes a clear keyword), "slug": string (lowercase letters, numbers and hyphens, max 70 chars), ' +
    '"excerpt": string (one sentence, 100-180 characters), "metaDescription": string (130-155 characters), "keywords": array of 6 to 10 short keyword phrases, "content": string (the markdown article)}';

  const raw = blogGemini_(prompt, true, 8192);
  let j;
  try { j = JSON.parse(String(raw).replace(/^```json|```$/g, '').trim()); } catch (e) { throw new Error('Gemini returned invalid JSON'); }

  const title = String(j.title || '').replace(/\s+/g, ' ').trim();
  if (title.length < 15 || title.length > 90) throw new Error('title length out of range (' + title.length + ')');
  if (existing.some(x => x.title.toLowerCase() === title.toLowerCase())) throw new Error('title already exists');

  const content = blogSanitize_(String(j.content || ''), links);
  const words = content.split(/\s+/).filter(Boolean).length;
  if (words < BLOG.MIN_WORDS) throw new Error('article too short (' + words + ' words)');
  if (words > 2200) throw new Error('article too long (' + words + ' words)');
  if ((content.match(/^##\s+/gm) || []).length < 3) throw new Error('not enough sections');

  let slug = slug_(j.slug || title).slice(0, 80).replace(/^-+|-+$/g, '');
  if (slug.length < 5) slug = slug_(title).slice(0, 80);
  const excerpt = String(j.excerpt || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  let meta = String(j.metaDescription || excerpt).replace(/\s+/g, ' ').trim();
  if (meta.length > 160) meta = meta.slice(0, 157).replace(/\s+\S*$/, '') + '...';
  if (excerpt.length < 40 || meta.length < 60) throw new Error('excerpt/meta too short');
  const keywords = (Array.isArray(j.keywords) ? j.keywords : String(j.keywords || '').split(',')).map(k => String(k).trim()).filter(Boolean).slice(0, 10);

  return { title, slug, excerpt, metaDescription: meta, keywords: keywords.join(', '), category, content, wordCount: words, readingMinutes: Math.max(1, Math.ceil(words / 200)) };
}

/** Removes HTML, headings level 1 and every link that is not on the allowed internal list. */
function blogSanitize_(md, allowed) {
  const ok = {}; allowed.forEach(u => { ok[u] = 1; });
  let s = md.replace(/\r\n?/g, '\n').replace(/<[^>]*>/g, '');
  s = s.replace(/^#\s+.*$/gm, '');                                   // no H1 inside the body (page already has one)
  let n = 0;
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const u = url.replace(/\/+$/, '') || '/';
    if (ok[url] || ok[u]) { n++; return '[' + text + '](' + url + ')'; }
    return text;                                                     // unknown / external link -> plain text
  });
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (n < 2) s += '\n\n## Keep Practising\n\nRead the chapter-wise [FBISE notes](/fbise/notes) and test yourself with a free [LeemAI quiz](/leemai#quiz).';
  return s;
}

function blogGemini_(prompt, json, maxTokens) {
  const key = props_().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const pref = props_().getProperty('GEMINI_MODEL');
  const models = (pref ? [pref] : []).concat(CFG.MODELS).filter((m, i, a) => a.indexOf(m) === i);
  let last = '';
  for (const m of models) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: Object.assign({ temperature: 0.8, maxOutputTokens: maxTokens || 8192 }, json ? { responseMimeType: 'application/json' } : {}) })
    });
    const code = r.getResponseCode(), body = r.getContentText();
    if (code === 200) {
      const d = JSON.parse(body), c = d.candidates && d.candidates[0];
      const t = c && c.content && c.content.parts ? c.content.parts.map(x => x.text || '').join('') : '';
      if (t.trim() && !(c && c.finishReason === 'MAX_TOKENS')) return t;
      last = 'empty or cut-off answer from ' + m; continue;
    }
    last = 'HTTP ' + code + ' from ' + m;
    if (code === 403 || (code === 400 && /api key/i.test(body))) throw new Error('Gemini rejected the API key');
  }
  throw new Error(last || 'Gemini unavailable');
}

/* ───────────────────────── Firestore ───────────────────────── */

/** Existing posts: [{slug, title, category}] (oldest first not guaranteed). */
function blogExisting_() {
  const out = []; let token = '';
  for (let i = 0; i < 5; i++) {
    const d = fsGet_('blogPosts?pageSize=300&mask.fieldPaths=title&mask.fieldPaths=category' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    (d.documents || []).forEach(x => {
      const f = x.fields || {};
      out.push({ slug: x.name.split('/').pop(), title: (f.title && f.title.stringValue) || '', category: (f.category && f.category.stringValue) || '' });
    });
    if (!d.nextPageToken) break;
    token = d.nextPageToken;
  }
  return out;
}

/** Creates blogPosts/{slug}; never overwrites an existing post. Returns 'created' | 'exists'. */
function blogSave_(slug, post, status) {
  const now = new Date();
  const fields = {
    title: V_(post.title), excerpt: V_(post.excerpt), metaDescription: V_(post.metaDescription), keywords: V_(post.keywords),
    category: V_(post.category), content: V_(post.content), wordCount: V_(post.wordCount), readingMinutes: V_(post.readingMinutes),
    status: V_(status), source: V_('auto-blog'), createdAt: V_(now), updatedAt: V_(now)
  };
  if (status === 'published') fields.publishedAt = V_(now);
  const r = fsCall_('post', fsBase_() + '/blogPosts?documentId=' + encodeURIComponent(slug), { fields });
  if (r.code === 200) return 'created';
  if (r.code === 409) return 'exists';
  throw new Error('Firestore save ' + r.code + ': ' + r.text.slice(0, 250));
}

function blogMail_(subject, body) {
  try {
    const to = props_().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to, 'StudyLeem Blog: ' + subject, body);
  } catch (e) { Logger.log('Mail failed: ' + e.message); }
}
