// Server-side rendering for the pages Google must index:
//   /fbise/12                          class page      (kind=class)
//   /fbise/12/english                  subject page    (kind=hub)
//   /fbise/12/english/notes/chapter-1  material page   (kind=item)
//   /sitemap                           HTML sitemap    (kind=sitemap)
// It reads the static HTML template, then puts the REAL title, description, canonical, headings, text and links
// (from Firestore) into the first HTML response, so a crawler sees unique content and every link without running JavaScript.
// The normal page scripts still run afterwards and replace this content with the full interactive version.
// If Firestore cannot be reached the untouched template is served (the site keeps working).
const fs = require('fs');
const path = require('path');

const SITE = 'https://studyleem.vercel.app';
const PROJECT = 'studyleem0786';
const KEY = 'AIzaSyD3v1qSVW-DIuqLhJFRESjl903VjH55umA';      // public Firebase web key (same as firebase-client.js)
const FIELDS = ['type', 'typeLabel', 'class', 'subject', 'subjectSlug', 'title', 'description', 'chapterNumber', 'exerciseNumber', 'chapterSlug', 'contentType', 'review', 'createdAt', 'updatedAt'];
const DEFAULTS = { notes: 'Notes', books: 'Books', exercises: 'Exercises', 'review-exercises': 'Review Exercises', 'mcqs-explanation': 'MCQs Explanation', 'past-papers': 'Past Papers' };
const STAGE = { '9': 'SSC Part-I', '10': 'SSC Part-II', '11': 'HSSC Part-I', '12': 'HSSC Part-II' };

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toSlug = s => String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
const titleCase = s => String(s).replace(/\b\w/g, c => c.toUpperCase());
const val = f => f ? (f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ?? f.timestampValue ?? null) : null;

