// books.js — AI 없이 규칙으로 도서 추천.
// 공신력은 선정 근거(BOOKS의 sources: 퀸즐랜드 PRC 목록·CBCA 수상/후보)에서, 개인화는 아이의 반응과 학습 기록에서.
import { BOOKS } from './books-data.js?v=8';
export { BOOKS };

export const BANDS = ['P-1', '2-3', '4-5', '6-7'];
export const BAND_LABEL = { 'P-1': 'Prep–Year 1', '2-3': 'Year 2–3', '4-5': 'Year 4–5', '6-7': 'Year 6–7' };
export const KIND_LABEL = { JF: '그림책·짧은 이야기', F: '챕터북', NF: '논픽션', GN: '그래픽노블' };
export const TOPIC_KO = { animals: '동물', adventure: '모험', space: '우주', nature: '자연', friendship: '우정', school: '학교', family: '가족', fantasy: '판타지', science: '과학', sports: '운동', humour: '유머', mystery: '미스터리', history: '역사', other: '기타' };

// 아이의 학년 → PRC 학년대. 영어 수준으로 한 단계 조정 (기초면 한 단계 아래를 '편한 책'으로)
export function gradeFromAge(age) { const a = Number(age) || 8; return Math.max(0, Math.min(6, a - 5)); } // 호주: 5세 Prep(0), 6세 Year 1 …
export function childBand(profile) {
  const g = profile.grade === undefined || profile.grade === null || profile.grade === '' ? gradeFromAge(profile.age) : Number(profile.grade);
  let i = g <= 1 ? 0 : g <= 3 ? 1 : g <= 5 ? 2 : 3;
  if (profile.level === 'beginner') i = Math.max(0, i - 1);
  if (profile.level === 'advanced') i = Math.min(3, i + 1);
  return i; // BANDS 인덱스
}

// 읽기 부담: 아이 학년대 기준 아래/같음/위
export function burden(book, bandIdx) {
  const d = BANDS.indexOf(book.band) - bandIdx;
  return d < 0 ? 'easy' : d === 0 ? 'fit' : d === 1 ? 'stretch' : 'together';
}
export const BURDEN_LABEL = { easy: '가볍게 읽기', fit: '혼자 읽기', stretch: '조금 도전', together: '함께 읽기' };

export function badgeText(src) {
  if (src.source === 'CBCA') return `CBCA ${src.year} ${src.result === 'Winner' ? '수상작' : src.result === 'Honour' ? '아너북' : '최종 후보'} · ${src.category}`;
  if (src.source === 'QLD PRC') return `QLD Premier's Reading Challenge ${src.year} 목록`;
  return `${src.source} ${src.year}`;
}
export function hasAward(book) { return book.sources.some(s => s.source === 'CBCA'); }

// 관심사 판단 우선순위
//  1. 확인된 관심사: 아이가 직접 고른 주제 + "재미있었어요" 반응 (가장 강하게)
//  2. 관심 주제 후보: 읽고 싶어요 누른 책의 주제
//  3. 최근 학습 주제: 최근 등록한 단어의 topic (보조)
export function interestSignals(profile, words) {
  const confirmed = new Set(profile.interests || []);
  const candidate = new Set();
  const learning = new Map();
  const reactions = profile.bookReactions || {};
  BOOKS.forEach(b => {
    const r = reactions[b.title];
    if (r === 'liked') b.topics.forEach(t => confirmed.add(t));
    if (r === 'want') b.topics.forEach(t => candidate.add(t));
  });
  words.slice().sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 20)
    .forEach(w => learning.set(w.topic || 'other', (learning.get(w.topic || 'other') || 0) + 1));
  const learningTop = [...learning.entries()].filter(([t]) => t !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
  return { confirmed: [...confirmed], candidate: [...candidate], learning: learningTop };
}

// 결정적 셔플 — seed가 바뀌면 다른 후보 ("다른 추천 보기")
function seeded(seed) { let x = (seed * 9301 + 49297) % 233280; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }

