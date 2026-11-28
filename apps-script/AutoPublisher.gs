/**
 * StudyLeem Auto-Publisher  (Google Apps Script — free, runs inside your Google account)      v2: ANY material type
 *
 * Drop a PDF into the Drive folder "StudyLeem Uploads" and, within ~5 minutes, it is:
 *   shared (anyone with link) -> described by Gemini (English + Urdu) -> saved to Firestore `materials`
 * No admin login and NO admin approval needed (uses a Firebase service account). Safe against duplicates.
 *
 * ───────────────────────────── HOW TO NAME THE PDF ─────────────────────────────
 *   Class-<9|10|11|12>-<Subject>-<chapter / item words>-<MATERIAL TYPE>.pdf
 *   The MATERIAL TYPE is the LAST part of the name. Separators: - or _ or spaces.
 *
 *   Known types (English or Urdu)         Examples
 *   ─────────────────────────────────     ─────────────────────────────────────────────────────────
 *   Notes / Note                          Class-10-Physics-Ch3-Electrostatics-Notes.pdf
 *   Book / Books / Textbook               Class-12-Physics-Book.pdf          (whole textbook)
 *                                         Class12-Physics-Ch2-Mechanics-Book.pdf   (a part of a book)
 *   Main Exercise / Exercise              Class-12-Mathematics-Ex-2.1-Main-Exercise.pdf   (chapter 2, exercise 1)
 *   Review Exercise / Review              Class-12-Mathematics-Review-Ex-1-Review-Exercise.pdf
 *   MCQs Explanation / MCQs / MCQ         Class-9-Biology-Ch4-Cell-MCQs-Explanation.pdf
 *   Past Papers / Past Paper              Class-10-Chemistry-Model-Paper-2025-Past-Papers.pdf
 *   Urdu keywords also work               کلاس-10-اردو-باب-3-نظم-نوٹس.pdf   (کلاس=Class, باب=Chapter, نوٹس=Notes,
 *                                         کتاب=Book, مشق=Exercise)   Subject names in Urdu (اردو, طبیعیات, ریاضی...) work too.
 *
 *   ANY OTHER TYPE: put the type name in square brackets at the very end, e.g.
 *        Class-10-Physics-Ch2-Kinematics [Short Questions].pdf
 *        Class-9-English-Grammar-Rules [Model Papers].pdf
 *   A new type automatically gets its own section on the homepage and its own pages (/fbise/short-questions).
 *   (Type names must use English letters/numbers because they become part of the URL.)
 *
 *   Optional markers inside the name:  Ch3 / Chapter-3 / باب-3   Ex-2.1 (chapter 2, exercise 1)   Review-Ex-1
 *   The rest of the words become the title:  Ch3-Electrostatics  ->  title "Electrostatics".
 *   Old names that have no type at the end still work exactly as before:
 *        Class-10-Physics-Ch3-Electrostatics.pdf  /  Class-12-Mathematics-Ex-2.1.pdf  /  Class-12-Mathematics-Review-Ex-1.pdf
 *
 *   REPLACE: add -REPLACE at the very end to update the PDF/cover/description of an item that is already on the site
 *            (its title stays), e.g. Class-12-Mathematics-Ex-2.4-Main-Exercise-REPLACE.pdf
 *
 * SCRIPT PROPERTIES (Project Settings -> Script properties):
 *   GEMINI_API_KEY        required   Google AI Studio key
 *   SERVICE_ACCOUNT_JSON  required   whole content of the Firebase service-account .json file
 *   GEMINI_MODEL          optional   preferred model name
 *   NOTIFY_EMAIL          optional   where to send reports (default: your own Google account)
 * Created automatically by setup(): FOLDER_UPLOADS, FOLDER_DONE, FOLDER_ERRORS, FOLDER_DUPES
 */

const CFG = {
  ROOT_FOLDER_NAME: 'StudyLeem Uploads',
  MAX_PER_RUN: 5,              // files handled per 5-minute run
  RUN_BUDGET_MS: 4 * 60 * 1000,
  THUMB_TRIES: 3,              // wait for Drive's cover thumbnail this many runs, then publish anyway
  MAX_FAILS: 5,                // after this many failed saves the file goes to "Needs attention"
  MODELS: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
};

const props_ = () => PropertiesService.getScriptProperties();

/* ───────────────────────── one-time setup helpers ───────────────────────── */

