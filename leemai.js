/* LeemAI v2 – Chat (with memory + photo), Quiz maker, Paper checker.
   PRIVACY: photos are compressed in the browser, kept only in memory and sent straight to /api/*.
   They are never saved in localStorage, IndexedDB, Firestore or on the StudyLeem server. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var slug = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''); };
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

  /* ───────────── shared context: class + subject ───────────── */
  var SSC = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 'English', 'Urdu', 'Islamiat', 'Pakistan Studies'];
  var HSSC = SSC.concat(['Economics', 'Statistics']);
  var SUBJECTS = { '9': SSC, '10': SSC, '11': HSSC, '12': HSSC };
  var QQ = {
    Physics: ["Define Newton's second law of motion", 'Difference between distance and displacement', "State Ohm's law and its limitations", 'What is the principle of a simple pendulum?'],
    Chemistry: ['What is chemical equilibrium?', 'Define buffer solution', 'Difference between ionic and covalent bonds', "What is Le Chatelier's principle?"],
    Biology: ['Explain osmosis with an example', 'Difference between mitosis and meiosis', 'What is the function of enzymes?', 'Describe the structure of DNA'],
    Mathematics: ['How to solve a quadratic equation by the quadratic formula?', 'State the Pythagoras theorem with an example', 'What is the difference between permutation and combination?', 'Explain the factorization of a³ + b³'],
    'Computer Science': ['What is the difference between RAM and ROM?', 'Explain the working of a logic gate (AND, OR, NOT)', 'What is an algorithm? Give an example', 'Define database and DBMS'],
    English: ['How do I write a good formal letter?', 'Difference between active and passive voice', 'How to write a précis step by step?', 'Explain direct and indirect speech with examples'],
    Urdu: ['خط لکھنے کا طریقہ بتائیں', 'مضمون نگاری کے اہم نکات کیا ہیں؟', 'تشبیہ اور استعارہ میں فرق', 'مرکب اضافی اور مرکب توصیفی کیا ہیں؟'],
    Islamiat: ['Explain the five pillars of Islam', 'What are the conditions of Salah?', 'Describe the importance of Hadith', 'Explain the Treaty of Hudaibiyah'],
    'Pakistan Studies': ['What was the Lahore Resolution 1940?', 'Explain the causes of the 1971 East Pakistan crisis', 'Describe the main features of the 1973 Constitution', 'Major rivers and climate regions of Pakistan'],
    Economics: ['Define demand and law of demand', 'Difference between micro and macroeconomics', 'What is inflation? Give its causes', 'Explain elasticity of demand'],
    Statistics: ['Difference between mean, median and mode', 'What is standard deviation?', 'Define probability with an example', 'Explain correlation and regression'],
    all: ['What is chemical equilibrium?', 'Define osmosis', "State Newton's laws of motion", 'Explain the quadratic formula']
  };
  var ctx = LS.get('sl_ctx', { cls: '10', subject: 'all' });
  if (!SUBJECTS[ctx.cls]) ctx.cls = '10';

  function fillSubjects() {
    var sel = $('ctxSubject'), list = SUBJECTS[ctx.cls];
    sel.innerHTML = '<option value="all">All subjects</option>' + list.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
    if (ctx.subject !== 'all' && list.indexOf(ctx.subject) < 0) ctx.subject = 'all';
    sel.value = ctx.subject;
  }
  function onCtx() {
    LS.set('sl_ctx', ctx);
    renderQuick(); loadChapters();
  }
  $('ctxClass').value = ctx.cls; fillSubjects();
  $('ctxClass').addEventListener('change', function () { ctx.cls = this.value; fillSubjects(); onCtx(); });
  $('ctxSubject').addEventListener('change', function () { ctx.subject = this.value; onCtx(); });

  /* ───────────── tabs ───────────── */
  var TABS = { chat: 'panelChat', quiz: 'panelQuiz', checker: 'panelCheck' };
  function showTab(name, noHash) {
    if (!TABS[name]) name = 'chat';
    Object.keys(TABS).forEach(function (k) { $(TABS[k]).classList.toggle('active', k === name); });
    document.querySelectorAll('.lm-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); b.setAttribute('aria-selected', b.dataset.tab === name); });
    if (!noHash) { try { history.replaceState(null, '', '#' + name); } catch (_) {} }
    if (name === 'quiz') loadChapters();
  }
  document.querySelectorAll('.lm-tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
  window.addEventListener('hashchange', function () { showTab(location.hash.slice(1), true); });

  /* ───────────── image helper (compress in browser, memory only) ───────────── */
  function loadImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('This image type is not supported. Please use a JPG or PNG photo.')); };
      im.src = url;
    });
  }
  function compress(file, maxDim, q) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) return Promise.reject(new Error('Please choose an image file.'));
    return loadImg(file).then(function (im) {
      var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, maxDim / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    });
  }
  var b64 = function (d) { return d.replace(/^data:image\/jpeg;base64,/, ''); };

  function api(path, payload) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          if (!d) throw new Error(r.status === 404 ? 'LeemAI service not found (HTTP 404). Check that the /api folder is deployed.' : 'Unexpected server response (HTTP ' + r.status + '). Please try again.');
          if (!r.ok) throw new Error(d.detail || 'Something went wrong. Please try again.');
          return d;
        });
      }, function () { throw new Error('Could not connect to LeemAI. Please check your internet connection.'); });
  }

  /* ═════════════════════════ CHAT ═════════════════════════ */
  var hist = [], chatImg = null, busy = false;
  var input = $('chatInput');

  function renderQuick() {
    var list = QQ[ctx.subject] || QQ.all;
    var html = list.map(function (q) { return '<button class="quick-q" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
    $('quickQs').innerHTML = html;
    var w = $('welcomeChips'); if (w) w.innerHTML = list.map(function (q) { return '<button class="welcome-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
    var t = $('welcomeCtx'); if (t) t.textContent = (ctx.subject === 'all' ? 'Class ' + ctx.cls + ' · all subjects' : 'Class ' + ctx.cls + ' · ' + ctx.subject);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-q]');
    if (b) { input.value = b.dataset.q; showTab('chat'); sendMessage(); }
  });

  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  $('sendBtn').addEventListener('click', sendMessage);

  $('chatAttach').addEventListener('click', function () { $('chatFile').click(); });
  $('chatFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    compress(f, 1400, 0.78).then(function (d) {
      chatImg = d; $('chatPrevImg').src = d; $('chatPreview').classList.add('on');
    }, function (err) { alert(err.message); });
  });
  $('chatPrevClear').addEventListener('click', clearChatImg);
  function clearChatImg() { chatImg = null; $('chatPrevImg').removeAttribute('src'); $('chatPreview').classList.remove('on'); }

  $('newChat').addEventListener('click', function () {
    hist = []; clearChatImg();
    $('chatMessages').innerHTML = welcomeHtml(); renderQuick();
  });
  function welcomeHtml() {
    return '<div class="welcome-state" id="welcomeState"><div class="welcome-icon-wrap">' + ic('bot') + '</div>' +
      '<h2>Hello! I\'m LeemAI</h2><p>Your AI tutor for the FBISE syllabus — <strong id="welcomeCtx"></strong>. Ask in English, Urdu or Roman Urdu, or attach a photo of a question.</p>' +
      '<div class="welcome-chips" id="welcomeChips"></div></div>';
  }

  function fmt(text) {
    var lines = esc(text).split('\n'), out = '', list = '', para = [];
    var inline = function (s) {
      return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    };
    var flushP = function () { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    var flushL = function () { if (list) { out += '</' + list + '>'; list = ''; } };
    lines.forEach(function (ln) {
      var u = ln.match(/^\s*(?:[-*•])\s+(.*)$/), o = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (u || o) { flushP(); var t = u ? 'ul' : 'ol'; if (list !== t) { flushL(); out += '<' + t + '>'; list = t; } out += '<li>' + inline((u || o)[1]) + '</li>'; }
      else if (!ln.trim()) { flushP(); flushL(); }
      else { flushL(); para.push(ln); }
    });
    flushP(); flushL();
    return out || '<p></p>';
  }

  function addMsg(role, html) {
    var box = $('chatMessages'), row = document.createElement('div');
    row.className = 'msg-row ' + role;
    row.innerHTML = '<div class="msg-avatar">' + (role === 'user' ? 'U' : ic('bot')) + '</div><div class="msg-content"><div class="msg-bubble">' + html + '</div></div>';
    box.appendChild(row); box.scrollTop = box.scrollHeight; return row;
  }
  function typing() { return addMsg('ai', '<div class="typing-dots"><span></span><span></span><span></span></div>'); }

  function sendMessage() {
    if (busy) return;
    var q = input.value.trim();
    if (!q && !chatImg) return;
    var w = $('welcomeState'); if (w) w.remove();
    var img = chatImg;
    addMsg('user', (img ? '<img class="chat-img" src="' + img + '" alt="Your question photo">' : '') + esc(q || 'Please solve the question in this photo.'));
    input.value = ''; input.style.height = 'auto'; clearChatImg();
    busy = true; $('sendBtn').disabled = true;
    var t = typing();
    api('/api/ask', { question: q, image: img ? b64(img) : undefined, class: ctx.cls, subject: ctx.subject, history: hist.slice(-8) })
      .then(function (d) {
        t.remove(); addMsg('ai', fmt(d.answer));
        hist.push({ role: 'user', text: q || '(photo question)' }, { role: 'ai', text: d.answer });
      })
      .catch(function (err) { t.remove(); addMsg('ai', esc(err.message)); })
      .then(function () { busy = false; $('sendBtn').disabled = false; input.focus(); });
  }
  window.sendMessage = sendMessage;

  $('sidebarToggle').addEventListener('click', function () { $('chatSidebar').classList.toggle('open'); });

  /* ═════════════════════════ QUIZ ═════════════════════════ */
  var quiz = null, qi = 0, answers = [], qStart = 0, qTimer = null, lastQuestions = LS.get('sl_quiz_recent', []);
  var LETTERS = ['A', 'B', 'C', 'D'];
  var qView = function (name) { ['quizSetup', 'quizLoad', 'quizRun', 'quizDone'].forEach(function (id) { $(id).hidden = id !== name; }); $('panelQuiz').scrollTop = 0; };

  function whenDB() {
    if (window.DB) return Promise.resolve();
    return new Promise(function (res) { var done = false; var f = function () { if (!done) { done = true; res(); } }; window.addEventListener('firebase-ready', f, { once: true }); setTimeout(f, 6000); });
  }
  function loadChapters() {
    var dl = $('chapterList'); dl.innerHTML = '';
    if (ctx.subject === 'all') return;
    var mine = ctx.cls + '|' + ctx.subject;
    whenDB().then(function () {
      if (!window.DB) return;
      return DB.getBySubjectSlug(ctx.cls, slug(ctx.subject), 'notes').then(function (items) {
        if (mine !== ctx.cls + '|' + ctx.subject) return;
        var seen = {}, opts = [];
        items.filter(function (m) { return m.contentType !== 'exercise' && m.chapterNumber != null; })
          .sort(function (a, b) { return (a.chapterNumber || 0) - (b.chapterNumber || 0); })
          .forEach(function (m) { var l = 'Chapter ' + m.chapterNumber + (m.chapterTitle ? ': ' + m.chapterTitle : ''); if (!seen[l]) { seen[l] = 1; opts.push(l); } });
        dl.innerHTML = opts.map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join('');
      });
    }).catch(function () {});
  }

  function showSetupErr(msg) { var e = $('quizErr'); e.textContent = msg || ''; e.hidden = !msg; }

  function renderHistory() {
    var h = LS.get('sl_quiz_hist', []);
    $('quizHist').innerHTML = h.length ? '<div class="hist"><h4>Your recent quizzes (saved on this device)</h4>' + h.slice(0, 6).map(function (x) {
      return '<div class="hist-row"><span>Class ' + esc(x.cls) + ' · <b>' + esc(x.subject) + '</b>' + (x.chapter ? ' · ' + esc(x.chapter.slice(0, 30)) : '') + '</span><span><b>' + x.score + '/' + x.total + '</b> · ' + esc(x.date) + '</span></div>';
    }).join('') + '</div>' : '';
  }

  function startQuiz(opts) {
    opts = opts || {};
    if (ctx.subject === 'all') { showSetupErr('Please select a subject in the bar above first.'); qView('quizSetup'); return; }
    showSetupErr('');
    var payload = {
      action: 'generate', class: ctx.cls, subject: ctx.subject,
      chapter: opts.chapter != null ? opts.chapter : $('qChapter').value.trim(),
      count: parseInt($('qCount').value, 10), difficulty: opts.difficulty || $('qLevel').value, lang: $('qLang').value,
      avoid: lastQuestions.slice(-20)
    };
    $('qLoadTxt').textContent = 'Building your Class ' + ctx.cls + ' ' + ctx.subject + ' quiz…';
    qView('quizLoad');
    api('/api/quiz', payload).then(function (d) {
      quiz = d; qi = 0; answers = new Array(d.questions.length).fill(-1); qStart = Date.now();
      lastQuestions = lastQuestions.concat(d.questions.map(function (x) { return x.q.slice(0, 80); })).slice(-40); LS.set('sl_quiz_recent', lastQuestions);
      clearInterval(qTimer); qTimer = setInterval(tick, 1000);
      qView('quizRun'); drawQ();
    }).catch(function (err) { showSetupErr(err.message); qView('quizSetup'); });
  }
  $('qStart').addEventListener('click', function () { startQuiz(); });

  function tick() { var s = Math.floor((Date.now() - qStart) / 1000), el = $('qTime'); if (el) el.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function drawQ() {
    var q = quiz.questions[qi], n = quiz.questions.length;
    $('qNum').textContent = 'Question ' + (qi + 1) + ' of ' + n;
    $('qTopic').textContent = q.topic || '';
    $('qBar').style.width = ((qi + 1) / n * 100) + '%';
    $('qText').textContent = q.q;
    $('qOpts').innerHTML = q.options.map(function (o, i) {
      return '<button class="qz-opt' + (answers[qi] === i ? ' sel' : '') + '" data-i="' + i + '"><b>' + LETTERS[i] + '</b><span>' + esc(o) + '</span></button>';
    }).join('');
    $('qPrev').disabled = qi === 0;
    $('qNext').textContent = qi === n - 1 ? 'Finish quiz' : 'Next';
    $('qDots').innerHTML = quiz.questions.map(function (_, i) { return '<button data-go="' + i + '" class="' + (answers[i] >= 0 ? 'done ' : '') + (i === qi ? 'cur' : '') + '" aria-label="Go to question ' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('');
  }
  $('qOpts').addEventListener('click', function (e) { var b = e.target.closest('.qz-opt'); if (!b) return; answers[qi] = +b.dataset.i; drawQ(); });
  $('qDots').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) { qi = +b.dataset.go; drawQ(); } });
  $('qPrev').addEventListener('click', function () { if (qi > 0) { qi--; drawQ(); } });
  $('qNext').addEventListener('click', function () {
    if (qi < quiz.questions.length - 1) { qi++; drawQ(); return; }
    var left = answers.filter(function (a) { return a < 0; }).length;
    if (left && !confirm(left + ' question' + (left > 1 ? 's are' : ' is') + ' unanswered. Finish the quiz anyway?')) return;
    finishQuiz();
  });
  $('qQuit').addEventListener('click', function () { if (confirm('Quit this quiz? Your progress will be lost.')) { clearInterval(qTimer); qView('quizSetup'); } });
  document.addEventListener('keydown', function (e) {
    if ($('quizRun').hidden || !$('panelQuiz').classList.contains('active') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase(), i = '1234'.indexOf(k); if (i < 0) i = 'abcd'.indexOf(k);
    if (i >= 0 && i < 4) { answers[qi] = i; drawQ(); }
    else if (e.key === 'ArrowRight') { $('qNext').click(); } else if (e.key === 'ArrowLeft') { $('qPrev').click(); }
  });

  var lastResult = null;
  function finishQuiz() {
    clearInterval(qTimer);
    var secs = Math.floor((Date.now() - qStart) / 1000), n = quiz.questions.length;
    var results = quiz.questions.map(function (q, i) {
      return { topic: q.topic, q: q.q, correct: answers[i] === q.answer, skipped: answers[i] < 0, chosen: answers[i] >= 0 ? q.options[answers[i]] : '', right: q.options[q.answer] };
    });
    var score = results.filter(function (r) { return r.correct; }).length, pct = Math.round(score / n * 100);
    lastResult = { results: results, score: score, total: n, pct: pct, secs: secs };
    var h = LS.get('sl_quiz_hist', []); h.unshift({ cls: quiz.class, subject: quiz.subject, chapter: quiz.chapter, score: score, total: n, date: new Date().toLocaleDateString() }); LS.set('sl_quiz_hist', h.slice(0, 20));
    drawResult(); qView('quizDone');

    // AI feedback: score review + suggestions
    $('aiFb').innerHTML = '<div class="lm-loading" style="padding:1.2rem"><div class="lm-spin"></div>LeemAI is reviewing your quiz…</div>';
    api('/api/quiz', { action: 'review', class: quiz.class, subject: quiz.subject, chapter: quiz.chapter, lang: $('qLang').value, seconds: secs, results: results.map(function (r) { return { topic: r.topic, q: r.q, correct: r.correct, skipped: r.skipped, chosen: r.chosen, right: r.right }; }) })
      .then(drawFeedback).catch(function (err) {
        $('aiFb').innerHTML = '<div class="lm-err">' + esc(err.message) + ' <button class="lm-btn" id="fbRetry" style="padding:.3rem .7rem">Retry</button></div>';
        var rb = $('fbRetry'); if (rb) rb.onclick = finishReviewRetry;
      });
  }
  function finishReviewRetry() {
    $('aiFb').innerHTML = '<div class="lm-loading" style="padding:1.2rem"><div class="lm-spin"></div>LeemAI is reviewing your quiz…</div>';
    var r = lastResult;
    api('/api/quiz', { action: 'review', class: quiz.class, subject: quiz.subject, chapter: quiz.chapter, lang: $('qLang').value, seconds: r.secs, results: r.results }).then(drawFeedback)
      .catch(function (err) { $('aiFb').innerHTML = '<div class="lm-err">' + esc(err.message) + '</div>'; });
  }

  function drawResult() {
    var r = lastResult, color = r.pct >= 70 ? '#16a34a' : r.pct >= 40 ? '#f59e0b' : '#dc2626';
    var skipped = r.results.filter(function (x) { return x.skipped; }).length, wrong = r.total - r.score - skipped;
    var mm = Math.floor(r.secs / 60) + ':' + ('0' + (r.secs % 60)).slice(-2);
    var msg = r.pct >= 80 ? 'Excellent work!' : r.pct >= 60 ? 'Good job – keep going!' : r.pct >= 40 ? 'Not bad – let\'s improve it.' : 'Don\'t worry – practice makes perfect.';
    $('quizScore').innerHTML =
      '<div class="sc-top"><div class="sc-ring" style="--p:' + r.pct + ';--c:' + color + '"><div><strong>' + r.pct + '%</strong><span>' + r.score + ' / ' + r.total + '</span></div></div>' +
      '<div class="sc-meta"><h2>' + msg + '</h2><div class="lm-note">Class ' + esc(quiz.class) + ' · ' + esc(quiz.subject) + (quiz.chapter ? ' · ' + esc(quiz.chapter) : '') + '</div>' +
      '<div class="sc-pills"><span class="sc-pill g">✓ ' + r.score + ' correct</span><span class="sc-pill r">✗ ' + wrong + ' wrong</span>' + (skipped ? '<span class="sc-pill o">' + skipped + ' skipped</span>' : '') + '<span class="sc-pill">⏱ ' + mm + '</span></div></div></div>';
    drawReview('all');
    var wt = weakTopics();
    $('quizActions').innerHTML = (wt.length ? '<button class="lm-btn primary" id="actWeak">Practise weak topics</button>' : '') +
      '<button class="lm-btn' + (wt.length ? '' : ' primary') + '" id="actAgain">New quiz</button>' +
      '<a class="lm-btn" href="/fbise/notes/' + esc(quiz.class) + '/' + slug(quiz.subject) + '">Open ' + esc(quiz.subject) + ' notes</a>' +
      '<button class="lm-btn" id="actSetup">Change settings</button>';
    if ($('actWeak')) $('actWeak').onclick = function () { startQuiz({ chapter: wt.join(', '), difficulty: 'mixed' }); };
    $('actAgain').onclick = function () { startQuiz({ chapter: quiz.chapter }); };
    $('actSetup').onclick = function () { qView('quizSetup'); renderHistory(); };
  }
  function weakTopics() {
    var m = {}; lastResult.results.forEach(function (r) { if (!r.correct) m[r.topic] = (m[r.topic] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 3);
  }
  function drawFeedback(d) {
    var h = '<h3>' + ic('sparkles') + ' LeemAI review &amp; suggestions</h3>';
    if (d.summary) h += '<p style="font-size:.92rem;line-height:1.65">' + esc(d.summary) + '</p>';
    if (d.strengths && d.strengths.length) h += '<h4 style="margin:.6rem 0 .2rem;font-size:.85rem">What you did well</h4><ul>' + d.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (d.weak_topics && d.weak_topics.length) h += '<h4 style="margin:.6rem 0 .3rem;font-size:.85rem">Focus on these topics</h4>' + d.weak_topics.map(function (w) { return '<div class="tipbox"><b>' + esc(w.topic) + ':</b> ' + esc(w.tip) + '</div>'; }).join('');
    if (d.study_plan && d.study_plan.length) h += '<h4 style="margin:.6rem 0 .2rem;font-size:.85rem">Your study plan</h4><ul>' + d.study_plan.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (d.next_quiz && d.next_quiz.focus) h += '<p class="lm-note">Next quiz suggestion: <b>' + esc(d.next_quiz.difficulty) + '</b> level on <b>' + esc(d.next_quiz.focus) + '</b>.</p>';
    if (d.encouragement) h += '<div class="enc">' + esc(d.encouragement) + '</div>';
    $('aiFb').innerHTML = h;
  }
  function drawReview(filter) {
    var r = lastResult;
    $('reviewList').innerHTML = quiz.questions.map(function (q, i) {
      var res = r.results[i]; if (filter === 'wrong' && res.correct) return '';
      var cls = res.correct ? 'ok' : res.skipped ? 'skip' : 'bad';
      return '<div class="rv-item ' + cls + '"><div class="rv-q">' + (i + 1) + '. ' + esc(q.q) + '</div>' +
        q.options.map(function (o, k) { var c = k === q.answer ? 'right' : (k === answers[i] ? 'wrong' : ''); return '<div class="rv-opt ' + c + '">' + LETTERS[k] + '. ' + esc(o) + (k === q.answer ? ' ✓' : k === answers[i] ? ' ✗ (your answer)' : '') + '</div>'; }).join('') +
        (res.skipped ? '<div class="lm-note">You skipped this question.</div>' : '') +
        (q.explanation ? '<div class="rv-exp"><b>Why:</b> ' + esc(q.explanation) + '</div>' : '') +
        (!res.correct ? '<div class="rv-actions"><button data-explain="' + i + '">Ask LeemAI to explain more</button></div>' : '') + '</div>';
    }).join('') || '<p class="lm-note">Perfect score – no wrong answers to review! 🎉</p>';
  }
  document.querySelectorAll('[data-rvf]').forEach(function (b) { b.addEventListener('click', function () { document.querySelectorAll('[data-rvf]').forEach(function (x) { x.classList.remove('primary'); }); b.classList.add('primary'); drawReview(b.dataset.rvf); }); });
  $('reviewList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-explain]'); if (!b) return;
    var q = quiz.questions[+b.dataset.explain];
    input.value = 'Explain this MCQ in detail: "' + q.q + '" Options: ' + q.options.map(function (o, i) { return LETTERS[i] + ') ' + o; }).join('; ') + '. The correct answer is ' + LETTERS[q.answer] + '. Why is it correct and why are the others wrong?';
    showTab('chat'); sendMessage();
  });

  /* ═════════════════════════ PAPER CHECKER ═════════════════════════ */
  var ans = [], qp = [];   // [{file, url}] – memory only
  function drawThumbs() {
    var one = function (arr, id, kind) {
      $(id).innerHTML = arr.map(function (x, i) { return '<div class="lm-th"><img src="' + x.url + '" alt="Page ' + (i + 1) + '"><button data-rm="' + kind + i + '" aria-label="Remove photo">×</button><span>' + (kind === 'a' ? 'Page ' : 'Paper ') + (i + 1) + '</span></div>'; }).join('');
    };
    one(ans, 'ansThumbs', 'a'); one(qp, 'qpThumbs', 'q');
  }
  function addFiles(files, arr, max) {
    var list = Array.prototype.slice.call(files).slice(0, max - arr.length);
    if (files.length > list.length) alert('You can add up to ' + max + ' photos here.');
    return Promise.all(list.map(function (f) { return compress(f, 1500, 0.78).then(function (u) { arr.push({ file: f, url: u }); }, function (e) { alert(e.message); }); })).then(drawThumbs);
  }
  function wireDrop(dropId, inputId, arr, max) {
    var d = $(dropId), f = $(inputId);
    d.addEventListener('click', function () { f.click(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } });
    f.addEventListener('change', function () { addFiles(f.files, arr, max); f.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove('over'); }); });
    d.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files, arr, max); });
  }
  wireDrop('ansDrop', 'ansFile', ans, 4); wireDrop('qpDrop', 'qpFile', qp, 2);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rm]'); if (!b) return;
    var kind = b.dataset.rm[0], i = +b.dataset.rm.slice(1); (kind === 'a' ? ans : qp).splice(i, 1); drawThumbs();
  });
  function ckErr(m) { var e = $('ckErr'); e.textContent = m || ''; e.hidden = !m; }
  function totalLen(a) { return a.reduce(function (n, s) { return n + s.length; }, 0); }

  $('ckGo').addEventListener('click', function () {
    ckErr('');
    if (ctx.subject === 'all') return ckErr('Please select your subject in the bar above.');
    var total = Number($('ckMarks').value);
    if (!total || total < 1 || total > 200) return ckErr('Please enter the total marks of the paper (1–200).');
    if (!ans.length) return ckErr('Please upload at least one photo of your answer sheet.');
    $('ckGo').disabled = true; $('ckForm').hidden = true; $('ckLoad').hidden = false; $('ckResult').hidden = true;
    var make = function (dim, q) {
      return Promise.all(ans.concat(qp).map(function (x) { return compress(x.file, dim, q); })).then(function (all) { return { a: all.slice(0, ans.length).map(b64), q: all.slice(ans.length).map(b64) }; });
    };
    make(1500, 0.78).then(function (p) { return totalLen(p.a.concat(p.q)) > 3600000 ? make(1100, 0.6) : p; })
      .then(function (p) {
        if (totalLen(p.a.concat(p.q)) > 3900000) throw new Error('The photos are too large. Use fewer pages or retake them closer and well-lit.');
        return api('/api/check', { class: ctx.cls, subject: ctx.subject, totalMarks: total, strictness: $('ckStrict').value, lang: $('ckLang').value, questionText: $('ckQText').value, markingScheme: $('ckScheme').value, answerImages: p.a, questionImages: p.q });
      })
      .then(drawCheck)
      .catch(function (err) { $('ckLoad').hidden = true; $('ckForm').hidden = false; ckErr(err.message); })
      .then(function () { $('ckGo').disabled = false; });
  });

  function drawCheck(d) {
    $('ckLoad').hidden = true; $('ckResult').hidden = false; $('panelCheck').scrollTop = 0;
    var pct = Math.min(100, Math.round(d.percentage)), color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626';
    var VL = { correct: 'Correct', partial: 'Partly correct', incorrect: 'Incorrect', unreadable: 'Unreadable', not_attempted: 'Not attempted' };
    var h = '<div class="lm-card"><div class="sc-top"><div class="sc-ring" style="--p:' + pct + ';--c:' + color + '"><div><strong>' + d.obtained + '</strong><span>out of ' + d.total + '</span></div></div>' +
      '<div class="sc-meta"><h2>' + d.percentage + '% · Grade ' + esc(d.grade) + '</h2><div class="lm-note">Class ' + esc(ctx.cls) + ' · ' + esc(ctx.subject) + ' · approximate FBISE grade band</div>' +
      '<div class="sc-pills"><span class="sc-pill g">' + d.questions.filter(function (q) { return q.verdict === 'correct'; }).length + ' correct</span><span class="sc-pill o">' + d.questions.filter(function (q) { return q.verdict === 'partial'; }).length + ' partial</span><span class="sc-pill r">' + d.questions.filter(function (q) { return q.verdict === 'incorrect' || q.verdict === 'not_attempted'; }).length + ' wrong / skipped</span></div></div></div>' +
      (d.note ? '<p class="lm-note" style="margin-top:.8rem">ℹ️ ' + esc(d.note) + '</p>' : '') + '<p class="lm-note" style="margin-top:.5rem">' + esc(d.disclaimer) + '</p></div>';
    h += '<div class="lm-card"><h3>Question-wise marking</h3>' + d.questions.map(function (q) {
      return '<div class="ck-item ' + q.verdict + '"><div class="ck-h"><b>' + esc(q.label) + (q.question ? ' <span style="font-weight:500;color:var(--text-light)">– ' + esc(q.question) + '</span>' : '') + '</b><span class="ck-marks">' + q.marks_awarded + ' / ' + q.marks_max + '</span></div>' +
        '<div class="lm-note" style="margin-bottom:.2rem">' + (VL[q.verdict] || '') + '</div>' +
        (q.feedback ? '<p>' + esc(q.feedback) + '</p>' : '') +
        (q.mistakes.length ? '<ul>' + q.mistakes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        (q.model_answer ? '<details><summary>Show model answer</summary><div>' + esc(q.model_answer) + '</div></details>' : '') + '</div>';
    }).join('') + '</div>';
    var list = function (t, a) { return a.length ? '<h4 style="margin:.7rem 0 .2rem;font-size:.88rem">' + t + '</h4><ul style="margin:0 0 .4rem 1.1rem;font-size:.9rem;line-height:1.6">' + a.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : ''; };
    h += '<div class="lm-card ai-fb"><h3>' + ic('sparkles') + ' Suggestions from LeemAI</h3>' + list('Strengths', d.strengths) + list('How to improve', d.improvements) + list('Presentation tips', d.presentation_tips) + list('Revise next', d.study_next) + '</div>';
    h += '<div class="lm-row"><button class="lm-btn primary" id="ckAgain">Check another paper</button><button class="lm-btn" id="ckClear">Clear photos from this device</button></div>';
    $('ckResult').innerHTML = h;
    $('ckAgain').onclick = function () { $('ckResult').hidden = true; $('ckForm').hidden = false; };
    $('ckClear').onclick = function () { ans.length = 0; qp.length = 0; drawThumbs(); $('ckResult').hidden = true; $('ckForm').hidden = false; };
  }

  /* ───────────── init ───────────── */
  $('chatMessages').innerHTML = welcomeHtml();
  renderQuick(); renderHistory(); qView('quizSetup');
  showTab((location.hash || '#chat').slice(1), true);
  var mm = $('mobileMenuBtn'); if (mm) mm.addEventListener('click', function () { $('mobileMenu').classList.toggle('active'); });
})();
