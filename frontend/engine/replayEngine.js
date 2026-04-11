/**
 * Replay Engine Module
 * Fetches a pre-simulated game replay from the Python backend and plays it
 * back event-by-event. No client-side AI — pure visualisation driver.
 */

class ReplayEngine {
  constructor() {
    this.replay = [];          // full event list from backend
    this.currentIndex = 0;     // current replay position
    this.isPlaying = false;
    this.isPaused = false;
    this.playbackTimer = 0;
    this.listeners = {};       // event system

    this.MAZE_STEP_DELAY   = 600;   // ms between maze move events
    this.BATTLE_STEP_DELAY = 900;   // ms between battle action events
    this.TRANSITION_DELAY  = 1500;  // ms for transition events

    this.currentDelay = this.MAZE_STEP_DELAY;
  }

  // ════════════════════════════════════════
  //   EVENT SYSTEM
  // ════════════════════════════════════════
  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  emit(event, data = {}) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ════════════════════════════════════════
  //   LIFECYCLE
  // ════════════════════════════════════════
  async startGame() {
    // 1. POST /api/game/start — backend simulates full game
    this.emit('debugLog', { message: 'Requesting game simulation from backend...' });
    try {
      const startRes = await fetch('/api/game/start', { method: 'POST' });
      if (!startRes.ok) throw new Error('Failed to start game');
      const startData = await startRes.json();
      this.emit('debugLog', { message: `Backend simulated ${startData.totalEvents} events. Winner: ${startData.winner}` });

      // 2. GET /api/game/replay
      const replayRes = await fetch('/api/game/replay');
      if (!replayRes.ok) throw new Error('Failed to fetch replay');
      const replayData = await replayRes.json();
      this.replay = replayData.replay;
      this.currentIndex = 0;
      this.isPlaying = true;
      this.isPaused = false;
      this.playbackTimer = 0;

      this.emit('debugLog', { message: `Replay loaded: ${this.replay.length} events` });
      this.emit('replayLoaded', { total: this.replay.length });

      // Process GAME_START event immediately (no delay)
      if (this.replay.length > 0) {
        this._processEvent(this.replay[0]);
        this.currentIndex = 1;
      }

    } catch (err) {
      this.emit('debugLog', { message: `ERROR: ${err.message}` });
      console.error('ReplayEngine startGame error:', err);
    }
  }