/* ───── data (cached 5 minutes per warm instance) ───── */
let cache = { t: 0, docs: null };
async function allMaterials() {
  if (cache.docs && Date.now() - cache.t < 300000) return cache.docs;
  const docs = []; let token = '';
  for (let i = 0; i < 30; i++) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/materials?pageSize=300&key=${KEY}` +
      FIELDS.map(f => '&mask.fieldPaths=' + f).join('') + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = await fetch(url, { headers: { Referer: SITE + '/' } });
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach(d => {
      const f = d.fields || {}, m = { id: d.name.split('/').pop() };
      FIELDS.forEach(k => { const v = val(f[k]); m[k] = (k === 'chapterNumber' || k === 'exerciseNumber') && v != null ? Number(v) : v; });
      m.type = String(m.type || 'notes').toLowerCase();
      m.class = String(m.class || '');
      m.subjectSlug = m.subjectSlug || toSlug(m.subject);
      docs.push(m);
    });
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  cache = { t: Date.now(), docs };
  return docs;
}

/* ───── same slug / label rules as types.js ───── */
const typeLabel = m => m.typeLabel || DEFAULTS[m.type] || titleCase(String(m.type).replace(/-/g, ' '));
const isLegacyBook = m => m.type === 'books' && !m.chapterSlug;
function genericSlug(m) {
  let base = toSlug(String(m.title || '').replace(/\./g, '-'));
  if (m.chapterNumber != null) { const pre = 'chapter-' + m.chapterNumber; base = base.indexOf(pre) === 0 ? base : (pre + (base ? '-' + base : '')); }
  return base.slice(0, 80).replace(/-+$/, '') || null;
}
function itemSlug(m) {
  if (m.type === 'notes') {
    if (m.chapterSlug) return m.chapterSlug;
    if (m.contentType === 'exercise') return m.review ? `review-exercise-${m.chapterNumber}` : `exercise-${m.chapterNumber}${m.exerciseNumber ? '-' + m.exerciseNumber : ''}`;
    if (m.chapterNumber == null) return toSlug(m.title) || 'notes-' + m.id;
    return `chapter-${m.chapterNumber}`;
  }
  if (isLegacyBook(m)) return 'book-' + m.id;
  return m.chapterSlug || genericSlug(m) || 'item-' + m.id;
}
const hubHref = (c, s) => `/fbise/${c}/${s}`;
const itemHref = m => `/fbise/${m.class}/${m.subjectSlug}/${m.type}/${itemSlug(m)}`;
function itemLabel(m) {
  if (m.type === 'notes') {
    if (m.contentType === 'exercise') return m.review ? `Review Exercise ${m.chapterNumber}` : `Exercise ${m.chapterNumber}.${m.exerciseNumber || ''}`;
    return m.chapterNumber != null ? `Chapter ${m.chapterNumber}` : 'Notes';
  }
  if (isLegacyBook(m)) return 'Full Textbook';
  return typeLabel(m) + (m.chapterNumber != null ? ` · Chapter ${m.chapterNumber}` : '') + (m.exerciseNumber != null ? ` · Ex ${m.exerciseNumber}` : '');
}
const cmp = (a, b) => ((a.chapterNumber || 0) - (b.chapterNumber || 0)) || ((a.review ? 9999 : a.exerciseNumber || 0) - (b.review ? 9999 : b.exerciseNumber || 0)) || String(a.title).localeCompare(String(b.title));
const english = d => String(d || '').split(' | ')[0].trim();
function groupTypes(list) {
  const map = {};
  list.forEach(m => { (map[m.type] = map[m.type] || { slug: m.type, label: typeLabel(m), items: [] }).items.push(m); });
  const rank = s => s === 'notes' ? 0 : s === 'books' ? 1 : 2;
  return Object.values(map).sort((a, b) => rank(a.slug) - rank(b.slug) || a.label.localeCompare(b.label));
}

/* ───── template handling ───── */
function readTemplate(name) {
  for (const base of [process.cwd(), path.join(__dirname, '..')]) {
    try { return fs.readFileSync(path.join(base, name), 'utf8'); } catch (_) {}
  }
  throw new Error('template missing: ' + name);
}
function setHead(html, o) {
  const m = html.match(/<head>([\s\S]*?)<\/head>/); if (!m) return html;
  let h = m[1];
  [/<title[^>]*>[\s\S]*?<\/title>\s*/g, /<meta\s+name="(?:description|keywords|robots)"[^>]*>\s*/g, /<meta\s+property="og:[^>]*>\s*/g, /<meta\s+name="twitter:[^>]*>\s*/g,
    /<link\s+rel="canonical"[^>]*>\s*/g, /<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/g, /<script>\(function\(\)\{var c=document\.getElementById\('pageCanonical'\)[\s\S]*?<\/script>\s*/g
  ].forEach(r => { h = h.replace(r, ''); });
  const img = SITE + '/og-image.png', url = SITE + o.canonical;
  const block = [
    `<title id="pageTitle">${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.desc)}">`,
    `<meta name="keywords" content="${esc(o.kw)}">`,
    `<meta name="robots" content="${o.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta name="author" content="StudyLeem"><meta name="theme-color" content="#2563eb">',
    '<meta property="og:site_name" content="StudyLeem"><meta property="og:locale" content="en_US"><meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.desc)}"><meta name="twitter:image" content="${img}">`,
    o.ld ? `<script type="application/ld+json" id="seo-ld">${JSON.stringify({ '@context': 'https://schema.org', '@graph': o.ld }).replace(/</g, '\\u003c')}</script>` : ''
  ].join('\n') + '\n';
  const vp = h.match(/<meta name="viewport"[^>]*>\n?/);
  h = vp ? h.slice(0, vp.index + vp[0].length) + block + h.slice(vp.index + vp[0].length) : block + h;
  return html.replace(m[1], () => h);
}
function swap(html, from, to) { return html.includes(from) ? html.replace(from, () => to) : html; }
const crumbLd = list => ({ '@type': 'BreadcrumbList', itemListElement: list.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b[0], item: SITE + b[1] })) });
const list = items => '<ul class="ssr-list">' + items.map(m => `<li><a href="${esc(itemHref(m))}">${esc(itemLabel(m) === m.title ? m.title : itemLabel(m) + ' – ' + m.title)}</a>${english(m.description) ? ' – ' + esc(english(m.description).slice(0, 140)) : ''}</li>`).join('') + '</ul>';