/** Run once: creates the folders and checks your settings. */
function setup() {
  const p = props_();
  const root = findOrCreateFolder_(DriveApp.getRootFolder(), CFG.ROOT_FOLDER_NAME);
  p.setProperty('FOLDER_UPLOADS', root.getId());
  p.setProperty('FOLDER_DONE',   findOrCreateFolder_(root, 'Done').getId());
  p.setProperty('FOLDER_ERRORS', findOrCreateFolder_(root, 'Needs attention').getId());
  p.setProperty('FOLDER_DUPES',  findOrCreateFolder_(root, 'Duplicates').getId());
  Logger.log('Upload folder ready: ' + root.getUrl());
  ['GEMINI_API_KEY', 'SERVICE_ACCOUNT_JSON'].forEach(k => { if (!p.getProperty(k)) Logger.log('MISSING script property: ' + k); });
  Logger.log('Setup finished. Next: run testConnections(), then createTrigger().');
}

/** Run after setup(): checks Firestore access, Gemini and the folders. */
function testConnections() {
  const out = [];
  try { const t = firestoreToken_(); out.push('Firestore login: OK'); fsGet_('materials?pageSize=1'); out.push('Firestore read: OK'); }
  catch (e) { out.push('Firestore: FAILED - ' + e.message); }
  try { const r = callGemini_('Reply with the single word: ok'); out.push('Gemini: OK (' + String(r).slice(0, 20).trim() + ')'); }
  catch (e) { out.push('Gemini: FAILED - ' + e.message); }
  try { out.push('Upload folder: ' + DriveApp.getFolderById(props_().getProperty('FOLDER_UPLOADS')).getName()); }
  catch (e) { out.push('Folders: FAILED - run setup() first'); }
  Logger.log(out.join('\n'));
}

/** Shows where every file is, the trigger state, retry counters and what the script has already published. */
function diagnose() {
  const p = props_(), L = [];
  ['FOLDER_UPLOADS', 'FOLDER_DONE', 'FOLDER_ERRORS', 'FOLDER_DUPES'].forEach(k => {
    try {
      const f = DriveApp.getFolderById(p.getProperty(k)), it = f.getFiles(), names = [];
      while (it.hasNext()) names.push(it.next().getName());
      L.push(f.getName() + ' (' + names.length + '): ' + (names.join(' | ') || '-'));
    } catch (e) { L.push(k + ': cannot open (' + e.message + ')'); }
  });
  const trig = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processNewFiles');
  L.push('Triggers for processNewFiles: ' + trig.length + (trig.length ? '' : '  <-- MISSING, run createTrigger()'));
  Object.keys(p.getProperties()).filter(k => /^(thumb|fail)_/.test(k)).forEach(k => L.push('counter ' + k + ' = ' + p.getProperty(k)));
  try {
    const r = fsCall_('post', fsBase_() + ':runQuery', { structuredQuery: { from: [{ collectionId: 'materials' }],
      where: { fieldFilter: { field: { fieldPath: 'source' }, op: 'EQUAL', value: { stringValue: 'auto-publisher' } } }, limit: 20 } });
    if (r.code !== 200) L.push('Firestore query FAILED (' + r.code + '): ' + r.text.slice(0, 300));
    else {
      const docs = JSON.parse(r.text).filter(x => x.document);
      L.push('Published by this script so far: ' + docs.length);
      docs.forEach(x => { const f = x.document.fields; L.push('  - ' + x.document.name.split('/').pop() + ' | ' + ((f.typeLabel || f.type || {}).stringValue) + ' | class ' + (f.class || {}).stringValue + ' | ' + (f.subject || {}).stringValue + ' | ' + (f.title || {}).stringValue); });
    }
  } catch (e) { L.push('Firestore: FAILED - ' + e.message); }
  Logger.log(L.join('\n'));
}

/** Shows how each PDF in the upload folder would be understood, without publishing anything. */
function previewNames() {
  const files = DriveApp.getFolderById(props_().getProperty('FOLDER_UPLOADS')).getFilesByType(MimeType.PDF);
  let n = 0;
  while (files.hasNext()) { n++; Logger.log(describeName_(files.next().getName())); }
  if (!n) Logger.log('No PDF files in the upload folder.');
}
/** Paste any file name to test it: testName('Class12-Physics-Ch2-Mechanics-Book.pdf') */
function testName(name) { Logger.log(describeName_(name || 'Class-10-Physics-Ch3-Electrostatics-Notes.pdf')); }
function describeName_(name) {
  const i = parseName_(name);
  if (!i.ok) return name + '  ->  ERROR: ' + i.reason;
  return name + '  ->  type "' + i.typeLabel + '" (/fbise/' + i.type + ') | class ' + i.cls + ' | ' + i.subject +
    ' | chapter ' + (i.chapterNumber || '-') + (i.exerciseNumber ? ' ex ' + i.exerciseNumber : '') + ' | title "' + i.title + '" | slug ' + (i.chapterSlug || '(single textbook)') + (i.replace ? ' | REPLACE existing' : '');
}

