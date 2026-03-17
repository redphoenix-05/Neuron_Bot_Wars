/**
 * Game Engine Module
 * Core game loop, state machine, and simulation logic
 * Manages all game logic including maze navigation and battle phases
 */

class GameEngine {
  constructor() {
    // Game states
    this.STATE_MAZE = 'maze';
    this.STATE_TRANSITION = 'transition';
    this.STATE_BATTLE = 'battle';
    this.STATE_FINISHED = 'finished';
    
    this.currentState = this.STATE_MAZE;
    this.previousState = null;
    
    // Game variables
    this.turn = 0;
    this.mazeTurn = 0;
    this.battleTurn = 0;
    this.maxMazeTurns = 50;
    this.maxBattleTurns = 200;
    this.isRunning = false;
    this.isPaused = false;
    
    // Timing
    this.deltaTime = 0;
    this.lastFrameTime = Date.now();
    this.actionDelay = 0.5; // Time between actions in seconds
    this.actionTimer = 0;
    
    // Action queue
    this.actionQueue = [];
    this.currentAction = null;
    this.transitionProgress = 0;
    
    // Winners/results
    this.winner = null;
    this.gameOver = false;
    
    // Callback hooks
    this.callbacks = {
      onStateChange: null,
      onTurnStart: null,
      onAgentMove: null,
      onDamage: null,
      onTrapActivate: null,
      onGameOver: null,
      onDebugLog: null
    };
    
    // Debug
    this.debugMode = true;
    this.debugBuffer = [];
    this.MAX_DEBUG_LOGS = 1000;
  }
  
