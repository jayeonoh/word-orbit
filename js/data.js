// data.js — 예시 단어(공개 체험용)와 시작용 도서 목록

export const TOPICS = [
  { id: 'animals', name: '동물', en: 'Animals' },
  { id: 'adventure', name: '모험', en: 'Adventure' },
  { id: 'space', name: '우주', en: 'Space' },
  { id: 'nature', name: '자연', en: 'Nature' },
  { id: 'friendship', name: '우정', en: 'Friendship' },
  { id: 'school', name: '학교', en: 'School' },
  { id: 'family', name: '가족', en: 'Family' },
  { id: 'fantasy', name: '판타지', en: 'Fantasy' },
  { id: 'science', name: '과학', en: 'Science' },
  { id: 'sports', name: '운동', en: 'Sports' },
  { id: 'other', name: '기타', en: 'Other' },
];

export const SAMPLE_WORDS = [
  { word: 'enormous', korean: '거대한', definition: 'very, very big', context: 'An enormous elephant walked slowly to the river.', example: 'The whale was enormous, bigger than our bus!', distractors: ['very small', 'very fast', 'very old', 'very loud'], topic: 'animals' },
  { word: 'curious', korean: '호기심 많은', definition: 'wanting to know or learn about something', context: 'The curious kitten looked inside the box.', example: 'Mia was curious about what was under the rock.', distractors: ['feeling sleepy', 'feeling scared', 'feeling angry', 'feeling bored'], topic: 'animals' },
  { word: 'dart', korean: '쏜살같이 움직이다', definition: 'to move suddenly and very fast', context: 'The fish darted away when the boy stepped closer.', example: 'A lizard darted across the path.', distractors: ['to walk very slowly', 'to sleep for a long time', 'to eat quietly', 'to sit still'], topic: 'nature' },
  { word: 'tiny', korean: '아주 작은', definition: 'very small', context: 'A tiny ant carried a big crumb.', example: 'The baby bird was tiny and soft.', distractors: ['very big', 'very heavy', 'very tall', 'very wide'], topic: 'nature' },
  { word: 'reluctant', korean: '내키지 않는', definition: 'not wanting to do something', context: 'Sam was reluctant to jump into the cold water.', example: 'The dog was reluctant to go out in the rain.', distractors: ['very happy to do something', 'very good at something', 'very fast at something', 'very tired of something'], topic: 'adventure' },
  { word: 'gloomy', korean: '어둑한, 우울한', definition: 'dark, or sad and without hope', context: 'The cave was gloomy and cold.', example: 'It was a gloomy, rainy morning.', distractors: ['bright and sunny', 'noisy and busy', 'warm and cosy', 'clean and tidy'], topic: 'adventure' },
  { word: 'brave', korean: '용감한', definition: 'not afraid to do something hard or scary', context: 'The brave knight walked toward the dragon.', example: 'It was brave of you to speak in front of the class.', distractors: ['very lazy', 'very quiet', 'very clever', 'very careful'], topic: 'fantasy' },
  { word: 'whisper', korean: '속삭이다', definition: 'to speak very softly and quietly', context: '"Look," she whispered, pointing at the owl.', example: 'Please whisper in the library.', distractors: ['to shout loudly', 'to laugh out loud', 'to sing a song', 'to cry softly'], topic: 'friendship' },
];

