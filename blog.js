/* StudyLeem blog: list page (/blog) and post page (/blog/:slug). Data comes from Firestore `blogPosts`. */
(function () {
  'use strict';
  var BASE = 'https://studyleem.vercel.app';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function whenBlog() {
    if (window.Blog) return Promise.resolve();
    return new Promise(function (res) { window.addEventListener('firebase-ready', function () { res(); }, { once: true }); });
  }
  function date(ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function iso(ms) { return ms ? new Date(ms).toISOString() : undefined; }
  window.blogCard = function (p, h) {
    h = h || 'h2';
    return '<a class="bl-card" href="/blog/' + esc(p.slug) + '"><span class="bl-cat">' + esc(p.category || 'Study Tips') + '</span><' + h + '>' + esc(p.title) + '</' + h + '><p>' + esc(p.excerpt || '') + '</p><div class="bl-meta">' + date(p.publishedAt) + ' · ' + (p.readingMinutes || 5) + ' min read</div></a>';
  };

  /* ───── list page ───── */
  function initList() {
    var posts = [], cat = '', q = '', shown = 12;
    function draw() {
      var list = posts.filter(function (p) { return (!cat || p.category === cat) && (!q || (p.title + ' ' + (p.excerpt || '') + ' ' + (p.keywords || '')).toLowerCase().indexOf(q) >= 0); });
      $('blogGrid').innerHTML = list.slice(0, shown).map(function (p) { return window.blogCard(p, 'h2'); }).join('') ||
        '<div class="bl-empty" style="grid-column:1/-1">No articles found. New study articles are published every week – check back soon, or explore <a href="/fbise/notes">FBISE notes</a> and <a href="/leemai">LeemAI</a>.</div>';
      $('blogMore').style.display = list.length > shown ? 'block' : 'none';
    }
    whenBlog().then(function () { return Blog.listPublished(); }).then(function (p) {
      posts = p;
      var cats = []; posts.forEach(function (x) { if (x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });
      $('blogChips').innerHTML = cats.length > 1 ? ['All'].concat(cats).map(function (c) { return '<button class="bl-chip' + (c === 'All' ? ' active' : '') + '" data-c="' + esc(c === 'All' ? '' : c) + '">' + esc(c) + '</button>'; }).join('') : '';
      draw();
      if (window.SEO && posts.length) {
        SEO.apply({
          title: document.title, description: document.querySelector('meta[name="description"]').content, canonical: '/blog',
          breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog' }],
          jsonld: [{ '@type': 'Blog', '@id': BASE + '/blog#blog', name: 'StudyLeem Blog', url: BASE + '/blog', inLanguage: 'en', publisher: { '@id': BASE + '/#org' },
            blogPost: posts.slice(0, 20).map(function (x) { return { '@type': 'BlogPosting', headline: x.title, url: BASE + '/blog/' + x.slug, datePublished: iso(x.publishedAt) }; }) }]
        });
      }
    }).catch(function (e) { $('blogGrid').innerHTML = '<div class="bl-empty" style="grid-column:1/-1">Could not load articles: ' + esc(e.message) + '</div>'; });
    $('blogChips').addEventListener('click', function (e) { var b = e.target.closest('.bl-chip'); if (!b) return; cat = b.dataset.c; shown = 12; document.querySelectorAll('.bl-chip').forEach(function (x) { x.classList.toggle('active', x === b); }); draw(); });
    $('blogSearch').addEventListener('input', function () { q = this.value.trim().toLowerCase(); shown = 12; draw(); });
    $('blogMore').addEventListener('click', function () { shown += 12; draw(); });
  }

  /* ───── post page ───── */
  function notFound() {
    var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    document.title = 'Article not found | StudyLeem';
    $('postBody').innerHTML = '<div class="bl-empty">This article was not found. <a href="/blog">Browse all articles</a> or open <a href="/leemai">LeemAI</a>.</div>';
    $('postHead').hidden = true;
  }
  function initPost() {
    var slug = decodeURIComponent((location.pathname.replace(/\/+$/, '').split('/').pop() || ''));
    whenBlog().then(function () { return Blog.getBySlug(slug); }).then(function (p) {
      if (!p) return notFound();
      var url = BASE + '/blog/' + p.slug;
      var desc = p.metaDescription || p.excerpt || p.title;
      var kw = (p.keywords ? p.keywords + ', ' : '') + 'StudyLeem, FBISE, LeemAI';
      $('postCat').textContent = p.category || 'Study Tips';
      $('postTitle').textContent = p.title;
      $('postCrumb').textContent = p.title;
      $('postDate').textContent = date(p.publishedAt || p.createdAt);
      $('postMins').textContent = (p.readingMinutes || 5) + ' min read';
      $('postLead').textContent = p.excerpt || '';
      $('postLead').hidden = !p.excerpt;
      $('postContent').innerHTML = mdToHtml(p.content);
      if (p.status !== 'published') $('postDraft').hidden = false;
      // table of contents from the h2 headings
      var hs = Array.prototype.slice.call($('postContent').querySelectorAll('h2'));
      if (hs.length >= 3) $('postToc').innerHTML = '<b>In this article</b><ol>' + hs.map(function (h) { return '<li><a href="#' + esc(h.id) + '">' + esc(h.textContent) + '</a></li>'; }).join('') + '</ol>';
      else $('postToc').hidden = true;
      $('postTags').innerHTML = (p.keywords || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
      var shareTxt = encodeURIComponent(p.title + ' – StudyLeem');
      $('postShare').innerHTML = 'Share: <a target="_blank" rel="noopener" href="https://wa.me/?text=' + shareTxt + '%20' + encodeURIComponent(url) + '">WhatsApp</a><a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">Facebook</a><button type="button" id="copyLink">Copy link</button>';
      $('copyLink').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Copied!'; }, function () { prompt('Copy this link', url); }); };
      if (window.SEO) {
        SEO.apply({
          title: p.title + ' | StudyLeem Blog', description: desc, keywords: kw, canonical: '/blog/' + p.slug,
          breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog' }, { name: p.title, url: '/blog/' + p.slug }],
          jsonld: [{ '@type': 'BlogPosting', headline: p.title, description: desc, url: url, mainEntityOfPage: url, image: BASE + '/og-image.png',
            datePublished: iso(p.publishedAt || p.createdAt), dateModified: iso(p.updatedAt || p.publishedAt || p.createdAt), articleSection: p.category, keywords: kw,
            wordCount: p.wordCount || undefined, inLanguage: 'en', isAccessibleForFree: true,
            author: { '@type': 'Organization', name: 'StudyLeem', url: BASE }, publisher: { '@id': BASE + '/#org', '@type': 'Organization', name: 'StudyLeem', logo: { '@type': 'ImageObject', url: BASE + '/favicon-512.png' } } }]
        });
      }
      return Blog.listPublished().then(function (all) {
        var rel = all.filter(function (x) { return x.slug !== p.slug; });
        rel.sort(function (a, b) { return (b.category === p.category) - (a.category === p.category) || b.publishedAt - a.publishedAt; });
        rel = rel.slice(0, 3);
        if (rel.length) $('postRelated').innerHTML = '<h2>More study articles</h2><div class="bl-grid">' + rel.map(function (x) { return window.blogCard(x, 'h3'); }).join('') + '</div>';
      }).catch(function () {});
    }).catch(function (e) { $('postBody').innerHTML = '<div class="bl-empty">Could not load this article: ' + esc(e.message) + '</div>'; });
  }
  if ($('blogGrid')) initList();
  if ($('postContent')) initPost();
})();