  /**
   * Register callback for events
   */
  on(eventName, callback) {
    if (this.callbacks.hasOwnProperty(`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`)) {
      this.callbacks[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`] = callback;
    }
  }
  
  /**
   * Emit callback for events
   */
  emit(eventName, data = {}) {
    const callbackName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
    if (this.callbacks[callbackName]) {
      this.callbacks[callbackName](data);
    }
  }
  
  /**
   * Debug logging
   */
  log(level, message, data = {}) {
    if (!this.debugMode) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      turn: this.turn,
      state: this.currentState
    };
    
    this.debugBuffer.push(logEntry);
    if (this.debugBuffer.length > this.MAX_DEBUG_LOGS) {
      this.debugBuffer.shift();
    }
    
    const color = level === 'error' ? '#ff4444' : level === 'warn' ? '#ffaa44' : '#44ff44';
    console.log(`%c[${timestamp}] [${level.toUpperCase()}] ${message}`, `color: ${color}`, data);
    
    this.emit('debugLog', logEntry);
  }
  
  /**
   * Initialize game
   */
  initialize() {
    this.log('info', 'Game Engine Initialized', {
      state: this.currentState,
      gridSize: 7,
      arenaSize: 3
    });
    this.turn = 0;
    this.mazeTurn = 0;
    this.battleTurn = 0;
    this.currentState = this.STATE_MAZE;
    this.isRunning = true;
    this.gameOver = false;
    this.winner = null;
    this.actionQueue = [];
  }
  
  /**
   * Start the game loop
   */
  start() {
    this.isRunning = true;
    this.isPaused = false;
    this.initialize();
    this.log('info', 'Game Engine Started');
  }
  
  /**
   * Pause game
   */
  pause() {
    this.isPaused = true;
    this.log('info', 'Game Engine Paused');
  }
  
  /**
   * Resume game
   */
  resume() {
    this.isPaused = false;
    this.log('info', 'Game Engine Resumed');
  }
  
  /**
   * Stop game
   */
  stop() {
    this.isRunning = false;
    this.log('info', 'Game Engine Stopped');
  }
  
  /**
   * Update game state (called every frame)
   */
  update(deltaTime) {
    if (!this.isRunning || this.isPaused || this.gameOver) {
      return;
    }
    
    // Update delta time
    this.deltaTime = Math.min(deltaTime, 0.05); // Cap at 50ms
    this.actionTimer += this.deltaTime;
    
    // Process current action
    if (this.currentAction) {
      this.updateCurrentAction();
      return;
    }
    
    // Process action queue
    if (this.actionTimer >= this.actionDelay && this.actionQueue.length > 0) {
      this.currentAction = this.actionQueue.shift();
      this.actionTimer = 0;
      this.log('info', `Executing action: ${this.currentAction.type}`, this.currentAction);
    }
    
    // Update state-specific logic
    switch (this.currentState) {
      case this.STATE_MAZE:
        this.updateMazePhase();
        break;
      case this.STATE_TRANSITION:
        this.updateTransition();
        break;
      case this.STATE_BATTLE:
        this.updateBattlePhase();
        break;
      case this.STATE_FINISHED:
        this.gameOver = true;
        this.emit('gameOver', { winner: this.winner });
        break;
    }
  }
  
  /**
   * Generate maze navigation turns
   */
  updateMazePhase() {
    // Generate turns if queue is empty
    if (this.actionQueue.length === 0 && !this.currentAction) {
      // Check if both agents reached arena entry
      const aegisInArena = gameState.aegis.inArena;
      const veloInArena = gameState.velo.inArena;
      
      if (aegisInArena && veloInArena) {
        this.log('info', 'Both agents reached arena entry!', {
          aegisPos: [gameState.aegis.x, gameState.aegis.y],
          veloPos: [gameState.velo.x, gameState.velo.y]
        });
        this.transitionToState(this.STATE_TRANSITION);
        return;
      }
      
      if (this.mazeTurn >= this.maxMazeTurns) {
        this.log('warn', 'Max maze turns reached!', { mazeTurn: this.mazeTurn });
        this.transitionToState(this.STATE_TRANSITION);
        return;
      }
      
      // Generate next maze turn
      this.generateMazeTurn();
    }
  }
  
  /**
   * Generate a maze navigation turn
   */
  generateMazeTurn() {
    this.mazeTurn++;
    this.turn++;
    this.emit('turnStart', { turn: this.turn, phase: 'maze' });
    this.log('info', `Maze Turn ${this.mazeTurn}`, {
      aegisPos: [gameState.aegis.x, gameState.aegis.y],
      veloPos: [gameState.velo.x, gameState.velo.y]
    });
    
    // AEGIS moves (if not in arena)
    if (!gameState.aegis.inArena) {
      const nextMoveName = this.chooseNextMazeMove('aegis');
      if (nextMoveName) {
        this.actionQueue.push({
          type: 'moveAgent',
          agent: 'aegis',
          nextPos: nextMoveName,
          duration: 0.3
        });
      }
    }
    
    // VELO moves (if not in arena)
    if (!gameState.velo.inArena) {
      const nextMoveName = this.chooseNextMazeMove('velo');
      if (nextMoveName) {
        this.actionQueue.push({
          type: 'moveAgent',
          agent: 'velo',
          nextPos: nextMoveName,
          duration: 0.3
        });
      }
    }
  }
  
  /**
   * Choose next maze move for agent
   */
  chooseNextMazeMove(agentName) {
    const agent = agentName === 'aegis' ? gameState.aegis : gameState.velo;
    const x = agent.x;
    const y = agent.y;
    
    // Simple pathfinding: move towards arena entry (2, 3)
    const entryX = 2;
    const entryY = 3;
    
    const moves = [];
    
    // Add adjacent moves
    if (x > entryX) moves.push([x - 1, y]);
    if (x < entryX) moves.push([x + 1, y]);
    if (y > entryY) moves.push([x, y - 1]);
    if (y < entryY) moves.push([x, y + 1]);
    
    // Filter valid moves
    const validMoves = moves.filter(([nx, ny]) => {
      const cellType = gameState.getCellType(nx, ny);
      return cellType !== null && cellType !== '#';
    });
    
    if (validMoves.length === 0) {
      return null;
    }
    
    // Choose move (simple: prefer moving towards entry)
    return validMoves[0];
  }
  
  /**
   * Update transition phase
   */
  updateTransition() {
    this.transitionProgress += this.deltaTime / 1.0; // 1 second transition
    
    if (this.transitionProgress >= 1.0) {
      this.transitionProgress = 1.0;
      this.transitionToState(this.STATE_BATTLE);
    }
    
    this.emit('transitionProgress', { progress: this.transitionProgress });
  }
  
  /**
   * Update battle phase
   */
  updateBattlePhase() {
    // Generate turns if queue is empty
    if (this.actionQueue.length === 0 && !this.currentAction) {
      // Check win conditions
      if (gameState.aegis.hp <= 0) {
        this.log('info', 'VELO Wins!', { aegisHP: gameState.aegis.hp, veloHP: gameState.velo.hp });
        this.winner = 'velo';
        this.transitionToState(this.STATE_FINISHED);
        return;
      }
      
      if (gameState.velo.hp <= 0) {
        this.log('info', 'AEGIS Wins!', { aegisHP: gameState.aegis.hp, veloHP: gameState.velo.hp });
        this.winner = 'aegis';
        this.transitionToState(this.STATE_FINISHED);
        return;
      }
      
      if (this.battleTurn >= this.maxBattleTurns) {
        this.log('warn', 'Max battle turns reached!', { battleTurn: this.battleTurn });
        // Declare winner based on HP
        if (gameState.aegis.hp > gameState.velo.hp) {
          this.winner = 'aegis';
        } else if (gameState.velo.hp > gameState.aegis.hp) {
          this.winner = 'velo';
        } else {
          this.winner = 'draw';
        }
        this.transitionToState(this.STATE_FINISHED);
        return;
      }
      
      // Generate next battle turn
      this.generateBattleTurn();
    }
  }
  
  /**
   * Generate a battle turn
   */
  generateBattleTurn() {
    this.battleTurn++;
    this.turn++;
    this.emit('turnStart', { turn: this.turn, phase: 'battle' });
    this.log('info', `Battle Turn ${this.battleTurn}`, {
      aegisPos: [gameState.aegis.x, gameState.aegis.y],
      aegisHP: gameState.aegis.hp,
      veloPos: [gameState.velo.x, gameState.velo.y],
      veloHP: gameState.velo.hp
    });
    
    // AEGIS attacks
    const aegisDamage = Math.random() > 0.5 ? 15 : 10;
    this.actionQueue.push({
      type: 'attack',
      attacker: 'aegis',
      defender: 'velo',
      damage: aegisDamage,
      duration: 0.5
    });
    
    // VELO attacks back
    const veloDamage = Math.random() > 0.5 ? 12 : 8;
    this.actionQueue.push({
      type: 'attack',
      attacker: 'velo',
      defender: 'aegis',
      damage: veloDamage,
      duration: 0.5
    });
  }
  
  /**
   * Update current action
   */
  updateCurrentAction() {
    if (!this.currentAction) return;
    
    const action = this.currentAction;
    
    switch (action.type) {
      case 'moveAgent':
        this.updateMoveAction(action);
        break;
      case 'attack':
        this.updateAttackAction(action);
        break;
    }
  }
  
  /**
   * Update move action
   */
  updateMoveAction(action) {
    // Move agent
    gameState.moveAgent(action.agent, action.nextPos[0], action.nextPos[1]);
    
    // Check for trap
    if (gameState.hasTrap(action.nextPos[0], action.nextPos[1])) {
      this.log('warn', `${action.agent} hit a trap!`, {
        pos: action.nextPos,
        currentHP: action.agent === 'aegis' ? gameState.aegis.hp : gameState.velo.hp
      });
      gameState.damageAgent(action.agent, 10);
      this.emit('trapActivate', { agent: action.agent, pos: action.nextPos });
      this.emit('damage', { agent: action.agent, damage: 10 });
    }
    
    // Check for arena entry
    if (action.nextPos[0] === 2 && action.nextPos[1] === 3) {
      gameState[action.agent].inArena = true;
      this.log('info', `${action.agent} entered arena!`, { pos: action.nextPos });
    }
    
    this.emit('agentMove', { agent: action.agent, pos: action.nextPos });
    this.currentAction = null;
  }
  
  /**
   * Update attack action
   */
  updateAttackAction(action) {
    gameState.damageAgent(action.defender, action.damage);
    
    this.log('info', `${action.attacker} attacks ${action.defender} for ${action.damage} damage`, {
      attackerHP: action.attacker === 'aegis' ? gameState.aegis.hp : gameState.velo.hp,
      defenderHP: action.defender === 'aegis' ? gameState.aegis.hp : gameState.velo.hp
    });
    
    this.emit('damage', { agent: action.defender, damage: action.damage });
    this.currentAction = null;
  }
  
  /**
   * Transition to new state
   */
  transitionToState(newState) {
    if (newState === this.currentState) return;
    
    this.previousState = this.currentState;
    this.currentState = newState;
    this.transitionProgress = 0;
    this.actionQueue = [];
    this.currentAction = null;
    
    this.log('info', `State transition: ${this.previousState} -> ${newState}`);
    this.emit('stateChange', { from: this.previousState, to: newState });
    
    if (newState === this.STATE_BATTLE) {
      // Setup battle phase
      gameState.phase = 2;
      gameState.aegis.inArena = true;
      gameState.velo.inArena = true;
      
      // Set battle spawn positions
      const arenaCenter = 3;
      gameState.moveAgent('aegis', arenaCenter - 1, arenaCenter);
      gameState.moveAgent('velo', arenaCenter + 1, arenaCenter);
      
      this.log('info', 'Battle phase started', {
        aegisSpawn: [arenaCenter - 1, arenaCenter],
        veloSpawn: [arenaCenter + 1, arenaCenter]
      });
    }
  }
  
  /**
   * Get current state
   */
  getState() {
    return {
      currentState: this.currentState,
      turn: this.turn,
      mazeTurn: this.mazeTurn,
      battleTurn: this.battleTurn,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      gameOver: this.gameOver,
      winner: this.winner,
      transitionProgress: this.transitionProgress
    };
  }
  
  /**
   * Get debug logs
   */
  getDebugLogs(count = 50) {
    return this.debugBuffer.slice(-count);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
}