// 시작용 도서 목록 — 선정 근거(기관·연도·구분)를 함께 보여줍니다.
// ⚠ 확장하거나 배포하기 전에 각 항목의 출처(수상 연도·부문)를 공식 사이트에서 한 번 더 확인하세요.
//   CBCA: cbca.org.au   ALSC(Newbery/Caldecott): ala.org/alsc
// level: easy(혼자 읽기) · medium(조금 도전) · challenge(함께 읽기)
export const BOOKS = [
  { title: 'Frog and Toad Together', author: 'Arnold Lobel', source: 'ALSC', award: 'Newbery Honor', year: 1973, ages: [5, 8], level: 'easy', topics: ['friendship', 'animals'], note: '짧은 챕터, 그림 많음. Year 1 혼자 읽기 좋아요.' },
  { title: 'Owl Moon', author: 'Jane Yolen', source: 'ALSC', award: 'Caldecott Medal', year: 1988, ages: [4, 8], level: 'easy', topics: ['nature', 'family'], note: '그림책. 조용한 밤 산책 이야기.' },
  { title: 'Where the Wild Things Are', author: 'Maurice Sendak', source: 'ALSC', award: 'Caldecott Medal', year: 1964, ages: [4, 8], level: 'easy', topics: ['fantasy', 'adventure'], note: '그림책 고전.' },
  { title: 'Are We There Yet?', author: 'Alison Lester', source: 'CBCA', award: 'Picture Book of the Year', year: 2005, ages: [5, 9], level: 'easy', topics: ['adventure', 'family', 'nature'], note: '호주 일주 여행 그림책. 호주 지명이 많이 나와요.' },
  { title: 'Diary of a Wombat', author: 'Jackie French', source: 'CBCA', award: 'Honour Book (Early Childhood)', year: 2003, ages: [4, 8], level: 'easy', topics: ['animals'], note: '짧고 웃겨요. 호주 동물.' },
  { title: 'Mr Huff', author: 'Anna Walker', source: 'CBCA', award: 'Picture Book of the Year', year: 2016, ages: [4, 8], level: 'easy', topics: ['family', 'other'], note: '기분이 안 좋은 날에 대한 그림책.' },
  { title: 'Charlotte\'s Web', author: 'E. B. White', source: 'ALSC', award: 'Newbery Honor', year: 1953, ages: [8, 12], level: 'medium', topics: ['animals', 'friendship'], note: '챕터북. Year 3–4 함께 읽기 시작하기 좋아요.' },
  { title: 'Because of Winn-Dixie', author: 'Kate DiCamillo', source: 'ALSC', award: 'Newbery Honor', year: 2001, ages: [8, 12], level: 'medium', topics: ['animals', 'family', 'friendship'], note: '개와 여자아이. 문장이 쉬운 편.' },
  { title: 'The One and Only Ivan', author: 'Katherine Applegate', source: 'ALSC', award: 'Newbery Medal', year: 2013, ages: [8, 12], level: 'medium', topics: ['animals', 'friendship'], note: '짧은 문단으로 되어 있어 읽기 부담이 적어요.' },
  { title: 'Mr. Popper\'s Penguins', author: 'Richard & Florence Atwater', source: 'ALSC', award: 'Newbery Honor', year: 1939, ages: [7, 11], level: 'medium', topics: ['animals', 'adventure'], note: '펭귄 12마리와 사는 가족. 웃겨요.' },
  { title: 'Rowan of Rin', author: 'Emily Rodda', source: 'CBCA', award: 'Book of the Year: Younger Readers', year: 1994, ages: [8, 12], level: 'medium', topics: ['fantasy', 'adventure'], note: '호주 작가 판타지 시리즈 1권.' },
  { title: 'Sarah, Plain and Tall', author: 'Patricia MacLachlan', source: 'ALSC', award: 'Newbery Medal', year: 1986, ages: [7, 11], level: 'easy', topics: ['family'], note: '아주 짧은 챕터북.' },
  { title: 'The Tale of Despereaux', author: 'Kate DiCamillo', source: 'ALSC', award: 'Newbery Medal', year: 2004, ages: [8, 12], level: 'challenge', topics: ['fantasy', 'adventure', 'animals'], note: '어휘가 조금 어려워요. 함께 읽기 추천.' },
  { title: 'Holes', author: 'Louis Sachar', source: 'ALSC', award: 'Newbery Medal', year: 1999, ages: [10, 14], level: 'challenge', topics: ['adventure', 'friendship'], note: '초등 고학년 이상. 주제가 조금 무거워요.' },
  { title: 'The Rabbits', author: 'John Marsden & Shaun Tan', source: 'CBCA', award: 'Picture Book of the Year', year: 1999, ages: [9, 14], level: 'challenge', topics: ['nature', 'other'], note: '그림책이지만 식민 역사 우화. 부모와 함께 읽기.' },
];

export const SOURCES = {
  ALSC: { name: 'ALSC (미국도서관협회 아동도서 분과)', url: 'https://www.ala.org/alsc/awardsgrants/bookmedia', note: 'Newbery = 글의 문학적 성취, Caldecott = 그림책의 그림' },
  CBCA: { name: 'CBCA (호주 아동도서협의회)', url: 'https://cbca.org.au/', note: '호주 아동문학상 수상작·최종 후보·Notable Books' },
};
