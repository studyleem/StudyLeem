/* Material page: /fbise/<class>/<subject>/<type>/<item>  (e.g. /fbise/12/english/notes/chapter-1)
   A normal StudyLeem page (header + footer) with the PDF embedded in the page, a Download button and descriptive content.
   The PDF engine itself (pdf-embed.js / StudyPDF) is unchanged. */
(function () {
  'use strict';
  var BASE = 'https://studyleem.vercel.app';
  var DOWNLOAD_WAIT = 15;                      // seconds before the download starts (set 0 for an instant download)
  var esc = SLC.esc, $ = function (id) { return document.getElementById(id); };

  function mobileMenu() {
    var btn = $('mobileMenuBtn'), menu = $('mobileMenu');
    if (btn && menu) {
      btn.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('active'); };
      document.onclick = function (e) { if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active'); };
    }
  }
  // new order /fbise/12/english/notes/chapter-1   |   old order /fbise/notes/12/english/chapter-1
  function parsePath() {
    var p = location.pathname.split('/').filter(Boolean);
    if (/^(9|10|11|12)$/.test(p[1] || '')) return { cls: p[1], subjectSlug: (p[2] || '').toLowerCase(), type: (p[3] || '').toLowerCase(), slug: decodeURIComponent(p[4] || '') };
    return { type: (p[1] || '').toLowerCase(), cls: p[2] || '', subjectSlug: (p[3] || '').toLowerCase(), slug: decodeURIComponent(p[4] || '') };
  }
  var P = parsePath(), cur = null, rawUrl = '';

  function fmtDate(ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  function toTitle(s) { return String(s).replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function notFound() {
    var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    document.title = 'Material not found | StudyLeem';
    $('pageH1').textContent = 'Material not found';
    $('pageSubtitle').textContent = 'This file may have been moved or removed.';
    $('matViewer').hidden = true;
    $('matInfo').innerHTML = '<p>Go back to <a href="' + (P.cls && P.subjectSlug ? SLT.hubHref(P.cls, P.subjectSlug) : '/fbise') + '">all materials</a> or search from the <a href="/">home page</a>.</p>' + SLC.disclaimer();
  }

  /* ───── chapter switcher + prev / next ───── */
  function buildNav(list) {
    if (list.length < 2) return;
    list = list.slice().sort(SLT.compareItems);
    var i = list.findIndex(function (m) { return m.id === cur.id; });
    $('matTabs').innerHTML = list.map(function (m) { return '<a href="' + esc(SLT.itemHref(m)) + '" class="mat-tab' + (m.id === cur.id ? ' active' : '') + '" title="' + esc(m.title) + '">' + esc(SLT.tabLabel(m)) + '</a>'; }).join('');
    var prev = list[i - 1], next = list[i + 1];
    $('prevBtn').href = prev ? SLT.itemHref(prev) : '#'; $('prevBtn').classList.toggle('disabled', !prev);
    $('nextBtn').href = next ? SLT.itemHref(next) : '#'; $('nextBtn').classList.toggle('disabled', !next);
    $('matNav').hidden = false;
    var act = $('matTabs').querySelector('.active'); if (act && act.scrollIntoView) act.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* ───── descriptive content under the viewer ───── */
  function faqItems(S, C, typeLab) {
    return [
      ['Can I read this ' + S + ' PDF online?', 'Yes. The PDF opens inside this page. You can zoom, jump to a page and use full screen on mobile and desktop – no app is needed.'],
      ['How do I download it?', 'Press the Download PDF button under the viewer. The download starts after a short countdown.'],
      ['Is this for the FBISE Federal Board syllabus?', 'It is shared for Class ' + C + ' ' + S + ' students following the Federal Board (FBISE) syllabus. Always confirm the current syllabus and notifications with the board or your college.'],
      ['Can LeemAI help me with this PDF?', 'Yes. Use "Ask LeemAI" inside the viewer to summarize or explain the page you are reading, or open the AI quiz to practise this subject.'],
      ['Is it free?', 'Yes. Reading, downloading and LeemAI are free on StudyLeem.']
    ];
  }

  async function drawInfo(siblings) {
    var S = esc(toTitle(cur.subject)), C = esc(cur.class), typeLab = SLT.label(cur.type, cur.typeLabel), T = esc(typeLab);
    var ci = SLC.classInfo(cur.class), desc = String(cur.description || ''), parts = desc.split(' | '), en = parts[0].trim(), ur = parts.slice(1).join(' | ').trim();
    var added = fmtDate(cur.updatedAt || cur.createdAt);
    var rows = [['Board', 'FBISE – Federal Board, Islamabad'], ['Class', ci.name], ['Subject', toTitle(cur.subject)], ['Material type', typeLab], ['Item', (cur.title && cur.title.toLowerCase().indexOf(SLT.itemLabel(cur).toLowerCase()) === 0) ? cur.title : SLT.itemLabel(cur) + (cur.title && SLT.itemLabel(cur) !== cur.title ? ' – ' + cur.title : '')], ['Format', 'PDF – read online or download'], ['Price', 'Free']];
    if (added) rows.push(['Added', added]);
    var how = SLC.howTo(cur.type).map(function (s, i) { return '<li><div><b>Step ' + (i + 1) + '</b><span>' + esc(s) + '</span></div></li>'; }).join('');
    var same = (siblings || []).filter(function (m) { return m.type === cur.type && m.id !== cur.id; }).sort(SLT.compareItems).slice(0, 24);
    var others = SLT.typesFrom(siblings || []).filter(function (t) { return t.slug !== cur.type; });
    var lm = 'data-lm-class="' + esc(cur.class) + '" data-lm-subject="' + esc(cur.subject) + '"';
    var faq = faqItems(S, C, T).map(function (f) { return '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('');
    $('matInfo').innerHTML =
      '<h2>About this PDF</h2><div class="sp-quick">' +
        '<p><b>' + esc(cur.title) + '</b> – ' + (en ? esc(en) : 'free FBISE ' + S + ' ' + T.toLowerCase() + ' for Class ' + C + '.') + '</p>' +
        (ur ? '<p class="mat-urdu" dir="rtl" lang="ur">' + esc(ur) + '</p>' : '') +
        '<p>' + SLC.typeAbout(cur.type, typeLab) + '</p></div>' +
      '<h2>Details</h2><dl class="mat-details">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<h2>How to use this ' + T + ' PDF</h2><ol class="sp-steps">' + how + '</ol>' +
      '<h2>About Class ' + C + ' ' + S + '</h2><p>' + SLC.subjectBlurb(cur.subjectSlug || toSlug(cur.subject)) + ' This is part of the <a href="' + SLT.hubHref(cur.class, cur.subjectSlug || toSlug(cur.subject)) + '">Class ' + C + ' ' + S + ' study material</a> on StudyLeem for ' + esc(ci.stage) + ' students.</p>' +
      (same.length ? '<h2>More ' + T + ' for Class ' + C + ' ' + S + '</h2><div class="sp-rel">' + same.map(function (m) { return '<a href="' + esc(SLT.itemHref(m)) + '">' + esc(SLT.itemLabel(m) === m.title ? m.title : SLT.itemLabel(m) + ' – ' + m.title) + '</a>'; }).join('') + '</div>' : '') +
      (others.length ? '<h2>Other ' + S + ' material</h2><div class="sp-rel">' + others.map(function (t) { return '<a href="' + SLT.hubHref(cur.class, cur.subjectSlug || toSlug(cur.subject)) + '#t-' + esc(t.slug) + '">' + esc(t.label) + ' (' + t.count + ')</a>'; }).join('') + '</div>' : '') +
      '<h2>Practise with LeemAI</h2><div class="sp-grid">' +
        '<a class="sp-box hub-cta" href="/leemai#quiz" ' + lm + '>' + ic('clipboard') + '<h3>' + S + ' AI Quiz</h3><p>Test yourself with a Class ' + C + ' ' + S + ' quiz and get a score, review and study plan.</p></a>' +
        '<a class="sp-box hub-cta" href="/leemai#chat" ' + lm + '>' + ic('bot') + '<h3>Ask LeemAI</h3><p>Stuck on a page? Ask in English, Urdu or Roman Urdu.</p></a>' +
        '<a class="sp-box hub-cta" href="/leemai#checker" ' + lm + '>' + ic('image') + '<h3>AI Paper Checker</h3><p>Solved a paper? Upload a photo for marks and feedback.</p></a></div>' +
      '<h2>Frequently Asked Questions</h2><div class="sp-faq">' + faq + '</div>' + SLC.disclaimer();
  }

  function seo() {
    var S = toTitle(cur.subject), C = cur.class, typeLab = SLT.label(cur.type, cur.typeLabel);
    var isBook = cur.type === 'books', isEx = cur.type === 'notes' && cur.contentType === 'exercise';
    var noun = isBook ? 'textbook' : cur.type === 'notes' ? 'notes' : typeLab.toLowerCase();
    var part = isBook ? (cur.chapterNumber ? 'Chapter ' + cur.chapterNumber : 'Book')
      : cur.type !== 'notes' ? (cur.chapterNumber ? typeLab + ' Chapter ' + cur.chapterNumber : cur.title)
      : isEx ? (cur.review ? 'Review Exercise ' + cur.chapterNumber : 'Exercise ' + cur.chapterNumber + (cur.exerciseNumber ? '.' + cur.exerciseNumber : ''))
      : cur.chapterNumber ? 'Chapter ' + cur.chapterNumber : cur.title;
    var h1 = 'Class ' + C + ' ' + S + ' ' + part + (cur.type === 'notes' ? ' Notes PDF' : ' PDF');
    var url = SLT.itemHref(cur), title = h1 + ' – FBISE | StudyLeem';
    var en = SLC.english(cur.description);
    var desc = (cur.title + ' – free FBISE ' + S + ' ' + noun + ' for Class ' + C + ' (Federal Board Pakistan). Read online, download the PDF and practise with a LeemAI AI quiz.').slice(0, 300);
    var kw = 'FBISE ' + S + ' ' + noun + ' class ' + C + ', ' + cur.title + ', Federal Board ' + S + ' class ' + C + ' PDF, free ' + S + ' ' + noun + ' download, StudyLeem';
    var hub = SLT.hubHref(C, cur.subjectSlug || toSlug(cur.subject));
    $('pageH1').textContent = h1;
    $('pageSubtitle').textContent = cur.title + (en ? ' – ' + en.slice(0, 140) : '');
    $('bcClass').textContent = 'Class ' + C; $('bcClass').href = '/fbise/' + C;
    $('bcSubject').textContent = S; $('bcSubject').href = hub;
    $('bcType').textContent = typeLab; $('bcType').href = hub + '#t-' + cur.type;
    $('bcItem').textContent = cur.title;
    $('matBadges').innerHTML = '<span class="mat-pill">' + ic(SLT.icon(cur.type)) + ' ' + esc(typeLab) + '</span><span class="mat-pill">Class ' + esc(C) + '</span><span class="mat-pill">' + esc(S) + '</span><span class="mat-pill">Free PDF</span>';
    SEO.apply({
      title: title, description: desc, keywords: kw, canonical: url,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, { name: 'Class ' + C, url: '/fbise/' + C }, { name: S, url: hub }, { name: cur.title, url: url }],
      jsonld: [
        { '@type': 'LearningResource', name: h1, description: desc, url: BASE + url, learningResourceType: isBook ? 'Textbook' : cur.type === 'notes' ? (isEx ? 'Exercise' : 'Study notes') : typeLab, educationalLevel: 'Class ' + C, about: S, inLanguage: 'en', isAccessibleForFree: true, provider: { '@type': 'Organization', name: 'StudyLeem', url: BASE } },
        { '@type': 'FAQPage', mainEntity: faqItems(S, C, typeLab).map(function (f) { return { '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }; }) }
      ]
    });
  }

  function actions() {
    var url = BASE + SLT.itemHref(cur), t = encodeURIComponent(cur.title + ' – StudyLeem');
    $('downloadBtn').onclick = function () { StudyPDF.withTimer($('downloadBtn'), DOWNLOAD_WAIT, function () { return StudyPDF.download(rawUrl, cur.title); }); };
    $('fullBtn').onclick = function () { StudyPDF.openModal(cur.title, rawUrl); };
    $('shareWa').href = 'https://wa.me/?text=' + t + '%20' + encodeURIComponent(url);
    $('copyBtn').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Copied!'; }, function () { prompt('Copy this link', url); }); };
  }

  async function init() {
    mobileMenu();
    if (!P.cls || !P.subjectSlug || !P.type || !P.slug) return notFound();
    try {
      if (P.type === 'books' && P.slug.indexOf('book-') === 0) cur = await DB.getById(P.slug.replace(/^book-/, ''));   // old single textbooks
      if (!cur) { var r = await DB.getByChapterSlug(P.cls, P.subjectSlug, P.slug, P.type); cur = r && r[0]; }
    } catch (e) { console.error(e); }
    if (!cur) return notFound();
    rawUrl = cur.pdfLink || '';
    seo(); actions();
    $('matViewer').hidden = false;
    if (!rawUrl) { $('pdfFrame').innerHTML = '<div class="mat-nopdf">No PDF link is available for this item yet.</div>'; }
    else StudyPDF.mount($('pdfHost'), rawUrl, { title: function () { return cur.title; } });
    var sib = [];
    try { sib = await DB.getBySubjectSlug(P.cls, P.subjectSlug); } catch (e) { console.warn(e); }
    buildNav(sib.filter(function (m) { return m.type === cur.type; }));
    drawInfo(sib);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
