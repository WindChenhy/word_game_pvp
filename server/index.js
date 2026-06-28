import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // 项目根目录

const PORT = process.env.PORT || 3001;

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const WORD_BANK = [
  { id: 1,  word: 'apple',   zh: '苹果',       theme: ['food', 'fruit'] },
  { id: 2,  word: 'banana',  zh: '香蕉',       theme: ['food', 'fruit'] },
  { id: 3,  word: 'bread',   zh: '面包',       theme: ['food'] },
  { id: 4,  word: 'water',   zh: '水',         theme: ['food', 'travel'] },
  { id: 5,  word: 'coffee',  zh: '咖啡',       theme: ['food'] },
  { id: 6,  word: 'train',   zh: '火车',       theme: ['travel'] },
  { id: 7,  word: 'plane',   zh: '飞机',       theme: ['travel'] },
  { id: 8,  word: 'hotel',   zh: '酒店',       theme: ['travel'] },
  { id: 9,  word: 'ticket',  zh: '票',         theme: ['travel'] },
  { id: 10, word: 'beach',   zh: '海滩',       theme: ['travel', 'nature'] },
  { id: 11, word: 'cat',     zh: '猫',         theme: ['animal'] },
  { id: 12, word: 'dog',     zh: '狗',         theme: ['animal'] },
  { id: 13, word: 'bird',    zh: '鸟',         theme: ['animal', 'nature'] },
  { id: 14, word: 'tiger',   zh: '老虎',       theme: ['animal'] },
  { id: 15, word: 'fish',    zh: '鱼',         theme: ['animal', 'food'] },
  { id: 16, word: 'red',     zh: '红色',       theme: ['color'] },
  { id: 17, word: 'blue',    zh: '蓝色',       theme: ['color'] },
  { id: 18, word: 'green',   zh: '绿色',       theme: ['color', 'nature'] },
  { id: 19, word: 'yellow',  zh: '黄色',       theme: ['color'] },
  { id: 20, word: 'black',   zh: '黑色',       theme: ['color'] },
  { id: 21, word: 'mother',  zh: '妈妈',       theme: ['family'] },
  { id: 22, word: 'father',  zh: '爸爸',       theme: ['family'] },
  { id: 23, word: 'sister',  zh: '姐妹',       theme: ['family'] },
  { id: 24, word: 'brother', zh: '兄弟',       theme: ['family'] },
  { id: 25, word: 'friend',  zh: '朋友',       theme: ['family'] },
  { id: 26, word: 'run',     zh: '跑',         theme: ['action'] },
  { id: 27, word: 'jump',    zh: '跳',         theme: ['action'] },
  { id: 28, word: 'eat',     zh: '吃',         theme: ['action', 'food'] },
  { id: 29, word: 'drink',   zh: '喝',         theme: ['action', 'food'] },
  { id: 30, word: 'sleep',   zh: '睡觉',       theme: ['action'] },
];

function pickWord() {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

function checkAnswer(input, word) {
  if (!input || !word) return false;
  return input.trim().toLowerCase().normalize('NFC') === word.toLowerCase();
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const server = http.createServer((req, res) => {
  // 剥离查询参数 (?v=11 等)
  const urlPath = req.url.split('?')[0];

  // 提供静态文件
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // 安全检查：防止路径遍历攻击
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 如果找不到文件，返回 index.html（支持 SPA 式路由）
      fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(data2);
        }
      });
    } else {
      const headers = { 'Content-Type': contentType };
      // 开发阶段禁用缓存，避免样式/脚本更新不生效
      if (/^\.(css|js|html?)$/.test(ext)) {
        headers['Cache-Control'] = 'no-cache';
      }
      res.writeHead(200, headers);
      res.end(data);
    }
  });
});

const wss = new WebSocketServer({ server });

const clients = new Map();
const queue = [];
const rooms = new Map();

wss.on('connection', (ws) => {
  const playerId = generateId();
  const client = { ws, playerId, roomId: null, state: 'connected' };
  clients.set(playerId, client);

  ws.send(JSON.stringify({ type: 'connected', player_id: playerId }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(playerId, msg);
    } catch {
      sendError(ws, 'Invalid message');
    }
  });

  ws.on('close', () => {
    handleDisconnect(playerId);
  });

  ws.on('error', () => {
    handleDisconnect(playerId);
  });
});

function handleMessage(playerId, msg) {
  const client = clients.get(playerId);
  if (!client) return;

  switch (msg.type) {
    case 'find_match':
      startMatchmaking(playerId);
      break;
    case 'cancel_match':
      cancelMatchmaking(playerId);
      break;
    case 'submit_answer':
      handleAnswer(playerId, msg.word);
      break;
    case 'leave_game':
      leaveGame(playerId);
      break;
  }
}

function sendError(ws, message) {
  ws.send(JSON.stringify({ type: 'error', message }));
}

function startMatchmaking(playerId) {
  const client = clients.get(playerId);
  if (!client) return;

  client.state = 'matchmaking';
  queue.push(playerId);
  client.ws.send(JSON.stringify({ type: 'matchmaking' }));

  if (queue.length >= 2) {
    const p1Id = queue.shift();
    const p2Id = queue.shift();
    const p1 = clients.get(p1Id);
    const p2 = clients.get(p2Id);
    if (p1 && p2) {
      createRoom(p1, p2);
    } else {
      if (p1) queue.unshift(p1Id);
      if (p2) queue.unshift(p2Id);
    }
  }
}

