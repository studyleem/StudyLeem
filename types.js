/* StudyLeem material types – single source of truth for the website (exposed as window.SLT).
   A material's `type` is a URL-safe slug: the old types "notes" and "books" are unchanged, any other type
   ("exercises", "mcqs-explanation", "past-papers", or anything the admin writes) works the same way.
   Old documents without `typeLabel` / `chapterSlug` keep working: labels come from DEFAULTS, slugs from the old rules. */

export const DEFAULTS = {
  notes: 'Notes', books: 'Books', exercises: 'Exercises', 'review-exercises': 'Review Exercises',
  'mcqs-explanation': 'MCQs Explanation', 'past-papers': 'Past Papers'
};
const ICONS = { books: 'book-open', notes: 'notes', exercises: 'calculator', 'review-exercises': 'clipboard', 'mcqs-explanation': 'check-circle', 'past-papers': 'notes' };
// words the admin may type -> canonical type
const ALIASES = {
  notes: ['note', 'notes', 'chapter note', 'chapter notes'],
  books: ['book', 'books', 'textbook', 'textbooks', 'text book', 'text books'],
  exercises: ['exercise', 'exercises', 'main exercise', 'main exercises', 'solved exercise', 'solved exercises', 'exercise solution', 'exercise solutions'],
  'review-exercises': ['review exercise', 'review exercises', 'review ex', 'review'],
  'mcqs-explanation': ['mcq explanation', 'mcqs explanation', 'mcq explanations', 'mcqs explanations', 'mcq', 'mcqs', 'mcqs with explanation', 'mcq solution', 'mcqs solution'],
  'past-papers': ['past paper', 'past papers', 'pastpaper', 'pastpapers', 'old papers', 'old paper']
};
const TYPE_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export function toSlug(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
const titleCase = s => String(s).replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** "Main Exercise" -> {slug:'exercises', label:'Exercises'}; "Model Papers" -> {slug:'model-papers', label:'Model Papers'}; invalid -> null */
export function resolve(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const n = norm(raw);
  for (const slug of Object.keys(ALIASES)) if (ALIASES[slug].indexOf(n) >= 0) return { slug, label: DEFAULTS[slug] };
  const slug = toSlug(raw);
  if (!TYPE_RE.test(slug)) return null;               // needs English letters/numbers (the slug is part of the URL)
  const t = raw.slice(0, 50);
  return { slug, label: (t === t.toLowerCase() || t === t.toUpperCase()) ? titleCase(t) : t };
}
export const isValidType = s => TYPE_RE.test(String(s || ''));
export const label = (slug, docLabel) => docLabel || DEFAULTS[slug] || titleCase(String(slug || '').replace(/-/g, ' '));
export const icon = slug => ICONS[slug] || 'notes';
export const tag = (slug, lab) => slug === 'books' ? 'FBISE Book' : slug === 'notes' ? 'FBISE Notes' : 'FBISE ' + label(slug, lab);
export const badge = m => m.type === 'books' ? 'Book' : m.type === 'notes' ? 'Notes' : label(m.type, m.typeLabel);

/** Distinct types found in the data: [{slug,label,count}] – notes, books first, then the rest A-Z. */
export function typesFrom(materials, opts) {
  const map = {};
  (materials || []).forEach(m => {
    const s = m.type || 'notes';
    if (!map[s]) map[s] = { slug: s, label: '', count: 0 };
    map[s].count++;
    if (!map[s].label && m.typeLabel) map[s].label = m.typeLabel;
  });
  if (opts && opts.always) ['notes', 'books'].forEach(s => { if (!map[s]) map[s] = { slug: s, label: '', count: 0 }; });
  const out = Object.keys(map).map(s => { map[s].label = label(s, map[s].label); return map[s]; });
  const rank = s => s === 'notes' ? 0 : s === 'books' ? 1 : 2;
  return out.sort((a, b) => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label));
}

/* ── item slugs & labels ── */
export const isLegacyBook = m => m.type === 'books' && !m.chapterSlug;