/** Run once: makes processNewFiles() run every 5 minutes (removes old copies first). */
function createTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('processNewFiles').timeBased().everyMinutes(5).create();
  Logger.log('Trigger created: processNewFiles every 5 minutes.');
}
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'processNewFiles') ScriptApp.deleteTrigger(t); });
}

/* ───────────────────────── main job (runs every 5 minutes) ───────────────────────── */

function processNewFiles() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { Logger.log('Another run is still active - skipped this run.'); return; }
  const started = Date.now(), p = props_(), report = { ok: [], err: [], dupe: [] };
  try {
    const upload = DriveApp.getFolderById(p.getProperty('FOLDER_UPLOADS'));
    const done = DriveApp.getFolderById(p.getProperty('FOLDER_DONE'));
    const errors = DriveApp.getFolderById(p.getProperty('FOLDER_ERRORS'));
    const dupes = DriveApp.getFolderById(p.getProperty('FOLDER_DUPES'));

    const it = upload.getFilesByType(MimeType.PDF);
    const files = [];
    while (it.hasNext() && files.length < CFG.MAX_PER_RUN) files.push(it.next());
    Logger.log('Run started: ' + files.length + ' PDF(s) found in the upload folder.');

    for (const file of files) {
      if (Date.now() - started > CFG.RUN_BUDGET_MS) break;
      const name = file.getName(), id = file.getId();
      try {
        const info = parseName_(name);
        Logger.log('File: ' + name);
        if (!info.ok) { Logger.log('  -> name not understood: ' + info.reason + ' (moved to Needs attention)'); move_(file, errors); report.err.push(`${name}: ${info.reason}`); continue; }
        Logger.log('  parsed: ' + info.typeLabel + ' | ' + info.label + ' | class ' + info.cls + ' | ' + info.subject);

        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // cover = Drive's first-page thumbnail; it can take a minute to appear for new files
        const tkey = 'thumb_' + id, tries = Number(p.getProperty(tkey) || 0);
        if (!thumbReady_(id) && tries < CFG.THUMB_TRIES) { p.setProperty(tkey, String(tries + 1)); Logger.log('  -> waiting for the Drive cover thumbnail (try ' + (tries + 1) + ' of ' + CFG.THUMB_TRIES + ')'); continue; }

        const docId = 'gd_' + id;
        const clash = findExisting_(info);
        if (clash) Logger.log('  existing document found on the site: ' + clash);
        if (clash && info.replace) {
          const ai0 = aiText_(info);
          updateMaterial_(clash, ai0, id);
          Logger.log('  existing item ' + clash + ' updated with the new PDF -> moved to Done');
          move_(file, done); p.deleteProperty(tkey); report.ok.push(`${info.typeLabel}: ${info.label} (replaced)  -  ${ai0.seoTitle}`); continue;
        }
        if (!clash && info.replace) Logger.log('  nothing to replace on the site yet - publishing as a new item');
        if (clash && clash !== docId) { move_(file, dupes); report.dupe.push(`${name}: same item already exists on the site (${clash}). To replace it, rename the file to end with -REPLACE.pdf`); continue; }
        if (clash === docId) { move_(file, done); continue; }

        const ai = aiText_(info);
        Logger.log('  saving to Firestore...');
        const res = createMaterial_(docId, info, ai, id);
        Logger.log('  Firestore result: ' + res + ' -> moved to Done');
        if (res === 'created' || res === 'exists') {
          move_(file, done); p.deleteProperty(tkey); p.deleteProperty('fail_' + id);
          if (res === 'created') report.ok.push(`${info.typeLabel}: ${info.label}  -  ${ai.seoTitle}`);
        }
      } catch (e) {
        const fkey = 'fail_' + id, fails = Number(p.getProperty(fkey) || 0) + 1;
        p.setProperty(fkey, String(fails));
        Logger.log('  -> FAILED (' + fails + '/' + CFG.MAX_FAILS + '): ' + e.message);
        if (fails >= CFG.MAX_FAILS) { move_(file, errors); report.err.push(`${name}: gave up after ${fails} tries (${e.message})`); p.deleteProperty(fkey); }
      }
    }
  } finally { lock.releaseLock(); }

  Logger.log('Run finished: published ' + report.ok.length + ', errors ' + report.err.length + ', duplicates ' + report.dupe.length);
  if (report.ok.length || report.err.length || report.dupe.length) mail_(report);
}

