// ai.js — Google Gemini (무료 티어) 호출. 서버 없이 브라우저에서 직접 호출합니다.
// 키는 이 기기의 localStorage에만 저장되고, 사진은 추출 후 보관하지 않습니다.
// AI가 하는 일은 딱 네 가지: 사진/문장에서 표시된 단어 추출, 더 쉬운 설명, 뜻 설명 채점, 연결 확인.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// 모델 이름은 고정하지 않습니다. 구글이 세대를 올리면 옛 이름이 막히므로, 연결할 때 목록을 받아와 자동으로 고릅니다.
export const DEFAULT_MODEL = '';
export const MODEL_OPTIONS = [];

export function getKey() { try { return localStorage.getItem('wo.geminiKey') || ''; } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem('wo.geminiKey', k) : localStorage.removeItem('wo.geminiKey'); } catch {} }
export function getModel() { try { return localStorage.getItem('wo.geminiModel') || ''; } catch { return ''; } }
export function setModel(m) { try { m ? localStorage.setItem('wo.geminiModel', m) : localStorage.removeItem('wo.geminiModel'); } catch {} }
export function getModelList() { try { return JSON.parse(localStorage.getItem('wo.geminiModels') || '[]'); } catch { return []; } }

// 이 키로 지금 쓸 수 있는 generateContent 모델 목록
export async function listModels(key) {
  const res = await fetch(`${ENDPOINT}?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `모델 목록을 받지 못했어요 (${res.status})`);
  const names = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => /gemini/i.test(n) && !/embedding|tts|audio|image-generation|live|thinking-exp|robotics|computer-use/i.test(n));
  try { localStorage.setItem('wo.geminiModels', JSON.stringify(names)); } catch {}
  return names;
}

// 무료 티어에 알맞은 모델 고르기: flash 계열 중 가장 최신, lite/preview는 뒤로
export function rankModels(names, preferred = '') {
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]) || 0;
  const score = n => ver(n) * 100 + (/flash/.test(n) ? 20 : 0) - (/lite/.test(n) ? 5 : 0) - (/preview|exp|-\d{2,}$/.test(n) ? 10 : 0) - (/pro/.test(n) ? 8 : 0);
  const sorted = names.slice().sort((a, b) => score(b) - score(a));
  if (preferred && sorted.includes(preferred)) return [preferred, ...sorted.filter(n => n !== preferred)];
  return sorted;
}
export function pickModel(names, preferred = '') { return rankModels(names, preferred)[0] || ''; }

// 붐빔(503/429 high demand) 시 다음 후보 모델로 자동 재시도
function isBusy(status, msg) { return status === 503 || /high demand|overloaded|try again later|resource exhausted/i.test(msg || ''); }

async function call({ key, model, parts, json = true, temperature = 0.3 }) {
  if (!key) throw new Error('Gemini API 키를 먼저 설정해 주세요. (부모 리포트)');
  model = model || getModel();
  if (!model) throw new Error('먼저 부모 리포트에서 "연결 확인"을 눌러 모델을 정해 주세요.');
  // 후보: 선택 모델 + flash 계열 2개 (pro 계열은 느려서 자동 후보에서 제외)
  const ranked = rankModels(getModelList(), model).filter(n => n === model || (/flash/.test(n) && !/pro/.test(n)));
  const candidates = ranked.slice(0, 3);
  if (!candidates.length) candidates.push(model);
  let lastErr = null;
  for (const m of candidates) {
    try { onProgress(`${m} 로 요청 중…`); return await callOnce({ key, model: m, parts, json, temperature }); }
    catch (err) { lastErr = err; if (!err.busy) throw err; onProgress(`${m} 붐빔 → 다음 모델로`); }
  }
  throw new Error((lastErr && lastErr.message) || '잠시 후 다시 시도해 주세요.');
}

// 진행 상황 알림 (photo-test 등에서 표시). 기본은 콘솔.
let progressHandler = msg => console.log('[ai]', msg);
export function onProgressChange(fn) { progressHandler = fn || (() => {}); }
function onProgress(msg) { try { progressHandler(msg); } catch {} }

const TIMEOUT_MS = 40000; // 한 번의 요청은 40초까지만 기다림

async function callOnce({ key, model, parts, json, temperature }) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
  } catch (err) {
    const e = new Error(err.name === 'AbortError' ? `응답이 40초 넘게 없어요 (${model}).` : `네트워크 오류: ${err.message}`); e.busy = true; throw e;
  } finally { clearTimeout(timer); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `요청 실패 (${res.status})`;
    if (isBusy(res.status, msg)) { const e = new Error(`AI가 지금 붐벼요 (${model}). 잠시 후 다시 시도해 주세요.`); e.busy = true; throw e; }
    if (res.status === 429) throw new Error('오늘의 무료 사용량을 넘었거나 요청이 너무 빨라요. 잠시 후 다시 시도해 주세요.');
    if (res.status === 404) throw new Error('모델 이름이 더 이상 유효하지 않아요. 부모 리포트에서 "연결 확인"을 다시 눌러 주세요.');
    if (res.status === 400 || res.status === 403) throw new Error('API 키를 확인해 주세요. ' + msg);
    throw new Error(msg);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!json) return text;
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error('AI 응답을 읽지 못했어요. 다시 시도해 주세요.');
  }
}

function levelText(age, level) {
  const lv = { beginner: 'beginner English reader (simple words, short sentences)', intermediate: 'intermediate English reader', advanced: 'confident English reader' }[level] || 'young English learner';
  return `The child is ${age || 8} years old and is a ${lv}. Interests should stay age-appropriate; language difficulty should match reading level.`;
}

const WORD_FIELDS = `{
   "word": "the word exactly as it appears (lowercase, base form if obviously inflected)",
   "context": "ONLY the single sentence from the source that contains the word, verbatim (never a whole paragraph), or empty",
   "definition": "one very short, child-friendly English definition that fits THIS context (max 10 words, everyday words only — explain it the way a kind teacher would to a child of this age, not like a dictionary)",
   "example": "one new, simple example sentence using the word (max 12 words)",
   "distractors": ["four", "plausible", "wrong", "definitions of similar length and simplicity"],
   "topic": "one of: animals, adventure, space, nature, friendship, school, family, fantasy, science, sports, other",
   "korean": "짧은 한국어 뜻"
  }`;
const WORD_SCHEMA = `Return JSON only:
{
 "words": [ ${WORD_FIELDS} ],
 "note": "one short note for the parent in Korean if anything was uncertain, else empty"
}`;

// 사진 한 장 분석. 빠르게 하려고 목적별로 나눕니다.
// mode: 'auto'  — 형광펜/플래그/아이 펜 표시 단어만 (표시 없으면 words 빈 배열). 본문은 받지 않음 → 빠름
//       'point' — 손가락(또는 펜 끝)이 가리키는 단어 하나
//       'page'  — 본문 문장만 받아옴 (탭해서 고르기용). 단어 뜻은 만들지 않음
export async function analyzePage({ key, model, imageBase64, mime = 'image/jpeg', age, level, mode = 'auto' }) {
  let prompt;
  if (mode === 'page') {
    prompt = `This is a photo of a page from a children's book or school worksheet.
Transcribe the main body text as a list of short sentences in reading order (split long sentences at commas). Skip headers, page numbers, captions and instructions. Max 30 sentences. Do not explain anything.
Return JSON only: {"sentences": ["...", "..."], "note": "짧은 한국어 메모 (읽기 어려운 부분이 있었으면), 없으면 빈 문자열"}`;
  } else {
    const marking = mode === 'point'
      ? `The child is POINTING at one word with a finger or pen tip. Return exactly that one word (the word closest to the fingertip / pen tip). If two words are equally close, return both and say so in "note".`
      : `The child may have MARKED some words with a highlighter, a sticky flag, or a hand-drawn circle/underline in pen.
Count ONLY those child-made marks. IGNORE underlines, bold, italics, boxes or numbering that are printed as part of the worksheet or book, and ignore pencil marks that look like the teacher's or the printed layout.
If nothing is clearly marked by the child, return an empty "words" array — do NOT guess.`;
    prompt = `This is a photo of a page from a children's book or school worksheet.
${marking}
${levelText(age, level)}
${WORD_SCHEMA}`;
  }
  return call({ key, model, parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: imageBase64 } }] });
}

// 아이가 탭해서 고른 단어들에 문맥 맞는 뜻 만들기 (사진 없이 문장만 전송)
export async function defineWords({ key, model, words, sentences, age, level }) {
  const prompt = `A child read the text below and picked these words as unknown: ${words.map(w => `"${w}"`).join(', ')}.
For each picked word, find the sentence it appears in and explain it for THIS context.
${levelText(age, level)}
${WORD_SCHEMA}

TEXT:
${(sentences || []).join('\n')}`;
  return call({ key, model, parts: [{ text: prompt }] });
}

// (호환용) 표시된 단어만
export async function extractFromImage(opts) {
  const r = await analyzePage({ ...opts, mode: opts.mode || 'auto' });
  return { words: r.words || [], note: r.note || '', sentences: r.sentences || [] };
}

// 붙여넣은 문장에서 어려운 단어 추출 (사용자가 * 로 표시했으면 그것만)
export async function extractFromText({ key, model, text, age, level }) {
  const marked = /\*[A-Za-z'-]+\*/.test(text);
  const prompt = marked
    ? `In the following text, words wrapped in asterisks like *this* are the words the child marked. Extract ONLY those.`
    : `From the following text, pick up to 8 words that a child at this level would most likely not know yet.`;
  return call({ key, model, parts: [{ text: `${prompt}\n${levelText(age, level)}\n${WORD_SCHEMA}\n\nTEXT:\n${text}` }] });
}

// "더 쉽게 설명해 줘"
export async function simplify({ key, model, word, definition, context, age, level }) {
  const prompt = `A child did not understand this definition. Explain the word "${word}" again more simply, in English, in one or two very short sentences a ${age || 7}-year-old would understand. You may compare it to something familiar. Context sentence: "${context || ''}". Current definition: "${definition}".
${levelText(age, level)}
Return JSON only: {"definition": "...", "korean": "한국어로 한 줄 설명"}`;
  return call({ key, model, parts: [{ text: prompt }] });
}

// 아이가 자기 말로 설명한 뜻 채점 (관대하게, 격려 중심)
export async function gradeExplain({ key, model, word, definition, answer, age }) {
  const prompt = `A ${age || 8}-year-old child was asked to explain the word "${word}" in their own words.
Reference definition: "${definition}"
Child's answer: "${answer}"
Judge generously: accept any answer that shows the child understands the core meaning, even with spelling mistakes or simple language. Reject only if the meaning is wrong or missing.
Return JSON only: {"correct": true/false, "feedback": "one short, kind sentence in simple English for the child", "feedbackKo": "부모용 한 줄 한국어 설명"}`;
  return call({ key, model, parts: [{ text: prompt }], temperature: 0.1 });
}

// 연결 확인: 모델 목록을 받아 쓸 수 있는 모델을 고른 뒤 한 번 호출해 봅니다. 고른 모델 이름을 돌려줍니다.
export async function testConnection({ key, model }) {
  const names = await listModels(key);
  if (!names.length) throw new Error('이 키로 쓸 수 있는 Gemini 모델이 없어요. AI Studio에서 키를 다시 확인해 주세요.');
  const chosen = pickModel(names, model);
  const r = await call({ key, model: chosen, parts: [{ text: 'Reply with JSON only: {"ok": true}' }] });
  if (!r || r.ok !== true) throw new Error('연결 확인 응답이 예상과 달라요.');
  setModel(chosen);
  return chosen;
}

// 사진을 1600px 이하 JPEG로 줄여서 base64로 (무료 한도 절약 + 업로드 속도)
export function fileToBase64(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 열지 못했어요.')); };
    img.src = url;
  });
}
