# Word Orbit · 나의 단어 우주

책에서 만난 단어가 오래 남는 기억으로. 서버 없이 브라우저 안에서만 동작하는 아이 단어장 PWA.

## 구조 (비용 0원)

| 부분 | 방식 |
|---|---|
| 앱 | 순수 HTML/JS/CSS (빌드 없음). 파일을 그대로 올리면 동작 |
| 저장 | 브라우저 IndexedDB. 기기 밖으로 나가지 않음. 백업 = JSON 내보내기/가져오기 |
| 복습 일정 | `js/srs.js` — 1일→3일→1주→2주→1달→2달, 단어별로 조절. AI 없음 |
| 퀴즈 (뜻 고르기·단어 말하기·철자) | 로직으로 판정. AI 없음 |
| 읽어주기 / 마이크 | 브라우저 내장 (SpeechSynthesis / SpeechRecognition — Chrome, Safari) |
| 도서 추천 | `js/books-data.js` 500권(퀸즐랜드 PRC 목록 + CBCA 2018–2026) + `js/books.js` 규칙. AI 없음 |
| **AI (Gemini 무료 티어)** | 사진·문장에서 표시 단어 추출, "더 쉽게 설명", 뜻 설명 채점 — 이 세 가지만 |

각 가정이 자기 Gemini 키(무료)를 부모 리포트에서 넣어 쓰므로 배포자에게 비용이 생기지 않습니다.

## 파일

```
index.html            앱
photo-test.html       0단계: 실제 책 사진으로 추출 정확도 검증하는 페이지
js/app.js             화면·흐름
js/srs.js             기억곡선 로직 (핵심)
js/ai.js              Gemini 호출
js/db.js              IndexedDB
js/books.js           도서 추천 규칙
js/data.js            예시 단어, 주제
js/books-data.js      도서 500권 (자동 생성 — 아래 '도서 목록' 참고)
js/ocr.js             기기 안 글자 읽기 (Tesseract)
vendor/tesseract/     OCR 엔진 (약 10MB)
css/app.css
manifest.webmanifest, sw.js, icons/   PWA 설치·오프라인
```

## 실행

로컬에서 열 때는 `file://`로 열면 모듈이 막히므로 간단한 서버가 필요합니다.

```
cd word-orbit
python3 -m http.server 8080     # 그다음 브라우저에서 http://localhost:8080
```

## 배포 (무료)

1. GitHub 저장소를 만들고 이 폴더 내용을 올린다.
2. Settings → Pages → Branch: main, folder: / (root) → Save.
3. `https://<계정>.github.io/<저장소>/` 로 접속. 폰·태블릿에서 "홈 화면에 추가"하면 앱처럼 설치됨.

(Cloudflare Pages, Netlify 드래그 앤 드롭도 동일하게 무료.)

## 지인에게 나눠줄 때 안내문

1. 위 주소를 연다 → 아이 프로필 만들기
2. 부모 리포트 → AI 연결 → https://aistudio.google.com/apikey 에서 무료 키 발급 → 붙여넣기 → 연결 확인
3. 단어 추가하기 → 사진 → 책에서 표시한 페이지 촬영
4. 데이터는 그 기기에만 저장되므로, 기기를 바꿀 땐 부모 리포트 → 백업 내보내기

## 다음 할 일

- [ ] **photo-test.html로 실제 책·과제 사진 5~10장 검증** (가장 먼저)
- [x] 도서 목록 500권으로 확장 (2026-09-03)
- [ ] 아이들이 뽑는 상(KOALA·YABBA) 이력 추가 — 회원 전용 자료라 미확보
- [ ] 그림 연결(picture) 문제 — 단어에 그림이 있을 때만. 사진 보관을 안 하므로 후순위
- [ ] 뜻 설명 채점을 AI 대신 온디바이스 임베딩(Transformers.js)으로 바꾸는 실험
- [ ] 여러 기기 동기화가 필요해지면 Supabase 무료 티어 검토

## 설계 원칙 메모

- 장기 기억 판정은 "푼 문제 수"가 아니라 여러 날(3일 이상, 7일 이상 간격)에 걸쳐 힌트 없이 떠올린 기록으로
- 철자 실패는 뜻 기억을 초기화하지 않음. 철자만 따로 연습
- 뜻 혼동 시 그날 몇 문제 뒤에 다시 만나고, 다음엔 쉬운 설명부터
- 복습이 밀리면 하루 예산만큼만 배치하고 새 단어를 줄임
- 관심사는 아이가 직접 고른 주제와 "재미있었어요" 반응을 가장 강하게, 학습 지문 주제는 보조로만
- 도서 카드에는 기관·연도·구분을 정확히 표시하고, 기관이 앱을 인증한 것처럼 보이지 않게

## 도서 목록 (js/books-data.js)

- 뼈대: **Queensland Premier's Reading Challenge** 공식 도서 목록 (prc.median.com.au/BookList, 2020–2026 추가분) — Prep–Year 1 / Years 2–3 / Years 4–5 / Years 6–7 학년대, 주제(themes), 요약(QDoE), ISBN 포함
- 배지: **CBCA Book of the Year** 2018–2026 — Younger Readers / Early Childhood / Picture Book / Eve Pownall 부문의 수상작·아너북·최종 후보 (출처: cbca.org.au 아카이브, Books+Publishing, Readings)
- 선정: 학년대별 115~130권, 주제 다양성 확보, CBCA 이력 우선. 총 500권 (CBCA 이력 109권)
- 앱 topic(동물·모험·우주…)은 PRC themes/요약을 규칙으로 분류한 것 — 완벽하지 않음. 오분류를 보면 `build_books.py`의 TOPIC_RULES를 고쳐 재생성
- 재생성: PRC 목록 JSON(qld-prc-books.json)을 브라우저에서 내려받은 뒤 `python3 build_books.py` (스크립트는 `tools/` 참고)
- 아이 학년(profile.grade) → 학년대, 영어 수준(기초/능숙)으로 한 단계 조정. 추천은 학년대 ±1 범위에서
