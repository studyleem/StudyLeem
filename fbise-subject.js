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
    const type  = parts[1] || 'notes'; // 'notes' or 'books'
    const cls   = parts[2] || '12';
    return { type, cls };
  }

  const classLabels = {
    '9':  'Class 9 – SSC Part 1',
    '10': 'Class 10 – SSC Part 2',
    '11': 'Class 11 – HSSC Part 1',
    '12': 'Class 12 – HSSC Part 2'
  };

  function setMeta(type, cls) {
    const typeLabel = type === 'books' ? 'Books' : 'Notes';
    const clsLabel  = classLabels[cls] || `Class ${cls}`;
    const title = `Class ${cls} FBISE ${typeLabel} – All Subjects, Free PDF | StudyLeem`;
    const desc  = `Free FBISE ${typeLabel.toLowerCase()} for ${clsLabel} (Federal Board Pakistan): chapter-wise PDFs for every subject, plus LeemAI, the AI tutor with quizzes.`;
    const keys  = `FBISE ${typeLabel.toLowerCase()} class ${cls}, FBISE class ${cls} ${typeLabel.toLowerCase()}, Federal Board ${cls} ${typeLabel.toLowerCase()} PDF, free FBISE class ${cls} study material Pakistan`;

    document.getElementById('pageTitle').textContent      = title;
    document.getElementById('pageDesc').content           = desc;
    document.getElementById('pageKeywords').content       = keys;
    document.getElementById('pageCanonical').href         = `https://studyleem.vercel.app/fbise/${type}/${cls}`;
    if (window.SEO) SEO.apply({
      title, description: desc, keywords: keys, canonical: `/fbise/${type}/${cls}`,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, { name: `FBISE ${typeLabel}`, url: `/fbise/${type}` }, { name: clsLabel, url: `/fbise/${type}/${cls}` }],
      jsonld: [{ '@type': 'CollectionPage', name: `FBISE ${typeLabel} – ${clsLabel}`, description: desc, url: `https://studyleem.vercel.app/fbise/${type}/${cls}`, educationalLevel: clsLabel, inLanguage: 'en', isAccessibleForFree: true }]
    });
    document.getElementById('pageH1').textContent         = `FBISE ${typeLabel} – ${clsLabel}`;
    document.getElementById('pageSubtitle').textContent   = `Select a subject to browse ${typeLabel === 'Books' ? 'textbooks' : 'chapter-wise notes'}`;
    document.getElementById('breadClass').textContent     = clsLabel;

    // Type switcher
    const sw = document.getElementById('typeSwitcher');
    sw.innerHTML = `
      <a href="/fbise/notes/${cls}" class="type-switch-btn ${type==='notes'?'active':''}">${ic('notes')} Notes</a>
      <a href="/fbise/books/${cls}" class="type-switch-btn ${type==='books'?'active':''}">${ic('book-open')} Books</a>
    `;

    document.getElementById('subjectsHeading').textContent = `${typeLabel} – ${clsLabel}`;
  }

  async function loadSubjects(type, cls) {
    const grid = document.getElementById('subjectsGrid');
    try {
      grid.innerHTML = '<div class="loading">Loading subjects...</div>';
      const materials = await DB.getByClass(cls);
      const filtered  = type === 'all' ? materials : materials.filter(m => m.type === type);

      if (!filtered.length) {
        grid.innerHTML = `<p class="loading">No ${type} available for Class ${cls} yet. Check back soon!</p>`;
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

      grid.innerHTML = subjects.map(s => spCard(`/fbise/${type}/${cls}/${s.slug}`, cls, s.name, type === 'books' ? 'FBISE Book' : 'FBISE Notes', s.cover)).join('');

    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="loading">Error loading subjects. Please refresh.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mobileMenu();
    const { type, cls } = parsePath();
    setMeta(type, cls);
    loadSubjects(type, cls);
  });
})();
