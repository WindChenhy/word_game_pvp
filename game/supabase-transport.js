import { WORD_BANK, checkAnswer } from './words.js';
import { CONFIG } from './config.js';

let _sharedClient = null;

function getOrCreateClient() {
  if (_sharedClient) return _sharedClient;
  if (!window.supabase) return null;
  const { URL, KEY } = CONFIG.SUPABASE;
  if (!URL || !KEY) return null;
  _sharedClient = window.supabase.createClient(URL, KEY);
  return _sharedClient;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function pickWord() {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

export class SupabaseTransport {
  constructor() {
    this._client = null;
    this._lobbyChannel = null;
    this._roomChannel = null;
    this.playerId = null;
    this._side = null;
    this._isHost = false;
    this._roomId = null;
    this.connected = false;
    this._handlers = new Map();
    this._room = null;
    this._answerTimeout = null;
    this._nextWordTimeout = null;
    this._disconnectTimer = null;
    this._currentWord = null;       // 仅 guest 用来做"乐观本地结算"，让远端广播回来时不重复触发动画
    this._optimisticKeys = new Set(); // 记录本地乐观派发过的消息 key，用于去重宿主的回环广播
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        const client = getOrCreateClient();
        if (!client) {
          reject(new Error('Supabase JS library not loaded or missing URL/Key'));
          return;
        }
        this._client = client;
        this.playerId = generateId();
        this.connected = true;
        const msg = { type: 'connected', player_id: this.playerId };
        this._dispatch(msg);
        resolve(msg);
      } catch (e) {
        reject(new Error('Failed to initialize Supabase: ' + e.message));
      }
    });
  }

  send(msg) {
    if (!this.connected) return;
    switch (msg.type) {
      case 'find_match':
        this._joinLobby();
        break;
      case 'cancel_match':
        this._leaveLobby();
        break;
      case 'submit_answer':
        this._handleSubmit(msg.word);
        break;
      case 'leave_game':
        this._leaveRoom();
        break;
    }
  }

  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this._handlers.get(type)?.delete(handler);
  }

  disconnect() {
    this._cleanup();
    this.connected = false;
    this.playerId = null;
    this._side = null;
    this._isHost = false;
    this._roomId = null;
    this._room = null;
    this._handlers.clear();
  }

  _joinLobby() {
    if (this._lobbyChannel) return;
    this._lobbySubscribed = false;
    this._lobbyChannel = this._client.channel('pvp-lobby', {
      config: { presence: { key: this.playerId } }
    });

    this._lobbyChannel.on('presence', { event: 'sync' }, () => {
      if (this._roomId) return;
      const state = this._lobbyChannel.presenceState();
      const players = Object.keys(state).sort();
      if (players.length >= 2 && players[0] === this.playerId) {
        const roomId = `room_${Date.now()}`;

        this._side = 'player1';
        this._isHost = true;
        this._roomId = roomId;

        try {
          this._lobbyChannel.send({
            type: 'broadcast',
            event: 'match',
            payload: { roomId, player1: players[0], player2: players[1] }
          });
        } catch {}

        if (this._lobbyChannel) {
          this._lobbyChannel.unsubscribe();
          this._lobbyChannel = null;
        }

        this._dispatch({ type: 'matchmaking' });
        this._dispatch({ type: 'matched', room_id: roomId, side: this._side });
        this._joinRoom(roomId);
      }
    });

    this._lobbyChannel.on('broadcast', { event: 'match' }, (payload) => {
      if (this._roomId) return;
      const { roomId, player1, player2 } = payload.payload;
      if (player1 !== this.playerId && player2 !== this.playerId) return;
      if (player1 === this.playerId) return;

      this._side = 'player2';
      this._isHost = false;
      this._roomId = roomId;
      if (this._lobbyChannel) {
        this._lobbyChannel.unsubscribe();
        this._lobbyChannel = null;
      }
      this._dispatch({ type: 'matchmaking' });
      this._dispatch({ type: 'matched', room_id: roomId, side: this._side });
      this._joinRoom(roomId);
    });

    this._lobbyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this._lobbySubscribed = true;
        try {
          await this._lobbyChannel.track({ user_id: this.playerId, joined_at: Date.now() });
        } catch {}
        this._dispatch({ type: 'matchmaking' });
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !this._lobbySubscribed) {
        this._dispatch({ type: 'disconnected', code: 0 });
      }
    });
  }

  _leaveLobby() {
    if (this._lobbyChannel) {
      this._lobbyChannel.unsubscribe();
      this._lobbyChannel = null;
    }
  }

  _joinRoom(roomId) {
    this._roomStarted = false;
    this._roomSubscribed = false;
    this._roomChannel = this._client.channel(`pvp-room:${roomId}`, {
      config: {
        presence: { key: this.playerId },
        // self: true 让广播也回环给发送者，否则宿主的 self_hit / hp_update 等事件
        // 永远收不到，本地状态永远不更新（会出现"自己发不出去"的现象）。
        broadcast: { self: true }
      }
    });

    this._roomChannel.on('broadcast', { event: 'game' }, (payload) => {
      const msg = payload.payload;
      if (msg.type === 'submit_answer') {
        if (msg.sender === this.playerId) return;
        if (this._isHost && this._room) {
          const guestSide = this._side === 'player1' ? 'player2' : 'player1';
          this._room.answered.set(guestSide, msg.word);
          if (this._room.answered.size >= 2) {
            this._processAnswers();
          }
        }
        return;
      }
      // 同步本地 currentWord（guest 没有 _room，靠这个字段做乐观结算）
      if (msg.type === 'new_word' && msg.word) {
        this._currentWord = msg.word;
        // 新一轮：清空上一轮乐观派发的去重 key，防止跨轮误判
        this._optimisticKeys.clear();
      }
      // 宿主回环/对方广播：若本地已经乐观派发过相同 key 的结算，跳过以避免双重动画。
      if (this._isOptimisticDup(msg)) return;
      this._dispatch(msg);
    });

    this._roomChannel.on('presence', { event: 'sync' }, () => {
      const state = this._roomChannel.presenceState();
      const players = Object.keys(state);

      if (this._roomStarted) {
        if (this._room && players.length < 2) {
          if (this._disconnectTimer) return;
          this._disconnectTimer = setTimeout(() => {
            this._disconnectTimer = null;
            if (!this._roomChannel || !this._room) return;
            const s = this._roomChannel.presenceState();
            if (Object.keys(s).length < 2) {
              this._room = null;
              this._dispatch({ type: 'game_over', winner: this._side, reason: 'disconnect' });
            }
          }, 3000);
        } else if (players.length >= 2 && this._disconnectTimer) {
          clearTimeout(this._disconnectTimer);
          this._disconnectTimer = null;
        }
      } else if (players.length >= 2) {
        this._roomStarted = true;
        if (this._isHost) {
          this._room = {
            hp: { player1: 100, player2: 100 },
            currentWord: null,
            answered: new Map(),
          };
          // self: true 已开启，广播会自动回环给发送者，因此只 _broadcast 即可。
          // 旧代码还会本地 _dispatch 一次，会导致 _startBattle / hud.bind 重复执行（双重挂载监听）。
          this._broadcast({ type: 'game_start', hp: 100, maxHp: 100 });
          this._sendNextWord();
        }
      }
    });

    this._roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this._roomSubscribed = true;
        try {
          await this._roomChannel.track({ user_id: this.playerId, side: this._side });
        } catch {}
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !this._roomSubscribed) {
        this._dispatch({ type: 'disconnected', code: 0 });
      }
    });
  }

  _leaveRoom() {
    if (this._disconnectTimer) {
      clearTimeout(this._disconnectTimer);
      this._disconnectTimer = null;
    }
    if (this._roomChannel) {
      this._roomChannel.unsubscribe();
      this._roomChannel = null;
    }
    this._room = null;
    this._currentWord = null;
    this._optimisticKeys.clear();
    if (this._answerTimeout) clearTimeout(this._answerTimeout);
    if (this._nextWordTimeout) clearTimeout(this._nextWordTimeout);
  }

  _sendNextWord() {
    if (!this._room) return;
    const word = pickWord();
    this._room.currentWord = word;
    this._room.answered = new Map();
    const data = { type: 'new_word', word };
    // self: true 让广播回环，宿主也会在自己的 broadcast 监听中收到。
    // 旧版同时 _dispatch + _broadcast 会让 on('new_word') 触发两次；
    // on('new_word') 内部是幂等的（_pendingAnswer=false、state.setWord）所以没问题，
    // 但移除冗余 _dispatch 让逻辑更清晰。
    this._broadcast(data);
    this._answerTimeout = setTimeout(() => {
      this._processAnswers();
    }, 8000);
  }

  _handleSubmit(word) {
    if (!this._isHost || !this._room) {
      // ===== GUEST 分支 =====
      // guest 没有 _room，只负责把提交广播给 host。
      // 为了让 guest 不用等 1~2s 网络回程就能看到自己的命中/受击动画，
      // 在本地基于当前单词做一次"乐观结算"并立刻 dispatch。
      // 之后 host 的回环广播会带相同的 key，被 _isOptimisticDup 过滤掉，避免双重动画。
      if (this._currentWord) {
        const correct = checkAnswer(word, this._currentWord.word);
        if (correct) {
          const damage = this._currentWord.word.length;
          const opponent = this._side === 'player1' ? 'player2' : 'player1';
          const hitMsg = { type: 'hit', attacker: this._side, victim: opponent, damage, word: this._currentWord.word };
          this._markOptimistic(hitMsg);
          this._dispatch(hitMsg);
        } else {
          const selfHitMsg = { type: 'self_hit', player: this._side, damage: 10 };
          this._markOptimistic(selfHitMsg);
          this._dispatch(selfHitMsg);
        }
      }
      this._broadcast({ type: 'submit_answer', word });
      return;
    }
    // ===== HOST 分支 =====
    this._room.answered.set(this._side, word);
    this._broadcast({ type: 'submit_answer', word });
    if (this._room.answered.size >= 2) {
      this._processAnswers();
    }
  }

  /**
   * 为某条结算消息生成稳定的去重 key。
   * guest 在本地乐观派发时记录 key；host 回环广播到达时若 key 命中则跳过，
   * 避免双重动画 / 双重计数。
   *
   * 注意：广播里 _processAnswers / _handleSubmit 传过来的 hit / self_hit
   * 只携带字符串 `word`，没有 id 字段；所以这里用 word 字符串本身 + 损伤值来生成 key。
   * 乐观派发时构造的 hitMsg / selfHitMsg 也用同样的字段，确保两端 key 完全一致。
   */
  _markOptimistic(msg) {
    let key;
    if (msg.type === 'hit') {
      // msg.word 在两类广播里都是 string（单词本身），不是带 id 的对象
      key = `hit:${msg.attacker}:${msg.victim}:${msg.damage}:${msg.word}`;
    } else if (msg.type === 'self_hit') {
      key = `self_hit:${msg.player}:${msg.damage}`;
    } else {
      key = `${msg.type}:${JSON.stringify(msg)}`;
    }
    this._optimisticKeys.add(key);
  }

  _isOptimisticDup(msg) {
    let key;
    if (msg.type === 'hit') {
      key = `hit:${msg.attacker}:${msg.victim}:${msg.damage}:${msg.word}`;
    } else if (msg.type === 'self_hit') {
      key = `self_hit:${msg.player}:${msg.damage}`;
    } else {
      return false;
    }
    return this._optimisticKeys.has(key);
  }

  _processAnswers() {
    if (!this._room || !this._room.currentWord) return;
    clearTimeout(this._answerTimeout);
    const word = this._room.currentWord;
    this._room.currentWord = null;
    for (const side of ['player1', 'player2']) {
      const answer = this._room.answered.get(side) || '';
      const correct = checkAnswer(answer, word.word);
      const opponent = side === 'player1' ? 'player2' : 'player1';
      if (correct) {
        const damage = word.word.length;
        this._room.hp[opponent] = Math.max(0, this._room.hp[opponent] - damage);
        this._broadcast({ type: 'hit', attacker: side, victim: opponent, damage, word: word.word });
      } else {
        this._room.hp[side] = Math.max(0, this._room.hp[side] - 10);
        this._broadcast({ type: 'self_hit', player: side, damage: 10 });
      }
    }
    this._broadcast({
      type: 'hp_update',
      player1_hp: this._room.hp.player1,
      player2_hp: this._room.hp.player2
    });
    if (this._room.hp.player1 <= 0 || this._room.hp.player2 <= 0) {
      const winner = this._room.hp.player1 <= 0 ? 'player2' : 'player1';
      this._broadcast({ type: 'game_over', winner, reason: 'hp_zero' });
      this._room = null;
    } else {
      this._nextWordTimeout = setTimeout(() => this._sendNextWord(), 1000);
    }
  }

  _broadcast(msg) {
    if (this._roomChannel) {
      try {
        this._roomChannel.send({ type: 'broadcast', event: 'game', payload: { ...msg, sender: this.playerId } });
      } catch {}
    }
  }

  _cleanup() {
    this._leaveLobby();
    this._leaveRoom();
  }

  _dispatch(msg) {
    const set = this._handlers.get(msg.type);
    if (set) for (const fn of set) fn(msg);
    const all = this._handlers.get('*');
    if (all) for (const fn of all) fn(msg);
  }
}