export function recommend(profile, words, seed = 0) {
  const sig = interestSignals(profile, words);
  const reactions = profile.bookReactions || {};
  const bandIdx = childBand(profile);
  const rnd = seeded(seed + 1);
  // 후보: 아이 학년대 ±1, 아직 반응하지 않은 책. 수상작을 앞에, 나머지는 섞어서
  const pool = BOOKS.filter(b => Math.abs(BANDS.indexOf(b.band) - bandIdx) <= 1 && !reactions[b.title])
    .map(b => ({ b, r: rnd() + (hasAward(b) ? -0.35 : 0) })).sort((x, y) => x.r - y.r).map(x => x.b);
  const used = new Set();
  const pick = (filter, reason) => {
    const c = pool.find(b => !used.has(b.title) && filter(b));
    if (c) { used.add(c.title); return { book: c, reason }; }
    return null;
  };
  const isFit = b => burden(b, bandIdx) === 'fit';
  const isEasyOrFit = b => ['easy', 'fit'].includes(burden(b, bandIdx));
  const isStretch = b => burden(b, bandIdx) === 'stretch';
  const topicName = t => TOPIC_KO[t] || t;
  const cards = [];
  // ① 좋아할 만한 책: 확인된 관심사 + 편한 난이도
  const fav = pick(b => isEasyOrFit(b) && b.topics.some(t => sig.confirmed.includes(t)),
    sig.confirmed.length ? `좋아하는 주제(${sig.confirmed.map(topicName).join(', ')})와 잘 맞고 편하게 읽을 수 있어요.` : '')
    || pick(b => isEasyOrFit(b) && b.topics.some(t => sig.candidate.includes(t)), '읽고 싶다고 한 책과 비슷한 주제예요.')
    || pick(b => isFit(b) && b.kind !== 'NF', '지금 학년에 편하게 읽을 수 있는 책이에요.');
  if (fav) cards.push({ slot: '좋아할 만한 책', ...fav });
  // ② 지금 배우는 것과 이어지는 책: 최근 단어 주제
  const link = pick(b => isEasyOrFit(b) && b.topics.some(t => sig.learning.includes(t)),
    sig.learning.length ? `최근 배운 단어 주제(${sig.learning.map(topicName).join(', ')})가 이어져요.` : '')
    || pick(b => isFit(b) && b.kind === 'NF', '배운 단어가 실제 지식과 연결되는 논픽션이에요.');
  if (link) cards.push({ slot: '지금 배우는 것과 이어지는 책', ...link });
  // ③ 새롭게 도전할 책: 한 단계 위 + 다른 주제
  const known = new Set([...sig.confirmed, ...sig.candidate, ...sig.learning]);
  const challenge = pick(b => isStretch(b) && !b.topics.some(t => known.has(t)), '읽기 수준에 맞으면서 새로운 주제를 만나요.')
    || pick(b => isStretch(b), '조금 도전이 되는 난이도예요.')
    || pick(b => isFit(b), '새로운 이야기를 만나봐요.');
  if (challenge) cards.push({ slot: '새롭게 도전할 책', ...challenge });

  cards.forEach(c => {
    c.burden = burden(c.book, bandIdx);
    // 본문 자료가 없으므로 주제 일치만 표시 (단어 등장은 보장하지 않음)
    c.reviewWords = words.filter(w => w.progress.attempts > 0 && c.book.topics.includes(w.topic)).slice(0, 4).map(w => w.word);
  });
  return { cards, signals: sig, bandIdx };
}

// 책장 둘러보기: 학년대·주제·종류 필터
export function browse(profile, { band, topic, kind, awardOnly } = {}) {
  const reactions = profile.bookReactions || {};
  const b = band || BANDS[childBand(profile)];
  return BOOKS.filter(x => x.band === b && (!topic || x.topics.includes(topic)) && (!kind || x.kind === kind) && (!awardOnly || hasAward(x)))
    .sort((x, y) => (hasAward(y) ? 1 : 0) - (hasAward(x) ? 1 : 0) || (reactions[x.title] ? 1 : 0) - (reactions[y.title] ? 1 : 0) || x.title.localeCompare(y.title));
}

export const STATS = { total: BOOKS.length, byBand: BANDS.map(b => [b, BOOKS.filter(x => x.band === b).length]), awards: BOOKS.filter(hasAward).length };
