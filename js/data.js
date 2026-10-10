/* BD Exam Arena — data layer: question loading, localStorage store, XP/levels.
   Zero network requests except same-origin fetches of local JSON files. */
const STORE_KEY = 'bd_exam_arena_v1';
const SUBJECTS = ['bangla','english','math','bangladesh','international','science','ict','mental'];

const LEVEL_XP = [0,150,400,800,1400,2200,3200,4500,6000,8000,11000,15000];
function levelFor(xp){
  let l = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1;
  return l;
}

function blankStore(){
  return { xp: 0, sessions: [], settings: { lang: 'en' }, qcount: 0 };
}
function loadStore(){
  try{
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') return Object.assign(blankStore(), s);
  }catch(e){}
  return blankStore();
}
function saveStore(s){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }catch(e){}
}

const Data = {
  store: loadStore(),
  cache: {},       // slug -> {subject, subject_en, subject_bn, questions:[...]}
  manifest: null,

  async loadManifest(){
    if (this.manifest) return this.manifest;
    const r = await fetch('questions/index.json');
    if (!r.ok) throw new Error('manifest load failed');
    this.manifest = await r.json();
    return this.manifest;
  },
  async loadSubject(slug){
    if (this.cache[slug]) return this.cache[slug];
    const r = await fetch('questions/' + slug + '.json');
    if (!r.ok) throw new Error('subject load failed: ' + slug);
    const d = await r.json();
    for (const q of d.questions) q.subject = d.subject;
    this.cache[slug] = d;
    return d;
  },
  async loadAll(){
    const m = await this.loadManifest();
    const out = [];
    for (const s of m.subjects) out.push(await this.loadSubject(s.slug));
    return out;
  },
  totalQuestions(){
    return Object.values(this.cache).reduce((n,d)=>n+d.questions.length,0);
  },
  subjectName(slug, lang){
    const d = this.cache[slug];
    return d ? (lang==='bn' ? d.subject_bn : d.subject_en) : slug;
  },
  topicsOf(slug, lang){
    const d = this.cache[slug];
    if (!d) return [];
    const seen = new Map();
    for (const q of d.questions){
      const k = q.topic_en;
      if (!seen.has(k)) seen.set(k, lang==='bn' ? q.topic_bn : q.topic_en);
    }
    return [...seen.entries()].map(([en,label])=>({en,label}));
  }
};

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length-1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
/* Build a session question: shuffle options, remap answer index. */
function buildSessionQuestion(q){
  const order = shuffle([0,1,2,3]);
  return {
    id: q.id, subject: q.subject,
    topic_en: q.topic_en, topic_bn: q.topic_bn,
    q_en: q.q_en, q_bn: q.q_bn,
    options_en: order.map(i=>q.options_en[i]),
    options_bn: order.map(i=>q.options_bn[i]),
    answer: order.indexOf(q.answer),
    explain_en: q.explain_en, explain_bn: q.explain_bn
  };
}
