/**
 * Game State Module
 * Source of truth for all game data.
 * Uses string-based state machine: "maze" | "transition" | "battle" | "finished"
 */

const gameState = {
  // ── Grid configuration ──
  gridSize: 7,
  tileSize: 1,

  // Arena is the center 3×3 (indices 2–4)
  arena: { start: 2, end: 4, size: 3 },

  // ── State machine ──
  phase: 'maze', // "maze" | "transition" | "battle" | "finished"

  // ── Turn tracking ──
  turnCount: 0,
  mazeTurnCount: 0,
  battleTurnCount: 0,
  currentTurnAgent: 'aegis', // alternates each turn

  // ── Maze layout ──
  // 7×7 grid:  '#' = wall, '.' = path, 'A' = arena cell
  // Arena occupies rows 2-4, cols 2-4
  // Row 3 (y=3) is the main corridor — kept fully open so agents can walk across
  maze: [
    ['.', '.', '#', '.', '#', '.', '.'],
    ['.', '#', '.', '.', '.', '#', '.'],
    ['.', '.', 'A', 'A', 'A', '.', '.'],
    ['.', '.', 'A', 'A', 'A', '.', '.'],
    ['.', '.', 'A', 'A', 'A', '.', '.'],
    ['.', '#', '.', '.', '.', '#', '.'],
    ['.', '.', '#', '.', '#', '.', '.']
  ],

  // Arena entry point (left side of arena, matching backend)
  arenaEntry: { x: 2, y: 3 },

  // ── Agents ──
  aegis: {
    x: 0, y: 3,       // spawn left-center (matches backend AGENT_SPAWN_AEGIS)
    hp: 100, maxHp: 100,
    attack: 15, defense: 5,
    alive: true,
    inArena: false,
    reachedEntry: false,
    isDefending: false,
    color: 'blue',
    name: 'AEGIS',
    path: [],          // pre-computed path
    pathIndex: 0
  },

  velo: {
    x: 6, y: 3,       // spawn right-center (matches backend AGENT_SPAWN_VELO)
    hp: 100, maxHp: 100,
    attack: 12, defense: 3,
    alive: true,
    inArena: false,
    reachedEntry: false,
    isDefending: false,
    color: 'red',
    name: 'VELO',
    path: [],
    pathIndex: 0
  },

  // ── Traps ──
  traps: [],  // [{x, y, active}]

  // ── Power-up ──
  powerUp: {
    spawned: false,
    pickedUp: false,
    x: -1, y: -1,
    effect: 'damage_boost',
    value: 10
  },

  // ── Medkit ──
  medkit: {
    spawned: false,
    pickedUp: false,
    x: -1, y: -1,
    healAmount: 30
  },

  // ── Animation ──
  animating: false,

  // ── Winner ──
  winner: null,

  // ════════════════════════════════════════
  //   METHODS
  // ════════════════════════════════════════

  /** Convert grid (0–6) → world coords (centered at 0) */
  gridToWorld(gridX, gridY) {
    return { x: gridX - 3, z: gridY - 3 };
  },

  worldToGrid(x, z) {
    return { x: Math.round(x + 3), y: Math.round(z + 3) };
  },

  isInArena(x, y) {
    return x >= this.arena.start && x <= this.arena.end &&
           y >= this.arena.start && y <= this.arena.end;
  },

  /** Check cell type. Returns null for out-of-bounds. */
  getCellType(x, y) {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return null;
    return this.maze[y][x];
  },

  /** Is this cell walkable? */
  isWalkable(x, y) {
    const cell = this.getCellType(x, y);
    return cell !== null && cell !== '#';
  },

  hasTrap(x, y) {
    return this.traps.some(t => t.x === x && t.y === y && t.active);
  },

  moveAgent(agentName, x, y) {
    const agent = this.getAgent(agentName);
    agent.x = x;
    agent.y = y;
    agent.inArena = this.isInArena(x, y);
  },

  damageAgent(agentName, amount) {
    const agent = this.getAgent(agentName);
    const actualDamage = Math.max(1, amount - (agent.isDefending ? agent.defense : 0));
    agent.hp = Math.max(0, agent.hp - actualDamage);
    if (agent.hp <= 0) {
      agent.hp = 0;
      agent.alive = false;
    }
    agent.isDefending = false;
    return actualDamage;
  },

  healAgent(agentName, amount) {
    const agent = this.getAgent(agentName);
    agent.hp = Math.min(agent.maxHp, agent.hp + amount);
  },

  getAgent(name) {
    return name === 'aegis' ? this.aegis : this.velo;
  },

  getOpponent(name) {
    return name === 'aegis' ? 'velo' : 'aegis';
  },

  /** Generate traps on walkable non-arena cells (25–30% density) */
  generateTraps() {
    this.traps = [];
    const walkableCells = [];

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.isWalkable(x, y) && !this.isInArena(x, y)) {
          // Don't place traps on spawn points, arena entry, or direct corridor (y=3)
          if ((x === this.aegis.x && y === this.aegis.y) ||
              (x === this.velo.x && y === this.velo.y) ||
              (x === this.arenaEntry.x && y === this.arenaEntry.y)) {
            continue;
          }
          // Keep direct path (y=3) clear so agents can walk through
          if (y === 3) continue;
          walkableCells.push({ x, y });
        }
      }
    }

    // 25–30% density
    const density = 0.25 + Math.random() * 0.05;
    const trapCount = Math.floor(walkableCells.length * density);

    // Shuffle and pick
    for (let i = walkableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [walkableCells[i], walkableCells[j]] = [walkableCells[j], walkableCells[i]];
    }

    for (let i = 0; i < trapCount && i < walkableCells.length; i++) {
      this.traps.push({ x: walkableCells[i].x, y: walkableCells[i].y, active: true });
    }
  },

  /** Initialize from backend state (if backend is used) */
  initializeFromBackend(backendState) {
    if (backendState.aegis) {
      Object.assign(this.aegis, {
        x: backendState.aegis.x, y: backendState.aegis.y,
        hp: backendState.aegis.hp, alive: backendState.aegis.alive
      });
    }
    if (backendState.velo) {
      Object.assign(this.velo, {
        x: backendState.velo.x, y: backendState.velo.y,
        hp: backendState.velo.hp, alive: backendState.velo.alive
      });
    }
    if (backendState.traps) {
      this.traps = backendState.traps.map(t => ({ x: t[0], y: t[1], active: true }));
    }
    this.turnCount = backendState.turn || 0;
    this.phase = backendState.phase || 'maze';
  },

  /** Full reset */
  reset() {
    this.phase = 'maze';
    this.turnCount = 0;
    this.mazeTurnCount = 0;
    this.battleTurnCount = 0;
    this.currentTurnAgent = 'aegis';
    this.winner = null;
    this.animating = false;

    this.aegis = {
      x: 0, y: 3, hp: 100, maxHp: 100,
      attack: 15, defense: 5,
      alive: true, inArena: false, reachedEntry: false,
      isDefending: false, color: 'blue', name: 'AEGIS',
      path: [], pathIndex: 0
    };

    this.velo = {
      x: 6, y: 3, hp: 100, maxHp: 100,
      attack: 12, defense: 3,
      alive: true, inArena: false, reachedEntry: false,
      isDefending: false, color: 'red', name: 'VELO',
      path: [], pathIndex: 0
    };

    this.traps = [];

    this.powerUp = {
      spawned: false, pickedUp: false,
      x: -1, y: -1, effect: 'damage_boost', value: 10
    };

    this.medkit = {
      spawned: false, pickedUp: false,
      x: -1, y: -1, healAmount: 30
    };
  }
};
