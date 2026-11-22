/* Admin: blog posts (collection blogPosts). Uses Blog from firebase-client.js and mdToHtml from blog-md.js. */
let allBlog = [];
const $b = id => document.getElementById(id);

async function loadBlog() {
  const tb = $b('blogTableBody');
  try {
    tb.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';
    allBlog = await Blog.listAll();
    renderBlog(allBlog);
  } catch (e) { tb.innerHTML = `<tr><td colspan="6" class="loading">Error: ${escHtml(e.message)}</td></tr>`; }
}
function renderBlog(list) {
  const tb = $b('blogTableBody');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="6" class="loading">No posts yet. The first automatic article arrives with the next weekly run, or click "+ New post".</td></tr>'; return; }
  tb.innerHTML = list.map(p => {
    const d = p.publishedAt || p.createdAt, date = d ? new Date(d).toLocaleDateString('en-GB') : '—', pub = p.status === 'published';
    return `<tr>
      <td style="max-width:280px">${escHtml(p.title)}<div style="font-size:.74rem;color:#94a3b8">/blog/${escHtml(p.slug)}</div></td>
      <td>${escHtml(p.category || '')}</td>
      <td><span style="font-weight:600;color:${pub ? '#16a34a' : '#d97706'}">${pub ? 'Published' : 'Draft'}</span></td>
      <td>${p.source === 'auto-blog' ? 'AI (auto)' : 'Admin'}</td>
      <td>${date}</td>
      <td><div class="table-actions">
        <button class="btn btn-secondary btn-sm" onclick="editBlog('${p.slug}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleBlog('${p.slug}')">${pub ? 'Unpublish' : 'Publish'}</button>
        <a class="btn btn-secondary btn-sm" href="/blog/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">View</a>
        <button class="btn btn-danger btn-sm" onclick="deleteBlog('${p.slug}')">Delete</button>
      </div></td></tr>`;
  }).join('');
}
function filterBlog() {
  const q = $b('searchBlog').value.toLowerCase(), s = $b('filterBlogStatus').value;
  renderBlog(allBlog.filter(p => (!s || p.status === s) && (!q || (p.title + ' ' + p.slug + ' ' + (p.category || '')).toLowerCase().includes(q))));
}
function openBlogModal(p) {
  const isNew = !p;
  $b('blogModalTitle').textContent = isNew ? 'New post' : 'Edit post';
  $b('blogIsNew').value = isNew ? '1' : '';
  $b('blogHadPub').value = p && p.publishedAt ? '1' : '';
  $b('blogTitle').value = p ? p.title : '';
  $b('blogSlug').value = p ? p.slug : ''; $b('blogSlug').readOnly = !isNew;
  const cat = $b('blogCategory'), c = p && p.category;
  if (c && ![...cat.options].some(o => o.value === c)) cat.add(new Option(c, c));
  cat.value = c || 'Study Tips';
  $b('blogStatus').value = p ? p.status : 'published';
  $b('blogExcerpt').value = p ? (p.excerpt || '') : '';
  $b('blogMeta').value = p ? (p.metaDescription || '') : '';
  $b('blogKeywords').value = p ? (p.keywords || '') : '';
  $b('blogContent').value = p ? (p.content || '') : '';
  $b('blogPreview').style.display = 'none'; $b('blogMsg').textContent = '';
  $b('blogModal').classList.add('active');
}
window.editBlog = slug => openBlogModal(allBlog.find(x => x.slug === slug));
window.toggleBlog = async slug => {
  const p = allBlog.find(x => x.slug === slug); if (!p) return;
  const to = p.status === 'published' ? 'draft' : 'published';
  if (!confirm(`${to === 'published' ? 'Publish' : 'Unpublish'} "${p.title}"?`)) return;
  try { await Blog.save(slug, { ...p, status: to, hadPublishedAt: !!p.publishedAt }, false); await loadBlog(); } catch (e) { alert(e.message); }
};
window.deleteBlog = async slug => {
  const p = allBlog.find(x => x.slug === slug); if (!p || !confirm(`Delete "${p.title}" permanently?`)) return;
  try { await Blog.remove(slug); await loadBlog(); } catch (e) { alert(e.message); }
};

$b('newBlogBtn').onclick = () => openBlogModal(null);
$b('searchBlog').oninput = filterBlog;
$b('filterBlogStatus').onchange = filterBlog;
$b('closeBlogModal').onclick = $b('closeBlogModal2').onclick = () => closeModal('blogModal');
$b('blogTitle').addEventListener('input', () => { if ($b('blogIsNew').value && !$b('blogSlug').dataset.touched) $b('blogSlug').value = toSlug($b('blogTitle').value).slice(0, 80); });
$b('blogSlug').addEventListener('input', () => { $b('blogSlug').dataset.touched = '1'; });
$b('blogPreviewBtn').onclick = () => {
  const box = $b('blogPreview'); box.innerHTML = mdToHtml($b('blogContent').value);
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};
$b('blogForm').onsubmit = async e => {
  e.preventDefault();
  const btn = $b('blogSaveBtn'), msg = $b('blogMsg'); btn.disabled = true; msg.textContent = 'Saving…';
  try {
    await Blog.save($b('blogSlug').value.trim(), {
      title: $b('blogTitle').value, category: $b('blogCategory').value, status: $b('blogStatus').value, excerpt: $b('blogExcerpt').value,
      metaDescription: $b('blogMeta').value, keywords: $b('blogKeywords').value, content: $b('blogContent').value, hadPublishedAt: !!$b('blogHadPub').value
    }, !!$b('blogIsNew').value);
    closeModal('blogModal'); await loadBlog();
  } catch (err) { msg.textContent = err.message; msg.style.color = '#dc2626'; }
  btn.disabled = false;
};