function cancelMatchmaking(playerId) {
  const idx = queue.indexOf(playerId);
  if (idx !== -1) queue.splice(idx, 1);
  const client = clients.get(playerId);
  if (client) {
    client.state = 'connected';
    try { client.ws.send(JSON.stringify({ type: 'match_cancelled' })); } catch {}
  }
}

function createRoom(p1, p2) {
  const roomId = generateId();
  const room = {
    id: roomId,
    player1: p1.playerId,
    player2: p2.playerId,
    state: 'playing',
    hp: { player1: 100, player2: 100 },
    maxHp: 100,
    currentWord: null,
    answered: new Set(),
  };
  rooms.set(roomId, room);
  p1.roomId = roomId;
  p2.roomId = roomId;
  p1.state = 'playing';
  p2.state = 'playing';

  try { p1.ws.send(JSON.stringify({ type: 'matched', room_id: roomId, side: 'player1' })); } catch {}
  try { p2.ws.send(JSON.stringify({ type: 'matched', room_id: roomId, side: 'player2' })); } catch {}

  try { p1.ws.send(JSON.stringify({ type: 'game_start', hp: 100, maxHp: 100 })); } catch {}
  try { p2.ws.send(JSON.stringify({ type: 'game_start', hp: 100, maxHp: 100 })); } catch {}

  sendNextWord(room);
}

function sendNextWord(room) {
  const word = { ...pickWord() };
  room.currentWord = word;
  room.answered = new Set();

  const p1 = clients.get(room.player1);
  const p2 = clients.get(room.player2);
  const data = JSON.stringify({ type: 'new_word', word });
  try { if (p1) p1.ws.send(data); } catch {}
  try { if (p2) p2.ws.send(data); } catch {}
}

function handleAnswer(playerId, answer) {
  const client = clients.get(playerId);
  if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || room.state !== 'playing') return;
  if (!room.currentWord) return;

  if (room.answered.has(playerId)) return;
  room.answered.add(playerId);

  const correct = checkAnswer(answer, room.currentWord.word);
  const isPlayer1 = room.player1 === playerId;
  const side = isPlayer1 ? 'player1' : 'player2';
  const opponent = isPlayer1 ? 'player2' : 'player1';

  const p1 = clients.get(room.player1);
  const p2 = clients.get(room.player2);

  if (correct) {
    const damage = room.currentWord.word.length;
    room.hp[opponent] = Math.max(0, room.hp[opponent] - damage);

    broadcast(room, { type: 'hit', attacker: side, victim: opponent, damage, word: room.currentWord.word });
    broadcast(room, { type: 'hp_update', player1_hp: room.hp.player1, player2_hp: room.hp.player2 });

    if (room.hp[opponent] <= 0) {
      endGame(room, side);
    } else {
      setTimeout(() => sendNextWord(room), 1000);
    }
  } else {
    room.hp[side] = Math.max(0, room.hp[side] - 10);

    broadcast(room, { type: 'self_hit', player: side, damage: 10 });
    broadcast(room, { type: 'hp_update', player1_hp: room.hp.player1, player2_hp: room.hp.player2 });

    if (room.hp[side] <= 0) {
      endGame(room, opponent);
    } else {
      setTimeout(() => sendNextWord(room), 1000);
    }
  }
}

function endGame(room, winner) {
  room.state = 'ended';
  broadcast(room, { type: 'game_over', winner, reason: 'hp_zero' });

  setTimeout(() => {
    for (const pid of [room.player1, room.player2]) {
      const c = clients.get(pid);
      if (c) { c.roomId = null; c.state = 'connected'; }
    }
    rooms.delete(room.id);
  }, 5000);
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const pid of [room.player1, room.player2]) {
    const c = clients.get(pid);
    if (c) try { c.ws.send(data); } catch {}
  }
}

function leaveGame(playerId) {
  handleDisconnect(playerId);
}

function handleDisconnect(playerId) {
  const client = clients.get(playerId);
  if (!client) return;

  const qIdx = queue.indexOf(playerId);
  if (qIdx !== -1) queue.splice(qIdx, 1);

  if (client.roomId) {
    const room = rooms.get(client.roomId);
    if (room && room.state === 'playing') {
      const isPlayer1 = room.player1 === playerId;
      const winner = isPlayer1 ? room.player2 : room.player1;
      const loser = isPlayer1 ? room.player1 : room.player2;

      broadcast(room, { type: 'game_over', winner, reason: 'disconnect' });
      rooms.delete(client.roomId);

      const winnerClient = clients.get(winner);
      if (winnerClient) { winnerClient.roomId = null; winnerClient.state = 'connected'; }
    }
  }

  clients.delete(playerId);
}

server.listen(PORT, () => {
  console.log(`\n🎯 标枪单词对战 · 服务器已启动`);
  console.log(`   🌐 页面: http://localhost:${PORT}`);
  console.log(`   🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`   📋 按 Ctrl+C 停止\n`);
});
