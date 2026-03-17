/**
 * Game State Module
 * Represents the current state of the Neuro Bot Wars game
 * This is the source of truth for all game data
 */

const gameState = {
  // Grid configuration
  gridSize: 7,
  tileSize: 1,
  
  // Arena configuration (center 3x3)
  arena: {
    start: 2,
    end: 4,
    size: 3
  },
  
  // Agent positions
  aegis: {
    x: 0,
    y: 6,
    hp: 100,
    maxHp: 100,
    alive: true,
    inArena: false,
    isDefending: false
  },
  
  velo: {
    x: 6,
    y: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    inArena: false,
    isDefending: false
  },
  
  // Trap positions
  traps: [
    { x: 2, y: 1 },
    { x: 4, y: 5 },
    { x: 1, y: 3 },
    { x: 5, y: 2 },
    { x: 3, y: 4 }
  ],
  
  // Maze cell types
  // CellType: WALL='#', PATH='.', TRAP='T', ENTRY='E', ARENA=' '
  maze: [
    ['#', '.', '.', '.', '.', '.', '#'],
    ['#', '.', '#', '#', '#', '.', '#'],
    ['.', '.', '#', ' ', ' ', '.', '.'],
    ['.', '#', ' ', ' ', ' ', '#', '.'],
    ['.', '.', ' ', ' ', ' ', '.', '.'],
    ['#', '.', '#', '#', '#', '.', '#'],
    ['#', '.', '.', '.', '.', '.', '#']
  ],
  
  // Arena entry point
  arenaEntry: { x: 2, y: 3 },
  
  // Game phase
  phase: 1, // 1 = Maze Navigation, 2 = Combat
  turnCount: 0,
  mazeTurnCount: 0,
  
  // Animation states
  animating: false,
  
  /**
   * Convert grid coordinates to world position
   * @param {number} gridX - Grid X coordinate (0-6)
   * @param {number} gridY - Grid Y coordinate (0-6)
   * @returns {object} World position {x, z}
   */
  gridToWorld: function(gridX, gridY) {
    // Convert grid (0-6) to world (-3 to 3)
    const x = gridX - 3;
    const z = gridY - 3;
    return { x, z };
  },
  
  /**
   * Convert world coordinates to grid position
   * @param {number} x - World X coordinate
   * @param {number} z - World Z coordinate
   * @returns {object} Grid position {x, y}
   */
  worldToGrid: function(x, z) {
    const gridX = Math.round(x + 3);
    const gridY = Math.round(z + 3);
    return { x: gridX, y: gridY };
  },
  
  /**
   * Check if position is in arena
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isInArena: function(x, y) {
    return x >= this.arena.start && x <= this.arena.end && 
           y >= this.arena.start && y <= this.arena.end;
  },
  
  /**
   * Check if position has a trap
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  hasTrap: function(x, y) {
    return this.traps.some(trap => trap.x === x && trap.y === y);
  },
  
  /**
   * Get cell type at position
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {string} Cell type
   */
  getCellType: function(x, y) {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
      return null;
    }
    return this.maze[y][x];
  },
  
  /**
   * Move an agent to a new position
   * @param {string} agent - 'aegis' or 'velo'
   * @param {number} x - New grid X
   * @param {number} y - New grid Y
   */
  moveAgent: function(agent, x, y) {
    if (agent === 'aegis') {
      this.aegis.x = x;
      this.aegis.y = y;
      this.aegis.inArena = this.isInArena(x, y);
    } else if (agent === 'velo') {
      this.velo.x = x;
      this.velo.y = y;
      this.velo.inArena = this.isInArena(x, y);
    }
  },
  
  /**
   * Damage agent
   * @param {string} agent - 'aegis' or 'velo'
   * @param {number} amount - Damage amount
   */
  damageAgent: function(agent, amount) {
    if (agent === 'aegis') {
      this.aegis.hp = Math.max(0, this.aegis.hp - amount);
      if (this.aegis.hp === 0) {
        this.aegis.alive = false;
      }
    } else if (agent === 'velo') {
      this.velo.hp = Math.max(0, this.velo.hp - amount);
      if (this.velo.hp === 0) {
        this.velo.alive = false;
      }
    }
  },
  
  /**
   * Heal agent
   * @param {string} agent - 'aegis' or 'velo'
   * @param {number} amount - Heal amount
   */
  healAgent: function(agent, amount) {
    if (agent === 'aegis') {
      this.aegis.hp = Math.min(this.aegis.maxHp, this.aegis.hp + amount);
    } else if (agent === 'velo') {
      this.velo.hp = Math.min(this.velo.maxHp, this.velo.hp + amount);
    }
  },
  
  /**
   * Set phase
   * @param {number} phase - 1 or 2
   */
  setPhase: function(phase) {
    this.phase = phase;
  },
  
  /**
   * Next turn
   */
  nextTurn: function() {
    this.turnCount++;
  },
  
  /**
   * Get agent object
   */
  getAgent: function(name) {
    return name === 'aegis' ? this.aegis : this.velo;
  },
  
  /**
   * Reset for new match
   */
  reset: function() {
    this.aegis = {
      x: 0,
      y: 6,
      hp: 100,
      maxHp: 100,
      alive: true,
      inArena: false,
      isDefending: false
    };
    
    this.velo = {
      x: 6,
      y: 0,
      hp: 100,
      maxHp: 100,
      alive: true,
      inArena: false,
      isDefending: false
    };
    
    this.phase = 1;
    this.turnCount = 0;
    this.mazeTurnCount = 0;
  },
  
  /**
   * Apply damage to agent
   * @param {string} agent - 'aegis' or 'velo'
   * @param {number} damage - Damage amount
   */
  damageAgent: function(agent, damage) {
    const target = agent === 'aegis' ? this.aegis : this.velo;
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp === 0) {
      target.alive = false;
    }
  },
  
  /**
   * Set agent defending status
   * @param {string} agent - 'aegis' or 'velo'
   * @param {boolean} defending - Is defending
   */
  setDefending: function(agent, defending) {
    if (agent === 'aegis') {
      this.aegis.isDefending = defending;
    } else if (agent === 'velo') {
      this.velo.isDefending = defending;
    }
  },
  
  /**
   * Update game phase
   * @param {number} newPhase - 1 or 2
   */
  setPhase: function(newPhase) {
    this.phase = newPhase;
  },
  
  /**
   * Increment turn count
   */
  nextTurn: function() {
    this.turnCount++;
    if (this.phase === 1) {
      this.mazeTurnCount++;
    }
  },
  
  /**
   * Reset all agent positions and HP for new game
   */
  reset: function() {
    this.aegis = {
      x: 0, y: 6, hp: 100, maxHp: 100,
      alive: true, inArena: false, isDefending: false
    };
    this.velo = {
      x: 6, y: 0, hp: 100, maxHp: 100,
      alive: true, inArena: false, isDefending: false
    };
    this.phase = 1;
    this.turnCount = 0;
    this.mazeTurnCount = 0;
    this.animating = false;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameState;
}