/* ───────────────────────── file-name parsing (any material type, English + Urdu) ───────────────────────── */

// type slug -> display label + the words that mean it (matched at the END of the file name, longest first)
const TYPES_ = {
  'notes':            { label: 'Notes',            words: ['notes', 'note', 'chapter notes', 'chapter note', 'نوٹس', 'نوٹ'] },
  'books':            { label: 'Books',            words: ['books', 'book', 'textbooks', 'textbook', 'text books', 'text book', 'کتاب', 'کتب'] },
  'exercises':        { label: 'Exercises',        words: ['main exercises', 'main exercise', 'solved exercises', 'solved exercise', 'exercise solutions', 'exercise solution', 'exercises', 'exercise', 'مشق', 'مشقیں'] },
  'review-exercises': { label: 'Review Exercises', words: ['review exercises', 'review exercise', 'review ex', 'review', 'نظرثانی مشق', 'جائزہ مشق'] },
  'mcqs-explanation': { label: 'MCQs Explanation', words: ['mcqs explanations', 'mcqs explanation', 'mcq explanations', 'mcq explanation', 'mcqs with explanation', 'mcqs solution', 'mcq solution', 'mcqs', 'mcq'] },
  'past-papers':      { label: 'Past Papers',      words: ['past papers', 'past paper', 'pastpapers', 'pastpaper', 'old papers', 'old paper'] }
};
// subject names (English + Urdu) -> canonical English name (longest first when matching)
const SUBJECTS_ = {
  'Physics': ['physics', 'طبیعیات', 'فزکس'], 'Chemistry': ['chemistry', 'کیمیا'], 'Biology': ['biology', 'حیاتیات'],
  'Mathematics': ['mathematics', 'maths', 'math', 'ریاضی'], 'Computer Science': ['computer science', 'computer studies', 'computer', 'کمپیوٹر سائنس', 'کمپیوٹر'],
  'English': ['english', 'انگریزی'], 'Urdu': ['urdu', 'اردو'], 'Islamiat': ['islamiat', 'islamiyat', 'islamic studies', 'اسلامیات'],
  'Pakistan Studies': ['pakistan studies', 'pak studies', 'مطالعہ پاکستان'], 'Economics': ['economics', 'معاشیات'], 'Statistics': ['statistics', 'شماریات'],
  'Education': ['education', 'تعلیم'], 'Civics': ['civics', 'شہریت']
};
const TYPE_LOOKUP_ = (function () {
  const L = [];
  Object.keys(TYPES_).forEach(slug => TYPES_[slug].words.forEach(w => L.push({ slug, label: TYPES_[slug].label, tokens: w.split(' '), key: w })));
  return L.sort((a, b) => b.tokens.length - a.tokens.length);
})();
const SUBJECT_LOOKUP_ = (function () {
  const L = [];
  Object.keys(SUBJECTS_).forEach(name => SUBJECTS_[name].forEach(w => L.push({ name, tokens: w.split(' ') })));
  return L.sort((a, b) => b.tokens.length - a.tokens.length);
})();

