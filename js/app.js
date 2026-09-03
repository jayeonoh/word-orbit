// app.js — 화면과 흐름. 프레임워크 없이 동작합니다.
import { db } from './db.js?v=8';
import * as srs from './srs.js?v=8';
import * as ai from './ai.js?v=8';
import { SAMPLE_WORDS, TOPICS } from './data.js?v=8';
import { recommend, browse, BANDS, BAND_LABEL, KIND_LABEL, BURDEN_LABEL, badgeText, hasAward, childBand, gradeFromAge, STATS, BOOKS as BOOKS_ALL } from './books.js?v=8';
import { pageSentences, readWordImage } from './ocr.js?v=8';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fmtDate = k => { const [y, m, d] = k.split('-'); return `${Number(m)}월 ${Number(d)}일`; };

const NAV = [
  { id: 'home', label: '오늘의 학습', sub: 'Today', icon: '✦' },
  { id: 'words', label: '나의 단어', sub: 'My words', icon: '◉' },
  { id: 'memory', label: '기억 보관소', sub: 'Memory room', icon: '☆' },
  { id: 'books', label: '다음에 읽을 책', sub: 'Next chapter', icon: '▤' },
  { id: 'shelf', label: '나의 책장', sub: 'My bookshelf', icon: '📚' },
  { id: 'parents', label: '부모 리포트', sub: 'For parents', icon: '☺' },
];
const ORB_COLORS = ['purple', 'green', 'orange', 'blue', 'pink'];

const state = {
  profiles: [], profile: null, words: [], reviews: [],
  route: 'home', session: null, busy: false, sidebar: false, progress: '',
};
ai.onProgressChange(m => { state.progress = m; const el = document.getElementById('aiProgress'); if (el) el.textContent = m; });

// ---------- 공용 ----------
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}
const ACCENTS = { 'en-US': '미국식', 'en-GB': '영국식', 'en-AU': '호주식' };
const FLAGS = { 'en-US': '🇺🇸', 'en-GB': '🇬🇧', 'en-AU': '🇦🇺' };
const SPK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5a1 1 0 0 0 1 1h2.6l4 3.2a.8.8 0 0 0 1.3-.6V5.9a.8.8 0 0 0-1.3-.6L7.6 8.5H5a1 1 0 0 0-1 1z" fill="currentColor" stroke="none" opacity=".9"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.6 6.6a7.5 7.5 0 0 1 0 10.8"/></svg>';
// 스피커 버튼 (+ 선택: 발음 국기)
function spk(id, { flags = false, size = '' } = {}) {
  const cur = accentLang();
  return `<span class="spk-wrap"><button class="spk ${size}" id="${id}" aria-label="읽어주기">${SPK_SVG}</button>${flags ? `<span class="flags">${Object.keys(FLAGS).map(k => `<button class="flag ${k === cur ? 'on' : ''}" data-accent="${k}" title="${ACCENTS[k]}">${FLAGS[k]}</button>`).join('')}</span>` : ''}</span>`;
}
// 한국어는 기본으로 감춤 — 눌러야 보임 (영어로 이해하는 연습이 목적)
function ko(text, cls = '') { return text ? `<span class="ko-wrap ${cls}"><button class="ko-toggle" type="button">한국어</button><span class="ko-text" hidden>${esc(text)}</span></span>` : ''; }
function bindKo() { document.querySelectorAll('.ko-toggle').forEach(b => b.onclick = e => { e.stopPropagation(); const t = b.nextElementSibling; t.hidden = !t.hidden; b.classList.toggle('on', !t.hidden); }); }
function bindFlags() { document.querySelectorAll('.flag[data-accent]').forEach(b => b.onclick = async e => { e.stopPropagation(); await saveProfile({ accent: b.dataset.accent }); render(); }); }
function accentLang() { return (state.profile && state.profile.accent) || 'en-US'; }
function speak(text, lang) {
  try {
    lang = lang || accentLang();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = 0.85;
    const voices = speechSynthesis.getVoices();
    const norm = v => v.lang.replace('_', '-').toLowerCase();
    // 같은 지역 목소리 중 기본/고품질 우선, 없으면 아무 영어 목소리
    const v = voices.filter(v => norm(v) === lang.toLowerCase()).sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0) || (b.localService ? 1 : 0) - (a.localService ? 1 : 0))[0]
      || voices.find(v => norm(v).startsWith('en'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {}; // iOS에서 목소리 목록 미리 불러오기
function listen(onResult, onError) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('이 브라우저는 음성 입력을 지원하지 않아요. 직접 입력해 주세요.'); return null; }
  const r = new SR(); r.lang = accentLang(); r.interimResults = false; r.continuous = false;
  r.onresult = e => onResult(e.results[0][0].transcript);
  r.onerror = () => { onError && onError(); toast('마이크 권한을 확인하거나 답을 입력해 주세요.'); };
  try { r.start(); } catch { toast('마이크를 시작하지 못했어요.'); return null; }
  return r;
}

async function loadProfile(id) {
  state.profiles = await db.listProfiles();
  if (!state.profiles.length) { state.profile = null; state.words = []; state.reviews = []; return; }
  const savedId = id || await db.getMeta('activeProfile');
  state.profile = state.profiles.find(p => p.id === savedId) || state.profiles[0];
  await db.setMeta('activeProfile', state.profile.id);
  state.words = await db.listWords(state.profile.id);
  state.reviews = await db.listReviews(state.profile.id);
}
async function saveProfile(patch) {
  Object.assign(state.profile, patch, { updated: new Date().toISOString() });
  await db.putProfile(state.profile);
}
async function addWords(items, origin = 'manual') {
  const today = srs.todayKey();
  const existing = new Set(state.words.map(w => w.word.toLowerCase()));
  const ws = items.filter(i => i.word && !existing.has(i.word.toLowerCase())).map(i => ({
    id: db.uid(), profileId: state.profile.id, created: new Date().toISOString(), origin,
    word: i.word.trim().toLowerCase(), korean: i.korean || '', definition: i.definition || '', context: i.context || '',
    example: i.example || '', distractors: Array.isArray(i.distractors) ? i.distractors.slice(0, 4) : [], topic: i.topic || 'other',
    simpleDefinition: '', progress: srs.newProgress(today),
  }));
  if (!ws.length) return 0;
  await db.putWords(ws);
  state.words.push(...ws);
  return ws.length;
}

