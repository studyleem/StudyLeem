/* Home page: latest 3 blog posts (hidden when there are none yet). */
(function () {
  var box = document.getElementById('homeBlogGrid'), sec = document.getElementById('homeBlog');
  if (!box || !sec) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function go() {
    Blog.listPublished(30).then(function (p) {
      if (!p.length) return;
      box.innerHTML = p.slice(0, 3).map(function (x) {
        return '<a class="bl-card" href="/blog/' + esc(x.slug) + '"><span class="bl-cat">' + esc(x.category || 'Study Tips') + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.excerpt || '') + '</p><div class="bl-meta">' + (x.readingMinutes || 5) + ' min read</div></a>';
      }).join('');
      sec.hidden = false;
    }).catch(function () {});
  }
  if (window.Blog) go(); else window.addEventListener('firebase-ready', go, { once: true });
})();