function normText_(s) { return String(s).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokensEq_(a, b) { for (let i = 0; i < b.length; i++) if (String(a[i]).toLowerCase() !== b[i]) return false; return true; }
/** "Main Exercise" / "main-exercises" -> {slug,label} for known types; any other readable text -> its own custom type; null if not usable. */
function resolveTypeText_(text) {
  const n = normText_(text).toLowerCase();
  if (!n) return null;
  const hit = TYPE_LOOKUP_.find(x => x.key === n);
  if (hit) return { slug: hit.slug, label: hit.label };
  const slug = slug_(n);
  if (slug.length < 2 || slug.length > 41) return null;      // needs English letters/numbers (the slug is part of the URL)
  return { slug, label: tc_(normText_(text)) };
}

function parseName_(fileName) {
  const fail = reason => ({ ok: false, reason });
  let s = String(fileName).replace(/\.pdf$/i, '').trim();

  // 1) -REPLACE flag
  let replace = false;
  if (/[\s_-]+replace$/i.test(s)) { replace = true; s = s.replace(/[\s_-]+replace$/i, ''); }

  // 2) explicit custom type in brackets at the end:  ... [Short Questions]
  let typeObj = null;
  const br = s.match(/[\[(]\s*([^\])]+?)\s*[\])]\s*$/);
  if (br) {
    typeObj = resolveTypeText_(br[1]);
    if (!typeObj) return fail('The type in brackets "' + br[1] + '" must use English letters/numbers (it becomes part of the web address)');
    s = s.slice(0, br.index);
  }
  let tokens = normText_(s).split(' ').filter(Boolean);

  // 3) known type words at the END of the name (longest first), e.g. ...-Main-Exercise / ...-MCQs-Explanation / ...-Book
  if (!typeObj) {
    for (const t of TYPE_LOOKUP_) {
      if (tokens.length > t.tokens.length + 2 && tokensEq_(tokens.slice(-t.tokens.length), t.tokens)) {
        typeObj = { slug: t.slug, label: t.label }; tokens = tokens.slice(0, -t.tokens.length); break;
      }
    }
  }
  if (tokens.length < 3) return fail('Name too short. Use: Class-10-Physics-Ch3-Electrostatics-Notes.pdf');

  // 4) class
  const m = tokens.join(' ').match(/^(?:class|کلاس)\s*(9|10|11|12)\s+(.+)$/i);
  if (!m) return fail('Name must start with Class-9, Class-10, Class-11 or Class-12 (or کلاس-10)');
  const cls = m[1];
  let rest = m[2].split(' ').filter(Boolean);

  // 5) subject
  let subject = '', after = rest;
  const sh = SUBJECT_LOOKUP_.find(x => rest.length >= x.tokens.length && tokensEq_(rest, x.tokens));
  if (sh) { subject = sh.name; after = rest.slice(sh.tokens.length); }
  else {
    const mk = rest.findIndex((w, i) => i > 0 && /^(?:ch(?:apter)?|باب)\d*$|^(?:ex(?:ercise)?|مشق)\d*$|^review$/i.test(w));
    const sub = mk > 0 ? rest.slice(0, mk) : [rest[0]];
    subject = tc_(sub.join(' ')); after = rest.slice(sub.length);
    if (!/[A-Za-z]/.test(subject)) return fail('Subject "' + subject + '" not recognised – use an English subject name (e.g. Physics) or a known Urdu name');
  }
  const itemText = after.join(' ');

  // 6) item markers: Review-Ex-N, Ex-A.B, Ch-N (English or Urdu)
  let marker = '', ch = null, ex = null, name = '', r;
  if ((r = itemText.match(/^(?:review|نظرثانی|جائزہ)(?:\s+(?:ex(?:ercise)?|مشق))?\s*(\d+)(?:\s+(.+))?$/i))) { marker = 'review'; ch = +r[1]; name = r[2] || ''; }
  else if ((r = itemText.match(/^(?:ex(?:ercise)?|مشق)\s*(\d+)\.(\d+)(?:\s+(.+))?$/i))) { marker = 'exercise'; ch = +r[1]; ex = +r[2]; name = r[3] || ''; }
  else if ((r = itemText.match(/^(?:ch(?:apter)?|باب)\s*(\d+)(?:\s+(.+))?$/i))) { marker = 'chapter'; ch = +r[1]; name = r[2] || ''; }
  else name = itemText;
  name = name ? tc_(name) : '';

  return build_({ cls, subject, typeObj, marker, ch, ex, name, replace });
}

