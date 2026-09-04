// db.js — 서버 없이 브라우저 IndexedDB에 모든 데이터를 보관합니다.
// 구조: profiles(아이), words(단어, profileId로 구분), reviews(학습 기록), meta(설정)

const DB_NAME = 'word-orbit';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('words')) {
        const s = db.createObjectStore('words', { keyPath: 'id' });
        s.createIndex('profileId', 'profileId');
      }
      if (!db.objectStoreNames.contains('reviews')) {
        const s = db.createObjectStore('reviews', { keyPath: 'id' });
        s.createIndex('profileId', 'profileId');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqToPromise(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export const db = {
  uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); },

  // --- meta / settings
  getMeta(key, fallback = null) { return reqToPromise('meta', 'readonly', s => s.get(key)).then(r => r ? r.value : fallback); },
  setMeta(key, value) { return tx('meta', 'readwrite', s => s.put({ key, value })); },

  // --- profiles
  listProfiles() { return reqToPromise('profiles', 'readonly', s => s.getAll()); },
  putProfile(p) { return tx('profiles', 'readwrite', s => s.put(p)); },
  deleteProfile(id) { return tx('profiles', 'readwrite', s => s.delete(id)); },

  // --- words
  listWords(profileId) { return reqToPromise('words', 'readonly', s => s.index('profileId').getAll(profileId)); },
  getWord(id) { return reqToPromise('words', 'readonly', s => s.get(id)); },
  putWord(w) { return tx('words', 'readwrite', s => s.put(w)); },
  putWords(ws) { return tx('words', 'readwrite', s => { ws.forEach(w => s.put(w)); }); },
  deleteWord(id) { return tx('words', 'readwrite', s => s.delete(id)); },

  // --- reviews
  listReviews(profileId) { return reqToPromise('reviews', 'readonly', s => s.index('profileId').getAll(profileId)); },
  putReview(r) { return tx('reviews', 'readwrite', s => s.put(r)); },

  // --- 내보내기 / 가져오기 (기기 이동용)
  async exportAll() {
    const [profiles, words, reviews] = await Promise.all([
      this.listProfiles(),
      reqToPromise('words', 'readonly', s => s.getAll()),
      reqToPromise('reviews', 'readonly', s => s.getAll()),
    ]);
    return { app: 'word-orbit', version: DB_VERSION, exported: new Date().toISOString(), profiles, words, reviews };
  },
  async importAll(data) {
    if (!data || data.app !== 'word-orbit') throw new Error('Word Orbit 백업 파일이 아니에요.');
    await tx('profiles', 'readwrite', s => (data.profiles || []).forEach(p => s.put(p)));
    await tx('words', 'readwrite', s => (data.words || []).forEach(w => s.put(w)));
    await tx('reviews', 'readwrite', s => (data.reviews || []).forEach(r => s.put(r)));
  },
};
