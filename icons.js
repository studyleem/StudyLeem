/* StudyLeem icon helper: ic('book-open') -> inline SVG icon from /icons.svg */
window.ic=function(n,c){return '<svg class="ic'+(c?' '+c:'')+'" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/icons.svg#'+n+'"/></svg>';};
(function(){try{var st=document.createElement('style');st.textContent='.ic{vertical-align:-.15em;flex-shrink:0;display:inline-block}';document.head.appendChild(st);}catch(e){}})();

/* Subject tile cards (studyplus-style): spCard(href, classNum, subjectName, label) */
window.spTile=function(subject){
  var s=String(subject||'').toLowerCase(),i='book',g=['#2563eb','#1d4ed8'];
  if(/math|statistic|algebra|calcul/.test(s)){i='calculator';g=['#2563eb','#1e40af'];}
  else if(/physic/.test(s)){i='zap';g=['#6366f1','#4338ca'];}
  else if(/chem/.test(s)){i='flask';g=['#f97316','#c2410c'];}
  else if(/bio|zoolog|botan/.test(s)){i='leaf';g=['#16a34a','#15803d'];}
  else if(/comput|ict|program/.test(s)){i='laptop';g=['#0891b2','#0e7490'];}
  else if(/english|urdu|literat|lang/.test(s)){i='book-open';g=['#db2777','#9d174d'];}
  else if(/islam|pak|histor|geograph|civic|econom|educat|general/.test(s)){i='home';g=['#7c3aed','#5b21b6'];}
  return {icon:i,g1:g[0],g2:g[1]};
};
window.spCard=function(href,cls,subject,label,cover){
  var t=window.spTile(subject),e=function(x){return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  var img=cover?'<img class="sp-cover" src="'+e(cover)+'" alt="'+e(subject)+' cover" loading="lazy" onerror="this.parentNode.classList.remove(\'has-cover\');this.remove()">':'';
  return '<a href="'+href+'" class="sp-card"><div class="sp-tile'+(cover?' has-cover':'')+'" style="--g1:'+t.g1+';--g2:'+t.g2+'">'+img+window.ic(t.icon)+'<span class="sp-badge">Class '+e(cls)+'</span></div><div class="sp-cap"><small>'+e(label||'FBISE')+'</small><b>'+e(subject)+'</b></div></a>';
};
