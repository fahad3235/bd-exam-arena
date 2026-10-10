/* BD Exam Arena — app: screens, quiz engine, mock timer, review, analytics, history. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const App = {
  lang: 'en',
  sess: null,       // active session
  timerId: null,
  drillSel: { subject: null, topic: null },

  t(k){ return I18N[this.lang][k] ?? k; },

  async init(){
    this.lang = Data.store.settings.lang || 'en';
    document.documentElement.lang = this.lang === 'bn' ? 'bn' : 'en';
    this.bindUI();
    this.applyLang();
    try{
      await Data.loadManifest();
      await Data.loadAll();
      Data.store.qcount = Data.totalQuestions();
      saveStore(Data.store);
    }catch(e){
      console.error('question load failed', e);
    }
    this.renderHome();
    this.show('home');
  },

  bindUI(){
    $('#langToggle').onclick = () => {
      this.lang = this.lang === 'en' ? 'bn' : 'en';
      Data.store.settings.lang = this.lang;
      saveStore(Data.store);
      document.documentElement.lang = this.lang === 'bn' ? 'bn' : 'en';
      this.applyLang(); this.renderHome();
      if (this.sess) this.renderQuestion();
    };
    $$('#mainTabs button').forEach(b => b.onclick = () => this.show(b.dataset.screen));
    $$('[data-goto]').forEach(b => b.onclick = () => this.show(b.dataset.goto));
    $('#btnQuick').onclick = () => this.startQuick();
    $('#btnDrill').onclick = () => this.show('drill');
    $('#btnMock').onclick = () => this.show('mocksetup');
    $('#btnStartMock').onclick = () => this.startMock();
    $('#btnStartDrill').onclick = () => this.startDrill();
    $('#btnPrevQ').onclick = () => this.move(-1);
    $('#btnNextQ').onclick = () => this.move(1);
    $('#btnFlag').onclick = () => this.toggleFlag();
    $('#btnSubmitQuiz').onclick = () => this.finish(true);
    $('#btnPaletteToggle').onclick = () => $('#qPalette').classList.toggle('hidden');
    $('#btnReview').onclick = () => this.showReview('all');
    $$('#reviewFilter .chip').forEach(c => c.onclick = () => {
      $$('#reviewFilter .chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      this.showReview(c.dataset.f);
    });
    $('#btnExport').onclick = () => this.exportData();
    $('#btnImport').onclick = () => $('#importFile').click();
    $('#importFile').onchange = e => this.importData(e.target.files[0]);
    this.buildDrillSubjects();
  },

  applyLang(){
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      const v = this.t(k);
      if (typeof v === 'string') el.innerHTML = v;
    });
    $('#langToggle').textContent = this.lang === 'en' ? 'বাংলা' : 'English';
    $('#brandName').textContent = this.lang === 'bn' ? 'বিডি এক্সাম অ্যারেনা' : 'BD Exam Arena';
    $('#brandTag').textContent = this.t('brandTag');
    this.updateXP();
  },

  show(name){
    this.stopTimer();
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-'+name).classList.add('active');
    $$('#mainTabs button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
    if (name === 'home') this.renderHome();
    if (name === 'analytics') this.renderAnalytics();
    if (name === 'history') this.renderHistory();
    window.scrollTo(0,0);
  },

  updateXP(){
    const xp = Data.store.xp;
    $('#xpVal').textContent = fmtNum(xp, this.lang);
    const lvl = levelFor(xp);
    $('#xpBadge').title = 'Level ' + lvl;
  },

  /* ---------- HOME ---------- */
  renderHome(){
    const n = Data.totalQuestions();
    $('#statQuestions').textContent = fmtNum(n, this.lang);
    $('#statSessions').textContent = fmtNum(Data.store.sessions.length, this.lang);
    $('#statLevel').textContent = fmtNum(levelFor(Data.store.xp), this.lang);
    const strip = $('#subjectStrip');
    strip.innerHTML = '';
    for (const slug of SUBJECTS){
      const d = Data.cache[slug];
      if (!d) continue;
      const pill = document.createElement('span');
      pill.className = 'subj-pill';
      pill.textContent = (this.lang==='bn' ? d.subject_bn : d.subject_en) + ' · ' + fmtNum(d.questions.length, this.lang);
      strip.appendChild(pill);
    }
    this.updateXP();
  },

  /* ---------- SESSION BUILDERS ---------- */
  poolAll(){
    const pool = [];
    for (const slug of SUBJECTS){
      const d = Data.cache[slug];
      if (d) for (const q of d.questions) pool.push(q);
    }
    return pool;
  },
  newSession(mode, rawQs, opts = {}){
    const questions = shuffle(rawQs).slice(0, opts.count || rawQs.length).map(buildSessionQuestion);
    this.sess = {
      mode, questions,
      answers: new Array(questions.length).fill(null),
      flagged: new Array(questions.length).fill(false),
      times: new Array(questions.length).fill(0),
      qStart: Date.now(),
      startTime: Date.now(),
      current: 0,
      negative: !!opts.negative,
      durationSec: opts.durationSec || 0,
      remaining: opts.durationSec || 0,
      practice: !!opts.practice   // instant feedback in practice modes
    };
    this.show('quiz');
    this.renderQuestion();
    if (this.sess.durationSec) this.startTimer();
    $('#quizTimer').classList.toggle('hidden', !this.sess.durationSec);
    $('#btnSubmitQuiz').classList.toggle('hidden', mode !== 'mock');
    $('#btnPaletteToggle').classList.toggle('hidden', mode !== 'mock');
    this.buildPalette();
  },
  startQuick(){
    this.newSession('quick', this.poolAll(), { count: 20, practice: true });
  },
  startDrill(){
    const { subject, topic } = this.drillSel;
    if (!subject || !topic) return;
    const d = Data.cache[subject];
    const qs = d.questions.filter(q => q.topic_en === topic);
    this.newSession('drill', qs.length ? qs : d.questions, { count: Math.min(20, qs.length || 20), practice: true });
  },
  startMock(){
    // BCS-style: ~12-13 questions per subject for 100 total
    const pool = [];
    for (const slug of SUBJECTS){
      const d = Data.cache[slug];
      if (d) pool.push(...shuffle(d.questions).slice(0, 13));
    }
    const qs = shuffle(pool).slice(0, 100);
    this.newSession('mock', qs, { count: qs.length, negative: true, durationSec: 120*60 });
  },

  buildDrillSubjects(){
    const row = $('#drillSubjects');
    row.innerHTML = '';
    for (const slug of SUBJECTS){
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = Data.subjectName(slug, this.lang);
      b.onclick = () => {
        this.drillSel.subject = slug; this.drillSel.topic = null;
        [...row.children].forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        this.buildDrillTopics();
        this.updateDrillBtn();
      };
      row.appendChild(b);
    }
  },
  buildDrillTopics(){
    const row = $('#drillTopics');
    row.innerHTML = '';
    if (!this.drillSel.subject) return;
    for (const tp of Data.topicsOf(this.drillSel.subject, this.lang)){
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = tp.label;
      b.onclick = () => {
        this.drillSel.topic = tp.en;
        [...row.children].forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        this.updateDrillBtn();
      };
      row.appendChild(b);
    }
  },
  updateDrillBtn(){
    $('#btnStartDrill').disabled = !(this.drillSel.subject && this.drillSel.topic);
  },

  /* ---------- QUIZ RENDER ---------- */
  renderQuestion(){
    const s = this.sess;
    const i = s.current;
    const q = s.questions[i];
    const L = this.lang;
    $('#quizCount').textContent = fmtNum(i+1, L) + ' / ' + fmtNum(s.questions.length, L);
    $('#quizProgFill').style.width = ((i+1)/s.questions.length*100) + '%';
    $('#qSubject').textContent = Data.subjectName(q.subject, L);
    $('#qTopic').textContent = L==='bn' ? q.topic_bn : q.topic_en;
    $('#qText').textContent = L==='bn' ? q.q_bn : q.q_en;
    const opts = $('#qOpts');
    opts.innerHTML = '';
    const optArr = L==='bn' ? q.options_bn : q.options_en;
    const answered = s.answers[i] !== null;
    optArr.forEach((txt, oi) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<span class="k">' + ['A','B','C','D'][oi] + '</span>' + escapeHtml(txt);
      if (s.practice && answered){
        b.disabled = true;
        if (oi === q.answer) b.classList.add('right');
        else if (oi === s.answers[i]) b.classList.add('wrong');
      } else if (answered && oi === s.answers[i]){
        b.classList.add('picked');
      }
      if (!(s.practice && answered)){
        b.onclick = () => this.answer(i, oi);
      }
      opts.appendChild(b);
    });
    const ex = $('#qExplain');
    if (s.practice && answered){
      ex.classList.remove('hidden');
      ex.innerHTML = '<b>' + escapeHtml(this.t('explanation')) + ':</b> ' + escapeHtml(L==='bn' ? q.explain_bn : q.explain_en);
    } else ex.classList.add('hidden');
    $('#btnFlag').innerHTML = (s.flagged[i] ? '🚩 ' : '🏳 ') + '<span>' + escapeHtml(this.t('flag')) + '</span>';
    $('#btnPrevQ').disabled = i === 0;
    $('#btnNextQ').textContent = (i === s.questions.length-1)
      ? (s.mode === 'mock' ? this.t('submitExam') : this.t('reviewAnswers'))
      : this.t('next');
    this.updatePalette();
  },
  answer(i, oi){
    const s = this.sess;
    if (s.answers[i] === null) s.times[i] = Date.now() - s.qStart;
    s.answers[i] = oi;
    this.renderQuestion();
  },
  move(d){
    const s = this.sess;
    if (s.answers[s.current] === null) s.times[s.current] = Date.now() - s.qStart;
    s.qStart = Date.now();
    const ni = s.current + d;
    if (ni >= s.questions.length){ this.finish(false); return; }
    if (ni < 0) return;
    s.current = ni;
    s.qStart = Date.now();
    this.renderQuestion();
  },
  toggleFlag(){
    const s = this.sess;
    s.flagged[s.current] = !s.flagged[s.current];
    this.renderQuestion();
  },
  buildPalette(){
    const p = $('#qPalette');
    p.innerHTML = '';
    const s = this.sess;
    s.questions.forEach((_, i) => {
      const b = document.createElement('button');
      b.textContent = fmtNum(i+1, this.lang);
      b.onclick = () => {
        if (s.answers[s.current] === null) s.times[s.current] = Date.now() - s.qStart;
        s.current = i; s.qStart = Date.now();
        this.renderQuestion();
      };
      p.appendChild(b);
    });
  },
  updatePalette(){
    const s = this.sess;
    if (!s || s.mode !== 'mock') return;
    [...$('#qPalette').children].forEach((b, i) => {
      b.classList.toggle('done', s.answers[i] !== null);
      b.classList.toggle('flagged', s.flagged[i]);
      b.classList.toggle('cur', i === s.current);
    });
  },

  /* ---------- TIMER ---------- */
  startTimer(){
    this.stopTimer();
    this.timerId = setInterval(() => {
      const s = this.sess;
      if (!s) return;
      s.remaining--;
      this.paintTimer();
      if (s.remaining <= 0){ this.finish(true, true); }
    }, 1000);
    this.paintTimer();
  },
  paintTimer(){
    const s = this.sess;
    const el = $('#quizTimer');
    const r = Math.max(0, s.remaining);
    const mm = String(Math.floor(r/60)).padStart(2,'0');
    const ss = String(r%60).padStart(2,'0');
    el.textContent = (this.lang==='bn' ? bnDigits(mm+':'+ss) : mm+':'+ss);
    el.classList.toggle('danger', r < 300);
  },
  stopTimer(){ if (this.timerId){ clearInterval(this.timerId); this.timerId = null; } },

  /* ---------- FINISH / SCORE ---------- */
  computeScore(s){
    let correct = 0, wrong = 0, skipped = 0;
    s.questions.forEach((q, i) => {
      const a = s.answers[i];
      if (a === null) skipped++;
      else if (a === q.answer) correct++;
      else wrong++;
    });
    const neg = s.negative ? wrong * 0.25 : 0;
    const score = Math.round((correct - neg) * 100) / 100;
    const answered = correct + wrong;
    return { correct, wrong, skipped, neg, score,
             acc: answered ? Math.round(correct/answered*100) : 0 };
  },
  finish(auto, timeUp){
    const s = this.sess;
    if (!s) return;
    this.stopTimer();
    if (s.answers[s.current] === null) s.times[s.current] = Date.now() - s.qStart;
    const res = this.computeScore(s);
    const durationSec = Math.round((Date.now() - s.startTime)/1000);
    const avgMs = s.questions.length ? Math.round(s.times.reduce((a,b)=>a+b,0)/s.questions.length) : 0;

    // persist session
    const prevLevel = levelFor(Data.store.xp);
    const gained = res.correct * 10;
    Data.store.xp += gained;
    const rec = {
      id: 's' + Date.now(), date: new Date().toISOString(),
      mode: s.mode, total: s.questions.length,
      correct: res.correct, wrong: res.wrong, skipped: res.skipped,
      score: res.score, durationSec,
      detail: s.questions.map((q, i) => ({
        subject: q.subject, topic_en: q.topic_en, topic_bn: q.topic_bn,
        ok: s.answers[i] === q.answer, skipped: s.answers[i] === null,
        ms: s.times[i] || 0
      }))
    };
    Data.store.sessions.unshift(rec);
    saveStore(Data.store);

    // result screen
    const L = this.lang;
    $('#resScore').textContent = fmtNum(res.score, L);
    $('#resCorrect').textContent = fmtNum(res.correct, L);
    $('#resWrong').textContent = fmtNum(res.wrong, L);
    $('#resSkipped').textContent = fmtNum(res.skipped, L);
    $('#resAcc').textContent = fmtNum(res.acc, L) + '%';
    $('#resTime').textContent = fmtNum(Math.round(avgMs/100)/10, L) + 's';
    $('#resXP').textContent = '+' + fmtNum(gained, L);
    const ring = $('.score-ring');
    const pct = s.questions.length ? Math.max(0, Math.min(100, res.score/s.questions.length*100)) : 0;
    ring.style.background = `conic-gradient(var(--acc) ${pct}%, var(--card2) ${pct}%)`;
    const nn = $('#resNegNote');
    if (s.negative){
      nn.classList.remove('hidden');
      nn.textContent = this.t('negNote')(fmtNum(res.correct, L) + ' − ' + fmtNum(res.wrong, L) + '×0.25 = ' + fmtNum(res.score, L));
    } else nn.classList.add('hidden');
    if (timeUp) alert(this.t('timeUp'));
    const newLevel = levelFor(Data.store.xp);
    if (newLevel > prevLevel) setTimeout(() => alert(this.t('levelUp')(fmtNum(newLevel, L))), 300);
    this.updateXP();
    this.show('result');
  },

  /* ---------- REVIEW ---------- */
  showReview(filter){
    const s = this.sess;
    if (!s){ this.show('home'); return; }
    const L = this.lang;
    const list = $('#reviewList');
    list.innerHTML = '';
    s.questions.forEach((q, i) => {
      const a = s.answers[i];
      const ok = a === q.answer;
      const kind = a === null ? 'skipped' : (ok ? 'correct' : 'wrong');
      if (filter !== 'all' && filter !== kind) return;
      const div = document.createElement('div');
      div.className = 'rev-item';
      const optArr = L==='bn' ? q.options_bn : q.options_en;
      div.innerHTML =
        '<h4>' + fmtNum(i+1, L) + '. ' + escapeHtml(L==='bn' ? q.q_bn : q.q_en) + '</h4>' +
        '<div class="rev-opts">' +
          this.t('yourAnswer') + ': <span class="' + (ok?'r':'w') + '">' +
            (a === null ? escapeHtml(this.t('notAnswered')) : ['A','B','C','D'][a] + ' — ' + escapeHtml(optArr[a])) + '</span><br>' +
          this.t('correctAnswer') + ': <span class="r">' + ['A','B','C','D'][q.answer] + ' — ' + escapeHtml(optArr[q.answer]) + '</span>' +
        '</div>' +
        '<div class="rev-exp"><b>' + escapeHtml(this.t('explanation')) + ':</b> ' + escapeHtml(L==='bn' ? q.explain_bn : q.explain_en) + '</div>';
      list.appendChild(div);
    });
    this.show('review');
  },

  /* ---------- ANALYTICS ---------- */
  aggregate(){
    const bySubj = {}, byTopic = {};
    let total = 0, okN = 0, ms = 0;
    for (const sess of Data.store.sessions){
      for (const d of (sess.detail || [])){
        if (d.skipped) continue;
        total++; ms += d.ms || 0;
        if (d.ok) okN++;
        const sb = bySubj[d.subject] || (bySubj[d.subject] = { n: 0, ok: 0 });
        sb.n++; if (d.ok) sb.ok++;
        const tk = d.subject + '|' + d.topic_en;
        const tp = byTopic[tk] || (byTopic[tk] = { n: 0, ok: 0, label: d.topic_en, label_bn: d.topic_bn, subject: d.subject });
        tp.n++; if (d.ok) tp.ok++;
      }
    }
    return { bySubj, byTopic, total, okN, ms };
  },
  renderAnalytics(){
    const ag = this.aggregate();
    const L = this.lang;
    $('#analyticsEmpty').classList.toggle('hidden', ag.total > 0);
    $('#analyticsBody').classList.toggle('hidden', ag.total === 0);
    if (!ag.total) return;
    const bars = $('#subjBars');
    bars.innerHTML = '';
    for (const slug of SUBJECTS){
      const sb = ag.bySubj[slug];
      if (!sb) continue;
      const acc = Math.round(sb.ok/sb.n*100);
      const row = document.createElement('div');
      row.className = 'bar-row';
      const color = acc >= 70 ? 'var(--good)' : acc >= 40 ? 'var(--warn)' : 'var(--bad)';
      row.innerHTML = '<div class="bar-top"><span>' + escapeHtml(Data.subjectName(slug, L)) +
        '</span><span>' + fmtNum(acc, L) + '% · ' + fmtNum(sb.n, L) + '</span></div>' +
        '<div class="bar"><div style="width:' + acc + '%;background:' + color + '"></div></div>';
      bars.appendChild(row);
    }
    const weak = $('#weakList');
    weak.innerHTML = '';
    const topics = Object.values(ag.byTopic)
      .filter(t => t.n >= 5 && t.ok/t.n < 0.5)
      .sort((a,b) => (a.ok/a.n) - (b.ok/b.n))
      .slice(0, 6);
    if (!topics.length){
      weak.innerHTML = '<div class="info-box"><p>' + escapeHtml(this.t('noWeak')) + '</p></div>';
    } else {
      for (const t of topics){
        const acc = Math.round(t.ok/t.n*100);
        const card = document.createElement('div');
        card.className = 'weak-card';
        card.innerHTML = '<h4>' + escapeHtml(L==='bn' ? t.label_bn : t.label) + ' — ' + fmtNum(acc, L) + '%</h4>' +
          '<p>' + escapeHtml(this.t('weakRec')(L==='bn' ? t.label_bn : t.label, fmtNum(acc, L))) + '</p>';
        weak.appendChild(card);
      }
    }
    $('#anTotal').textContent = fmtNum(ag.total, L);
    $('#anAcc').textContent = fmtNum(Math.round(ag.okN/ag.total*100), L) + '%';
    $('#anTime').textContent = fmtNum(Math.round(ag.ms/ag.total/100)/10, L) + 's';
  },

  /* ---------- HISTORY ---------- */
  renderHistory(){
    const L = this.lang;
    const list = $('#historyList');
    list.innerHTML = '';
    const modeName = { quick: this.t('quickPractice'), drill: this.t('topicDrill'), mock: this.t('fullMock') };
    if (!Data.store.sessions.length){
      list.innerHTML = '<div class="info-box"><p>' + escapeHtml(this.t('analyticsEmpty')) + '</p></div>';
      return;
    }
    for (const s of Data.store.sessions){
      const div = document.createElement('div');
      div.className = 'hist-item';
      const dt = new Date(s.date);
      div.innerHTML = '<div><b>' + escapeHtml(modeName[s.mode] || s.mode) + '</b><br>' +
        '<small>' + dt.toLocaleDateString() + ' · ' + escapeHtml(this.t('score') || 'Score') + ': ' + fmtNum(s.score, L) +
        ' (' + fmtNum(s.correct, L) + '/' + fmtNum(s.total, L) + ')</small></div>' +
        '<button class="del" aria-label="delete">🗑</button>';
      div.querySelector('.del').onclick = () => {
        if (confirm(this.t('confirmClear'))){
          Data.store.sessions = Data.store.sessions.filter(x => x.id !== s.id);
          saveStore(Data.store);
          this.renderHistory(); this.updateXP();
        }
      };
      list.appendChild(div);
    }
  },

  exportData(){
    const blob = new Blob([JSON.stringify(Data.store)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bd-exam-arena-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importData(file){
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try{
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.sessions) || typeof d.xp !== 'number') throw 0;
        Data.store = Object.assign(blankStore(), d);
        saveStore(Data.store);
        this.lang = Data.store.settings.lang || 'en';
        this.applyLang(); this.renderHome();
        alert(this.t('dataImported'));
      }catch(e){ alert(this.t('badFile')); }
    };
    r.readAsText(file);
  }
};

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => App.init());

/* Test/debug hooks (harmless in production) */
window.BDEA_DEBUG = {
  app: () => App,
  data: () => Data,
  setMockSeconds(s){ if (App.sess) App.sess.remaining = s; },
  current(){ const s = App.sess; if (!s) return null;
    const q = s.questions[s.current];
    return { index: s.current, total: s.questions.length, answer: q.answer, answered: s.answers[s.current] }; },
  answerCurrent(correct){
    const s = App.sess; const q = s.questions[s.current];
    const oi = correct ? q.answer : (q.answer + 1) % 4;
    App.answer(s.current, oi);
  },
  score(){ return App.computeScore(App.sess); }
};