/* ───── page builders ───── */
function hubPage(tpl, docs, c, s, res) {
  const items = docs.filter(m => m.class === c && m.subjectSlug === s);
  if (!items.length) return null;
  const S = titleCase(items[0].subject || s.replace(/-/g, ' ')), groups = groupTypes(items);
  const names = groups.map(g => g.label), url = hubHref(c, s);
  const title = `FBISE Class ${c} ${S} Notes & Books – Free PDF | StudyLeem`;
  const desc = `Free FBISE Class ${c} ${S} notes, books and more: ${items.length} PDFs (${names.slice(0, 4).join(', ')}). Read online, download and practise with LeemAI, the AI tutor for Federal Board students.`.slice(0, 300);
  const kw = `FBISE ${c} ${S}, FBISE class ${c} ${S}, class ${c} ${S} notes, class ${c} ${S} book PDF, Federal Board ${S} class ${c}, ${names.map(n => 'FBISE ' + S + ' ' + n.toLowerCase()).join(', ')}, LeemAI ${S} quiz, StudyLeem`;
  let h = setHead(tpl, { title, desc, kw, canonical: url, ld: [
    { '@type': 'CollectionPage', name: `Class ${c} ${S} – FBISE study material`, description: desc, url: SITE + url, about: S, educationalLevel: 'Class ' + c, inLanguage: 'en', isAccessibleForFree: true, isPartOf: { '@type': 'WebSite', name: 'StudyLeem', url: SITE } },
    { '@type': 'ItemList', itemListElement: items.slice().sort(cmp).slice(0, 40).map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.title, url: SITE + itemHref(m) })) },
    crumbLd([['Home', '/'], ['FBISE', '/fbise'], ['Class ' + c, '/fbise/' + c], [S, url]])] });
  h = swap(h, '<h1 id="pageH1">Loading…</h1>', `<h1 id="pageH1">Class ${c} ${esc(S)} – FBISE ${esc(names.slice(0, 3).join(', '))} &amp; Study Material</h1>`);
  h = swap(h, '<p id="pageSubtitle">Free FBISE study material</p>', `<p id="pageSubtitle">${items.length} free PDFs for Class ${c} ${esc(S)} (${STAGE[c]}) · Federal Board (FBISE)</p>`);
  h = swap(h, '<a href="#" id="breadClassLink">Class</a>', `<a href="/fbise/${c}" id="breadClassLink">Class ${c}</a>`);
  h = swap(h, '<span id="breadSubject">Subject</span>', `<span id="breadSubject">${esc(S)}</span>`);
  h = swap(h, '<div id="hubList"><div class="loading">Loading materials…</div></div>',
    `<div id="hubList">${groups.map(g => `<h2 class="hub-type" id="t-${esc(g.slug)}">${esc(g.label)} <span>(${g.items.length})</span></h2>${list(g.items.slice().sort(cmp))}`).join('')}</div>`);
  const others = [...new Set(docs.filter(m => m.class === c && m.subjectSlug !== s).map(m => m.subjectSlug))].sort();
  h = swap(h, '<div class="container sp-info" id="hubInfo"></div>',
    `<div class="container sp-info" id="hubInfo"><h2>About FBISE ${c} ${esc(S)} (Class ${c} ${esc(S)})</h2><p>${esc(S)} for Class ${c} (${STAGE[c]}) on StudyLeem: ${items.length} free PDF${items.length === 1 ? '' : 's'} – ${esc(names.join(', '))} – for students of the Federal Board of Intermediate and Secondary Education (FBISE), Islamabad. Read every file online, download it, or practise with LeemAI, the free AI tutor with quizzes and a paper checker.</p>` +
    (others.length ? `<h2>Other Class ${c} subjects</h2><p>${others.map(o => `<a href="${hubHref(c, o)}">Class ${c} ${esc(titleCase(o.replace(/-/g, ' ')))}</a>`).join(' · ')}</p>` : '') + '</div>');
  return h;
}