/** URL slug for a NEW-style item (non-legacy): from number + title, ASCII only. */
export function genericSlug(m) {
  let base = toSlug(String(m.title || m.chapterTitle || '').replace(/\./g, '-'));
  const n = m.chapterNumber;
  if (n != null && n !== '') {
    const pre = 'chapter-' + n;
    base = base.indexOf(pre) === 0 ? base : (pre + (base ? '-' + base : ''));
  }
  base = base.slice(0, 80).replace(/-+$/, '');
  return base || null;
}
function legacyNotesSlug(m) {
  if (m.chapterSlug) return m.chapterSlug;
  if (m.contentType === 'exercise') return m.review ? `review-exercise-${m.chapterNumber}` : `exercise-${m.chapterNumber}${m.exerciseNumber ? '-' + m.exerciseNumber : ''}`;
  if (m.chapterNumber == null || m.chapterNumber === '') return toSlug(m.title) || 'notes-' + m.id;
  return `chapter-${m.chapterNumber}`;
}
/** The slug used in /fbise/:type/:class/:subject/:slug for any material. */
export function itemSlug(m) {
  if (m.type === 'notes') return legacyNotesSlug(m);
  if (isLegacyBook(m)) return 'book-' + m.id;
  return m.chapterSlug || genericSlug(m) || 'item-' + m.id;
}
/** New URL scheme: /fbise/<class>/<subject>/<type>/<item>  (the subject page /fbise/<class>/<subject> lists every type together). */
export const hubHref = (cls, subjectSlug) => `/fbise/${cls}/${subjectSlug}`;
export const itemHref = m => `/fbise/${m.class}/${m.subjectSlug || toSlug(m.subject)}/${m.type || 'notes'}/${itemSlug(m)}`;

/** Small heading above a title in lists. */
export function itemLabel(m) {
  if (m.type === 'notes') {
    if (m.contentType === 'exercise') return m.review ? `Review Exercise ${m.chapterNumber}` : `Exercise ${m.chapterNumber}.${m.exerciseNumber || ''}`;
    return m.chapterNumber != null && m.chapterNumber !== '' ? `Chapter ${m.chapterNumber}` : 'Notes';
  }
  if (isLegacyBook(m)) return 'Full Textbook';
  let s = label(m.type, m.typeLabel);
  if (m.chapterNumber != null && m.chapterNumber !== '') s += ` · Chapter ${m.chapterNumber}`;
  if (m.exerciseNumber != null && m.exerciseNumber !== '') s += ` · Ex ${m.exerciseNumber}`;
  return s;
}
/** Very short label for chapter tabs in the viewer. */
export function tabLabel(m) {
  if (m.type === 'notes' && m.contentType === 'exercise') return m.review ? `Review ${m.chapterNumber}` : `Ex ${m.chapterNumber}.${m.exerciseNumber || ''}`;
  if (m.chapterNumber != null && m.chapterNumber !== '') return `Ch ${m.chapterNumber}` + (m.type !== 'notes' && m.exerciseNumber != null && m.exerciseNumber !== '' ? '.' + m.exerciseNumber : '');
  return m.type === 'notes' ? 'Notes' : 'Item';
}
/** Sort: chapter number, then exercise number (review last), then title. */
export function compareItems(a, b) {
  const nA = Number(a.chapterNumber) || 0, nB = Number(b.chapterNumber) || 0;
  if (nA !== nB) return nA - nB;
  const eA = a.review ? 9999 : Number(a.exerciseNumber) || 0, eB = b.review ? 9999 : Number(b.exerciseNumber) || 0;
  return eA - eB || String(a.title || '').localeCompare(String(b.title || ''));
}

export const SLT = { hubHref, DEFAULTS, resolve, isValidType, label, icon, tag, badge, typesFrom, isLegacyBook, genericSlug, itemSlug, itemHref, itemLabel, tabLabel, compareItems, toSlug };
if (typeof window !== 'undefined') window.SLT = SLT;
