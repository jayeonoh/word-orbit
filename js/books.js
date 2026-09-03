// books.js — AI 없이 규칙으로 도서 추천.
// 공신력은 선정 근거(BOOKS의 source/award/year)에서, 개인화는 아이의 반응과 학습 기록에서.
import { BOOKS } from './data.js?v=5';

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

function ageFits(book, age) { return age >= book.ages[0] - 1 && age <= book.ages[1] + 1; }
function levelOrder(l) { return { easy: 0, medium: 1, challenge: 2 }[l]; }
// 아이의 영어 수준에 따라 '편하게 읽는 난이도'
function comfortLevel(level) { return { beginner: 'easy', intermediate: 'medium', advanced: 'challenge' }[level] || 'easy'; }

export function recommend(profile, words) {
  const sig = interestSignals(profile, words);
  const reactions = profile.bookReactions || {};
  const age = profile.age || 8;
  const comfort = comfortLevel(profile.level);
  // 나이에 맞고, 아직 '다른 책 볼래요'/'읽었어요' 하지 않은 책
  const pool = BOOKS.filter(b => ageFits(b, age) && !['skip', 'liked', 'hard'].includes(reactions[b.title]));
  const used = new Set();
  const pick = (filter, reason) => {
    const c = pool.find(b => !used.has(b.title) && filter(b));
    if (c) { used.add(c.title); return { book: c, reason }; }
    return null;
  };
  const cards = [];
  // ① 좋아할 만한 책: 확인된 관심사 + 편한 난이도
  const fav = pick(b => levelOrder(b.level) <= levelOrder(comfort) && b.topics.some(t => sig.confirmed.includes(t)),
    sig.confirmed.length ? `좋아하는 주제(${sig.confirmed.join(', ')})와 잘 맞고 편하게 읽을 수 있어요.` : '')
    || pick(b => levelOrder(b.level) <= levelOrder(comfort) && b.topics.some(t => sig.candidate.includes(t)), '읽고 싶다고 한 책과 비슷한 주제예요.')
    || pick(b => b.level === comfort, '지금 읽기 수준에 편한 책이에요.');
  if (fav) cards.push({ slot: '좋아할 만한 책', ...fav });
  // ② 지금 배우는 것과 이어지는 책: 최근 단어 주제
  const link = pick(b => levelOrder(b.level) <= levelOrder(comfort) + 1 && b.topics.some(t => sig.learning.includes(t)),
    sig.learning.length ? `최근 배운 단어 주제(${sig.learning.join(', ')})가 이어져요.` : '');
  if (link) cards.push({ slot: '지금 배우는 것과 이어지는 책', ...link });
  // ③ 새롭게 도전할 책: 수준은 맞추되 다른 주제
  const known = new Set([...sig.confirmed, ...sig.candidate, ...sig.learning]);
  const challenge = pick(b => levelOrder(b.level) === Math.min(2, levelOrder(comfort) + 1) && !b.topics.some(t => known.has(t)), '읽기 수준에 맞으면서 새로운 주제를 만나요.')
    || pick(b => levelOrder(b.level) === Math.min(2, levelOrder(comfort) + 1), '조금 도전이 되는 난이도예요.')
    || pick(() => true, '새로운 이야기를 만나봐요.');
  if (challenge) cards.push({ slot: '새롭게 도전할 책', ...challenge });

  // 배운 단어가 다시 나올 수 있는 책 — 본문 자료가 없으므로 주제 일치만 표시 (단어 등장은 보장하지 않음)
  cards.forEach(c => {
    c.reviewWords = words.filter(w => w.progress.attempts > 0 && c.book.topics.includes(w.topic)).slice(0, 4).map(w => w.word);
  });
  return { cards, signals: sig };
}