function build_(o) {
  const subjectSlug = slug_(o.subject);
  if (!subjectSlug) return { ok: false, reason: 'Could not build a web address from the subject "' + o.subject + '"' };
  const base = { ok: true, cls: o.cls, subject: o.subject, subjectSlug, replace: o.replace, chapterNumber: o.ch, exerciseNumber: o.ex, review: false, contentType: null };

  // ── OLD BEHAVIOUR (kept exactly): no type word, or the type is Notes -> chapter / exercise / review exercise notes ──
  if (!o.typeObj || o.typeObj.slug === 'notes') {
    if (o.marker === 'review')   return Object.assign(base, { type: 'notes', typeLabel: 'Notes', kind: 'review',   contentType: 'exercise', review: true, exerciseNumber: null, chapterSlug: `review-exercise-${o.ch}`, label: `Review Exercise ${o.ch}`, title: `Review Exercise ${o.ch}` + (o.name ? ' - ' + o.name : ''), chapterName: '' });
    if (o.marker === 'exercise') return Object.assign(base, { type: 'notes', typeLabel: 'Notes', kind: 'exercise', contentType: 'exercise', chapterSlug: `exercise-${o.ch}-${o.ex}`, label: `Exercise ${o.ch}.${o.ex}`, title: `Exercise ${o.ch}.${o.ex}` + (o.name ? ' - ' + o.name : ''), chapterName: '' });
    if (o.marker === 'chapter')  return Object.assign(base, { type: 'notes', typeLabel: 'Notes', kind: 'chapter',  contentType: 'chapter',  chapterSlug: `chapter-${o.ch}`, label: `Chapter ${o.ch}`, title: o.name || `Chapter ${o.ch}`, chapterName: o.name });
    if (!o.typeObj) return { ok: false, reason: 'Add the material type at the END of the name, e.g. -Notes, -Book, -Main-Exercise, -Review-Exercise, -MCQs-Explanation, -Past-Papers (or [Any Type]); or use Ch3 / Ex-2.1 / Review-Ex-1 for notes' };
    // Notes without chapter number: a general notes file
    const t = o.name || `${o.subject} Notes (Class ${o.cls})`;
    return Object.assign(base, { type: 'notes', typeLabel: 'Notes', kind: 'item', contentType: 'chapter', chapterSlug: itemSlug_(t, null, o), label: t, title: t, chapterName: o.name });
  }

  const T = o.typeObj;
  // ── OLD BEHAVIOUR: a whole textbook (…-Book with nothing else) ──
  if (T.slug === 'books' && !o.marker && !o.name) {
    return Object.assign(base, { type: 'books', typeLabel: 'Books', kind: 'book', chapterNumber: null, exerciseNumber: null, chapterSlug: null, label: 'Textbook', title: `${o.subject} Textbook (Class ${o.cls})`, chapterName: '' });
  }

  // ── ANY OTHER TYPE (and parts of a book): one flat list of items per type ──
  let title;
  if (o.marker === 'exercise')     title = `Exercise ${o.ch}.${o.ex}` + (o.name ? ' - ' + o.name : '');
  else if (o.marker === 'review')  title = `Review Exercise ${o.ch}` + (o.name ? ' - ' + o.name : '');
  else if (o.marker === 'chapter') title = o.name || `${T.label} - Chapter ${o.ch}`;
  else                             title = o.name || `${T.label} (Class ${o.cls} ${o.subject})`;
  const label = o.marker === 'exercise' ? `Exercise ${o.ch}.${o.ex}` : o.marker === 'review' ? `Review Exercise ${o.ch}` : o.marker === 'chapter' ? `Chapter ${o.ch}` : title;
  return Object.assign(base, { type: T.slug, typeLabel: T.label, kind: 'item', chapterSlug: itemSlug_(o.marker === 'chapter' && !o.name ? '' : title, o.ch, o), label, title, chapterName: o.name });
}

/** ASCII slug for an item (same rule as the website's admin: chapter-N-<title words>); Urdu-only titles get a stable short code. */
function itemSlug_(title, chapterNumber, o) {
  let b = slug_(String(title).replace(/\./g, '-'));
  if (chapterNumber != null) { const pre = 'chapter-' + chapterNumber; b = b.indexOf(pre) === 0 ? b : pre + (b ? '-' + b : ''); }
  b = b.slice(0, 80).replace(/-+$/, '');
  if (b) return b;
  let h = 5381; const src = String(title) + o.cls + o.subject; for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return 'item-' + h.toString(36);
}

