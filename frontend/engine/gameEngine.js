/**
 * Game Engine Module
 * Core game loop, state machine, pathfinding, and simulation logic.
 * Fully self-contained — runs the entire game client-side.
 */

class GameEngine {
  constructor() {
    // ── State constants ──
    this.STATE_MAZE       = 'maze';
    this.STATE_TRANSITION = 'transition';
    this.STATE_BATTLE     = 'battle';
    this.STATE_FINISHED   = 'finished';

    // ── State ──
    this.currentState  = this.STATE_MAZE;
    this.previousState = null;

    // ── Turn tracking ──
    this.turn        = 0;
    this.mazeTurn     = 0;
    this.battleTurn   = 0;
    this.maxMazeTurns   = 50;
    this.maxBattleTurns = 200;

    // ── Control ──
    this.isRunning = false;
    this.isPaused  = false;
    this.gameOver  = false;

    // ── Timing ──
    this.actionDelay  = 0.6;     // seconds between turns
    this.actionTimer  = 0;
    this.transitionTimer = 0;
    this.transitionDuration = 1.5;

    // ── Results ──
    this.winner = null;

    // ── Callbacks ──
    this.listeners = {};

    // ── Debug ──
    this.debugMode = true;
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
  start() {
    this.isRunning = true;
    this.isPaused  = false;
    this.gameOver  = false;
    this.turn      = 0;
    this.mazeTurn   = 0;
    this.battleTurn = 0;
    this.actionTimer = 0;
    this.transitionTimer = 0;
    this.winner = null;
    this.currentState = this.STATE_MAZE;

    // Reset game state
    gameState.reset();
    gameState.generateTraps();

    // Pre-compute maze paths
    this.computeMazePaths();

    this.log('Game Engine started');
    this.log(`AEGIS spawn: (${gameState.aegis.x}, ${gameState.aegis.y})`);
    this.log(`VELO  spawn: (${gameState.velo.x}, ${gameState.velo.y})`);
    this.log(`Traps: ${gameState.traps.length}`);
    this.log(`Arena entry: (${gameState.arenaEntry.x}, ${gameState.arenaEntry.y})`);

    this.emit('gameStarted', {});
    this.emit('stateChange', { from: null, to: this.STATE_MAZE });
  }

  stop() {
    this.isRunning = false;
    this.log('Game Engine stopped');
  }

  pause()  { this.isPaused = true;  }
  resume() { this.isPaused = false; }

  // ════════════════════════════════════════
  //   MAIN UPDATE (called every frame)
  // ════════════════════════════════════════
  update(dt) {
    if (!this.isRunning || this.isPaused || this.gameOver) return;

    this.actionTimer += dt;

    switch (this.currentState) {
      case this.STATE_MAZE:
        this.updateMaze(dt);
        break;
      case this.STATE_TRANSITION:
        this.updateTransition(dt);
        break;
      case this.STATE_BATTLE:
        this.updateBattle(dt);
        break;
      case this.STATE_FINISHED:
        if (!this.gameOver) {
          this.gameOver = true;
          this.emit('gameOver', { winner: this.winner });
        }
        break;
    }
  }

  // ════════════════════════════════════════
  //   MAZE PHASE
  // ════════════════════════════════════════
  updateMaze(dt) {
    // Wait for action delay (and for animations to finish)
    if (this.actionTimer < this.actionDelay) return;
    if (gameState.animating) return;

    this.actionTimer = 0;

    // Check if both reached entry
    if (gameState.aegis.reachedEntry && gameState.velo.reachedEntry) {
      this.log('Both agents reached arena entry → TRANSITION');
      this.changeState(this.STATE_TRANSITION);
      return;
    }

    // Max turns safety
    if (this.mazeTurn >= this.maxMazeTurns) {
      this.log('Max maze turns reached → TRANSITION');
      gameState.aegis.reachedEntry = true;
      gameState.velo.reachedEntry  = true;
      this.changeState(this.STATE_TRANSITION);
      return;
    }

    // Execute one maze turn
    this.mazeTurn++;
    this.turn++;
    gameState.turnCount = this.turn;
    gameState.mazeTurnCount = this.mazeTurn;

    // Move AEGIS (if not at entry yet)
    if (!gameState.aegis.reachedEntry) {
      this.stepAgentOnPath('aegis');
    }

    // Move VELO (if not at entry yet)
    if (!gameState.velo.reachedEntry) {
      this.stepAgentOnPath('velo');
    }

    this.debugTurn();
  }

  /** Move an agent one step along its pre-computed path */
  stepAgentOnPath(agentName) {
    const agent = gameState.getAgent(agentName);

    if (agent.pathIndex >= agent.path.length) {
      // Already at destination
      agent.reachedEntry = true;
      this.log(`${agent.name} reached arena entry!`);
      return;
    }

    const oldX = agent.x;
    const oldY = agent.y;
    const next = agent.path[agent.pathIndex];
    agent.pathIndex++;

    gameState.moveAgent(agentName, next.x, next.y);

    // Check arena entry
    if (next.x === gameState.arenaEntry.x && next.y === gameState.arenaEntry.y) {
      agent.reachedEntry = true;
      this.log(`${agent.name} reached arena entry at (${next.x}, ${next.y})!`);
    }

    // Emit move event (for animation)
    this.emit('agentMove', {
      agent: agentName,
      from: { x: oldX, y: oldY },
      to: { x: next.x, y: next.y }
    });

    // Check for trap
    if (gameState.hasTrap(next.x, next.y)) {
      const dmg = 10;
      gameState.damageAgent(agentName, dmg);
      this.log(`${agent.name} hit a trap at (${next.x},${next.y})! -${dmg} HP → ${agent.hp}`);
      this.emit('trapActivate', { agent: agentName, x: next.x, y: next.y });
      this.emit('damage', { agent: agentName, damage: dmg });

      // Deactivate trap after triggering
      const trap = gameState.traps.find(t => t.x === next.x && t.y === next.y);
      if (trap) trap.active = false;
    }
  }

  // ════════════════════════════════════════
  //   PATHFINDING
  // ════════════════════════════════════════
  computeMazePaths() {
    const entry = gameState.arenaEntry;

    // AEGIS uses A* (optimal path)
    gameState.aegis.path = this.aStarPath(
      gameState.aegis.x, gameState.aegis.y,
      entry.x, entry.y
    );
    gameState.aegis.pathIndex = 0;

    // VELO uses Greedy Best-First (fast but sub-optimal)
    gameState.velo.path = this.greedyPath(
      gameState.velo.x, gameState.velo.y,
      entry.x, entry.y
    );
    gameState.velo.pathIndex = 0;

    this.log(`AEGIS path length: ${gameState.aegis.path.length}`);
    this.log(`VELO  path length: ${gameState.velo.path.length}`);
  }

  /** A* pathfinding (optimal) */
  aStarPath(sx, sy, gx, gy) {
    const grid = gameState;
    const open = [];
    const closed = new Set();
    const cameFrom = {};

    const h = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
    const key = (x, y) => `${x},${y}`;

    open.push({ x: sx, y: sy, g: 0, f: h(sx, sy) });
    cameFrom[key(sx, sy)] = null;

    const gScore = {};
    gScore[key(sx, sy)] = 0;

    while (open.length > 0) {
      // Find lowest f
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const ck = key(current.x, current.y);

      if (current.x === gx && current.y === gy) {
        // Reconstruct path (excluding start)
        const path = [];
        let node = ck;
        while (node !== null) {
          const [nx, ny] = node.split(',').map(Number);
          path.unshift({ x: nx, y: ny });
          node = cameFrom[node];
        }
        path.shift(); // remove start position
        return path;
      }

      closed.add(ck);

      // Neighbors (4-directional)
      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 }
      ];

      for (const n of neighbors) {
        const nk = key(n.x, n.y);
        if (closed.has(nk)) continue;
        if (!grid.isWalkable(n.x, n.y)) continue;

        // Cost: traps cost more (encourages safer paths for A*)
        const trapPenalty = grid.hasTrap(n.x, n.y) ? 5 : 0;
        const tentativeG = current.g + 1 + trapPenalty;

        if (gScore[nk] === undefined || tentativeG < gScore[nk]) {
          gScore[nk] = tentativeG;
          cameFrom[nk] = ck;
          const f = tentativeG + h(n.x, n.y);

          // Add/update in open
          const existing = open.find(o => o.x === n.x && o.y === n.y);
          if (existing) {
            existing.g = tentativeG;
            existing.f = f;
          } else {
            open.push({ x: n.x, y: n.y, g: tentativeG, f });
          }
        }
      }
    }

