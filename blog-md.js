/* Tiny, safe Markdown -> HTML for StudyLeem blog posts (used by the blog page and the admin preview).
   All text is HTML-escaped first; only /relative and https:// links are allowed; no raw HTML ever passes through. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function slugify(s) { return String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      u = u.replace(/&amp;/g, '&');
      if (/^(\/(?!\/)|https:\/\/)/.test(u)) {
        var ext = /^https:/.test(u);
        return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener nofollow"' : '') + '>' + t + '</a>';
      }
      return t;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    return s;
  }
  window.mdToHtml = function (md) {
    var lines = esc(String(md || '').replace(/\r\n?/g, '\n')).split('\n');
    var out = [], para = [], list = '', quote = [];
    function flushP() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushL() { if (list) { out.push('</' + list + '>'); list = ''; } }
    function flushQ() { if (quote.length) { out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } }
    lines.forEach(function (ln) {
      var h = ln.match(/^(#{1,4})\s+(.+)$/), u = ln.match(/^\s*[-*]\s+(.+)$/), o = ln.match(/^\s*\d+[.)]\s+(.+)$/), q = ln.match(/^&gt;\s?(.*)$/);
      if (h) { flushP(); flushL(); flushQ(); var lv = Math.min(4, Math.max(2, h[1].length + (h[1].length === 1 ? 1 : 0))); out.push('<h' + lv + ' id="' + slugify(h[2]) + '">' + inline(h[2]) + '</h' + lv + '>'); }
      else if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { flushP(); flushL(); flushQ(); out.push('<hr>'); }
      else if (u || o) { flushP(); flushQ(); var t = u ? 'ul' : 'ol'; if (list !== t) { flushL(); out.push('<' + t + '>'); list = t; } out.push('<li>' + inline((u || o)[1]) + '</li>'); }
      else if (q) { flushP(); flushL(); quote.push(q[1]); }
      else if (!ln.trim()) { flushP(); flushL(); flushQ(); }
      else { flushL(); flushQ(); para.push(ln.trim()); }
    });
    flushP(); flushL(); flushQ();
    return out.join('\n');
  };
})();