const SMALL_ = { of: 1, and: 1, the: 1, in: 1, to: 1, a: 1, an: 1, for: 1, on: 1 };
function tc_(str) {                                   // Title Case, keeps short ALL-CAPS words (ICT, DNA) and Urdu text
  return String(str).trim().split(/\s+/).map((w, i) => {
    if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
    const l = w.toLowerCase();
    return (i > 0 && SMALL_[l]) ? l : l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ');
}
function slug_(s) {                                   // identical to toSlug() used by the website
  return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/* ───────────────────────── Gemini ───────────────────────── */

function aiText_(info) {
  const fallback = templateText_(info);
  try {
    const prompt =
      'You write SEO metadata for StudyLeem, a free study website for FBISE (Federal Board, Pakistan) students.\n' +
      'Facts (use ONLY these, do not invent topics or claims):\n' +
      `- Class: ${info.cls}\n- Subject: ${info.subject}\n- Material type: ${info.typeLabel}${info.kind === 'book' ? ' (full textbook)' : ''}\n` +
      (info.chapterNumber ? `- Chapter number: ${info.chapterNumber}\n` : '') +
      (info.exerciseNumber ? `- Exercise: ${info.chapterNumber}.${info.exerciseNumber}\n` : '') +
      (info.review ? '- This is a review exercise\n' : '') +
      (info.chapterName ? `- Item name: ${info.chapterName}\n` : '') +
      'Return ONLY JSON: {"seoTitle": string, "description": string}\n' +
      '- seoTitle: max 80 characters, natural, includes "Class ' + info.cls + '", the subject, the item label (chapter/exercise if any), the material type ("' + info.typeLabel + '"), "FBISE" and "PDF".\n' +
      '- description: ONE English sentence (max 140 characters) for students, then " | ", then the same idea as ONE Urdu sentence (max 140 characters, Urdu script). No emojis, no quotes inside.';
    const txt = callGemini_(prompt, true);
    const j = JSON.parse(String(txt).replace(/^```json|```$/g, '').trim());
    const t = String(j.seoTitle || '').trim(), d = String(j.description || '').trim();
    if (t.length < 15 || t.length > 110 || d.length < 30 || d.length > 450) return fallback;
    if (!new RegExp('class\\s*' + info.cls, 'i').test(t)) return fallback;
    return { seoTitle: t, description: d };
  } catch (e) { Logger.log('Gemini failed, using template: ' + e.message); return fallback; }
}
function templateText_(i) {
  const part = i.review ? `Review Exercise ${i.chapterNumber}` : i.exerciseNumber ? `Exercise ${i.chapterNumber}.${i.exerciseNumber}` : i.chapterNumber ? `Chapter ${i.chapterNumber}` : (i.kind === 'book' ? '' : i.title);
  const what = i.typeLabel;
  return {
    seoTitle: `Class ${i.cls} ${i.subject} ${part} ${what} PDF Download - FBISE`.replace(/\s+/g, ' '),
    description: `Free FBISE Class ${i.cls} ${i.subject} ${part} ${what} in PDF for Federal Board students. | فیڈرل بورڈ کلاس ${i.cls} ${i.subject} کے ${what} مفت پی ڈی ایف میں پڑھیں۔`.replace(/\s+/g, ' ')
  };
}
function callGemini_(prompt, json) {
  const key = props_().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const pref = props_().getProperty('GEMINI_MODEL');
  const models = (pref ? [pref] : []).concat(CFG.MODELS).filter((m, i, a) => a.indexOf(m) === i);
  let last = '';
  for (const m of models) {
    const r = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: Object.assign({ temperature: 0.4, maxOutputTokens: 2000 }, json ? { responseMimeType: 'application/json' } : {}) })
    });
    const code = r.getResponseCode(), body = r.getContentText();
    if (code === 200) {
      const d = JSON.parse(body), c = d.candidates && d.candidates[0];
      const t = c && c.content && c.content.parts ? c.content.parts.map(x => x.text || '').join('') : '';
      if (t.trim()) return t;
      last = 'empty answer from ' + m; continue;
    }
    last = `HTTP ${code} from ${m}`;
    if (code === 403 || (code === 400 && /api key/i.test(body))) throw new Error('Gemini rejected the API key');
  }
  throw new Error(last || 'Gemini unavailable');
}

/* ───────────────────────── Drive helpers ───────────────────────── */

function findOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function move_(file, folder) { file.moveTo(folder); }
function thumbUrl_(id) { return `https://drive.google.com/thumbnail?id=${id}&sz=w600`; }
function thumbReady_(id) {
  try {
    const r = UrlFetchApp.fetch(thumbUrl_(id), { muteHttpExceptions: true, followRedirects: true });
    return r.getResponseCode() === 200 && /^image\//i.test(String(r.getHeaders()['Content-Type'] || r.getHeaders()['content-type'] || ''));
  } catch (e) { return false; }
}

/* ───────────────────────── Firestore (REST, service account) ───────────────────────── */

function sa_() {
  const raw = props_().getProperty('SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('SERVICE_ACCOUNT_JSON is not set');
  const j = JSON.parse(raw);
  if (!j.client_email || !j.private_key || !j.project_id) throw new Error('SERVICE_ACCOUNT_JSON is incomplete');
  return j;
}
function b64u_(x) { return (typeof x === 'string' ? Utilities.base64EncodeWebSafe(x, Utilities.Charset.UTF_8) : Utilities.base64EncodeWebSafe(x)).replace(/=+$/, ''); }
function firestoreToken_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('fs_token');
  if (hit) return hit;
  const sa = sa_(), now = Math.floor(Date.now() / 1000);
  const head = b64u_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u_(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64u_(Utilities.computeRsaSha256Signature(head + '.' + claim, sa.private_key));
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig } });
  const d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200 || !d.access_token) throw new Error('Firebase login failed: ' + (d.error_description || d.error || r.getResponseCode()));
  cache.put('fs_token', d.access_token, 3000);
  return d.access_token;
}
function fsBase_() { return `https://firestore.googleapis.com/v1/projects/${sa_().project_id}/databases/(default)/documents`; }
function fsCall_(method, url, body) {
  const r = UrlFetchApp.fetch(url, { method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + firestoreToken_() }, payload: body ? JSON.stringify(body) : undefined });
  return { code: r.getResponseCode(), text: r.getContentText() };
}
function fsGet_(path) { const r = fsCall_('get', fsBase_() + '/' + path); if (r.code !== 200) throw new Error('Firestore ' + r.code + ': ' + r.text.slice(0, 200)); return JSON.parse(r.text); }