    // No path found — return empty (agent will stay put)
    this.log('WARNING: A* found no path!');
    return [];
  }

  /** Greedy Best-First Search (fast, not necessarily optimal) */
  greedyPath(sx, sy, gx, gy) {
    const grid = gameState;
    const open = [];
    const closed = new Set();
    const cameFrom = {};

    const h = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
    const key = (x, y) => `${x},${y}`;

    open.push({ x: sx, y: sy, h: h(sx, sy) });
    cameFrom[key(sx, sy)] = null;

    while (open.length > 0) {
      // Pick node with lowest heuristic (greedy — ignores path cost)
      open.sort((a, b) => a.h - b.h);
      const current = open.shift();
      const ck = key(current.x, current.y);

      if (current.x === gx && current.y === gy) {
        const path = [];
        let node = ck;
        while (node !== null) {
          const [nx, ny] = node.split(',').map(Number);
          path.unshift({ x: nx, y: ny });
          node = cameFrom[node];
        }
        path.shift();
        return path;
      }

      closed.add(ck);

      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 }
      ];

      for (const n of neighbors) {
        const nk = key(n.x, n.y);
        if (closed.has(nk)) continue;
        if (!grid.isWalkable(n.x, n.y)) continue;
        if (cameFrom[nk] !== undefined) continue;

        cameFrom[nk] = ck;
        open.push({ x: n.x, y: n.y, h: h(n.x, n.y) });
      }
    }

    this.log('WARNING: Greedy found no path!');
    return [];
  }

  // ════════════════════════════════════════
  //   TRANSITION PHASE
  // ════════════════════════════════════════
  updateTransition(dt) {
    this.transitionTimer += dt;
    const progress = Math.min(this.transitionTimer / this.transitionDuration, 1.0);

    this.emit('transitionProgress', { progress });

    if (progress >= 1.0) {
      this.setupBattlePhase();
      this.changeState(this.STATE_BATTLE);
    }
  }

  setupBattlePhase() {
    gameState.phase = 'battle';

    // Battle spawn positions inside the 3×3 arena (x:2-4, y:2-4)
    const aegisSpawn = { x: 2, y: 3 };
    const veloSpawn  = { x: 4, y: 3 };

    gameState.moveAgent('aegis', aegisSpawn.x, aegisSpawn.y);
    gameState.moveAgent('velo',  veloSpawn.x,  veloSpawn.y);

    gameState.aegis.inArena = true;
    gameState.velo.inArena  = true;

    // Spawn medkit at arena center
    gameState.medkit.x = 3;
    gameState.medkit.y = 3;
    gameState.medkit.spawned = true;

    this.emit('agentMove', {
      agent: 'aegis',
      from: { x: gameState.arenaEntry.x, y: gameState.arenaEntry.y },
      to: aegisSpawn,
      instant: true
    });

    this.emit('agentMove', {
      agent: 'velo',
      from: { x: gameState.arenaEntry.x, y: gameState.arenaEntry.y },
      to: veloSpawn,
      instant: true
    });

    this.emit('medkitSpawned', { x: 3, y: 3 });

    this.log(`Battle phase setup — AEGIS:(${aegisSpawn.x},${aegisSpawn.y}) VELO:(${veloSpawn.x},${veloSpawn.y})`);
    this.actionTimer = 0;
  }

  // ════════════════════════════════════════
  //   BATTLE PHASE
  // ════════════════════════════════════════
  updateBattle(dt) {
    if (this.actionTimer < this.actionDelay) return;
    if (gameState.animating) return;

    this.actionTimer = 0;

    // ── Win conditions ──
    if (!gameState.aegis.alive) {
      this.winner = 'VELO';
      this.log('VELO WINS! AEGIS defeated.');
      this.changeState(this.STATE_FINISHED);
      return;
    }
    if (!gameState.velo.alive) {
      this.winner = 'AEGIS';
      this.log('AEGIS WINS! VELO defeated.');
      this.changeState(this.STATE_FINISHED);
      return;
    }

    // ── Turn limit ──
    if (this.battleTurn >= this.maxBattleTurns) {
      this.log('Max battle turns reached!');
      if (gameState.aegis.hp > gameState.velo.hp) this.winner = 'AEGIS';
      else if (gameState.velo.hp > gameState.aegis.hp) this.winner = 'VELO';
      else this.winner = 'DRAW';
      this.changeState(this.STATE_FINISHED);
      return;
    }

    // ── Execute turn ──
    this.battleTurn++;
    this.turn++;
    gameState.turnCount  = this.turn;
    gameState.battleTurnCount = this.battleTurn;

    // Alternate: odd turns = AEGIS, even turns = VELO
    const activeAgent = (this.battleTurn % 2 === 1) ? 'aegis' : 'velo';
    gameState.currentTurnAgent = activeAgent;

    this.executeBattleTurn(activeAgent);

    // ── Power-up check: spawn when first agent drops below 50% ──
    if (!gameState.powerUp.spawned) {
      const aegisLow = gameState.aegis.hp < gameState.aegis.maxHp * 0.5;
      const veloLow  = gameState.velo.hp  < gameState.velo.maxHp  * 0.5;
      if (aegisLow || veloLow) {
        this.spawnPowerUp();
      }
    }

    this.debugTurn();
  }

  executeBattleTurn(agentName) {
    const agent    = gameState.getAgent(agentName);
    const oppName  = gameState.getOpponent(agentName);
    const opponent = gameState.getAgent(oppName);

    const dist = Math.abs(agent.x - opponent.x) + Math.abs(agent.y - opponent.y);

    // ── Decision logic ──
    let action = 'wait'; // fallback — ALWAYS ensures turn ends

    // Check if on medkit
    if (gameState.medkit.spawned && !gameState.medkit.pickedUp &&
        agent.x === gameState.medkit.x && agent.y === gameState.medkit.y &&
        agent.hp < agent.maxHp) {
      action = 'use_medkit';
    }
    // Check if on power-up
    else if (gameState.powerUp.spawned && !gameState.powerUp.pickedUp &&
             agent.x === gameState.powerUp.x && agent.y === gameState.powerUp.y) {
      action = 'use_powerup';
    }
    // Adjacent → attack
    else if (dist <= 1) {
      action = 'attack';
    }
    // Not adjacent → move toward opponent
    else {
      action = 'move';
    }

    this.log(`${agent.name} turn ${this.battleTurn}: action=${action} dist=${dist}`);

    switch (action) {
      case 'attack':
        this.doBattleAttack(agentName, oppName);
        break;
      case 'move':
        this.doBattleMove(agentName, oppName);
        break;
      case 'use_medkit':
        this.doUseMedkit(agentName);
        break;
      case 'use_powerup':
        this.doUsePowerUp(agentName);
        break;
      case 'wait':
      default:
        this.log(`${agent.name} waits.`);
        this.emit('agentWait', { agent: agentName });
        break;
    }
  }

  doBattleAttack(attacker, defender) {
    const atkAgent = gameState.getAgent(attacker);
    const dmg = atkAgent.attack + Math.floor(Math.random() * 6) - 2;
    const actual = gameState.damageAgent(defender, Math.max(1, dmg));
    const defAgent = gameState.getAgent(defender);

    this.log(`${atkAgent.name} attacks ${defAgent.name} for ${actual} damage → ${defAgent.hp} HP`);
    this.emit('attack', { attacker, defender, damage: actual });
    this.emit('damage', { agent: defender, damage: actual });
  }

  doBattleMove(agentName, oppName) {
    const agent = gameState.getAgent(agentName);
    const opp   = gameState.getAgent(oppName);
    const oldX = agent.x;
    const oldY = agent.y;

    // Determine best move toward opponent within arena bounds
    const candidates = [
      { x: agent.x - 1, y: agent.y },
      { x: agent.x + 1, y: agent.y },
      { x: agent.x, y: agent.y - 1 },
      { x: agent.x, y: agent.y + 1 }
    ].filter(c =>
      c.x >= gameState.arena.start && c.x <= gameState.arena.end &&
      c.y >= gameState.arena.start && c.y <= gameState.arena.end &&
      !(c.x === opp.x && c.y === opp.y)
    );

    if (candidates.length === 0) {
      this.log(`${agent.name} cannot move — wait`);
      return;
    }

    // Pick move that minimizes distance to opponent
    candidates.sort((a, b) => {
      const distA = Math.abs(a.x - opp.x) + Math.abs(a.y - opp.y);
      const distB = Math.abs(b.x - opp.x) + Math.abs(b.y - opp.y);
      return distA - distB;
    });

    const best = candidates[0];

    // Check for medkit pickup
    if (gameState.medkit.spawned && !gameState.medkit.pickedUp &&
        best.x === gameState.medkit.x && best.y === gameState.medkit.y) {
      // Will pick up next turn
    }

    // Check for power-up pickup
    if (gameState.powerUp.spawned && !gameState.powerUp.pickedUp &&
        best.x === gameState.powerUp.x && best.y === gameState.powerUp.y) {
      // Will pick up next turn
    }

    gameState.moveAgent(agentName, best.x, best.y);
    this.log(`${agent.name} moves (${oldX},${oldY}) → (${best.x},${best.y})`);

    this.emit('agentMove', {
      agent: agentName,
      from: { x: oldX, y: oldY },
      to: { x: best.x, y: best.y }
    });
  }

  doUseMedkit(agentName) {
    const agent = gameState.getAgent(agentName);
    const healAmount = gameState.medkit.healAmount;
    gameState.healAgent(agentName, healAmount);
    gameState.medkit.pickedUp = true;
    this.log(`${agent.name} used medkit → healed ${healAmount} → ${agent.hp} HP`);
    this.emit('medkitUsed', { agent: agentName, amount: healAmount });
  }

  doUsePowerUp(agentName) {
    const agent = gameState.getAgent(agentName);
    agent.attack += gameState.powerUp.value;
    gameState.powerUp.pickedUp = true;
    this.log(`${agent.name} picked up power-up! Attack → ${agent.attack}`);
    this.emit('powerUpUsed', { agent: agentName, value: gameState.powerUp.value });
  }

  spawnPowerUp() {
    // Spawn at a random arena cell not occupied by agents
    const cells = [];
    for (let y = gameState.arena.start; y <= gameState.arena.end; y++) {
      for (let x = gameState.arena.start; x <= gameState.arena.end; x++) {
        if (!(x === gameState.aegis.x && y === gameState.aegis.y) &&
            !(x === gameState.velo.x && y === gameState.velo.y) &&
            !(x === gameState.medkit.x && y === gameState.medkit.y)) {
          cells.push({ x, y });
        }
      }
    }

    if (cells.length === 0) return;

    const pick = cells[Math.floor(Math.random() * cells.length)];
    gameState.powerUp.x = pick.x;
    gameState.powerUp.y = pick.y;
    gameState.powerUp.spawned = true;
    this.log(`Power-up spawned at (${pick.x}, ${pick.y})`);
    this.emit('powerUpSpawned', { x: pick.x, y: pick.y });
  }

  // ════════════════════════════════════════
  //   STATE TRANSITIONS
  // ════════════════════════════════════════
  changeState(newState) {
    if (newState === this.currentState) return;

    this.previousState = this.currentState;
    this.currentState  = newState;
    this.transitionTimer = 0;
    this.actionTimer     = 0;

    gameState.phase = newState;

    this.log(`STATE: ${this.previousState} → ${newState}`);
    this.emit('stateChange', { from: this.previousState, to: newState });
  }

  // ════════════════════════════════════════
  //   DEBUG
  // ════════════════════════════════════════
  log(msg) {
    if (!this.debugMode) return;
    console.log(`[GameEngine] ${msg}`);
    this.emit('debugLog', { message: msg });
  }

  debugTurn() {
    console.log(
      `Turn: ${this.turn}  Phase: ${this.currentState}  ` +
      `AEGIS: (${gameState.aegis.x},${gameState.aegis.y}) HP:${gameState.aegis.hp}  ` +
      `VELO: (${gameState.velo.x},${gameState.velo.y}) HP:${gameState.velo.hp}`
    );
  }

  getState() {
    return {
      currentState: this.currentState,
      turn: this.turn,
      mazeTurn: this.mazeTurn,
      battleTurn: this.battleTurn,
      isRunning: this.isRunning,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
}