function itemPage(tpl, docs, c, s, type, slug) {
  const subj = docs.filter(m => m.class === c && m.subjectSlug === s);
  let cur = null;
  if (type === 'books' && slug.indexOf('book-') === 0) cur = subj.find(m => m.id === slug.slice(5) && m.type === 'books');
  if (!cur) cur = subj.find(m => m.type === type && itemSlug(m) === slug);
  if (!cur) return null;
  const S = titleCase(cur.subject), tl = typeLabel(cur), isBook = type === 'books', isEx = type === 'notes' && cur.contentType === 'exercise';
  const noun = isBook ? 'textbook' : type === 'notes' ? 'notes' : tl.toLowerCase();
  const part = isBook ? (cur.chapterNumber != null ? 'Chapter ' + cur.chapterNumber : 'Book')
    : type !== 'notes' ? (cur.chapterNumber != null ? tl + ' Chapter ' + cur.chapterNumber : cur.title)
    : isEx ? (cur.review ? 'Review Exercise ' + cur.chapterNumber : 'Exercise ' + cur.chapterNumber + (cur.exerciseNumber ? '.' + cur.exerciseNumber : ''))
    : cur.chapterNumber != null ? 'Chapter ' + cur.chapterNumber : cur.title;
  const h1 = `Class ${c} ${S} ${part} ${type === 'notes' ? 'Notes PDF' : 'PDF'}`, url = itemHref(cur), hub = hubHref(c, s);
  const title = `${h1} – FBISE | StudyLeem`;
  const desc = (`${cur.title} – free FBISE ${S} ${noun} for Class ${c} (Federal Board Pakistan). Read online, download the PDF and practise with a LeemAI AI quiz.`).slice(0, 300);
  const kw = `FBISE ${S} ${noun} class ${c}, ${cur.title}, Federal Board ${S} class ${c} PDF, free ${S} ${noun} download, StudyLeem`;
  const en = english(cur.description), ur = String(cur.description || '').split(' | ').slice(1).join(' | ');
  const same = subj.filter(m => m.type === type && m.id !== cur.id).sort(cmp).slice(0, 30);
  let h = setHead(tpl, { title, desc, kw, canonical: url, ld: [
    { '@type': 'LearningResource', name: h1, description: desc, url: SITE + url, learningResourceType: isBook ? 'Textbook' : type === 'notes' ? (isEx ? 'Exercise' : 'Study notes') : tl, educationalLevel: 'Class ' + c, about: S, inLanguage: 'en', isAccessibleForFree: true, provider: { '@type': 'Organization', name: 'StudyLeem', url: SITE } },
    crumbLd([['Home', '/'], ['FBISE', '/fbise'], ['Class ' + c, '/fbise/' + c], [S, hub], [cur.title, url]])] });
  h = swap(h, '<h1 id="pageH1">Loading…</h1>', `<h1 id="pageH1">${esc(h1)}</h1>`);
  h = swap(h, '<p id="pageSubtitle"></p>', `<p id="pageSubtitle">${esc(cur.title)}${en ? ' – ' + esc(en.slice(0, 140)) : ''}</p>`);
  h = swap(h, '<a href="#" id="bcClass">Class</a>', `<a href="/fbise/${c}" id="bcClass">Class ${c}</a>`);
  h = swap(h, '<a href="#" id="bcSubject">Subject</a>', `<a href="${hub}" id="bcSubject">${esc(S)}</a>`);
  h = swap(h, '<a href="#" id="bcType">Type</a>', `<a href="${hub}#t-${esc(type)}" id="bcType">${esc(tl)}</a>`);
  h = swap(h, '<span id="bcItem">Item</span>', `<span id="bcItem">${esc(cur.title)}</span>`);
  h = swap(h, '<div id="matBadges"></div>', `<div id="matBadges"><span class="mat-pill">${esc(tl)}</span><span class="mat-pill">Class ${c}</span><span class="mat-pill">${esc(S)}</span><span class="mat-pill">Free PDF</span></div>`);
  h = swap(h, '<div class="container sp-info" id="matInfo"></div>',
    `<div class="container sp-info" id="matInfo"><h2>About this PDF</h2><p><b>${esc(cur.title)}</b> – ${en ? esc(en) : `free FBISE ${esc(S)} ${esc(noun)} for Class ${c}`}.</p>${ur ? `<p dir="rtl" lang="ur">${esc(ur)}</p>` : ''}` +
    `<p>This ${esc(tl.toLowerCase())} file is part of the <a href="${hub}">Class ${c} ${esc(S)} study material</a> on StudyLeem for the Federal Board (FBISE) ${STAGE[c]} syllabus. It is free to read online and download, and you can practise the subject with a <a href="/leemai#quiz">LeemAI AI quiz</a>.</p>` +
    (same.length ? `<h2>More ${esc(tl)} for Class ${c} ${esc(S)}</h2>${list(same)}` : '') + '</div>');
  return h;
}