function V_(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  return { stringValue: String(x) };
}

/** Returns the id of an existing material for the same class+subject+type+item, or ''. */
function findExisting_(i) {
  const f = (field, v) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: v } } });
  const r = fsCall_('post', fsBase_() + ':runQuery', { structuredQuery: {
    from: [{ collectionId: 'materials' }],
    where: { compositeFilter: { op: 'AND', filters: [f('class', i.cls), f('subjectSlug', i.subjectSlug), f('type', i.type)] } },
    limit: 300 } });
  if (r.code !== 200) throw new Error('Firestore query ' + r.code + ': ' + r.text.slice(0, 200));
  for (const row of JSON.parse(r.text)) {
    if (!row.document) continue;
    const fl = row.document.fields || {}, id = row.document.name.split('/').pop();
    const slug = fl.chapterSlug && fl.chapterSlug.stringValue ? fl.chapterSlug.stringValue : null;
    if (slug === i.chapterSlug) return id;
  }
  return '';
}

/** Creates the document; never overwrites (409 = already there). */
function createMaterial_(docId, i, ai, fileId) {
  const fields = {
    type: V_(i.type), typeLabel: V_(i.typeLabel), contentType: V_(i.contentType), title: V_(i.title), seoTitle: V_(ai.seoTitle),
    class: V_(i.cls), subject: V_(i.subject), subjectSlug: V_(i.subjectSlug),
    chapterNumber: V_(i.chapterNumber), exerciseNumber: V_(i.exerciseNumber), review: V_(!!i.review),
    chapterTitle: V_(i.kind === 'book' ? null : i.title), chapterSlug: V_(i.chapterSlug),
    coverImage: V_(thumbUrl_(fileId)), pdfLink: V_(`https://drive.google.com/file/d/${fileId}/view`),
    description: V_(ai.description), source: V_('auto-publisher'), createdAt: V_(new Date())
  };
  const r = fsCall_('post', fsBase_() + '/materials?documentId=' + encodeURIComponent(docId), { fields });
  if (r.code === 200) return 'created';
  if (r.code === 409) return 'exists';
  throw new Error('Firestore save ' + r.code + ': ' + r.text.slice(0, 250));
}

/** Replaces the PDF link, cover and descriptions of an existing item. Title and everything else stay. */
function updateMaterial_(docId, ai, fileId) {
  const fields = { pdfLink: V_(`https://drive.google.com/file/d/${fileId}/view`), coverImage: V_(thumbUrl_(fileId)),
    description: V_(ai.description), seoTitle: V_(ai.seoTitle), updatedAt: V_(new Date()) };
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
  const r = fsCall_('patch', fsBase_() + '/materials/' + encodeURIComponent(docId) + '?' + mask, { fields });
  if (r.code !== 200) throw new Error('Firestore update ' + r.code + ': ' + r.text.slice(0, 250));
}

/* ───────────────────────── e-mail report ───────────────────────── */

function mail_(rep) {
  try {
    const to = props_().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    const parts = [];
    if (rep.ok.length)   parts.push('PUBLISHED (' + rep.ok.length + '):\n- ' + rep.ok.join('\n- '));
    if (rep.dupe.length) parts.push('SKIPPED - already on the site (moved to "Duplicates"):\n- ' + rep.dupe.join('\n- '));
    if (rep.err.length)  parts.push('NEEDS YOUR ATTENTION (moved to "Needs attention"):\n- ' + rep.err.join('\n- ') + '\n\nRename the file using the patterns and move it back to "StudyLeem Uploads".');
    MailApp.sendEmail(to, 'StudyLeem Auto-Publisher: ' + (rep.err.length ? 'action needed' : 'done'), parts.join('\n\n'));
  } catch (e) { Logger.log('Mail failed: ' + e.message); }
}
