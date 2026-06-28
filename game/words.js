// === 词库：CEFR A1，30 词，6 主题 × 5 词 ===
// 主题：food / travel / animal / color / family / action
// 字段遵循 GAME_PROMPTS.md 中的 schema

export const WORD_BANK = [
  // === food ===
  { id: 1,  word: 'apple',   pos: 'n', zh: '苹果',       theme: ['food', 'fruit'], difficulty: 1, en_example: 'I eat an apple every day.', phonetic: '/ˈæp.əl/' },
  { id: 2,  word: 'banana',  pos: 'n', zh: '香蕉',       theme: ['food', 'fruit'], difficulty: 1, en_example: 'The banana is yellow.',     phonetic: '/bəˈnæn.ə/' },
  { id: 3,  word: 'bread',   pos: 'n', zh: '面包',       theme: ['food'],           difficulty: 1, en_example: 'I have bread for breakfast.', phonetic: '/bred/' },
  { id: 4,  word: 'water',   pos: 'n', zh: '水',         theme: ['food', 'travel'], difficulty: 1, en_example: 'Please give me some water.', phonetic: '/ˈwɔː.tər/' },
  { id: 5,  word: 'coffee',  pos: 'n', zh: '咖啡',       theme: ['food'],           difficulty: 1, en_example: 'I love coffee in the morning.', phonetic: '/ˈkɔː.fi/' },

  // === travel ===
  { id: 6,  word: 'train',   pos: 'n', zh: '火车',       theme: ['travel'],         difficulty: 1, en_example: 'The train arrives at 9.',  phonetic: '/treɪn/' },
  { id: 7,  word: 'plane',   pos: 'n', zh: '飞机',       theme: ['travel'],         difficulty: 1, en_example: 'The plane takes off soon.', phonetic: '/pleɪn/' },
  { id: 8,  word: 'hotel',   pos: 'n', zh: '酒店',       theme: ['travel'],         difficulty: 1, en_example: 'My hotel is near the beach.', phonetic: '/hoʊˈtel/' },
  { id: 9,  word: 'ticket',  pos: 'n', zh: '票',         theme: ['travel'],         difficulty: 2, en_example: 'I bought a ticket online.', phonetic: '/ˈtɪk.ɪt/' },
  { id: 10, word: 'beach',   pos: 'n', zh: '海滩',       theme: ['travel', 'nature'], difficulty: 1, en_example: 'We swim at the beach.',   phonetic: '/biːtʃ/' },

  // === animal ===
  { id: 11, word: 'cat',     pos: 'n', zh: '猫',         theme: ['animal'],         difficulty: 1, en_example: 'My cat is sleeping.',      phonetic: '/kæt/' },
  { id: 12, word: 'dog',     pos: 'n', zh: '狗',         theme: ['animal'],         difficulty: 1, en_example: 'The dog runs fast.',       phonetic: '/dɔːɡ/' },
  { id: 13, word: 'bird',    pos: 'n', zh: '鸟',         theme: ['animal', 'nature'], difficulty: 1, en_example: 'A bird is in the tree.',  phonetic: '/bɜːrd/' },
  { id: 14, word: 'tiger',   pos: 'n', zh: '老虎',       theme: ['animal'],         difficulty: 2, en_example: 'Tigers live in the jungle.', phonetic: '/ˈtaɪ.ɡər/' },
  { id: 15, word: 'fish',    pos: 'n', zh: '鱼',         theme: ['animal', 'food'], difficulty: 1, en_example: 'I eat fish on Fridays.',  phonetic: '/fɪʃ/' },

  // === color ===
  { id: 16, word: 'red',     pos: 'adj', zh: '红色',     theme: ['color'],          difficulty: 1, en_example: 'The apple is red.',       phonetic: '/red/' },
  { id: 17, word: 'blue',    pos: 'adj', zh: '蓝色',     theme: ['color'],          difficulty: 1, en_example: 'The sky is blue.',        phonetic: '/bluː/' },
  { id: 18, word: 'green',   pos: 'adj', zh: '绿色',     theme: ['color', 'nature'], difficulty: 1, en_example: 'Grass is green.',         phonetic: '/ɡriːn/' },
  { id: 19, word: 'yellow',  pos: 'adj', zh: '黄色',     theme: ['color'],          difficulty: 1, en_example: 'The sun is yellow.',      phonetic: '/ˈjel.oʊ/' },
  { id: 20, word: 'black',   pos: 'adj', zh: '黑色',     theme: ['color'],          difficulty: 1, en_example: 'My bag is black.',        phonetic: '/blæk/' },

  // === family ===
  { id: 21, word: 'mother',  pos: 'n', zh: '妈妈',       theme: ['family'],         difficulty: 1, en_example: 'My mother is kind.',      phonetic: '/ˈmʌð.ər/' },
  { id: 22, word: 'father',  pos: 'n', zh: '爸爸',       theme: ['family'],         difficulty: 1, en_example: 'My father cooks dinner.', phonetic: '/ˈfɑː.ðər/' },
  { id: 23, word: 'sister',  pos: 'n', zh: '姐妹',       theme: ['family'],         difficulty: 2, en_example: 'I have one sister.',      phonetic: '/ˈsɪs.tər/' },
  { id: 24, word: 'brother', pos: 'n', zh: '兄弟',       theme: ['family'],         difficulty: 2, en_example: 'He is my brother.',       phonetic: '/ˈbrʌð.ər/' },
  { id: 25, word: 'friend',  pos: 'n', zh: '朋友',       theme: ['family'],         difficulty: 1, en_example: 'She is my best friend.',  phonetic: '/frend/' },

  // === action ===
  { id: 26, word: 'run',     pos: 'v', zh: '跑',         theme: ['action'],         difficulty: 1, en_example: 'I run every morning.',    phonetic: '/rʌn/' },
  { id: 27, word: 'jump',    pos: 'v', zh: '跳',         theme: ['action'],         difficulty: 1, en_example: 'Kids jump in the park.',  phonetic: '/dʒʌmp/' },
  { id: 28, word: 'eat',     pos: 'v', zh: '吃',         theme: ['action', 'food'], difficulty: 1, en_example: 'I eat rice for lunch.',   phonetic: '/iːt/' },
  { id: 29, word: 'drink',   pos: 'v', zh: '喝',         theme: ['action', 'food'], difficulty: 1, en_example: 'Drink more water.',       phonetic: '/drɪŋk/' },
  { id: 30, word: 'sleep',   pos: 'v', zh: '睡觉',       theme: ['action'],         difficulty: 1, en_example: 'I sleep at ten.',         phonetic: '/sliːp/' },
];

export const THEMES = ['food', 'travel', 'animal', 'color', 'family', 'action'];

/**
 * 随机抽一题
 * @param {string[]} themes - 可选主题，null = 全部
 */
export function pickWord(themes = null) {
  const pool = themes
    ? WORD_BANK.filter(w => w.theme.some(t => themes.includes(t)))
    : WORD_BANK;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 校验用户输入是否正确
 */
export function checkAnswer(input, word) {
  if (!input || !word) return false;
  const a = input.trim().toLowerCase().normalize('NFC');
  const b = word.trim().toLowerCase().normalize('NFC');
  return a === b;
}

/**
 * 训练模式：连续抽 N 个词不重复
 */
export function pickSession(words = 20, themes = null) {
  const pool = themes
    ? WORD_BANK.filter(w => w.theme.some(t => themes.includes(t)))
    : WORD_BANK;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(words, shuffled.length));
}