function classPage(tpl, docs, c) {
  const items = docs.filter(m => m.class === c), subj = {};
  items.forEach(m => { (subj[m.subjectSlug] = subj[m.subjectSlug] || { name: titleCase(m.subject || m.subjectSlug), n: 0, types: {} }).n++; subj[m.subjectSlug].types[typeLabel(m)] = 1; });
  const keys = Object.keys(subj).sort(), url = '/fbise/' + c;
  const title = `FBISE Class ${c} Notes, Books & Study Material (${STAGE[c]}) | StudyLeem`;
  const desc = `Free FBISE Class ${c} (${STAGE[c]}) study material for every subject: ${keys.slice(0, 6).map(k => subj[k].name).join(', ')} and more. Notes, books, exercises and LeemAI AI quizzes for Federal Board students.`.slice(0, 300);
  let h = setHead(tpl, { title, desc, kw: `FBISE class ${c}, class ${c} notes FBISE, Federal Board class ${c}, FBISE ${c} notes, ${keys.map(k => 'FBISE ' + c + ' ' + subj[k].name).join(', ')}, StudyLeem`, canonical: url, ld: [
    { '@type': 'CollectionPage', name: `FBISE Class ${c} study material`, description: desc, url: SITE + url, educationalLevel: 'Class ' + c, inLanguage: 'en', isAccessibleForFree: true, isPartOf: { '@type': 'WebSite', name: 'StudyLeem', url: SITE } },
    crumbLd([['Home', '/'], ['FBISE', '/fbise'], ['Class ' + c, url]])] });
  h = swap(h, '<h1 id="pageH1">FBISE Study Materials</h1>', `<h1 id="pageH1">Class ${c} (${STAGE[c]}) – All Subjects</h1>`);
  h = swap(h, '<p id="pageSubtitle">Select a subject to browse chapter-wise notes and books</p>', `<p id="pageSubtitle">Choose a subject to see every note, book and other PDF for Class ${c}</p>`);
  h = swap(h, '<div class="loading">Loading subjects...</div>', keys.length
    ? `<ul class="ssr-list">${keys.map(k => `<li><a href="${hubHref(c, k)}">Class ${c} ${esc(subj[k].name)}</a> – ${subj[k].n} PDF${subj[k].n === 1 ? '' : 's'} (${esc(Object.keys(subj[k].types).join(', '))})</li>`).join('')}</ul>`
    : '<div class="loading">Loading subjects...</div>');
  return h;
}