// ---------- 렌더 ----------
function render() {
  const app = $('#app');
  if (!state.profile) { app.innerHTML = renderOnboarding(); bindOnboarding(); return; }
  const page = state.session ? renderSession() : ({ home: renderHome, add: renderAdd, words: renderWords, memory: renderMemory, books: renderBooks, shelf: renderShelf, parents: renderParents }[state.route] || renderHome)();
  app.innerHTML = `
    <aside class="sidebar ${state.sidebar ? 'open' : ''}">
      <div class="brand">✦ Word Orbit</div>
      <nav>${NAV.map(n => `<a href="#${n.id}" class="${state.route === n.id && !state.session ? 'active' : ''}"><span class="ic">${n.icon}</span><span>${n.label}<small>${n.sub}</small></span></a>`).join('')}</nav>
      <div class="side-foot">
        <label>아이</label>
        <select id="profileSwitch">${state.profiles.map(p => `<option value="${p.id}" ${p.id === state.profile.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      </div>
    </aside>
    <div class="scrim ${state.sidebar ? 'show' : ''}" id="scrim"></div>
    <main>
      <header class="topbar">
        <button class="icon-btn" id="menuBtn" aria-label="메뉴">☰</button>
        <span class="topbar-title">${state.session ? '오늘의 학습' : NAV.find(n => n.id === state.route)?.label || '단어 추가'}</span>
        <span class="avatar" title="${esc(state.profile.name)}">${esc(state.profile.name.slice(0, 1).toUpperCase())}</span>
      </header>
      <div class="page">${page}</div>
      <footer class="app-footer"><span>✦ wordorbit · <a href="guide.html">시작 안내</a></span><span>Every word opens a little world.</span></footer>
    </main>`;
  bindCommon(); bindKo();
  if (state.session) bindSession(); else ({ home: bindHome, add: bindAdd, words: bindWords, memory: bindMemory, books: bindBooks, shelf: bindShelf, parents: bindParents }[state.route] || bindHome)();
}
function bindCommon() {
  $('#menuBtn').onclick = () => { state.sidebar = !state.sidebar; render(); };
  $('#scrim').onclick = () => { state.sidebar = false; render(); };
  $('#profileSwitch').onchange = async e => { await loadProfile(e.target.value); state.session = null; render(); };
  document.querySelectorAll('.sidebar nav a').forEach(a => a.onclick = () => { state.sidebar = false; });
}
function orb(word, i, small = false) {
  const st = word ? srs.stage(word.progress) : 'new';
  return `<button class="orb-wrap ${small ? 'small' : ''}" data-word="${word ? word.id : ''}" ${word ? '' : 'disabled'}>
    <span class="orb ${ORB_COLORS[i % ORB_COLORS.length]} ${st}"><span class="glint"></span></span>
    ${word ? `<span class="orb-label">${esc(word.word)}</span>` : ''}</button>`;
}

// ---------- 온보딩 ----------
function renderOnboarding() {
  return `<div class="onboard compact-form">
    <div class="row between"><div class="brand big">✦ Word Orbit</div><a href="guide.html" class="muted small">시작 안내 →</a></div>
    <h1>아이 프로필 만들기</h1>
    <p class="muted small">모든 기록은 이 기기 안에만 저장돼요. 나중에 부모 리포트에서 바꿀 수 있어요.</p>
    ${profileForm({})}
    <button class="primary big" id="createProfile">시작하기</button>
  </div>`;
}
function profileForm(p) {
  return `<div class="form-grid">
    <label>이름<input id="pf-name" value="${esc(p.name || '')}" placeholder="예: Siheon"></label>
    <label>나이<input id="pf-age" type="number" min="4" max="14" value="${p.age || 8}"></label>
    <label>학년<select id="pf-grade">${['Prep', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'].map((g, i) => `<option value="${i}" ${(p.grade === undefined || p.grade === null || p.grade === '' ? gradeFromAge(p.age) : Number(p.grade)) === i ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <label>영어 읽기 수준<select id="pf-level">
      <option value="beginner" ${p.level === 'beginner' ? 'selected' : ''}>기초 (짧은 문장, 그림책)</option>
      <option value="intermediate" ${!p.level || p.level === 'intermediate' ? 'selected' : ''}>중간 (쉬운 챕터북)</option>
      <option value="advanced" ${p.level === 'advanced' ? 'selected' : ''}>능숙 (챕터북 혼자 읽기)</option></select></label>
    <label>하루 목표 (분)<input id="pf-minutes" type="number" min="3" max="30" value="${p.minutes || 10}"></label>
    <label>하루 새 단어 최대<input id="pf-new" type="number" min="1" max="10" value="${p.newPerDay || 4}"></label>
    <label>발음 (읽어주기·마이크)<select id="pf-accent">${Object.entries(ACCENTS).map(([k, v]) => `<option value="${k}" ${(p.accent || 'en-US') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  </div>`;
}
function readProfileForm() {
  return { name: $('#pf-name').value.trim() || 'Explorer', age: Number($('#pf-age').value) || 8, grade: Number($('#pf-grade').value), level: $('#pf-level').value, minutes: Number($('#pf-minutes').value) || 10, newPerDay: Number($('#pf-new').value) || 4, accent: $('#pf-accent').value || 'en-US' };
}
function bindProfileForm() { const a = $('#pf-age'); if (a) a.onchange = () => { const g = $('#pf-grade'); if (g) g.value = String(gradeFromAge(a.value)); }; }
function bindOnboarding() {
  bindProfileForm();
  $('#createProfile').onclick = async () => {
    const p = { id: db.uid(), created: new Date().toISOString(), interests: [], bookReactions: {}, allowExplain: true, ...readProfileForm() };
    await db.putProfile(p); await loadProfile(p.id);
    await addWords(SAMPLE_WORDS, 'sample');
    toast(`${p.name}의 단어 우주를 만들었어요. 예시 단어 8개를 넣어두었어요.`, 'success');
    state.route = 'home'; render(); window.scrollTo(0, 0);
  };
}

// ---------- 홈 ----------
function renderHome() {
  const p = state.profile, today = srs.todayKey();
  const s = srs.buildSession(state.words, p, today);
  const counts = { new: 0, growing: 0, mastered: 0 };
  state.words.forEach(w => counts[srs.stage(w.progress)]++);
  const showcase = [...s.review, ...s.intro].slice(0, 5);
  const total = s.review.length + s.intro.length;
  return `
    <p class="eyebrow">A LITTLE EVERY DAY</p>
    <div class="row between">
      <div><h1>반가워, ${esc(p.name)} <span class="spark">✦</span></h1><p class="muted">오늘도 새로운 단어를 만나볼까?</p></div>
      <a href="#add" class="btn primary">＋ 단어 추가하기</a>
    </div>
    <section class="panel hero">
      <div class="row between hero-head"><span class="pill">● 나의 단어 우주</span><span class="hero-links"><a href="#shelf">📚 책장</a><a href="#memory">✦ 보관소</a></span></div>
      <h2 class="hero-title">오늘 만난 단어가<br><em>오래 남는 기억으로.</em></h2>
      <p class="muted">알아보고, 떠올리고, 내 말로 설명해요.</p>
      <div class="orbit-stage">
        <div class="ring r1"></div><div class="ring r2"></div>
        ${showcase.length ? showcase.map((w, i) => `<div class="orbit-pos p${i}">${orb(w, i)}</div>`).join('') : '<p class="muted center">단어를 추가하면 여기에 구슬이 떠요.</p>'}
      </div>
      <div class="stage-counts">
        <div><b>${counts.new}개</b><span>새로운 발견</span></div>
        <div><b>${counts.growing}개</b><span>기억을 키우는 중</span></div>
        <div><b>${counts.mastered}개</b><span>오래 기억하는 단어</span></div>
      </div>
    </section>
    <section class="panel mission">
      <p class="eyebrow">TODAY’S LITTLE MISSION</p>
      <div class="row between wrap">
        <div><h2>오늘의 기억 돌보기</h2><p class="muted">나에게 맞는 만큼, 차근차근. 하루 목표 ${p.minutes || 10}분</p></div>
        <div class="bignum"><b>${total}</b><span>오늘 만날 단어</span></div>
      </div>
      <div class="mission-grid">
        <div><span>다시 떠올릴 단어</span><b>${s.review.length}개</b></div>
        <div><span>새롭게 만날 단어</span><b>${s.intro.length}개</b></div>
        ${s.carried ? `<div><span>내일로 나눈 복습</span><b>${s.carried}개</b></div>` : ''}
        ${s.waiting ? `<div><span>기다리는 새 단어</span><b>${s.waiting}개</b></div>` : ''}
      </div>
      ${total ? `<button class="primary big" id="startSession">오늘의 학습 시작 →</button>` : `<p class="info-line">오늘 복습할 단어가 없어요. ${state.words.length ? '내일 다시 만나요!' : '단어를 추가해 볼까요?'}</p>`}
    </section>
    <section class="panel soft">
      <h3>작은 발견을 모아볼까요?</h3>
      <div class="three">
        <div><b>사진 한 장으로 쏙</b><p>책에 표시한 단어를 한 번에 모아요.</p></div>
        <div><b>뜻을 넘어, 이해하기</b><p>내가 읽은 문장 속에서 배워요.</p></div>
        <div><b>정답 횟수보다, 시간</b><p>시간이 지나도 떠올리는 힘을 길러요.</p></div>
      </div>
    </section>`;
}
function bindHome() {
  const b = $('#startSession'); if (b) b.onclick = startSession;
  document.querySelectorAll('.orb-wrap[data-word]').forEach(el => el.onclick = () => openWord(el.dataset.word));
}

// ---------- 학습 세션 ----------
function startSession() {
  const s = srs.buildSession(state.words, state.profile);
  const queue = [...s.intro.map(w => ({ id: w.id, intro: true })), ...s.review.map(w => ({ id: w.id, intro: false }))];
  state.session = { queue, index: 0, results: [], phase: 'intro', answer: '', hinted: false, feedback: null, options: null, simple: '', rec: null };
  prepareItem();
  render(); window.scrollTo(0, 0);
}
function currentWord() { return state.words.find(w => w.id === state.session.queue[state.session.index].id); }
function prepareItem() {
  const s = state.session, item = s.queue[s.index];
  if (!item) return;
  const w = currentWord();
  s.answer = ''; s.hinted = false; s.feedback = null; s.simple = ''; s.simpleKo = ''; s.listening = false; s.spokenFor = '';
  if (item.intro || w.progress.needsSimplify) { s.phase = 'intro'; s.mode = 'meaning'; }
  else { s.phase = 'quiz'; s.mode = srs.pickMode(w.progress, { allowExplain: state.profile.allowExplain !== false }); }
  if (s.mode === 'meaning') {
    let d = (w.distractors || []).filter(Boolean);
    if (d.length < 4) {
      const others = shuffle(state.words.filter(o => o.id !== w.id && o.definition).map(o => o.definition));
      d = [...d, ...others].slice(0, 4);
    }
    s.options = shuffle([w.definition, ...d]);
  }
}
function renderSession() {
  const s = state.session;
  if (s.index >= s.queue.length) return renderSessionEnd();
  const w = currentWord(), p = state.profile;
  const head = `<div class="row between compact"><span class="pill">${s.index + 1} / ${s.queue.length}</span><button class="ghost small" id="quitSession">그만하기</button></div>`;
  if (s.phase === 'intro') {
    return `${head}
      <section class="panel study">
        <p class="eyebrow">${w.progress.needsSimplify ? 'LET’S LOOK AGAIN' : 'NEW WORD'}</p>
        <h1 class="word-title">${esc(w.word)} ${spk('speakWord', { flags: true })}</h1>
        <p class="definition">${esc(w.definition)} ${ko(w.korean)}</p>
        ${(s.simple || w.simpleDefinition) ? `<div class="alt-explain"><span class="eyebrow">ANOTHER WAY</span><p>${esc(s.simple || w.simpleDefinition)}</p>${ko(s.simpleKo || w.simpleKorean, 'block')}</div>` : ''}
        ${w.context ? `<div class="context"><span class="eyebrow">IN YOUR STORY</span><p>${esc(w.context)}</p></div>` : ''}
        ${w.example ? `<p class="example">${esc(w.example)} ${spk('speakExample', { size: 'sm' })}</p>` : ''}
        <div class="button-row">
          <button class="ghost" id="simplify" ${state.busy ? 'disabled' : ''}>✨ ${(s.simple || w.simpleDefinition) ? '또 다르게' : '다르게 설명해 줘'}</button>
          <button class="primary" id="toQuiz">이제 떠올려 볼게요 →</button>
        </div>
      </section>`;
  }
  const modeLabel = srs.MODES[s.mode];
  let body = '';
  if (s.mode === 'meaning') {
    body = `<h1 class="word-title">${esc(w.word)} ${spk('speakWord', { flags: true })}</h1>
      <p class="muted">What does it mean?</p>
      <div class="options">${s.options.map((o, i) => `<button class="option ${s.answer === o ? 'chosen' : ''}" data-opt="${esc(o)}" ${s.feedback ? 'disabled' : ''}><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</button>`).join('')}</div>`;
  } else if (s.mode === 'recall') {
    body = `<p class="definition">${esc(w.definition)} ${ko(w.korean)}</p>
      <p class="muted">Which word is this? Say it or type it.</p>
      <div class="free-answer">
        <input id="answer" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="type the word" value="${esc(s.answer)}" ${s.feedback ? 'disabled' : ''}>
        <button class="ghost" id="mic" ${s.feedback ? 'disabled' : ''}>${s.listening ? '● 듣는 중… 누르면 멈춰요' : '🎤 마이크로 말하기'}</button>
      </div>`;
  } else if (s.mode === 'spell') {
    const pad = s.inputMode !== 'keyboard';
    body = `<p class="definition">${esc(w.definition)} ${ko(w.korean)}</p>
      <p class="muted">Listen and write the word. ${spk('speakWord', { flags: true })} <span class="letters">${'_ '.repeat(w.word.length)}</span></p>
      <div class="tabs"><button class="tab ${pad ? 'active' : ''}" id="modePad" ${s.feedback ? 'disabled' : ''}>✍️ 손으로 쓰기</button><button class="tab ${pad ? '' : 'active'}" id="modeKey" ${s.feedback ? 'disabled' : ''}>⌨️ 키보드</button></div>
      ${pad && !s.feedback ? `<div class="pad-wrap"><canvas id="pad" class="pad"></canvas>
        <div class="button-row"><button class="ghost small" id="padClear">지우기</button><button class="primary small" id="padRead" ${state.busy ? 'disabled' : ''}>${state.busy ? '읽는 중…' : '다 썼어요 → 읽기'}</button></div>
        <p class="muted small">글자를 또박또박 크게, 띄어서 써주세요. 읽힌 철자는 아래 칸에서 고칠 수 있어요.</p></div>` : ''}
      <div class="free-answer"><input id="answer" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${pad ? '읽힌 철자가 여기에 나와요' : 'write the word'}" value="${esc(s.answer)}" ${s.feedback ? 'disabled' : ''}></div>`;
  } else if (s.mode === 'explain') {
    body = `<h1 class="word-title">${esc(w.word)} ${spk('speakWord', { flags: true })}</h1>
      <p class="muted">Tell me what it means, in your own words.</p>
      <div class="free-answer">
        <textarea id="answer" rows="3" placeholder="It means…" ${s.feedback ? 'disabled' : ''}>${esc(s.answer)}</textarea>
        <button class="ghost" id="mic" ${s.feedback ? 'disabled' : ''}>${s.listening ? '● 듣는 중… 누르면 멈춰요' : '🎤 마이크로 말하기'}</button>
      </div>
      ${ai.getKey() ? '' : '<p class="info-line">AI가 연결되지 않아 부모님이 확인해 주세요.</p>'}`;
  }
  const hint = s.hinted && !s.feedback ? `<div class="hint-box">💡 ${s.mode === 'meaning' ? esc(w.example) : esc(w.word.slice(0, 1)) + '… ' + esc(w.example)}</div>` : '';
  const fb = s.feedback ? `<div class="feedback ${s.feedback.correct ? 'success' : 'retry'}" role="status">
      <b>${s.feedback.correct ? 'Nice one! ✦' : 'Not yet — let’s look again.'}</b>
      <p>${esc(s.feedback.text || '')}</p>
      ${!s.feedback.correct ? `<p class="muted"><b>${esc(w.word)}</b> — ${esc(w.definition)}</p>` : ''}
      <button class="primary" id="next">${s.index + 1 < s.queue.length ? '다음 →' : '마무리'}</button></div>` : '';
  const actions = s.feedback ? '' : (s.mode === 'explain' && !ai.getKey()
    ? `<div class="button-row"><button class="ghost" id="parentNo">다시 설명해 볼까</button><button class="primary" id="parentYes">맞아요 (부모 확인)</button></div>`
    : `<div class="button-row"><button class="ghost" id="hint" ${s.hinted ? 'disabled' : ''}>힌트</button><button class="primary" id="check" ${state.busy ? 'disabled' : ''}>확인</button></div>`);
  return `${head}<section class="panel study">
    <p class="eyebrow">${modeLabel.en.toUpperCase()} · ${modeLabel.label}</p>
    ${body}${hint}${actions}${fb}</section>`;
}
function renderSessionEnd() {
  const r = state.session.results, ok = r.filter(x => x.correct).length;
  const mastered = r.filter(x => x.mastered).length;
  return `<section class="panel study center">
    <p class="eyebrow">ALL DONE</p>
    <h1>오늘의 기억 돌보기 끝!</h1>
    <p class="muted">${r.length}개 중 ${ok}개를 떠올렸어요.${mastered ? ` 구슬 ${mastered}개가 기억 보관소로 굴러갔어요 ✦` : ''}</p>
    <div class="orbit-stage small">${r.slice(0, 5).map((x, i) => `<div class="orbit-pos p${i}">${orb(state.words.find(w => w.id === x.wordId), i)}</div>`).join('')}</div>
    <p class="muted">내일 다시 만나면 기억이 더 선명해져요.</p>
    <button class="primary big" id="endSession">홈으로</button>
  </section>`;
}
function bindSession() {
  const s = state.session;
  const q = $('#quitSession'); if (q) q.onclick = () => { state.session = null; render(); };
  const e = $('#endSession'); if (e) e.onclick = () => { state.session = null; state.route = 'home'; render(); };
  if (s.index >= s.queue.length) return;
  const w = currentWord();
  const sp = $('#speakWord'); if (sp) sp.onclick = () => speak(w.word);
  bindFlags();
  // 카드가 처음 열릴 때 한 번 자동으로 읽어주기 (뜻 설명·회상 문제는 정답을 말해버리므로 제외)
  if (!s.feedback && !s.spokenFor && (s.phase === 'intro' || s.mode === 'meaning' || s.mode === 'spell')) { s.spokenFor = w.id + s.phase + s.mode; speak(w.word); }
  if (s.phase === 'intro') {
    const se = $('#speakExample'); if (se) se.onclick = () => speak(w.example);
    $('#toQuiz').onclick = () => { s.phase = 'quiz'; s.spokenFor = ''; render(); };
    $('#simplify').onclick = async () => {
      if (!ai.getKey()) { toast('부모 리포트에서 Gemini API 키를 연결하면 사용할 수 있어요.'); return; }
      state.busy = true; render();
      try {
        const r = await ai.simplify({ key: ai.getKey(), word: w.word, definition: w.definition, context: w.context, age: state.profile.age, level: state.profile.level });
        s.simple = r.definition || ''; s.simpleKo = r.korean || ''; w.simpleDefinition = s.simple; w.simpleKorean = s.simpleKo; await db.putWord(w);
      } catch (err) { toast(err.message, 'error'); }
      state.busy = false; render();
    };
    return;
  }
  document.querySelectorAll('.option').forEach(b => b.onclick = () => { s.answer = b.dataset.opt; render(); });
  const inp = $('#answer'); if (inp) { inp.oninput = e => { s.answer = e.target.value; }; inp.onkeydown = e => { if (e.key === 'Enter' && s.mode !== 'explain') { e.preventDefault(); check(); } }; if (!s.feedback) inp.focus(); }
  const mic = $('#mic'); if (mic) mic.onclick = () => {
    if (s.rec) { s.rec.stop(); s.rec = null; s.listening = false; render(); return; }
    s.rec = listen(t => { s.answer = t; s.listening = false; s.rec = null; render(); }, () => { s.listening = false; s.rec = null; render(); });
    if (s.rec) { s.listening = true; s.rec.onend = () => { s.listening = false; s.rec = null; render(); }; render(); }
  };
  const mp = $('#modePad'); if (mp) mp.onclick = () => { s.inputMode = 'pad'; render(); };
  const mk = $('#modeKey'); if (mk) mk.onclick = () => { s.inputMode = 'keyboard'; render(); setTimeout(() => $('#answer')?.focus(), 50); };
  const pad = $('#pad'); if (pad) setupPad(pad);
  const pc = $('#padClear'); if (pc) pc.onclick = () => { const c = $('#pad'); c.getContext('2d').fillStyle = '#fff'; c.getContext('2d').fillRect(0, 0, c.width, c.height); drawGuide(c); c.dataset.dirty = ''; };
  const pr = $('#padRead'); if (pr) pr.onclick = async () => {
    const c = $('#pad'); if (!c.dataset.dirty) return toast('먼저 단어를 써 주세요.');
    const png = c.toDataURL('image/png'); const b64 = png.split(',')[1];
    state.busy = true; const btn = $('#padRead'); btn.disabled = true; btn.textContent = '읽는 중…';
    try {
      let r;
      if (ai.getKey()) r = await ai.readHandwriting({ key: ai.getKey(), imageBase64: b64, mime: 'image/png' });
      else r = await readWordImage(png, m => { btn.textContent = m; });
      s.answer = (r.text || '').trim().toLowerCase();
      $('#answer').value = s.answer;
      toast(r.uncertain ? '글자가 애매해요. 읽힌 철자를 확인하고 고쳐 주세요.' : '읽힌 철자가 쓴 것과 같은지 확인해 주세요.');
    } catch (err) { toast(err.message, 'error'); }
    state.busy = false; btn.disabled = false; btn.textContent = '다 썼어요 → 읽기';
  };
  const h = $('#hint'); if (h) h.onclick = () => { s.hinted = true; render(); };
  const c = $('#check'); if (c) c.onclick = check;
  const py = $('#parentYes'); if (py) py.onclick = () => finish(true, 'Great explanation!');
  const pn = $('#parentNo'); if (pn) pn.onclick = () => finish(false, 'Let’s read the meaning once more.');
  const n = $('#next'); if (n) n.onclick = () => { s.index += 1; prepareItem(); render(); window.scrollTo(0, 0); };

  async function check() {
    if (!s.answer.trim()) { toast('답을 먼저 골라 주세요.'); return; }
    if (s.mode === 'meaning') return finish(s.answer.trim() === w.definition.trim());
    if (s.mode === 'recall' || s.mode === 'spell') return finish(srs.normalize(s.answer) === srs.normalize(w.word));
    if (s.mode === 'explain') {
      state.busy = true; render();
      try {
        const r = await ai.gradeExplain({ key: ai.getKey(), word: w.word, definition: w.definition, answer: s.answer, age: state.profile.age });
        state.busy = false; return finish(!!r.correct, r.feedback || '');
      } catch (err) { state.busy = false; toast(err.message + ' 부모님이 확인해 주세요.', 'error'); ai.setKey(ai.getKey()); render(); }
    }
  }
  async function finish(correct, text = '') {
    const today = srs.todayKey();
    const before = w.progress;
    w.progress = srs.applyResult(before, s.mode, correct, s.hinted, today);
    await db.putWord(w);
    const rec = { id: db.uid(), profileId: state.profile.id, wordId: w.id, mode: s.mode, correct, hinted: s.hinted, date: today, gapDays: before.lastReviewed ? srs.daysBetween(before.lastReviewed, today) : 0 };
    await db.putReview(rec); state.reviews.push(rec);
    const mastered = !before.mastered && w.progress.mastered;
    s.results.push({ wordId: w.id, correct, mastered });
    s.feedback = { correct, text: text || (correct ? (mastered ? 'This word is now in your memory room ✦' : 'You remembered it!') : '') };
    // 뜻을 혼동한 단어는 몇 문제 뒤에 다시 만난다 (오늘 안에)
    if (!correct && s.mode === 'meaning' && !s.queue.slice(s.index + 1).some(q => q.id === w.id)) {
      s.queue.splice(Math.min(s.queue.length, s.index + 3), 0, { id: w.id, intro: false });
    }
    if (correct) speak(w.word);
    render();
  }
}

// ---------- 손글씨 패드 ----------
function drawGuide(c) {
  const ctx = c.getContext('2d'); ctx.save(); ctx.strokeStyle = '#d9d2ef'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
  const y1 = c.height * 0.3, y2 = c.height * 0.7; ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(c.width, y1); ctx.moveTo(0, y2); ctx.lineTo(c.width, y2); ctx.stroke(); ctx.restore();
}
function setupPad(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); const w = c.clientWidth || 320, h = 170;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px';
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); drawGuide(c);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1d1a33'; ctx.lineWidth = 6 * dpr;
  let drawing = false, last = null;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
  c.onpointerdown = e => { drawing = true; last = pos(e); c.setPointerCapture(e.pointerId); c.dataset.dirty = '1'; ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(last[0] + 0.1, last[1]); ctx.stroke(); };
  c.onpointermove = e => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; };
  c.onpointerup = c.onpointercancel = c.onpointerleave = () => { drawing = false; };
}

// ---------- 단어 추가 ----------
const add = { tab: 'photo', image: null, preview: '', text: '', found: [], note: '', manual: {}, sentences: [], picked: new Set() };
function renderAdd() {
  const key = ai.getKey();
  const tabs = [['photo', '📷 사진'], ['text', '✎ 문장 붙여넣기'], ['manual', '＋ 직접 입력']];
  let body = '';
  if (add.tab === 'photo') body = `
    <p class="muted">책이나 과제에서 형광펜·밑줄·플래그로 표시한 단어를 사진 한 장으로 모아요. 사진은 추출 후 보관하지 않아요.</p>
    ${key ? '' : '<p class="info-line">사진 읽기는 부모 리포트에서 Gemini API 키(무료)를 연결한 뒤 사용할 수 있어요. 지금은 직접 입력으로 추가할 수 있어요.</p>'}
    <div class="photo-box">${add.preview ? `<img src="${add.preview}" alt="">` : '<span>사진을 고르거나 찍어 주세요</span>'}</div>
    <div class="button-row">
      <label class="btn ghost">사진 선택 <input type="file" id="photo" accept="image/*" capture="environment" hidden></label>
      <button class="primary" id="extract" ${!add.image || state.busy || !key ? 'disabled' : ''}>${state.busy ? '읽는 중…' : '✨ 표시한 단어 찾기'}</button>
      <button class="ghost" id="extractPage" ${!add.image || state.busy || !key ? 'disabled' : ''}>📖 페이지 글 가져와서 탭하기</button>
      <button class="ghost" id="extractPoint" ${!add.image || state.busy || !key ? 'disabled' : ''}>☝ 손가락으로 가리킨 단어</button>
    </div>
    ${state.busy ? `<p class="muted small" id="aiProgress">${esc(state.progress)}</p>` : '<p class="muted small">형광펜·플래그 프린트물은 "표시한 단어 찾기". 표시 못 하는 도서관 책은 "페이지 글 가져와서 탭하기"로 모르는 단어를 직접 골라요.</p>'}`;
  else if (add.tab === 'text') body = `
    <p class="muted">문장을 붙여넣으세요. 아이가 표시한 단어는 *별표*로 감싸면 그 단어만 찾아요. 표시가 없으면 어려운 단어를 골라줘요.</p>
    ${key ? '' : '<p class="info-line">문장 분석은 Gemini API 키 연결 후 사용할 수 있어요.</p>'}
    <textarea id="text" rows="6" placeholder="The *enormous* elephant walked slowly to the river.">${esc(add.text)}</textarea>
    <div class="button-row"><button class="primary" id="extractText" ${state.busy || !key ? 'disabled' : ''}>${state.busy ? '읽는 중…' : '✨ 표시한 단어 찾기'}</button></div>`;
  else body = `
    <div class="form-grid">
      <label>단어 (영어)<input id="m-word" value="${esc(add.manual.word || '')}" placeholder="enormous"></label>
      <label>한국어 뜻<input id="m-korean" value="${esc(add.manual.korean || '')}" placeholder="거대한"></label>
      <label class="wide">쉬운 영어 뜻<input id="m-def" value="${esc(add.manual.definition || '')}" placeholder="very, very big"></label>
      <label class="wide">책에서 본 문장<input id="m-ctx" value="${esc(add.manual.context || '')}" placeholder="An enormous elephant walked to the river."></label>
      <label>주제<select id="m-topic">${TOPICS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></label>
    </div>
    <p class="muted small">오답 보기는 다른 단어의 뜻에서 자동으로 만들어요.</p>
    <div class="button-row"><button class="primary" id="addManual">단어 추가</button></div>`;
  const pickedArr = [...add.picked];
  const foundWords = new Set(add.found.map(f => f.word.toLowerCase()));
  const page = add.sentences.length ? `<section class="panel">
    <div class="row between wrap"><h3>페이지에서 모르는 단어 탭하기</h3>
      <button class="primary" id="definePicked" ${!pickedArr.length || state.busy ? 'disabled' : ''}>${state.busy ? '읽는 중…' : `고른 단어 ${pickedArr.length}개 뜻 만들기`}</button></div>
    <p class="muted small">단어를 탭하면 골라져요. 다시 탭하면 취소.</p>
    <div class="page-text">${add.sentences.map(sen => `<p>${sen.split(/(\s+)/).map(tok => {
      const w = tok.toLowerCase().replace(/[^a-z'-]/g, '');
      if (!w || /^\s+$/.test(tok)) return esc(tok);
      const on = add.picked.has(w), had = foundWords.has(w);
      return `<span class="tapword ${on ? 'on' : ''} ${had ? 'had' : ''}" data-w="${esc(w)}">${esc(tok)}</span>`;
    }).join('')}</p>`).join('')}</div>
  </section>` : '';
  const found = add.found.length ? `<section class="panel">
    <div class="row between"><h3>찾은 단어 ${add.found.length}개</h3><button class="primary" id="addFound">선택한 단어 추가</button></div>
    ${add.note ? `<p class="info-line">${esc(add.note)}</p>` : '<p class="muted">표시한 단어와 문맥에 맞는 뜻인지 확인해 주세요. 뜻은 고칠 수 있어요.</p>'}
    ${add.found.map((f, i) => `<div class="found ${f.checked ? '' : 'off'}">
      <label class="chk"><input type="checkbox" data-i="${i}" ${f.checked ? 'checked' : ''}><b>${esc(f.word)}</b> <span class="muted">${esc(f.korean || '')}</span></label>
      <input data-def="${i}" value="${esc(f.definition)}">
      ${f.context ? `<p class="muted small">“${esc(f.context)}”</p>` : ''}
    </div>`).join('')}</section>` : '';
  return `<p class="eyebrow">COLLECT</p><h1>단어 추가하기</h1>
    <div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${add.tab === id ? 'active' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>
    <section class="panel">${body}</section>${found}${page}
    ${state.words.length < 8 ? `<p class="muted center"><button class="text-link" id="addSamples">예시 단어 8개로 체험하기</button></p>` : ''}`;
}
function bindAdd() {
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => { add.tab = b.dataset.tab; render(); });
  const ph = $('#photo'); if (ph) ph.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2e7) { toast('20MB 이하의 사진을 선택해 주세요.', 'error'); return; }
    try { const r = await ai.fileToBase64(f); add.image = r; add.imageFile = f; add.preview = r.preview; add.found = []; add.sentences = []; add.picked = new Set(); render(); } catch (err) { toast(err.message, 'error'); }
  };
  const imgOpts = () => ({ key: ai.getKey(), imageBase64: add.image.base64, mime: add.image.mime, age: state.profile.age, level: state.profile.level });
  const setProgress = m => { state.progress = m; const el = document.getElementById('aiProgress'); if (el) el.textContent = m; };
  // 본문 읽기: 기기 안 OCR(무료·빠름) → 실패하면 AI로
  const readPage = async () => {
    try { const s = await pageSentences(add.imageFile || add.image.preview, setProgress); if (s.length >= 2) return { sentences: s, note: '' }; } catch (e) { console.warn('OCR 실패, AI로 대체', e); }
    setProgress('AI로 본문을 읽는 중…');
    const pg = await ai.analyzePage({ ...imgOpts(), mode: 'page' });
    return { sentences: pg.sentences || [], note: pg.note || '' };
  };
  const ex = $('#extract'); if (ex) ex.onclick = () => runExtract(async () => {
    const r = await ai.analyzePage({ ...imgOpts(), mode: 'auto' });
    if (!(r.words || []).length) { // 표시가 없으면 본문을 읽어 탭 모드로
      const pg = await readPage();
      return { words: [], sentences: pg.sentences, note: r.note || pg.note || '' };
    }
    return r;
  });
  const exg = $('#extractPage'); if (exg) exg.onclick = () => runExtract(readPage, 'page');
  const exp = $('#extractPoint'); if (exp) exp.onclick = () => runExtract(() => ai.analyzePage({ ...imgOpts(), mode: 'point' }));
  document.querySelectorAll('.tapword').forEach(el => el.onclick = () => { const w = el.dataset.w; add.picked.has(w) ? add.picked.delete(w) : add.picked.add(w); render(); });
  const dp = $('#definePicked'); if (dp) dp.onclick = async () => {
    state.busy = true; render();
    try {
      const r = await ai.defineWords({ key: ai.getKey(), words: [...add.picked], sentences: add.sentences, age: state.profile.age, level: state.profile.level });
      const got = (r.words || []).filter(x => x.word && x.definition).map(x => ({ ...x, checked: true, distractors: Array.isArray(x.distractors) ? x.distractors : [] }));
      const have = new Set(add.found.map(f => f.word.toLowerCase()));
      add.found.push(...got.filter(g => !have.has(g.word.toLowerCase())));
      add.picked.clear();
      if (!got.length) toast('뜻을 만들지 못했어요. 다시 시도해 주세요.');
    } catch (err) { toast(err.message, 'error'); }
    state.busy = false; render();
  };
  const tx = $('#text'); if (tx) tx.oninput = e => { add.text = e.target.value; };
  const et = $('#extractText'); if (et) et.onclick = () => { if (!add.text.trim()) return toast('문장을 먼저 붙여넣어 주세요.'); runExtract(() => ai.extractFromText({ key: ai.getKey(), text: add.text, age: state.profile.age, level: state.profile.level })); };
  document.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { add.found[c.dataset.i].checked = c.checked; render(); });
  document.querySelectorAll('input[data-def]').forEach(c => c.oninput = () => { add.found[c.dataset.def].definition = c.value; });
  const af = $('#addFound'); if (af) af.onclick = async () => {
    const n = await addWords(add.found.filter(f => f.checked), add.tab);
    toast(n ? `${n}개 단어를 추가했어요.` : '새로 추가된 단어가 없어요 (이미 있는 단어).', n ? 'success' : 'info');
    add.found = []; add.image = null; add.preview = ''; add.text = ''; add.sentences = []; add.picked = new Set(); render();
  };
  const am = $('#addManual'); if (am) am.onclick = async () => {
    const w = { word: $('#m-word').value, korean: $('#m-korean').value, definition: $('#m-def').value, context: $('#m-ctx').value, topic: $('#m-topic').value, distractors: [] };
    if (!w.word.trim() || !w.definition.trim()) return toast('단어와 영어 뜻은 꼭 필요해요.');
    const n = await addWords([w]); toast(n ? `“${w.word}”를 추가했어요.` : '이미 있는 단어예요.', n ? 'success' : 'info'); add.manual = {}; render();
  };
  const as = $('#addSamples'); if (as) as.onclick = async () => { const n = await addWords(SAMPLE_WORDS, 'sample'); toast(`예시 단어 ${n}개를 넣었어요.`, 'success'); render(); };
  async function runExtract(fn, kind = 'words') {
    state.busy = true; state.progress = '사진을 보내는 중…'; render();
    try {
      const r = await fn();
      const words = (r.words || []).filter(x => x.word && x.definition).map(x => ({ ...x, checked: true, distractors: Array.isArray(x.distractors) ? x.distractors : [] }));
      if (kind === 'page') { // 본문만 갱신, 이미 찾은 단어는 유지
        add.sentences = Array.isArray(r.sentences) ? r.sentences.filter(x => typeof x === 'string' && x.trim()) : [];
        if (!add.sentences.length) toast('글을 읽지 못했어요. 더 밝은 곳에서 가까이 찍어 보세요.');
      } else {
        add.found = words; add.note = r.note || '';
        add.sentences = Array.isArray(r.sentences) ? r.sentences.filter(x => typeof x === 'string' && x.trim()) : [];
        if (!add.found.length) toast(add.sentences.length ? '표시된 단어가 없어서 페이지 글을 가져왔어요. 모르는 단어를 탭해 보세요.' : '단어를 찾지 못했어요. 더 밝은 곳에서 가까이 찍어 보세요.');
      }
      add.picked = new Set();
    } catch (err) { toast(err.message, 'error'); }
    state.busy = false; state.progress = ''; render();
  }
}

