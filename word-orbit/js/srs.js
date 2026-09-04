// srs.js — 기억곡선(간격 반복) 로직. AI 없이 순수 계산 규칙으로만 동작합니다.
//
// 원칙
//  1. 단어마다 복습 일정이 다르다. 초기 일정은 1일 → 3일 → 1주 → 2주 → 1달 → 2달 (설계값, 사용 결과로 조정)
//  2. 한 단어의 모든 활동을 매번 시키지 않는다. 회차마다 문제 유형이 바뀐다 (뜻 고르기 → 단어 말하기 → 철자 → 뜻 설명…)
//  3. 뜻 이해 · 단어 떠올리기 · 철자는 따로 기록한다. 철자를 틀렸다고 뜻 기억까지 처음으로 돌리지 않는다.
//  4. 하루 학습량은 '복습 부담'을 보고 새 단어 수를 자동으로 줄이거나 늘린다.
//  5. '오래 기억하는 단어'(장기 보관소) 판정은 푼 문제 수가 아니라, 여러 날에 걸쳐 힌트 없이 떠올린 기록으로 한다.

export const INTERVALS = [1, 3, 7, 14, 30, 60]; // days
export const MODES = {
  meaning: { label: '뜻 고르기', en: 'Find the meaning' },
  recall:  { label: '단어 말하기', en: 'Say the word' },
  spell:   { label: '철자 쓰기', en: 'Write the word' },
  explain: { label: '뜻 설명하기', en: 'Tell me what it means' },
};

