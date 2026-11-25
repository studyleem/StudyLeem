/* Subject page: /fbise/<class>/<subject>  (e.g. /fbise/12/english)
   Shows every uploaded material of that class + subject (all types) as a grid or list, then a description of the
   subject, the book and the other material, how to study, FAQ and a disclaimer. */
(function () {
  'use strict';
  var BASE = 'https://studyleem.vercel.app';
  var esc = SLC.esc, $ = function (id) { return document.getElementById(id); };

  function mobileMenu() {
    var btn = $('mobileMenuBtn'), menu = $('mobileMenu');
    if (btn && menu) {
      btn.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('active'); };
      document.onclick = function (e) { if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active'); };
    }
  }
  // new order /fbise/12/english[/notes]   |   old order /fbise/notes/12/english
  function parsePath() {
    var p = location.pathname.split('/').filter(Boolean);
    if (/^(9|10|11|12)$/.test(p[1] || '')) return { cls: p[1], subjectSlug: (p[2] || '').toLowerCase(), type: (p[3] || '').toLowerCase() };
    return { type: (p[1] || '').toLowerCase(), cls: p[2] || '', subjectSlug: (p[3] || '').toLowerCase() };
  }
  var P = parsePath(), items = [], subjectName = '', filter = P.type || 'all', query = '';
  var view = 'grid'; try { view = localStorage.getItem('sl_view') === 'list' ? 'list' : 'grid'; } catch (e) {}

  function card(m) {
    var legacyBook = SLT.isLegacyBook(m), isEx = m.type === 'notes' && m.contentType === 'exercise';
    var icon = legacyBook ? 'book-open' : isEx ? 'calculator' : (m.type === 'notes' ? 'book' : SLT.icon(m.type));
    var cta = legacyBook ? 'Read Book' : isEx ? 'Open Exercise' : m.type === 'notes' ? 'Read Notes' : 'Open PDF';
    var d = SLC.english(m.description);
    return '<a href="' + esc(SLT.itemHref(m)) + '" class="chapter-item' + (legacyBook ? ' book-item' : '') + (m.coverImage ? ' has-cover' : '') + '" aria-label="' + esc(SLT.itemLabel(m)) + ': ' + esc(m.title) + '">' +
      (m.coverImage ? '<div class="chapter-thumb"><img src="' + esc(m.coverImage) + '" alt="" loading="lazy" onerror="this.parentNode.parentNode.classList.remove(\'has-cover\');this.parentNode.remove()"></div>' : '') +
      '<div class="chapter-body"><div class="chapter-num">' + ic(icon) + ' ' + esc(SLT.itemLabel(m)) + '</div>' +
      '<div class="chapter-info"><h3 class="chapter-title">' + esc(m.title) + '</h3>' + (d ? '<p class="chapter-desc">' + esc(d.slice(0, 110)) + (d.length > 110 ? '…' : '') + '</p>' : '') + '</div>' +
      '<span class="chapter-cta">' + cta + ' ' + ic('arrow-right') + '</span></div></a>';
  }

  function drawToolbar(types) {
    $('hubChips').innerHTML = [{ slug: 'all', label: 'All', count: items.length }].concat(types).map(function (t) {
      return '<button type="button" class="tab-btn' + (t.slug === filter ? ' active' : '') + '" data-t="' + esc(t.slug) + '">' + (t.slug !== 'all' ? ic(SLT.icon(t.slug)) + ' ' : '') + esc(t.label) + ' (' + t.count + ')</button>';
    }).join('');
    $('viewGrid').classList.toggle('active', view === 'grid'); $('viewList').classList.toggle('active', view === 'list');
  }
  function drawList() {
    var types = SLT.typesFrom(items), q = query.toLowerCase();
    drawToolbar(types);
    var shown = types.filter(function (t) { return filter === 'all' || filter === t.slug; });
    var html = shown.map(function (t) {
      var list = items.filter(function (m) { return m.type === t.slug && (!q || (m.title + ' ' + (m.description || '') + ' ' + SLT.itemLabel(m)).toLowerCase().indexOf(q) >= 0); }).sort(SLT.compareItems);
      if (!list.length) return '';
      return '<h2 class="hub-type" id="t-' + esc(t.slug) + '">' + ic(SLT.icon(t.slug)) + ' ' + esc(t.label) + ' <span>(' + list.length + ')</span></h2>' +
        '<div class="chapters-list hub-' + view + '">' + list.map(card).join('') + '</div>';
    }).join('');
    $('hubList').innerHTML = html || '<p class="loading">No material matches your search.</p>';
  }

  function faqItems(S, C) {
    return [
      ['Where can I download FBISE Class ' + C + ' ' + S + ' notes and books?', 'This page lists every free PDF available on StudyLeem for Class ' + C + ' ' + S + '. Open an item to read it online and use the Download button on its page.'],
      ['Are these materials for the Federal Board (FBISE)?', 'Yes. They are shared for students following the FBISE syllabus in Pakistan. Always check the latest syllabus and notifications from the board or your college.'],
      ['Can I practise ' + S + ' with an AI quiz?', 'Yes. LeemAI can create a Class ' + C + ' ' + S + ' quiz with a score, answer review and study suggestions, and can check a photo of your solved paper.'],
      ['Is StudyLeem free?', 'Yes. All study materials and LeemAI features on StudyLeem are free and need no registration.']
    ];
  }

  async function drawInfo() {
    var S = esc(subjectName), C = esc(P.cls), ci = SLC.classInfo(P.cls), types = SLT.typesFrom(items);
    var counts = types.map(function (t) { return t.label + ' (' + t.count + ')'; }).join(', ');
    var perType = types.map(function (t) {
      var first = items.filter(function (m) { return m.type === t.slug && m.description; }).sort(SLT.compareItems)[0];
      return '<div class="sp-box">' + ic(SLT.icon(t.slug)) + '<h3>' + esc(t.label) + ' (' + t.count + ')</h3><p>' + SLC.typeAbout(t.slug, t.label) + '</p>' +
        (first ? '<p class="hub-note"><b>' + esc(first.title) + ':</b> ' + esc(SLC.english(first.description)) + '</p>' : '') + '</div>';
    }).join('');
    var how = [['Read the textbook first', 'Understand each lesson before you use notes.'], ['Revise with notes', 'Use the notes for definitions, formulas and diagrams.'], ['Practise exercises', 'Solve the questions yourself, then compare with the solutions.'], ['Test yourself with LeemAI', 'Take an AI quiz and revise the topics you missed.']]
      .map(function (s) { return '<li><div><b>' + s[0] + '</b><span>' + s[1] + '</span></div></li>'; }).join('');
    var faq = faqItems(S, C).map(function (f) { return '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('');
    var lm = 'data-lm-class="' + esc(P.cls) + '" data-lm-subject="' + esc(subjectName) + '"';
    $('hubInfo').innerHTML =
      '<h2>About Class ' + C + ' ' + S + ' (' + esc(ci.stage) + ')</h2>' +
      '<div class="sp-quick"><p>' + SLC.subjectBlurb(P.subjectSlug) + '</p><p>This page brings together <b>' + items.length + ' free PDF' + (items.length === 1 ? '' : 's') + '</b> for <b>' + esc(ci.name) + ' ' + S + '</b> – ' + esc(counts) + ' – for students of the Federal Board (FBISE), Islamabad. Open any item to read it inside StudyLeem with the built-in PDF viewer, download it, or ask LeemAI to explain a page.</p>' +
      '<div class="sp-chips"><span class="sp-chip2">Federal Board</span><span class="sp-chip2">Class ' + C + '</span><span class="sp-chip2">' + S + '</span><span class="sp-chip2">Free PDF</span><span class="sp-chip2">AI Quiz</span></div></div>' +
      '<h2>What is available for ' + S + '</h2><div class="sp-grid">' + perType + '</div>' +
      '<h2>How to prepare ' + S + '</h2><ol class="sp-steps">' + how + '</ol>' +
      '<h2>Practise with LeemAI</h2><div class="sp-grid">' +
        '<a class="sp-box hub-cta" href="/leemai#quiz" ' + lm + '>' + ic('clipboard') + '<h3>' + S + ' AI Quiz</h3><p>Generate a Class ' + C + ' ' + S + ' quiz and get your score, review and a study plan.</p></a>' +
        '<a class="sp-box hub-cta" href="/leemai#chat" ' + lm + '>' + ic('bot') + '<h3>Ask LeemAI</h3><p>Ask any ' + S + ' question in English, Urdu or Roman Urdu.</p></a>' +
        '<a class="sp-box hub-cta" href="/leemai#checker" ' + lm + '>' + ic('image') + '<h3>Paper Checker</h3><p>Upload a photo of your solved paper for marks and feedback.</p></a></div>' +
      '<div id="hubRelated"></div>' +
      '<h2>Frequently Asked Questions</h2><div class="sp-faq">' + faq + '</div>' + SLC.disclaimer();
    try {
      var all = await DB.getAll(), subj = {}, cls = {};
      all.forEach(function (m) {
        var s = m.subjectSlug || toSlug(m.subject || '');
        if (m.class === P.cls && s !== P.subjectSlug && s) subj[s] = m.subject;
        if (s === P.subjectSlug && m.class !== P.cls) cls[m.class] = 1;
      });
      var a = Object.keys(subj).sort().map(function (s) { return '<a href="' + SLT.hubHref(P.cls, s) + '">Class ' + C + ' ' + esc(subj[s]) + '</a>'; });
      var b = Object.keys(cls).sort(function (x, y) { return x - y; }).map(function (c) { return '<a href="' + SLT.hubHref(c, P.subjectSlug) + '">Class ' + esc(c) + ' ' + S + '</a>'; });
      var rel = (a.length ? '<h3 class="hub-h3">Other Class ' + C + ' subjects</h3><div class="sp-rel">' + a.join('') + '</div>' : '') + (b.length ? '<h3 class="hub-h3">' + S + ' for other classes</h3><div class="sp-rel">' + b.join('') + '</div>' : '');
      if (rel) $('hubRelated').innerHTML = '<h2>Related resources</h2>' + rel;
    } catch (e) { console.warn(e); }
  }

  function seo() {
    var types = SLT.typesFrom(items), S = subjectName, C = P.cls;
    var names = types.slice(0, 3).map(function (t) { return t.label; }).join(', ');
    var title = 'Class ' + C + ' ' + S + ' – FBISE ' + names + ' (Free PDF) | StudyLeem';
    var desc = 'Free FBISE Class ' + C + ' ' + S + ' study material: ' + items.length + ' PDFs including ' + names.toLowerCase() + '. Read online, download, and practise with LeemAI, the AI tutor for Federal Board students.';
    var url = SLT.hubHref(C, P.subjectSlug);
    var kw = 'FBISE class ' + C + ' ' + S + ', class ' + C + ' ' + S + ' notes, class ' + C + ' ' + S + ' book PDF, Federal Board ' + S + ' class ' + C + ', ' + types.map(function (t) { return 'FBISE ' + S + ' ' + t.label.toLowerCase(); }).join(', ') + ', LeemAI ' + S + ' quiz, StudyLeem';
    $('pageH1').textContent = 'Class ' + C + ' ' + S + ' – FBISE ' + names + ' & Study Material';
    $('pageSubtitle').textContent = items.length + ' free PDF' + (items.length === 1 ? '' : 's') + ' for ' + SLC.classInfo(C).name + ' ' + S + ' · Federal Board (FBISE)';
    $('breadClassLink').textContent = 'Class ' + C; $('breadClassLink').href = '/fbise/' + C;
    $('breadSubject').textContent = S;
    SEO.apply({
      title: title, description: desc, keywords: kw, canonical: url,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, { name: 'Class ' + C, url: '/fbise/' + C }, { name: S, url: url }],
      jsonld: [
        { '@type': 'CollectionPage', name: 'Class ' + C + ' ' + S + ' – FBISE study material', description: desc, url: BASE + url, about: S, educationalLevel: 'Class ' + C, inLanguage: 'en', isAccessibleForFree: true, isPartOf: { '@type': 'WebSite', name: 'StudyLeem', url: BASE } },
        { '@type': 'ItemList', itemListElement: items.slice().sort(SLT.compareItems).slice(0, 40).map(function (m, i) { return { '@type': 'ListItem', position: i + 1, name: m.title, url: BASE + SLT.itemHref(m) }; }) },
        { '@type': 'FAQPage', mainEntity: faqItems(S, C).map(function (f) { return { '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }; }) }
      ]
    });
  }

  async function init() {
    mobileMenu();
    if (!/^(9|10|11|12)$/.test(P.cls) || !P.subjectSlug) { $('hubList').innerHTML = '<p class="loading">Page not found. <a href="/fbise">Browse all FBISE material</a>.</p>'; return; }
    $('breadClassLink').textContent = 'Class ' + P.cls; $('breadClassLink').href = '/fbise/' + P.cls;
    try {
      items = await DB.getBySubjectSlug(P.cls, P.subjectSlug);
    } catch (e) { $('hubList').innerHTML = '<p class="loading">Could not load materials. Please refresh.</p>'; return; }
    if (!items.length) {
      var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
      $('pageH1').textContent = 'Class ' + P.cls + ' – nothing here yet';
      $('hubList').innerHTML = '<p class="loading">No material has been uploaded for this class and subject yet. <a href="/fbise/' + P.cls + '">See all Class ' + P.cls + ' subjects</a>.</p>';
      return;
    }
    subjectName = items[0].subject || P.subjectSlug.replace(/-/g, ' ');
    if (filter !== 'all' && !items.some(function (m) { return m.type === filter; })) filter = 'all';
    seo(); drawList(); drawInfo();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('hubChips').addEventListener('click', function (e) { var b = e.target.closest('.tab-btn'); if (b) { filter = b.dataset.t; drawList(); } });
    $('hubSearch').addEventListener('input', function () { query = this.value.trim(); drawList(); });
    $('viewGrid').onclick = function () { view = 'grid'; try { localStorage.setItem('sl_view', view); } catch (e) {} drawList(); };
    $('viewList').onclick = function () { view = 'list'; try { localStorage.setItem('sl_view', view); } catch (e) {} drawList(); };
    init();
  });
})();