function sitemapPage(tpl, docs) {
  const a = tpl.indexOf('<div class="main-content">'), b = tpl.indexOf('<footer');
  if (a < 0 || b < 0) return null;
  const parts = ['9', '10', '11', '12'].map(c => {
    const subs = {}; docs.filter(m => m.class === c).forEach(m => { (subs[m.subjectSlug] = subs[m.subjectSlug] || { name: titleCase(m.subject || m.subjectSlug), items: [] }).items.push(m); });
    return `<h2><a href="/fbise/${c}">Class ${c} (${STAGE[c]})</a></h2>` + Object.keys(subs).sort().map(k =>
      `<h3><a href="${hubHref(c, k)}">Class ${c} ${esc(subs[k].name)}</a></h3>` + groupTypes(subs[k].items).map(g => `<p><b>${esc(g.label)}</b></p>${list(g.items.sort(cmp))}`).join('')).join('');
  }).join('');
  const main = `<div class="main-content"><div class="page-header"><div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span>›</span> <span>Sitemap</span></nav><h1>StudyLeem Sitemap – All FBISE Notes, Books and Study Material</h1><p>Every free PDF on StudyLeem, by class, subject and type.</p></div></div>` +
    `<section class="section"><div class="container sp-info"><h2>Main pages</h2><p><a href="/">Home</a> · <a href="/fbise">FBISE Study Material</a> · <a href="/leemai">LeemAI AI Tutor</a> · <a href="/blog">Study Blog</a> · <a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></p>${parts}</div></section></div>\n\n`;
  const h = tpl.slice(0, a) + main + tpl.slice(b);
  return setHead(h, { title: 'Sitemap – All FBISE Notes, Books and Study Material | StudyLeem', desc: 'Browse every free FBISE note, book, exercise and study PDF on StudyLeem by class (9-12), subject and type.', kw: 'StudyLeem sitemap, FBISE notes list, FBISE books list', canonical: '/sitemap', ld: [crumbLd([['Home', '/'], ['Sitemap', '/sitemap']])] });
}

/* ───── handler ───── */
module.exports = async (req, res) => {
  const q = req.query || {}, kind = String(q.kind || '');
  const file = { hub: 'fbise-hub.html', item: 'material.html', class: 'fbise-subject.html', sitemap: 'fbise-hub.html' }[kind];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!file) { res.status(404).send('Not found'); return; }
  let tpl;
  try { tpl = readTemplate(file); } catch (e) { console.error(e.message); res.status(500).send('Template error'); return; }
  try {
    const docs = await allMaterials();
    const c = String(q.class || ''), s = String(q.subject || '').toLowerCase(), type = String(q.type || '').toLowerCase(), slug = String(q.slug || '');
    let html = null, status = 200;
    if (kind === 'hub' && /^(9|10|11|12)$/.test(c) && s) html = hubPage(tpl, docs, c, s);
    else if (kind === 'item' && /^(9|10|11|12)$/.test(c) && s && type && slug) html = itemPage(tpl, docs, c, s, type, slug);
    else if (kind === 'class' && /^(9|10|11|12)$/.test(c)) html = classPage(tpl, docs, c);
    else if (kind === 'sitemap') html = sitemapPage(tpl, docs);
    if (!html) {                       // unknown class/subject/item: real 404 (not a "soft 404") with noindex
      status = 404;
      html = setHead(tpl, { title: 'Page not found | StudyLeem', desc: 'This study material page was not found on StudyLeem.', kw: 'StudyLeem', canonical: '/fbise', robots: 'noindex,follow' });
    }
    res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=1800, stale-while-revalidate=86400' : 'public, s-maxage=60');
    res.status(status).send(html);
  } catch (e) {
    console.error('page ssr', e && e.message);   // Firestore unreachable: serve the plain template, the browser scripts still work
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(200).send(tpl);
  }
};