export function todayKey(d = new Date()) {
  // 기기의 현지 날짜 (브리즈번에서 쓰면 브리즈번 기준)
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

export function newProgress(today = todayKey()) {
  return {
    step: 0,            // INTERVALS 인덱스
    due: today,         // 다음 복습일 (YYYY-MM-DD)
    attempts: 0,
    successes: 0,       // 힌트 유무 상관없이 맞힌 횟수 (문제 유형 순환에 사용)
    hintFreeDays: [],   // 힌트 없이 떠올린 날짜들 (장기 기억 판정)
    tracks: {           // 영역별 기록
      meaning: { ok: 0, miss: 0 },
      recall:  { ok: 0, miss: 0 },
      spell:   { ok: 0, miss: 0 },
      explain: { ok: 0, miss: 0 },
    },
    needsSpell: false,  // 철자만 별도 연습 필요
    needsSimplify: false, // 뜻을 혼동함 → 다음에 쉬운 설명부터
    mastered: false,
    masteredAt: null,
    lastReviewed: null,
    lastResult: null,
  };
}

export function stage(p) {
  if (p.mastered) return 'mastered';
  if (p.attempts === 0) return 'new';
  return 'growing';
}

export function isDue(p, today = todayKey()) {
  return p.due <= today;
}

// 회차마다 문제 유형을 바꾼다. 원래 앱의 순환 규칙을 따르되 explain은 옵션.
export function pickMode(p, { allowExplain = false } = {}) {
  if (p.attempts === 0 || p.successes === 0) return 'meaning';
  if (p.needsSpell) return 'spell';
  const s = p.successes;
  if (s % 3 === 0 && allowExplain) return 'explain';
  if (s % 2 === 0) return 'spell';
  return 'recall';
}

// 장기 기억 판정: 힌트 없이 떠올린 날이 3일 이상이고, 첫날과 마지막날 사이가 7일 이상
function checkMastered(p) {
  const days = [...new Set(p.hintFreeDays)].sort();
  return days.length >= 3 && daysBetween(days[0], days[days.length - 1]) >= 7 && p.step >= 3;
}

export function applyResult(p, mode, correct, hinted, today = todayKey()) {
  const n = JSON.parse(JSON.stringify(p));
  n.attempts += 1;
  n.lastReviewed = today;
  n.lastResult = { mode, correct, hinted, date: today };
  const t = n.tracks[mode] || (n.tracks[mode] = { ok: 0, miss: 0 });

  if (correct) {
    t.ok += 1;
    n.successes += 1;
    if (mode === 'spell') n.needsSpell = false;
    if (mode === 'meaning') n.needsSimplify = false;
    if (!hinted && (mode === 'recall' || mode === 'explain' || mode === 'spell')) {
      if (!n.hintFreeDays.includes(today)) n.hintFreeDays.push(today);
    }
    // 현재 단계의 간격만큼 뒤에 다시 만남 (1일 → 3일 → 7일 …). 힌트 없이 맞히면 다음 단계로, 힌트 썼으면 같은 단계 유지
    n.due = addDays(today, INTERVALS[n.step]);
    if (!hinted) n.step = Math.min(n.step + 1, INTERVALS.length - 1);
  } else {
    t.miss += 1;
    if (mode === 'spell') {
      // 뜻 기억은 유지. 철자만 따로 연습.
      n.needsSpell = true;
      n.due = addDays(today, Math.max(1, Math.floor(INTERVALS[n.step] / 2)));
    } else if (mode === 'recall' || mode === 'explain') {
      // 알아보긴 하지만 스스로 못 떠올림 → 가까운 시일에 다시
      n.step = Math.max(0, n.step - 1);
      n.due = addDays(today, 1);
    } else {
      // 뜻을 혼동 → 쉬운 설명 후 짧은 간격
      n.step = 0;
      n.needsSimplify = true;
      n.due = today; // 오늘 세션 안에서 다시 만남
    }
  }

  if (!n.mastered && checkMastered(n)) { n.mastered = true; n.masteredAt = today; }
  // 장기 보관 단어도 가끔 다시 꺼내본다. 잊었다고 구슬을 빼앗지는 않는다.
  if (n.mastered && !correct) { n.step = Math.max(2, n.step - 1); n.due = addDays(today, INTERVALS[n.step]); }
  return n;
}

// 오늘의 학습 구성
// budget: 하루 목표 분 → 문제 수 (약 50초/문제). 복습이 많으면 새 단어를 줄인다.
export function buildSession(words, profile, today = todayKey()) {
  const minutes = profile.minutes || 10;
  const budget = Math.max(4, Math.round(minutes * 1.2));
  const maxNew = profile.newPerDay || 4;

  const due = words.filter(w => w.progress.attempts > 0 && isDue(w.progress, today));
  const fresh = words.filter(w => w.progress.attempts === 0);

  // 밀린 복습 정렬: 오래 밀린 것 먼저, 장기 보관 단어는 뒤로
  due.sort((a, b) => {
    if (a.progress.mastered !== b.progress.mastered) return a.progress.mastered ? 1 : -1;
    return a.progress.due.localeCompare(b.progress.due);
  });
  // 여러 날 쉬었으면 한 번에 다 시키지 않고 예산만큼만
  const review = due.slice(0, budget);
  const carried = due.length - review.length;

  let newCount = Math.min(maxNew, Math.max(0, budget - review.length));
  if (review.length >= budget * 0.8) newCount = Math.min(newCount, 1);
  // 최근 복습 정확도가 낮으면 새 단어를 줄인다
  const recentMiss = words.filter(w => w.progress.lastResult && w.progress.lastResult.correct === false && daysBetween(w.progress.lastResult.date, today) <= 3).length;
  if (recentMiss >= 4) newCount = Math.min(newCount, 2);

  // 새 단어는 등록 순서대로 (오래된 것부터)
  fresh.sort((a, b) => (a.created || '').localeCompare(b.created || ''));
  const intro = fresh.slice(0, newCount);

  return { review, intro, carried, budget, waiting: fresh.length - intro.length };
}

// 부모 리포트 지표
export function summarize(words, reviews, today = todayKey()) {
  const total = words.length;
  const byStage = { new: 0, growing: 0, mastered: 0 };
  words.forEach(w => byStage[stage(w.progress)]++);

  // 시간이 지난 뒤(하루 이상) 힌트 없이 떠올린 비율
  const delayed = reviews.filter(r => r.mode !== 'meaning' && r.gapDays >= 1);
  const delayedOk = delayed.filter(r => r.correct && !r.hinted).length;
  const recallRate = delayed.length ? Math.round(100 * delayedOk / delayed.length) : null;

  const last7 = reviews.filter(r => daysBetween(r.date, today) < 7);
  const activeDays = new Set(last7.map(r => r.date)).size;
  const upcoming = words.filter(w => w.progress.attempts > 0 && daysBetween(today, w.progress.due) <= 7 && daysBetween(today, w.progress.due) >= 0).length;
  const overdue = words.filter(w => w.progress.attempts > 0 && w.progress.due < today).length;

  const usedInSentence = words.filter(w => (w.progress.tracks.explain?.ok || 0) > 0).length;
  const struggling = words.filter(w => !w.progress.mastered && (w.progress.tracks.meaning.miss + w.progress.tracks.recall.miss) >= 3)
    .map(w => w.word);

  return { total, byStage, recallRate, activeDays, upcoming, overdue, usedInSentence, struggling, reviewsLast7: last7.length };
}

export function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z']/g, '');
}
