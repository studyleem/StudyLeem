/* ── fbise-subject.js: /fbise/notes/:class or /fbise/books/:class ── */

(function () {
  'use strict';

  function escHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function mobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    if (btn && menu) {
      btn.onclick = e => { e.stopPropagation(); menu.classList.toggle('active'); };
      document.onclick = e => { if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active'); };
      menu.querySelectorAll('a').forEach(a => a.onclick = () => menu.classList.remove('active'));
    }
  }

  // Parse clean URL path: /fbise/notes/12 or /fbise/books/9
  function parsePath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // parts = ['fbise','notes','12']
    if (/^(9|10|11|12)$/.test(parts[1] || '')) return { type: 'all', cls: parts[1] };   // /fbise/12 -> every type
    const type  = parts[1] || 'notes'; // 'notes' or 'books' or any other type
    const cls   = parts[2] || '12';
    return { type, cls };
  }

  const classLabels = {
    '9':  'Class 9 – SSC Part 1',
    '10': 'Class 10 – SSC Part 2',
    '11': 'Class 11 – HSSC Part 1',
    '12': 'Class 12 – HSSC Part 2'
  };

  let typeList = [];
  function setMeta(type, cls, label) {
    const typeLabel = label || SLT.label(type);
    const clsLabel  = classLabels[cls] || `Class ${cls}`;
    const all = type === 'all';
    const title = all ? `Class ${cls} FBISE Notes, Books & Study Material – All Subjects | StudyLeem` : `Class ${cls} FBISE ${typeLabel} – All Subjects, Free PDF | StudyLeem`;
    const desc  = all ? `Free FBISE study material for ${clsLabel} (Federal Board Pakistan): notes, books and more for every subject, plus LeemAI, the AI tutor with quizzes.` : `Free FBISE ${typeLabel.toLowerCase()} for ${clsLabel} (Federal Board Pakistan): chapter-wise PDFs for every subject, plus LeemAI, the AI tutor with quizzes.`;
    const keys  = `FBISE ${typeLabel.toLowerCase()} class ${cls}, FBISE class ${cls} ${typeLabel.toLowerCase()}, Federal Board ${cls} ${typeLabel.toLowerCase()} PDF, free FBISE class ${cls} study material Pakistan`;

    document.getElementById('pageTitle').textContent      = title;
    document.getElementById('pageDesc').content           = desc;
    document.getElementById('pageKeywords').content       = keys;
    document.getElementById('pageCanonical').href         = `https://studyleem.vercel.app/fbise/${all ? '' : type + '/'}${cls}`;
    if (window.SEO) SEO.apply({
      title, description: desc, keywords: keys, canonical: all ? `/fbise/${cls}` : `/fbise/${type}/${cls}`,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, ...(all ? [] : [{ name: `FBISE ${typeLabel}`, url: `/fbise/${type}` }]), { name: clsLabel, url: all ? `/fbise/${cls}` : `/fbise/${type}/${cls}` }],
      jsonld: [{ '@type': 'CollectionPage', name: `FBISE ${typeLabel} – ${clsLabel}`, description: desc, url: `https://studyleem.vercel.app/fbise/${all ? '' : type + '/'}${cls}`, educationalLevel: clsLabel, inLanguage: 'en', isAccessibleForFree: true }]
    });
    document.getElementById('pageH1').textContent         = all ? `${clsLabel} – All Subjects` : `FBISE ${typeLabel} – ${clsLabel}`;
    document.getElementById('pageSubtitle').textContent   = all ? 'Choose a subject to see every note, book and other PDF' : `Select a subject to browse ${type === 'books' ? 'textbooks' : type === 'notes' ? 'chapter-wise notes' : typeLabel.toLowerCase()}`;
    document.getElementById('breadClass').textContent     = clsLabel;

    // Type switcher
    const sw = document.getElementById('typeSwitcher');
    sw.innerHTML = `<a href="/fbise/${cls}" class="type-switch-btn ${all ? 'active' : ''}">All</a>` + typeList.map(t => `<a href="/fbise/${t.slug}/${cls}" class="type-switch-btn ${t.slug === type ? 'active' : ''}">${ic(SLT.icon(t.slug))} ${escHtml(t.label)}</a>`).join('');

    document.getElementById('subjectsHeading').textContent = `${typeLabel} – ${clsLabel}`;
  }

  async function loadSubjects(type, cls) {
    const grid = document.getElementById('subjectsGrid');
    try {
      grid.innerHTML = '<div class="loading">Loading subjects...</div>';
      const materials = await DB.getByClass(cls);
      const filtered  = type === 'all' ? materials : materials.filter(m => m.type === type);
      typeList = SLT.typesFrom(await DB.getAll(), { always: true });
      if (type !== 'all' && !typeList.some(t => t.slug === type)) typeList.push({ slug: type, label: SLT.label(type), count: 0 });
      const lbl = (typeList.find(t => t.slug === type) || {}).label;
      setMeta(type, cls, lbl);

      if (!filtered.length) {
        grid.innerHTML = `<p class="loading">No ${escHtml(SLT.label(type))} available for Class ${cls} yet. Check back soon!</p>`;
        return;
      }

      // Group by subject
      const subjMap = {};
      filtered.forEach(m => {
        const slug = m.subjectSlug || toSlug(m.subject);
        if (!subjMap[slug]) {
          subjMap[slug] = { name: m.subject, slug, count: 0, cover: '' };
        }
        subjMap[slug].count++;
        if (!subjMap[slug].cover && m.coverImage) subjMap[slug].cover = m.coverImage;
      });

      const subjects = Object.values(subjMap).sort((a, b) => a.name.localeCompare(b.name));

      grid.innerHTML = subjects.map(s => spCard(SLT.hubHref(cls, s.slug), cls, s.name, type === 'all' ? 'FBISE Study Material' : SLT.tag(type, lbl), s.cover)).join('');

    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="loading">Error loading subjects. Please refresh.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mobileMenu();
    const { type, cls } = parsePath();
    typeList = SLT.typesFrom([], { always: true });
    setMeta(type, cls);
    loadSubjects(type, cls);
  });
})();