  stop() {
    this.isPlaying = false;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  // ════════════════════════════════════════
  //   MAIN UPDATE (called every frame)
  // ════════════════════════════════════════
  update(dt) {
    if (!this.isPlaying || this.isPaused) return;
    if (this.currentIndex >= this.replay.length) {
      this.isPlaying = false;
      return;
    }

    // Wait for animations to finish before advancing
    if (gameState.animating) return;

    this.playbackTimer += dt * 1000; // convert to ms
    if (this.playbackTimer < this.currentDelay) return;
    this.playbackTimer = 0;

    const event = this.replay[this.currentIndex];
    this._processEvent(event);
    this.currentIndex++;
  }

  // ════════════════════════════════════════
  //   EVENT DISPATCH
  // ════════════════════════════════════════
  _processEvent(event) {
    // Update delay based on phase
    if (event.phase === 'maze')        this.currentDelay = this.MAZE_STEP_DELAY;
    else if (event.phase === 'battle') this.currentDelay = this.BATTLE_STEP_DELAY;
    else if (event.phase === 'transition') this.currentDelay = this.TRANSITION_DELAY;

    switch (event.type) {
      case 'GAME_START':      this._handleGameStart(event);      break;
      case 'MAZE_MOVE':       this._handleMazeMove(event);       break;
      case 'MAZE_WINNER':     this._handleMazeWinner(event);     break;
      case 'TRANSITION':      this._handleTransition(event);     break;
      case 'BATTLE_SPAWN':    this._handleBattleSpawn(event);    break;
      case 'BATTLE_ACTION':   this._handleBattleAction(event);   break;
      case 'ITEM_SPAWNED':    this._handleItemSpawned(event);    break;
      case 'ITEM_COLLECTED':  this._handleItemCollected(event);  break;
      case 'GAME_OVER':       this._handleGameOver(event);       break;
    }
  }

  // ════════════════════════════════════════
  //   EVENT HANDLERS
  // ════════════════════════════════════════
  _handleGameStart(event) {
    // Reset gameState for a fresh game
    gameState.reset();

    // Initialize trap positions from backend
    gameState.traps = event.traps.map(t => ({ x: t[0], y: t[1], active: true }));
    gameState.arenaEntry = { x: event.arenaEntry[0], y: event.arenaEntry[1] };
    gameState.aegis.x  = event.aegisSpawn[0];
    gameState.aegis.y  = event.aegisSpawn[1];
    gameState.velo.x   = event.veloSpawn[0];
    gameState.velo.y   = event.veloSpawn[1];
    gameState.aegis.hp = 100;
    gameState.velo.hp  = 100;
    gameState.phase    = 'maze';

    this.emit('gameStart', event);
    this.emit('stateChange', { from: null, to: 'maze' });
  }

  _handleMazeMove(event) {
    const agentName = event.agent;
    const from = { x: event.from[0], y: event.from[1] };
    const to   = { x: event.to[0],   y: event.to[1]   };

    // Sync both HPs from the snapshot
    gameState.aegis.hp = event.aegis.hp;
    gameState.velo.hp  = event.velo.hp;

    // Update position
    const agent = gameState.getAgent(agentName);
    agent.x = to.x;
    agent.y = to.y;

    this.emit('agentMove', { agent: agentName, from, to, instant: false });

    if (event.trapHit) {
      this.emit('trapActivate', { agent: agentName, x: to.x, y: to.y });
      this.emit('damage', { agent: agentName, damage: event.damage });
    }

    this.emit('debugLog', {
      message: `[MAZE] ${agentName.toUpperCase()} → (${to.x},${to.y})${event.trapHit ? ' TRAP -' + event.damage + 'HP' : ''}`
    });
  }

  _handleMazeWinner(event) {
    gameState.mazeWinner = event.agent.toUpperCase();
    this.emit('mazeWinner', { agent: event.agent });
    this.emit('debugLog', { message: `[MAZE] Winner: ${event.agent.toUpperCase()}` });
  }

  _handleTransition(event) {
    gameState.phase = 'transition';
    this.emit('stateChange', { from: 'maze', to: 'transition' });
  }

  _handleBattleSpawn(event) {
    gameState.aegis.x = event.aegisPos[0];
    gameState.aegis.y = event.aegisPos[1];
    gameState.velo.x  = event.veloPos[0];
    gameState.velo.y  = event.veloPos[1];
    gameState.aegis.inArena = true;
    gameState.velo.inArena  = true;
    gameState.phase = 'battle';

    this.emit('agentMove', {
      agent: 'aegis',
      from: gameState.arenaEntry,
      to: { x: event.aegisPos[0], y: event.aegisPos[1] },
      instant: true
    });
    this.emit('agentMove', {
      agent: 'velo',
      from: gameState.arenaEntry,
      to: { x: event.veloPos[0], y: event.veloPos[1] },
      instant: true
    });
    this.emit('stateChange', { from: 'transition', to: 'battle' });
  }

  _handleBattleAction(event) {
    gameState.aegis.hp    = event.aegisHpAfter;
    gameState.velo.hp     = event.veloHpAfter;
    gameState.aegis.alive = event.aegis.alive;
    gameState.velo.alive  = event.velo.alive;

    // Sync positions (agent may have moved)
    gameState.aegis.x = event.aegis.x;
    gameState.aegis.y = event.aegis.y;
    gameState.velo.x  = event.velo.x;
    gameState.velo.y  = event.velo.y;

    const agentName = event.agent;
    const oppName   = agentName === 'aegis' ? 'velo' : 'aegis';

    gameState.turnCount++;

    if (event.action === 'move' && event.target) {
      this.emit('agentMove', {
        agent: agentName,
        from: { x: event[agentName].x, y: event[agentName].y },
        to:   { x: event.target[0], y: event.target[1] },
        instant: false
      });
    }
    if (event.damage > 0) {
      this.emit('attack',  { attacker: agentName, defender: oppName, attackType: event.attackType, damage: event.damage });
      this.emit('damage',  { agent: oppName, damage: event.damage });
    }
    if (event.action === 'defend') {
      this.emit('defend', { agent: agentName });
    }

    this.emit('debugLog', {
      message: `[Battle T${gameState.turnCount}] ${agentName.toUpperCase()}: ${event.action}${event.damage > 0 ? ' -' + event.damage + 'HP' : ''} | AEGIS:${event.aegisHpAfter} VELO:${event.veloHpAfter}`
    });
  }

  _handleItemSpawned(event) {
    gameState.healthPickupActive = true;
    gameState.healthPickupPos = { x: event.pos[0], y: event.pos[1] };
    this.emit('itemSpawned', { itemType: event.itemType, pos: event.pos });
  }

  _handleItemCollected(event) {
    gameState.healthPickupActive = false;
    gameState.healthPickupPos = null;
    this.emit('itemCollected', { agent: event.agent, itemType: event.itemType });
  }

  _handleGameOver(event) {
    gameState.phase        = 'finished';
    gameState.winner       = event.winner ? event.winner.toUpperCase() : null;
    gameState.mazeWinner   = event.mazeWinner   ? event.mazeWinner.toUpperCase()   : null;
    gameState.battleWinner = event.battleWinner ? event.battleWinner.toUpperCase() : null;

    this.emit('stateChange', { from: 'battle', to: 'finished' });
    this.emit('gameOver', {
      winner:       event.winner,
      mazeWinner:   event.mazeWinner,
      battleWinner: event.battleWinner,
      aegisFinalHp: event.aegisFinalHp,
      veloFinalHp:  event.veloFinalHp
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReplayEngine;
}
