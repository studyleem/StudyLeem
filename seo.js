/* StudyLeem SEO helper – updates title, description, canonical, Open Graph, Twitter and JSON-LD
   for pages whose content depends on the URL (class / subject / chapter pages).
   Usage: SEO.apply({ title, description, keywords, canonical, breadcrumbs:[{name,url}], jsonld:[{...}] }) */
(function () {
  'use strict';
  var BASE = 'https://studyleem.vercel.app';
  function meta(sel, attr, name, content) {
    var el = document.querySelector(sel);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }
  function abs(u) { return /^https?:/.test(u) ? u : BASE + (u.charAt(0) === '/' ? '' : '/') + u; }
  window.SEO = {
    BASE: BASE,
    apply: function (o) {
      var url = abs(o.canonical || location.pathname.replace(/\/+$/, '') || '/');
      if (o.title) { document.title = o.title; var t = document.getElementById('pageTitle'); if (t && t.tagName === 'TITLE') t.textContent = o.title; }
      if (o.description) meta('meta[name="description"]', 'name', 'description', o.description);
      if (o.keywords) meta('meta[name="keywords"]', 'name', 'keywords', o.keywords);
      var c = document.querySelector('link[rel="canonical"]');
      if (!c) { c = document.createElement('link'); c.rel = 'canonical'; document.head.appendChild(c); }
      c.href = url;
      var img = abs(o.image || '/og-image.png');
      meta('meta[property="og:title"]', 'property', 'og:title', o.title || document.title);
      meta('meta[property="og:description"]', 'property', 'og:description', o.description || '');
      meta('meta[property="og:url"]', 'property', 'og:url', url);
      meta('meta[property="og:image"]', 'property', 'og:image', img);
      meta('meta[name="twitter:title"]', 'name', 'twitter:title', o.title || document.title);
      meta('meta[name="twitter:description"]', 'name', 'twitter:description', o.description || '');
      meta('meta[name="twitter:image"]', 'name', 'twitter:image', img);
      var graph = (o.jsonld || []).slice();
      if (o.breadcrumbs && o.breadcrumbs.length) {
        graph.push({
          '@type': 'BreadcrumbList',
          itemListElement: o.breadcrumbs.map(function (b, i) { return { '@type': 'ListItem', position: i + 1, name: b.name, item: abs(b.url) }; })
        });
      }
      var s = document.getElementById('seo-ld');
      if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'seo-ld'; document.head.appendChild(s); }
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    }
  };
})();
