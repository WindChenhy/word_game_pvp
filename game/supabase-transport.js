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
      const state = this._lobbyChannel.presenceState();
      const players = Object.keys(state).sort();
      if (players.length >= 2 && players[0] === this.playerId) {
        const roomId = `room_${Date.now()}`;

        this._side = 'player1';
        this._isHost = true;
        this._roomId = roomId;

        this._lobbyChannel.send({
          type: 'broadcast',
          event: 'match',
          payload: { roomId, player1: players[0], player2: players[1] }
        });

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
    this._roomReady = false;
    this._roomChannel = this._client.channel(`pvp-room:${roomId}`, {
      config: { presence: { key: this.playerId } }
    });

    this._roomChannel.on('broadcast', { event: 'game' }, (payload) => {
      const msg = payload.payload;
      if (msg.type === 'submit_answer' && this._isHost && this._room) {
        const guestSide = this._side === 'player1' ? 'player2' : 'player1';
        this._room.answered.set(guestSide, msg.word);
        if (this._room.answered.size >= 2) {
          this._processAnswers();
        }
        return;
      }
      this._dispatch(msg);
    });

    this._roomChannel.on('presence', { event: 'sync' }, () => {
      if (!this._roomReady) return;
      const state = this._roomChannel.presenceState();
      const players = Object.keys(state);
      if (players.length < 2 && this._room) {
        this._room = null;
        this._dispatch({ type: 'game_over', winner: this._side, reason: 'disconnect' });
      }
    });

    this._roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await this._roomChannel.track({ user_id: this.playerId, side: this._side });
        } catch {}
        this._roomReady = true;
        if (this._isHost) {
          this._room = {
            hp: { player1: 100, player2: 100 },
            currentWord: null,
            answered: new Map(),
          };
          this._dispatch({ type: 'game_start', hp: 100, maxHp: 100 });
          this._broadcast({ type: 'game_start', hp: 100, maxHp: 100 });
          this._sendNextWord();
        }
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !this._roomReady) {
        this._dispatch({ type: 'disconnected', code: 0 });
      }
    });
  }

  _leaveRoom() {
    if (this._roomChannel) {
      this._roomChannel.unsubscribe();
      this._roomChannel = null;
    }
    this._room = null;
    if (this._answerTimeout) clearTimeout(this._answerTimeout);
    if (this._nextWordTimeout) clearTimeout(this._nextWordTimeout);
  }

  _sendNextWord() {
    if (!this._room) return;
    const word = pickWord();
    this._room.currentWord = word;
    this._room.answered = new Map();
    const data = { type: 'new_word', word };
    this._dispatch(data);
    this._broadcast(data);
    this._answerTimeout = setTimeout(() => {
      this._processAnswers();
    }, 8000);
  }

  _handleSubmit(word) {
    if (!this._isHost || !this._room) {
      this._broadcast({ type: 'submit_answer', word });
      return;
    }
    this._room.answered.set(this._side, word);
    this._broadcast({ type: 'submit_answer', word });
    if (this._room.answered.size >= 2) {
      this._processAnswers();
    }
  }

  _processAnswers() {
    if (!this._room || !this._room.currentWord) return;
    clearTimeout(this._answerTimeout);
    const word = this._room.currentWord;
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
      this._roomChannel.send({ type: 'broadcast', event: 'game', payload: msg });
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
