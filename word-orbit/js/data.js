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
  { id: 'humour', name: '유머', en: 'Humour' },
  { id: 'mystery', name: '미스터리', en: 'Mystery' },
  { id: 'history', name: '역사', en: 'History' },
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

// 도서 목록은 js/books-data.js (퀸즐랜드 PRC + CBCA, 500권)로 이동했습니다.
