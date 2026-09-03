// ocr.js — 페이지 글자 읽기를 브라우저 안에서 (Tesseract.js, 오픈소스). AI 한도를 쓰지 않고 붐빔도 없음.
// 앱 폴더에 같이 넣어둔 엔진(vendor/tesseract)을 사용 — 오프라인에서도 동작, 외부 CDN 불필요.

const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
const TESS_URL = BASE + 'tesseract.min.js';
let workerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('글자 읽기 엔진을 불러오지 못했어요.'));
    document.head.appendChild(s);
  });
}

async function getWorker(onProgress) {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    onProgress && onProgress('글자 읽기 엔진 준비 중… (처음 한 번만)');
    await loadScript(TESS_URL);
    const worker = await window.Tesseract.createWorker('eng', 1, {
      workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE, gzip: true,
      logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(`글자 읽는 중… ${Math.round((m.progress || 0) * 100)}%`); },
    });
    await worker.setParameters({ preserve_interword_spaces: '1' });
    return worker;
  })();
  workerPromise.catch(() => { workerPromise = null; });
  return workerPromise;
}

// 사진 보정: 크게 키우고(글자 높이 확보) 흑백 + 대비 늘리기. 폰 사진의 그림자·회색 배경을 줄여줌.
export function preprocess(src, maxSide = 2600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSide / Math.max(img.width, img.height), 3);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
      // 흑백 변환 + 히스토그램 스트레치 (밝은 5% → 흰색, 어두운 5% → 검정)
      const gray = new Uint8ClampedArray(p.length / 4), hist = new Uint32Array(256);
      for (let i = 0, j = 0; i < p.length; i += 4, j++) { const g = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0; gray[j] = g; hist[g]++; }
      const total = gray.length; let lo = 0, hi = 255, acc = 0;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.03) { lo = v; break; } }
      acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.08) { hi = v; break; } }
      const range = Math.max(1, hi - lo);
      for (let i = 0, j = 0; i < p.length; i += 4, j++) { let g = (gray[j] - lo) * 255 / range; g = g < 0 ? 0 : g > 255 ? 255 : g; p[i] = p[i + 1] = p[i + 2] = g; }
      ctx.putImageData(d, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('사진을 열지 못했어요.'));
    img.src = src;
  });
}

// 사진(dataURL 또는 File) → 문장 배열. 단어별 확신도로 잡음을 걸러냄.
export async function pageSentences(src, onProgress) {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  onProgress && onProgress('사진 보정 중…');
  const prepped = await preprocess(url);
  if (typeof src !== 'string') URL.revokeObjectURL(url);
  const worker = await getWorker(onProgress);
  onProgress && onProgress('글자 읽는 중…');
  const { data } = await worker.recognize(prepped);
  return linesToSentences(data);
}

const MIN_WORD_CONF = 55;   // 이보다 자신 없는 단어는 버림
const MIN_LINE_WORDS = 3;   // 좋은 단어가 3개 미만인 줄은 잡음으로 봄 (요일 칸, 문제 번호, 가장자리)

export function linesToSentences(data) {
  const lines = [];
  for (const block of data.blocks || []) for (const para of block.paragraphs || []) for (const line of para.lines || []) {
    const good = (line.words || []).filter(w => w.confidence >= MIN_WORD_CONF && /[A-Za-z]{2,}/.test(w.text));
    if (good.length < MIN_LINE_WORDS) continue;
    // 줄 안에서 자신 없는 단어만 빼고 이어 붙임
    const text = (line.words || []).filter(w => w.confidence >= MIN_WORD_CONF || /^[.,;:!?'"”“()-]+$/.test(w.text)).map(w => w.text).join(' ');
    const alpha = (text.match(/[A-Za-z]/g) || []).length;
    if (alpha / Math.max(1, text.length) < 0.6) continue; // 기호·숫자 위주 줄 제외
    lines.push(text.trim());
  }
  return toSentences(lines.join('\n'));
}

export function toSentences(text) {
  const clean = text
    .replace(/-\n(?=[a-z])/g, '')            // 줄 끝 하이픈 이어붙이기
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/([^.!?\n])\n(?=[a-z,])/g, '$1 ')   // 문장 중간 줄바꿈은 공백으로 (Safari 호환: lookbehind 미사용)
    .replace(/\n/g, ' ')
    .replace(/[|«»<>\[\]{}=~^_*#@\\]/g, ' ')   // OCR 잡음 기호 제거
    .replace(/\b\d+\)\s*(?:[A-Za-z]{1,2}\b)?/g, ' ') // 옆 칸 문제 번호 조각 ("1) Wh") 제거
    .replace(/\s{2,}/g, ' ');
  return clean
    .replace(/([.!?])\s+(?=[A-Z"“])/g, '$1\u0001')   // 문장 경계 표시 (Safari 호환: lookbehind 미사용)
    .split('\u0001')
    .map(s => s.trim())
    .filter(s => s.length >= 12 && (s.match(/[A-Za-z]{3,}/g) || []).length >= 3)
    .slice(0, 60);
}