// ---------- 나의 단어 / 상세 ----------
const wordsView = { filter: 'all' };
function renderWords() {
  const list = state.words.filter(w => wordsView.filter === 'all' || srs.stage(w.progress) === wordsView.filter)
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  const f = [['all', '전체'], ['new', '새로운 발견'], ['growing', '키우는 중'], ['mastered', '오래 기억']];
  return `<p class="eyebrow">MY WORD UNIVERSE</p><div class="row between"><h1>나의 단어 <span class="muted">${state.words.length}</span></h1><a href="#add" class="btn primary">＋ 추가</a></div>
    <div class="tabs">${f.map(([id, l]) => `<button class="tab ${wordsView.filter === id ? 'active' : ''}" data-f="${id}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="orb-grid">${list.map((w, i) => `<div class="orb-card" data-word="${w.id}">${orb(w, i, true)}<div class="orb-card-text"><b>${esc(w.word)}</b><span class="muted">${esc(w.definition || w.korean)}</span>${w.progress.attempts ? `<small>${w.progress.mastered ? '✦ 오래 기억' : `복습 ${fmtDate(w.progress.due)}`}</small>` : ''}</div></div>`).join('')}</div>` : '<section class="panel"><p class="muted center">아직 단어가 없어요.</p></section>'}`;
}
function bindWords() {
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => { wordsView.filter = b.dataset.f; render(); });
  document.querySelectorAll('.orb-card').forEach(el => el.onclick = () => openWord(el.dataset.word));
}
function openWord(id) {
  const w = state.words.find(x => x.id === id); if (!w) return;
  const p = w.progress, t = p.tracks;
  const st = srs.stage(p);
  const dlg = $('#dialog');
  dlg.innerHTML = `<div class="dlg word-dlg">
    <div class="row between">
      <div><h2 class="word-title" style="font-size:1.7rem">${esc(w.word)} ${spk('d-speak', { flags: true })}</h2>${ko(w.korean, 'block')}</div>
      <button class="icon-btn" id="d-close" aria-label="닫기">✕</button>
    </div>
    <span class="pill">${st === 'new' ? '새로운 발견' : st === 'growing' ? '기억을 키우는 중' : '✦ 오래 기억하는 단어'}${p.attempts ? ` · 복습 ${fmtDate(p.due)}` : ''}</span>
    <label>영어 뜻<textarea id="d-def" rows="2">${esc(w.definition)}</textarea></label>
    <label><span class="row between">책에서 본 문장 ${w.context ? spk('d-speak-ctx', { size: 'sm' }) : ''}</span><textarea id="d-ctx" rows="3" placeholder="책에서 본 문장">${esc(w.context)}</textarea></label>
    <label><span class="row between">예문 ${w.example ? spk('d-speak-ex', { size: 'sm' }) : ''}</span><textarea id="d-ex" rows="2" placeholder="예문">${esc(w.example)}</textarea></label>
    ${p.attempts ? `<p class="muted small">뜻 이해 ${t.meaning.ok}✓ ${t.meaning.miss}✗ · 떠올리기 ${t.recall.ok}✓ ${t.recall.miss}✗ · 철자 ${t.spell.ok}✓ ${t.spell.miss}✗ · 설명 ${t.explain.ok}✓ ${t.explain.miss}✗ · 힌트 없이 떠올린 날 ${[...new Set(p.hintFreeDays)].length}일</p>` : ''}
    <div class="row between" style="margin-top:6px"><button class="text-link danger" id="d-del">이 단어 삭제</button><button class="primary" id="d-save">저장</button></div></div>`;
  dlg.hidden = false;
  dlg.querySelectorAll('textarea').forEach(el => { const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }; el.oninput = fit; fit(); });
  $('#d-close').onclick = () => { dlg.hidden = true; };
  dlg.onclick = e => { if (e.target === dlg) dlg.hidden = true; };
  $('#d-speak').onclick = () => speak(w.word);
  bindFlags(); bindKo();
  const se = $('#d-speak-ex'); if (se) se.onclick = () => speak($('#d-ex').value || w.example);
  const sc = $('#d-speak-ctx'); if (sc) sc.onclick = () => speak($('#d-ctx').value || w.context);
  $('#d-save').onclick = async () => { w.definition = $('#d-def').value.trim(); w.context = $('#d-ctx').value.trim(); w.example = $('#d-ex').value.trim(); await db.putWord(w); dlg.hidden = true; toast('저장했어요.', 'success'); render(); };
  $('#d-del').onclick = async () => { if (!confirm(`“${w.word}”를 삭제할까요? 학습 기록도 함께 지워져요.`)) return; await db.deleteWord(w.id); state.words = state.words.filter(x => x.id !== w.id); dlg.hidden = true; render(); };
}

