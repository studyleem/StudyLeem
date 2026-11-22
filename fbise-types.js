/* /fbise landing page: add a card for every material type found in the data (Main Exercise, MCQs Explanation, ...). */
document.addEventListener('DOMContentLoaded', async () => {
  const box = document.getElementById('typeCards');
  if (!box || typeof DB === 'undefined') return;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  try {
    const types = (await DB.getTypes()).filter(t => t.slug !== 'notes' && t.slug !== 'books');
    box.insertAdjacentHTML('beforeend', types.map(t =>
      `<a href="/fbise/${esc(t.slug)}" class="class-card"><div class="class-icon">${esc(t.label.charAt(0).toUpperCase())}</div><h3>FBISE ${esc(t.label)}</h3><p>${t.count} file${t.count === 1 ? '' : 's'} for Class 9 to 12</p></a>`).join(''));
  } catch (e) { console.warn(e); }
});