// ---------- 기억 보관소 ----------
function renderMemory() {
  const m = state.words.filter(w => w.progress.mastered).sort((a, b) => (a.progress.masteredAt || '').localeCompare(b.progress.masteredAt || ''));
  const g = state.words.filter(w => srs.stage(w.progress) === 'growing').sort((a, b) => b.progress.step - a.progress.step).slice(0, 6);
  let seen = []; try { seen = JSON.parse(localStorage.getItem('wo.vaultSeen.' + state.profile.id) || '[]'); } catch {}
  const fresh = m.filter(w => !seen.includes(w.id)).map(w => w.id);
  try { localStorage.setItem('wo.vaultSeen.' + state.profile.id, JSON.stringify(m.map(w => w.id))); } catch {}
  return `<p class="eyebrow">MEMORY ROOM</p><h1>기억 보관소</h1>
    <p class="muted">여러 날에 걸쳐 힌트 없이 떠올린 단어가 구슬이 되어 굴러 들어와요. 가끔 다시 꺼내 보지만, 잊었다고 구슬을 빼앗지는 않아요.</p>
    <section class="panel hero">
      <div class="vault-scene">
        <div class="chute"></div>
        <div class="vault">
          ${m.map((w, i) => `<div class="orb-wrap-holder ${fresh.includes(w.id) ? 'rolling' : ''}" style="animation-delay:${fresh.indexOf(w.id) * 0.35}s">${orb(w, i)}</div>`).join('')}
          ${m.length ? '' : '<div class="vault-empty"><p class="muted">아직 보관소에 온 구슬이 없어요.<br>같은 단어를 3일 이상, 일주일 넘게 힌트 없이 떠올리면 여기로 굴러와요.</p></div>'}
        </div>
      </div>
      <p class="vault-count"><b>${m.length}</b><span class="muted"> 개의 구슬이 빛나고 있어요</span></p>
    </section>
    ${g.length ? `<h3>곧 굴러올 구슬</h3><div class="orb-grid">${g.map((w, i) => `<div class="orb-card" data-word="${w.id}">${orb(w, i + 2, true)}<div class="orb-card-text"><b>${esc(w.word)}</b><small>힌트 없이 ${[...new Set(w.progress.hintFreeDays)].length}일 · 간격 ${srs.INTERVALS[w.progress.step]}일</small></div></div>`).join('')}</div>` : ''}
    <section class="panel soft"><h3>복습 원리</h3><p class="muted">시간 간격을 두고, 답을 보지 않은 채 다시 떠올리는 연습이 장기 기억에 도움이 돼요. 이 앱은 1일 → 3일 → 1주 → 2주 → 1달 → 2달 간격으로 시작해서, 아이의 답에 따라 단어마다 간격을 조절해요.</p></section>`;
}
function bindMemory() { document.querySelectorAll('.orb-card, .vault .orb-wrap').forEach(el => el.onclick = () => openWord(el.dataset.word)); }

// ---------- 책 ----------
const booksView = { seed: 0, band: '', topic: '', kind: '', awardOnly: false, limit: 12, showShelf: false };
function bookCard(book, { slot, reason, burdenKey, reviewWords } = {}) {
  const rx = state.profile.bookReactions || {};
  const r = rx[book.title];
  const bandIdx = childBand(state.profile);
  const bk = burdenKey || (['easy', 'fit', 'stretch', 'together'][Math.max(0, Math.min(3, BANDS.indexOf(book.band) - bandIdx + 1))]);
  return `<section class="panel book ${hasAward(book) ? 'award' : ''}">
    ${slot ? `<p class="eyebrow">${slot}</p>` : ''}
    <h2>${esc(book.title)}</h2><p class="muted">${esc(book.author)}${book.year ? ` · ${book.year}` : ''}${book.pages ? ` · ${book.pages}쪽` : ''}</p>
    <div class="badges">
      ${book.sources.map(src => `<span class="badge ${src.source === 'CBCA' ? 'src' : 'prc'}">${esc(badgeText(src))}</span>`).join('')}
      <span class="badge">${BAND_LABEL[book.band]}</span><span class="badge">${KIND_LABEL[book.kind] || book.kind}</span><span class="badge burden-${bk}">${BURDEN_LABEL[bk]}</span>
    </div>
    ${reason ? `<p><b>우리 아이에게:</b> ${esc(reason)}</p>` : ''}
    ${book.summary ? `<p class="muted">${esc(book.summary)}</p>` : ''}
    ${book.themes && book.themes.length ? `<p class="muted small">주제: ${book.themes.map(esc).join(' · ')}</p>` : ''}
    ${reviewWords && reviewWords.length ? `<p class="muted small">배운 단어와 같은 주제: ${reviewWords.join(', ')}</p>` : ''}
    <div class="button-row">
      <button class="${r === 'skip' ? 'primary' : 'ghost'} small" data-react="skip" data-title="${esc(book.title)}">다른 책 볼래요</button>
      <button class="${r === 'want' ? 'primary' : 'ghost'} small" data-react="want" data-title="${esc(book.title)}">읽고 싶어요</button>
      <button class="${r === 'liked' ? 'primary' : 'ghost'} small" data-react="liked" data-title="${esc(book.title)}">읽었어요 · 재미있었어요</button>
      <button class="${r === 'hard' ? 'primary' : 'ghost'} small" data-react="hard" data-title="${esc(book.title)}">읽었어요 · 어려웠어요</button>
    </div></section>`;
}
function renderBooks() {
  const p = state.profile;
  const { cards, signals, bandIdx } = recommend(p, state.words, booksView.seed);
  const shelf = booksView.showShelf ? browse(p, { band: booksView.band || BANDS[bandIdx], topic: booksView.topic, kind: booksView.kind, awardOnly: booksView.awardOnly }) : [];
  const wants = Object.entries(p.bookReactions || {}).filter(([, v]) => v === 'want').map(([t]) => t);
  return `<p class="eyebrow">THE NEXT CHAPTER</p><h1>다음에 읽을 책</h1>
    <p class="muted">퀸즐랜드 Premier's Reading Challenge 목록과 CBCA 수상·후보작 ${STATS.total}권 중에서, ${esc(p.name)}의 학년(${BAND_LABEL[BANDS[bandIdx]]} 기준)과 관심사에 맞춰 골라요.</p>
    <section class="panel"><b>좋아하는 주제</b> <span class="muted small">(아이가 직접 고르기)</span>
      <div class="chips">${TOPICS.filter(t => t.id !== 'other').map(t => `<button class="chip ${(p.interests || []).includes(t.id) ? 'on' : ''}" data-topic="${t.id}">${t.name}</button>`).join('')}</div>
      ${signals.learning.length ? `<p class="muted small">최근 학습 주제: ${signals.learning.map(t => TOPICS.find(x => x.id === t)?.name || t).join(', ')} (보조로만 반영)</p>` : ''}
    </section>
    ${cards.map(c => bookCard(c.book, { slot: c.slot, reason: c.reason, burdenKey: c.burden, reviewWords: c.reviewWords })).join('')}
    <div class="button-row"><button class="ghost" id="reshuffle">🔄 다른 추천 보기</button><button class="ghost" id="toggleShelf">${booksView.showShelf ? '책장 닫기' : '📚 책장 둘러보기'}</button></div>
    ${booksView.showShelf ? `<section class="panel">
      <h3>책장 둘러보기</h3>
      <div class="chips">${BANDS.map(b => `<button class="chip ${(booksView.band || BANDS[bandIdx]) === b ? 'on' : ''}" data-band="${b}">${BAND_LABEL[b]}</button>`).join('')}</div>
      <div class="chips">${['', 'JF', 'F', 'NF', 'GN'].map(k => `<button class="chip ${booksView.kind === k ? 'on' : ''}" data-kind="${k}">${k ? KIND_LABEL[k] : '모든 종류'}</button>`).join('')}<button class="chip ${booksView.awardOnly ? 'on' : ''}" id="awardOnly">CBCA 수상·후보만</button></div>
      <div class="chips">${[''].concat(TOPICS.map(t => t.id)).map(t => `<button class="chip ${booksView.topic === t ? 'on' : ''}" data-ftopic="${t}">${t ? (TOPICS.find(x => x.id === t)?.name || t) : '모든 주제'}</button>`).join('')}</div>
      <p class="muted small">${shelf.length}권</p>
      ${shelf.slice(0, booksView.limit).map(b => bookCard(b)).join('')}
      ${shelf.length > booksView.limit ? `<button class="ghost big" id="moreShelf">더 보기 (${shelf.length - booksView.limit}권 남음)</button>` : ''}
    </section>` : ''}
    ${wants.length ? `<section class="panel soft"><h3>읽고 싶은 책 (${wants.length})</h3><p>${wants.map(esc).join(' · ')}</p><p class="muted small">도서관에서 빌릴 때 참고하세요. 읽고 나면 카드에서 "읽었어요"를 눌러주세요.</p></section>` : ''}
    <section class="panel soft"><h3>선정 출처</h3>
      <p><a href="https://readingchallenge.education.qld.gov.au/" target="_blank" rel="noopener">Queensland Premier's Reading Challenge</a> — 퀸즐랜드 교육부가 매년 내는 학년대별 도서 목록 (Prep–Year 9)</p>
      <p><a href="https://cbca.org.au/awards/" target="_blank" rel="noopener">CBCA Book of the Year</a> — 호주 아동도서협의회 아동문학상 수상작·아너북·최종 후보 (2018–2026)</p>
      <p class="muted small">이 목록은 기관이 선정한 책을 정리한 것이며, 기관이 이 앱을 인증한 것은 아니에요. 같은 학년대 안에서도 주제가 무거운 책이 있을 수 있으니 "함께 읽기" 표시가 있으면 먼저 살펴봐 주세요.</p></section>`;
}
function bindBooks() {
  document.querySelectorAll('.chip[data-topic]').forEach(b => b.onclick = async () => {
    const set = new Set(state.profile.interests || []); set.has(b.dataset.topic) ? set.delete(b.dataset.topic) : set.add(b.dataset.topic);
    await saveProfile({ interests: [...set] }); render();
  });
  document.querySelectorAll('[data-react]').forEach(b => b.onclick = async () => {
    const rx = { ...(state.profile.bookReactions || {}) };
    if (rx[b.dataset.title] === b.dataset.react) delete rx[b.dataset.title]; else rx[b.dataset.title] = b.dataset.react;
    const log = (state.profile.readLog || []).filter(e => e.title !== b.dataset.title);
    if (rx[b.dataset.title] === 'liked' || rx[b.dataset.title] === 'hard') {
      const book = BOOKS_ALL.find(x => x.title === b.dataset.title);
      log.push({ id: db.uid(), title: b.dataset.title, author: book?.author || '', band: book?.band || '', kind: book?.kind || '', date: srs.todayKey(), feeling: rx[b.dataset.title], source: 'app' });
    }
    await saveProfile({ bookReactions: rx, readLog: log });
    if (rx[b.dataset.title]) toast({ skip: '다른 책을 보여드릴게요.', want: '읽고 싶은 책으로 표시했어요.', liked: '재미있었다니 기뻐요! 비슷한 책을 더 찾아볼게요.', hard: '조금 쉬운 책을 골라볼게요.' }[b.dataset.react], 'success');
    render();
  });
  const rs = $('#reshuffle'); if (rs) rs.onclick = () => { booksView.seed += 1; render(); window.scrollTo(0, 0); };
  const ts = $('#toggleShelf'); if (ts) ts.onclick = () => { booksView.showShelf = !booksView.showShelf; render(); };
  document.querySelectorAll('.chip[data-band]').forEach(b => b.onclick = () => { booksView.band = b.dataset.band; booksView.limit = 12; render(); });
  document.querySelectorAll('.chip[data-kind]').forEach(b => b.onclick = () => { booksView.kind = b.dataset.kind; booksView.limit = 12; render(); });
  document.querySelectorAll('.chip[data-ftopic]').forEach(b => b.onclick = () => { booksView.topic = b.dataset.ftopic; booksView.limit = 12; render(); });
  const ao = $('#awardOnly'); if (ao) ao.onclick = () => { booksView.awardOnly = !booksView.awardOnly; render(); };
  const ms = $('#moreShelf'); if (ms) ms.onclick = () => { booksView.limit += 12; render(); };
}

// ---------- 나의 책장 ----------
const shelfView = { adding: false, editing: null, month: '' };
const SPINE_COLORS = ['#b9a8ff', '#a8d8b9', '#f5cf9a', '#a9cdef', '#f3b7d0', '#ffd6a5', '#c7e9b0', '#d7c5f5', '#f9c4c4', '#bde0fe'];
function spineColor(title) { let h = 0; for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SPINE_COLORS[h % SPINE_COLORS.length]; }
function spineHeight(e) { const base = { 'P-1': 96, '2-3': 110, '4-5': 124, '6-7': 136 }[e.band] || 116; let h = 0; for (const c of e.title) h = (h * 7 + c.charCodeAt(0)) % 17; return base + h; }
function monthKey(d) { return d.slice(0, 7); }
function monthLabel(k) { const [y, m] = k.split('-'); return `${y}년 ${Number(m)}월`; }
function shiftMonth(k, n) { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function renderShelf() {
  const p = state.profile, log = (p.readLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const today = srs.todayKey();
  if (!shelfView.month) shelfView.month = monthKey(today);
  const cur = shelfView.month;
  const inMonth = log.filter(e => monthKey(e.date) === cur).slice().reverse();
  const hasPrev = log.some(e => monthKey(e.date) < cur), hasNext = cur < monthKey(today);
  const newest = log.length ? log[log.length - 1].id : null;
  const form = shelfView.adding ? `<section class="panel">
      <h3>읽은 책 꽂기</h3>
      <div class="form-grid">
        <label class="wide">책 제목<input id="rl-title" placeholder="The Wild Robot" list="rl-titles"><datalist id="rl-titles">${BOOKS_ALL.map(b => `<option value="${esc(b.title)}">`).join('')}</datalist></label>
        <label>작가<input id="rl-author" placeholder="Peter Brown"></label>
        <label>읽은 날<input id="rl-date" type="date" value="${today}"></label>
        <label>어땠어요?<select id="rl-feeling"><option value="liked">재미있었어요</option><option value="ok">괜찮았어요</option><option value="hard">어려웠어요</option></select></label>
      </div>
      <div class="button-row"><button class="ghost" id="rl-cancel">취소</button><button class="primary" id="rl-save">책장에 꽂기</button></div>
    </section>` : '';
  return `<div class="row between wrap"><div><p class="eyebrow">MY BOOKSHELF</p><h1>${esc(p.name)}의 책장</h1><p class="muted">지금까지 <b>${log.length}권</b> 읽었어요.</p></div>
      <button class="ghost small" id="rl-export" title="엑셀로 내보내기" ${log.length ? '' : 'disabled'}>⬇ 엑셀</button></div>
    ${form}
    <section class="panel shelf-panel">
      <div class="row between">
        <button class="icon-btn" id="rl-prev" ${hasPrev ? '' : 'disabled'} aria-label="이전 달">‹</button>
        <div class="center"><h3 style="margin:0">${monthLabel(cur)}</h3><span class="muted small">${inMonth.length}권</span></div>
        <button class="icon-btn" id="rl-next" ${hasNext ? '' : 'disabled'} aria-label="다음 달">›</button>
      </div>
      <div class="shelf">
        ${inMonth.map(e => `<button class="spine ${e.id === newest ? 'new' : ''}" data-log="${e.id}" style="background:${spineColor(e.title)};height:${spineHeight(e)}px;width:${e.title.length > 18 ? 42 : e.title.length > 10 ? 38 : 34}px" title="${esc(e.title)}"><span class="spine-title">${esc(e.title)}</span><span class="spine-mark">${e.feeling === 'liked' ? '★' : e.feeling === 'hard' ? '△' : '○'}</span></button>`).join('')}
        <div class="shelf-board"></div>
      </div>
      ${inMonth.length ? '' : `<p class="muted center">${cur === monthKey(today) ? '이번 달에 꽂힌 책이 아직 없어요.' : '이 달에는 꽂힌 책이 없어요.'}</p>`}
      <button class="primary big" id="rl-add">＋ 읽은 책 꽂기</button>
    </section>
    <p class="muted small center">★ 재미있었어요 · ○ 괜찮았어요 · △ 어려웠어요 · 책등을 누르면 자세히 볼 수 있어요</p>`;
}
function bindShelf() {
  const add = $('#rl-add'); if (add) add.onclick = () => { shelfView.adding = true; render(); setTimeout(() => $('#rl-title')?.focus(), 50); };
  const cancel = $('#rl-cancel'); if (cancel) cancel.onclick = () => { shelfView.adding = false; render(); };
  const save = $('#rl-save'); if (save) save.onclick = async () => {
    const title = $('#rl-title').value.trim(); if (!title) return toast('책 제목을 적어 주세요.');
    const book = BOOKS_ALL.find(b => b.title.toLowerCase() === title.toLowerCase());
    const feeling = $('#rl-feeling').value;
    const log = (state.profile.readLog || []).filter(e => e.title.toLowerCase() !== title.toLowerCase());
    log.push({ id: db.uid(), title: book?.title || title, author: $('#rl-author').value.trim() || book?.author || '', band: book?.band || '', kind: book?.kind || '', date: $('#rl-date').value || srs.todayKey(), feeling, source: book ? 'app' : 'manual' });
    const rx = { ...(state.profile.bookReactions || {}) }; if (book && feeling !== 'ok') rx[book.title] = feeling; else if (book) rx[book.title] = 'liked';
    await saveProfile({ readLog: log, bookReactions: rx }); shelfView.adding = false; shelfView.month = monthKey(log[log.length - 1].date); toast('책장에 꽂았어요 📚', 'success'); render();
  };
  document.querySelectorAll('.spine').forEach(el => el.onclick = () => openReadLog(el.dataset.log));
  const pv = $('#rl-prev'); if (pv) pv.onclick = () => { shelfView.month = shiftMonth(shelfView.month, -1); render(); };
  const nx = $('#rl-next'); if (nx) nx.onclick = () => { shelfView.month = shiftMonth(shelfView.month, 1); render(); };
  const ex = $('#rl-export'); if (ex) ex.onclick = () => {
    const p = state.profile, log = (p.readLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const FEEL = { liked: '재미있었어요', ok: '괜찮았어요', hard: '어려웠어요' };
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['번호', '읽은 날', '책 제목', '작가', '학년대', '종류', '어땠어요', '출처'].map(q).join(',')]
      .concat(log.map((e, i) => [i + 1, e.date, e.title, e.author, e.band ? BAND_LABEL[e.band] : '', e.kind ? (KIND_LABEL[e.kind] || e.kind) : '', FEEL[e.feeling] || e.feeling, e.source === 'manual' ? '직접 입력' : '앱 추천 목록'].map(q).join(',')));
    const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }); // BOM: 엑셀에서 한글 깨짐 방지
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.name}-읽은책-${srs.todayKey()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    toast('엑셀에서 열 수 있는 파일로 저장했어요.', 'success');
  };
}
function openReadLog(id) {
  const e = (state.profile.readLog || []).find(x => x.id === id); if (!e) return;
  const dlg = $('#dialog');
  dlg.innerHTML = `<div class="dlg">
    <div class="row between"><h2>${esc(e.title)}</h2><button class="icon-btn" id="d-close">✕</button></div>
    <p class="muted">${esc(e.author || '')}${e.band ? ` · ${BAND_LABEL[e.band]}` : ''}${e.kind ? ` · ${KIND_LABEL[e.kind] || e.kind}` : ''}</p>
    <label>읽은 날<input id="rl-e-date" type="date" value="${e.date}"></label>
    <label>어땠어요?<select id="rl-e-feeling"><option value="liked" ${e.feeling === 'liked' ? 'selected' : ''}>재미있었어요</option><option value="ok" ${e.feeling === 'ok' ? 'selected' : ''}>괜찮았어요</option><option value="hard" ${e.feeling === 'hard' ? 'selected' : ''}>어려웠어요</option></select></label>
    <div class="button-row"><button class="ghost danger" id="rl-e-del">책장에서 빼기</button><button class="primary" id="rl-e-save">저장</button></div></div>`;
  dlg.hidden = false;
  $('#d-close').onclick = () => { dlg.hidden = true; };
  $('#rl-e-save').onclick = async () => {
    e.date = $('#rl-e-date').value || e.date; e.feeling = $('#rl-e-feeling').value;
    const rx = { ...(state.profile.bookReactions || {}) }; if (rx[e.title]) rx[e.title] = e.feeling === 'hard' ? 'hard' : 'liked';
    await saveProfile({ readLog: state.profile.readLog, bookReactions: rx }); dlg.hidden = true; render();
  };
  $('#rl-e-del').onclick = async () => {
    if (!confirm(`“${e.title}”를 책장에서 뺄까요?`)) return;
    const rx = { ...(state.profile.bookReactions || {}) }; delete rx[e.title];
    await saveProfile({ readLog: (state.profile.readLog || []).filter(x => x.id !== e.id), bookReactions: rx }); dlg.hidden = true; render();
  };
}

// ---------- 부모 리포트 ----------
function renderParents() {
  const p = state.profile, sum = srs.summarize(state.words, state.reviews);
  const key = ai.getKey();
  return `<p class="eyebrow">FOR PARENTS</p><h1>부모 리포트 · ${esc(p.name)}</h1>
    <section class="panel">
      <h3>기억 유지 상태</h3>
      <div class="stat-grid">
        <div><b>${sum.total}</b><span>등록한 단어</span></div>
        <div><b>${sum.byStage.mastered}</b><span>오래 기억하는 단어</span></div>
        <div><b>${sum.recallRate === null ? '–' : sum.recallRate + '%'}</b><span>하루 이상 지난 뒤 힌트 없이 떠올린 비율</span></div>
        <div><b>${sum.usedInSentence}</b><span>내 말로 설명한 단어</span></div>
        <div><b>${sum.activeDays}일</b><span>최근 7일 학습한 날</span></div>
        <div><b>${sum.upcoming}</b><span>앞으로 7일 복습 예정</span></div>
        <div><b>${(p.readLog || []).length}</b><span>책장에 꽂은 책</span></div>
      </div>
      ${sum.overdue ? `<p class="info-line">밀린 복습 ${sum.overdue}개 — 앱이 하루 예산만큼만 나눠서 배치해요.</p>` : ''}
      ${sum.struggling.length ? `<p><b>자주 혼동하는 단어:</b> ${sum.struggling.map(esc).join(', ')} <span class="muted small">— 다음 학습에서 쉬운 설명부터 보여줘요.</span></p>` : ''}
      <p class="muted small">이 수치는 앱에서 확인한 기억 유지 상태이며 영구 암기를 보장하는 건 아니에요.</p>
    </section>
    <section class="panel">
      <h3>아이 설정</h3>${profileForm(p)}
      <label class="chk"><input type="checkbox" id="pf-explain" ${p.allowExplain !== false ? 'checked' : ''}> '뜻 설명하기' 문제 포함 (AI 미연결 시 부모가 확인)</label>
      <div class="button-row"><button class="primary" id="saveProfile">저장</button></div>
    </section>
    <section class="panel">
      <div class="row between"><h3>AI 연결 (Google Gemini 무료 티어)</h3><span class="pill">${key && ai.getModel() ? `● 연결됨 · ${esc(ai.getModel())}` : '○ 연결 대기'}</span></div>
      <p class="muted">사진 속 표시 단어 읽기, 더 쉬운 설명, 뜻 설명 채점에만 사용해요. 복습 일정과 퀴즈는 AI 없이 동작해요.</p>
      <p class="muted small">키는 이 기기 브라우저에만 저장되고, 사진과 답변은 평가할 때 Google로 전송돼요. 원본 사진은 저장하지 않아요. 무료 키 발급: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> · <a href="guide.html#key">발급 방법 안내</a></p>
      <div class="form-grid">
        <label class="wide">Gemini API 키<input id="apikey" type="password" autocomplete="off" placeholder="AQ.… 또는 AIza…" value="${esc(key)}"></label>
        <label>모델 <span class="muted small">(연결 확인 시 자동 선택)</span><select id="model"><option value="">자동</option>${ai.getModelList().map(m => `<option ${ai.getModel() === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      </div>
      <div class="button-row"><button class="ghost" id="aiDisconnect" ${key ? '' : 'disabled'}>연결 해제</button><button class="primary" id="aiConnect" ${state.busy ? 'disabled' : ''}>${state.busy ? '확인 중…' : '연결 확인'}</button></div>
    </section>
    <section class="panel">
      <h3>지인에게 알려주기</h3>
      <p class="muted">앱 주소만 보내면 돼요. 각 가정이 자기 무료 키를 넣어 쓰므로 비용도, 기록 공유도 없어요.</p>
      <div class="button-row"><button class="ghost" id="shareApp">🔗 앱 주소 복사</button><a class="btn ghost" href="guide.html" target="_blank">시작 안내 보기</a></div>
    </section>
    <section class="panel">
      <h3>데이터</h3>
      <p class="muted">모든 기록은 이 기기에만 있어요. 기기를 바꾸거나 백업하려면 내보내기 파일을 저장해 두세요.</p>
      <div class="button-row">
        <button class="ghost" id="exportData">백업 내보내기</button>
        <label class="btn ghost">백업 가져오기 <input type="file" id="importData" accept="application/json" hidden></label>
        <button class="ghost" id="addProfile">아이 프로필 추가</button>
        <button class="ghost danger" id="deleteProfile">이 프로필 삭제</button>
      </div>
    </section>`;
}
function bindParents() {
  bindProfileForm();
  $('#saveProfile').onclick = async () => { await saveProfile({ ...readProfileForm(), allowExplain: $('#pf-explain').checked }); toast('저장했어요.', 'success'); render(); };
  $('#aiConnect').onclick = async () => {
    const k = $('#apikey').value.trim(); const m = $('#model').value;
    if (!k) return toast('API 키를 입력해 주세요.');
    state.busy = true; render();
    try { const chosen = await ai.testConnection({ key: k, model: m }); ai.setKey(k); toast(`AI를 연결했어요 (${chosen}). 이제 사진으로 단어를 추가할 수 있어요.`, 'success'); }
    catch (err) { toast(err.message, 'error'); }
    state.busy = false; render();
  };
  $('#aiDisconnect').onclick = () => { ai.setKey(''); toast('연결을 해제했어요.'); render(); };
  $('#shareApp').onclick = async () => {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'guide.html';
    try { if (navigator.share) await navigator.share({ title: 'Word Orbit', text: '책에서 만난 단어가 오래 남는 기억으로 — 아이 단어장 앱', url }); else { await navigator.clipboard.writeText(url); toast('안내 페이지 주소를 복사했어요.', 'success'); } } catch {}
  };
  $('#exportData').onclick = async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `word-orbit-backup-${srs.todayKey()}.json`; a.click();
  };
  $('#importData').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await db.importAll(JSON.parse(await f.text())); await loadProfile(); toast('백업을 가져왔어요.', 'success'); render(); } catch (err) { toast(err.message, 'error'); }
  };
  $('#addProfile').onclick = async () => {
    const name = prompt('아이 이름'); if (!name) return;
    const p = { id: db.uid(), created: new Date().toISOString(), name, age: 7, level: 'beginner', minutes: 10, newPerDay: 3, interests: [], bookReactions: {}, allowExplain: true };
    await db.putProfile(p); await loadProfile(p.id); state.route = 'parents'; render();
  };
  $('#deleteProfile').onclick = async () => {
    if (state.profiles.length < 2) return toast('마지막 프로필은 삭제할 수 없어요.');
    if (!confirm(`${state.profile.name}의 프로필과 단어, 기록을 모두 삭제할까요?`)) return;
    for (const w of state.words) await db.deleteWord(w.id);
    await db.deleteProfile(state.profile.id); await loadProfile(); render();
  };
}

// ---------- 시작 ----------
function router() {
  const r = location.hash.replace('#', '') || 'home';
  state.route = ['home', 'add', 'words', 'memory', 'books', 'shelf', 'parents'].includes(r) ? r : 'home';
  state.session = null; render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);
(async () => {
  try {
    await loadProfile();
    router();
    window.__woBooted = true; clearTimeout(window.__woBootTimer);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (err) { (window.__woShowError || alert)(err && err.message ? err.message : String(err)); }
})();
