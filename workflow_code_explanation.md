# Neuron Bot Wars — Complete Workflow & Code Explanation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [End-to-End Workflow](#3-end-to-end-workflow)
   - [Step 1 — User Opens the Browser](#step-1--user-opens-the-browser)
   - [Step 2 — Frontend Start Screen & Mode Selection](#step-2--frontend-start-screen--mode-selection)
   - [Step 3 — Game Launch & Scene Initialization](#step-3--game-launch--scene-initialization)
   - [Step 4 — POST /api/game/start (Backend Simulation)](#step-4--post-apigamestart-backend-simulation)
   - [Step 5 — GameController Boots Up](#step-5--gamecontroller-boots-up)
   - [Step 6 — Phase 1: Maze Navigation](#step-6--phase-1-maze-navigation)
   - [Step 7 — Phase 2: Transition](#step-7--phase-2-transition)
   - [Step 8 — Phase 3: Battle Arena](#step-8--phase-3-battle-arena)
   - [Step 9 — Replay Sent to Frontend](#step-9--replay-sent-to-frontend)
   - [Step 10 — ReplayEngine Drives the Visualization](#step-10--replayengine-drives-the-visualization)
4. [Module-by-Module Code Explanation](#4-module-by-module-code-explanation)
   - [frontend/index.html](#frontendindexhtml)
   - [frontend/style.css](#frontendstylecss)
   - [frontend/main.js](#frontendmainjs)
   - [frontend/game/gameState.js](#frontendgamegamestatejs)
   - [frontend/scene/sceneSetup.js](#frontendscenescenesetupjs)
   - [frontend/scene/gridRenderer.js](#frontendscenegridrendererjs)
   - [frontend/engine/coreEngine.js](#frontendenginecoreenginejs)
   - [frontend/engine/replayEngine.js](#frontendenginereplayenginejs)
   - [frontend/objects/ (aegis.js, velo.js, arena.js, trap.js)](#frontendobjects)
   - [frontend/server.py](#frontendserverpy)
   - [core/grid.py](#coregridpy)
   - [core/maze.py](#coremazespy)
   - [core/arena.py](#corearenapy)
   - [core/game_state_manager.py](#coregame_state_managerpy)
   - [core/game_controller.py](#coregame_controllerpy)
   - [agents/agent_base.py](#agentsagent_basepy)
   - [agents/aegis.py](#agentsaegispy)
   - [agents/velo.py](#agentsvelopy)
   - [ai/pathfinding.py](#aipathfindingpy)
   - [main.py](#mainpy)
5. [AI Algorithm Deep Dive](#5-ai-algorithm-deep-dive)
6. [Data Flow Diagram](#6-data-flow-diagram)

---

## 1. Project Overview

**Neuron Bot Wars** is a two-phase AI combat simulation game. Two autonomous bots, **AEGIS** (Blue) and **VELO** (Red), compete across:

| Phase | Description |
|-------|-------------|
| **Maze Navigation** | Both bots race through a 7×7 grid filled with traps, navigating to the central arena. |
| **Battle Arena** | Both bots fight in the 3×3 central arena using turn-based combat with three attack types, a defend mechanic, and item pickups. |

The backend is written in **Python** and performs the entire simulation server-side. The frontend is a **Three.js** browser visualization that fetches the pre-simulated replay and plays it back event by event.

---

## 2. File Structure

```
Neuron_Bot_Wars/
│
├── main.py                         ← CLI runner (runs simulation in terminal)
├── README.md
│
├── frontend/                       ← All browser-side code
│   ├── index.html                  ← Single-page HTML shell
│   ├── style.css                   ← Full visual styling (dark sci-fi theme)
│   ├── main.js                     ← Frontend entry point & orchestrator
│   ├── server.py                   ← Python HTTP server + REST API
│   │
│   ├── game/
│   │   └── gameState.js            ← Shared frontend state object
│   │
│   ├── scene/
│   │   ├── sceneSetup.js           ← Three.js scene, camera, renderer, lights
│   │   └── gridRenderer.js         ← Draws 7×7 maze tiles and traps
│   │
│   ├── engine/
│   │   ├── coreEngine.js           ← Self-contained AI game loop (human mode)
│   │   └── replayEngine.js         ← Replays backend events (AI-vs-AI mode)
│   │
│   └── objects/
│       ├── aegis.js                ← AEGIS 3D bot mesh & animations
│       ├── velo.js                 ← VELO 3D bot mesh & animations
│       ├── arena.js                ← Arena floor & glow visuals
│       └── trap.js                 ← Trap tile visuals
│
├── core/                           ← Core Python game logic
│   ├── grid.py                     ← Enums, constants, base Grid class
│   ├── maze.py                     ← Maze generation, trap placement
│   ├── arena.py                    ← Battle arena, item spawning
│   ├── game_state_manager.py       ← Centralized state tracking
│   └── game_controller.py          ← Master orchestrator (runs the full game)
│
├── agents/                         ← AI agent implementations
│   ├── agent_base.py               ← Shared base class (HP, actions, combat)
│   ├── aegis.py                    ← AEGIS: A* pathfinding + Minimax combat
│   └── velo.py                     ← VELO: UCS pathfinding + Greedy combat
│
└── ai/
    └── pathfinding.py              ← A* and Uniform Cost Search algorithms
```

---

## 3. End-to-End Workflow

### Step 1 — User Opens the Browser

The user opens `http://localhost:8000` (or runs `python frontend/server.py`). The Python server (`frontend/server.py`) is already running and serves `index.html` as the root page.

```
Browser  ──GET /──►  frontend/server.py  ──►  frontend/index.html
```

---

### Step 2 — Frontend Start Screen & Mode Selection

`index.html` loads three script files at the bottom: `gameState.js`, `sceneSetup.js`, `gridRenderer.js`, all the object files, `coreEngine.js`, `replayEngine.js`, and finally `main.js`.

`main.js` calls `initStartScreen()` on `DOMContentLoaded`. This:

- Draws animated bot portraits on the two `<canvas>` elements using 2D Canvas API
- Attaches click listeners to the three mode buttons:
  - **AEGIS vs VELO** — pure AI-vs-AI, uses `ReplayEngine`
  - **Human vs AEGIS** — human controls VELO, uses `CoreEngine`
  - **Human vs VELO** — human controls AEGIS, uses `CoreEngine`
- Enables the **START SIMULATION** button once a mode is selected

---

### Step 3 — Game Launch & Scene Initialization

When START SIMULATION is clicked, `launchGame(mode)` runs:

```
main.js: launchGame()
  ├── Fades out the start screen (CSS transition)
  ├── Shows the game screen div
  └── Calls startGameWithMode(mode)
         ├── Creates SceneSetup(container)        ← Three.js scene, camera, renderer
         ├── Creates CoreEngine() or ReplayEngine()
         └── Calls engine.init(sceneSetup)
```

**`SceneSetup`** (`frontend/scene/sceneSetup.js`):
- Creates a `THREE.Scene` with dark background (`0x0a0e27`)
- Creates an orthographic top-down camera
- Creates a `WebGLRenderer` and appends it to the DOM
- Sets up ambient + directional lighting with shadow maps

For **AI-vs-AI mode**: a `ReplayEngine` instance is created.
For **Human modes**: a `CoreEngine` instance is created which runs game logic client-side.

---

### Step 4 — POST /api/game/start (Backend Simulation)

*(This step applies only to AI-vs-AI mode via `ReplayEngine`)*

`ReplayEngine.startGame()` sends:

```
Browser  ──POST /api/game/start──►  frontend/server.py: start_new_game()
```

`server.py` responds by:
1. Creating a fresh `GameController()` instance
2. Calling `game_controller.simulate_full_game()` — this runs the **entire simulation instantly**
3. Returning a JSON response with `{ totalEvents, winner }`

Then the frontend immediately fetches the replay:

```
Browser  ──GET /api/game/replay──►  server.py: send_replay()
                                      └── returns { replay: [...events], total: N }
```

---

### Step 5 — GameController Boots Up

**File:** `core/game_controller.py` — class `GameController`

```python
def __init__(self):
    self.state = GameStateManager()   # Centralized state store
    self.max_maze_iterations = 50
    self.max_battle_iterations = 200
    self.replay = []                  # List of all structured events
    self.maze = None
    self.maze_agent_aegis = None
    self.maze_agent_velo = None
```

`GameStateManager` (`core/game_state_manager.py`) holds:
- Agent data dictionaries (`aegis`, `velo`) with position, HP, alive status
- Spawn positions: AEGIS at `(0, 3)`, VELO at `(6, 3)`
- Phase constants (`maze`, `transition`, `battle`, `finished`)
- Turn counters, trap positions, winner fields
- A list of internal events for debugging

`simulate_full_game()` then calls the three phases in sequence:

```
simulate_full_game()
  ├── _run_maze_phase()
  ├── _run_transition_phase()
  └── _run_battle_phase()
```

---

### Step 6 — Phase 1: Maze Navigation

**File:** `core/game_controller.py` → `_run_maze_phase()`

#### 6a. Maze is created

```python
self.maze = Maze()
```

`Maze` (`core/maze.py`) extends `Grid` (`core/grid.py`):
- Initializes a 7×7 grid where every cell starts as `CellType.PATH`
- **Marks the center 3×3** (rows 2–4, cols 2–4) as `CellType.ARENA`
- **Sets the arena entry** at `(3, 1)` — marked `CellType.ENTRY`
- Random walls are **disabled** (the `_place_random_walls()` call is commented out) so bots navigate freely among traps

Grid layout (row, col), 0-indexed:
```
Row 0: . . . . . . .
Row 1: . . . . . . .
Row 2: . . A A A . .
Row 3: . E A A A . .   ← E = Arena Entry at (3,1)
Row 4: . . A A A . .
Row 5: . . . . . . .
Row 6: . . . . . . .
```
AEGIS spawns at `(0, 3)` (top-center), VELO spawns at `(6, 3)` (bottom-center).

#### 6b. Agents are instantiated

```python
aegis_agent = AegisAgent(self.state.AGENT_SPAWN_AEGIS)   # position (0,3)
velo_agent  = VeloAgent(self.state.AGENT_SPAWN_VELO)     # position (6,3)
```

**`AegisAgent`** (`agents/aegis.py`) inherits `Agent` (`agents/agent_base.py`):
- Sets `name = "AEGIS"`, `symbol = "A"`, `color = "Blue"`
- `hp = 100` (from `INITIAL_HP` constant in `grid.py`)
- `minimax_depth = 5`
- `pathfinder = None` (assigned next)

**`VeloAgent`** (`agents/velo.py`) inherits `Agent`:
- Sets `name = "VELO"`, `symbol = "V"`, `color = "Red"`
- `hp = 100`
- `pathfinder = None` (assigned next)

#### 6c. Pathfinders are assigned

```python
aegis_agent.pathfinder = AStarPathfinder(self.maze)
velo_agent.pathfinder  = UniformCostSearch(self.maze)
```

Both pathfinders receive a reference to the **same maze** (`core/maze.py`) so they know the grid layout.

#### 6d. Traps are placed

```python
trap_count = random.randint(6, 10)
protected = {AGENT_SPAWN_AEGIS, AGENT_SPAWN_VELO, maze.arena_entry}
self.maze.place_traps(protected_cells=protected, trap_count=trap_count)
```

`Maze.place_traps()`:
- Collects all `PATH` maze cells that are not protected
- Randomly samples 6–10 cells and sets them to `CellType.TRAP`
- Stores them in `self.maze.traps` as a set of tuples

#### 6e. GAME_START event is emitted

```python
self._emit('GAME_START', 0, 'maze', aegis_agent, velo_agent,
            traps=[...], arenaEntry=[3,1],
            aegisSpawn=[0,3], veloSpawn=[6,3])
```

`_emit()` appends a structured dictionary to `self.replay`. Every event carries:
- `type` — event name
- `turn` — turn number
- `phase` — current phase string
- `aegis` / `velo` — snapshots with `x`, `y`, `hp`, `alive`, `inArena`
- Optional extra fields specific to the event type

#### 6f. Maze navigation loop

```python
while iteration < self.max_maze_iterations:   # max 50 turns
    # AEGIS moves
    next_pos = aegis_agent.decide_maze_move(self.maze)
    # check trap, update HP, emit MAZE_MOVE event
    
    # VELO moves
    next_pos = velo_agent.decide_maze_move(self.maze)
    # check trap, update HP, emit MAZE_MOVE event
```

**AEGIS maze decision** (`agents/aegis.py: decide_maze_move`):
1. Calls `self.pathfinder.find_path(current_pos, arena_entry, avoid_traps=True)`
2. `AStarPathfinder.find_path()` uses the A* algorithm:
   - Priority queue sorted by `f = g + h`
   - `g` = cost so far (traps cost 10 instead of 1 when `avoid_traps=True`)
   - `h` = Manhattan distance to goal
   - Returns the full path list
3. AEGIS steps to `path[1]` (the next cell toward the entry)

**VELO maze decision** (`agents/velo.py: decide_maze_move`):
1. Calls `self.pathfinder.find_path(current_pos, arena_entry)` — no trap avoidance
2. `UniformCostSearch.find_path()` uses Dijkstra-style expansion:
   - All moves cost 1 (uniform), so it finds the geometrically shortest path
   - VELO does not penalize traps, so it may walk right through them
3. VELO steps to `path[1]`

If a bot steps onto a trap cell, it takes `TRAP_DAMAGE = 1` HP.

The first bot to reach `(3, 1)` triggers a `MAZE_WINNER` event. Both bots eventually reach the entry (or the loop hits 50 iterations max).

---

### Step 7 — Phase 2: Transition

**File:** `core/game_controller.py` → `_run_transition_phase()`

The bots carry their maze-phase HP into battle. They are teleported to their battle spawn positions inside the 3×3 arena:

```python
aegis_battle_pos = (3, 2)   # left side of arena
velo_battle_pos  = (3, 4)   # right side of arena
```

Both agents have `in_arena = True` set. A `TRANSITION` and `BATTLE_SPAWN` event are emitted so the frontend can animate the camera shift from the maze view to the arena view.

---

### Step 8 — Phase 3: Battle Arena

**File:** `core/game_controller.py` → `_run_battle_phase()`

#### 8a. Arena is created

```python
arena = Arena()
```

`Arena` (`core/arena.py`) extends `Grid` with a **3×3 internal grid** (local coordinates 0–2). It tracks:
- `items` — dict mapping local `(row, col)` to `ItemType` (MEDKIT or POWERUP)
- `powerup_spawned`, `health_spawned` flags — items spawn only once each
- No initial items; they appear mid-battle when triggered

#### 8b. Combat loop

```python
while iteration < self.max_battle_iterations:   # max 200 turns
    # ── AEGIS turn ──
    action, move_target = aegis_agent.decide_combat_action(arena, velo_agent, self.maze)
    # execute action, emit BATTLE_ACTION event

    # ── VELO turn ──
    action, move_target = velo_agent.decide_combat_action(arena, aegis_agent, self.maze)
    # execute action, emit BATTLE_ACTION event

    # ── Item spawn triggers ──
    # If either bot ≤ 20 HP → spawn MEDKIT once
    # If either bot ≥ 60 HP after 10 turns → spawn POWERUP once
```

#### 8c. AEGIS combat decision — Minimax with Alpha-Beta Pruning

**File:** `agents/aegis.py: decide_combat_action()`

AEGIS uses **Minimax with Alpha-Beta Pruning** at depth 5:

1. **Generate all possible actions** (`_get_possible_combat_actions`):
   - `ELEMENTAL_BEAM` — if adjacent and beam not yet used
   - `LOGIC_BURST` — if adjacent and charge counter == 3
   - `PULSE_STRIKE` — if adjacent
   - `DEFEND` — always available (if not used last turn)
   - `MOVE` — each valid arena neighbor (not occupied by opponent)
   - `WAIT` — always available

2. **Minimax search** (`_minimax`):
   - Simulates both agents' states using `deepcopy`
   - Applies the chosen action to cloned agents (`_apply_action`)
   - Recursively alternates between maximizing (AEGIS) and minimizing (VELO) nodes
   - Alpha-Beta pruning cuts branches that cannot affect the result
   - Stops at `depth == 0` or when either agent's HP reaches 0

3. **Evaluation function** (`_evaluate`):
   ```
   score = (aegis.hp - opponent.hp) × 4.0     ← HP difference is dominant
           + proximity_score                   ← 60 pts if adjacent, else penalty
           + charge_score                      ← rewards Logic Burst readiness
           + beam_score                        ← rewards saving Elemental Beam
           + defend_penalty                    ← slight penalty for passive stance
           + jitter                            ← small random noise to break ties
   ```

4. **Action priority** (for tie-breaking): Beam > Burst > Strike > Defend > Move > Wait

#### 8d. Logic Burst charge mechanic

Every turn an agent does **not** use Logic Burst, its `logic_burst_charge` counter increments by 1 (capped at 3). When it reaches 3, Logic Burst becomes available — it then resets to 0 after use.

```python
if action != Action.LOGIC_BURST:
    agent.logic_burst_charge = min(3, agent.logic_burst_charge + 1)
```

#### 8e. VELO combat decision — Greedy Heuristic

**File:** `agents/velo.py: decide_combat_action()`

VELO evaluates the current state **greedily** (no lookahead):

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Adjacent + Beam unused + (finishing blow or opponent HP > 60) | `ELEMENTAL_BEAM` |
| 2 | Adjacent + Logic Burst charged | `LOGIC_BURST` |
| 3 | Adjacent | `PULSE_STRIKE` |
| 4 | Self HP < 40 or opponent burst charged | `DEFEND` |
| 5 | Not adjacent | `MOVE` toward opponent |
| 6 | Default | `DEFEND` or `WAIT` |

VELO's `_find_best_move_towards()` checks all valid arena neighbors and picks the one with the smallest Manhattan distance to the opponent.

#### 8f. Combat action execution (Agent base class)

All attacks are defined in `agents/agent_base.py`:

| Action | Method | Damage | Condition |
|--------|--------|--------|-----------|
| `PULSE_STRIKE` | `pulse_strike(target)` | 5 HP (×1.5 with powerup) | Must be adjacent |
| `LOGIC_BURST` | `logic_burst(target)` | 10 HP (×1.5 with powerup) | Adjacent + charge == 3 |
| `ELEMENTAL_BEAM` | `elemental_beam(target)` | 25 HP (×1.5 with powerup) | Adjacent + not used yet |
| `DEFEND` | `defend()` | — | Reduces incoming damage by 80% for one hit |
| `MOVE` | `move(new_pos)` | — | Can't move 3 turns in a row |
| `WAIT` | `wait()` | — | Always valid |

`take_damage(damage)`: If agent is defending (`is_defending = True`), damage is multiplied by `DEFEND_REDUCTION = 0.2` (i.e., only 20% of damage lands). The defend flag resets after one hit.

#### 8g. Item pickups

When an agent moves onto an arena cell with an item:
- **MEDKIT** (`ItemType.MEDKIT`): Restores `MEDKIT_HEAL = 20` HP (capped at 100)
- **POWERUP** (`ItemType.POWERUP`): Sets `has_powerup = True`; next attack deals ×1.5 damage

Items are single-use — once taken, they are removed from the arena grid.

#### 8h. Win condition

The battle loop breaks when either `aegis_agent.hp == 0` or `velo_agent.hp == 0`. A `GAME_OVER` event is emitted with the winner's name. If 200 turns pass without a winner, the bot with more remaining HP wins.

---

### Step 9 — Replay Sent to Frontend

After `simulate_full_game()` completes, `game_controller.replay` contains a flat list of event dictionaries, for example:

```json
[
  { "type": "GAME_START", "turn": 0, "phase": "maze", "aegis": {...}, "velo": {...}, "traps": [...] },
  { "type": "MAZE_MOVE",  "turn": 1, "phase": "maze", "agent": "aegis", "from": [0,3], "to": [1,3], "trapHit": false },
  { "type": "MAZE_MOVE",  "turn": 1, "phase": "maze", "agent": "velo",  "from": [6,3], "to": [5,3], "trapHit": false },
  ...
  { "type": "MAZE_WINNER", ... },
  { "type": "TRANSITION",  ... },
  { "type": "BATTLE_SPAWN", ... },
  { "type": "BATTLE_ACTION", "agent": "aegis", "action": "pulse_strike", "damage": 5, ... },
  ...
  { "type": "GAME_OVER", "winner": "aegis", ... }
]
```

`GET /api/game/replay` returns `{ "replay": [...], "total": N }`. The frontend receives this JSON and begins playback.

---

### Step 10 — ReplayEngine Drives the Visualization

**File:** `frontend/engine/replayEngine.js`

`ReplayEngine` processes one event per tick based on timing delays:
- Maze moves: 600 ms per event
- Battle actions: 900 ms per event
- Transitions: 1500 ms

For each event it calls `this.emit(eventType, data)` which triggers registered listener callbacks. The listeners (set up in `main.js` and `coreEngine.js`) then:

| Event | Frontend Action |
|-------|-----------------|
| `GAME_START` | Initialize `GridRenderer`, place trap visuals, spawn bot meshes |
| `MAZE_MOVE` | Move bot mesh on the 7×7 grid, play move animation, flash red if trap hit |
| `MAZE_WINNER` | Show "AEGIS REACHES ARENA FIRST!" banner |
| `TRANSITION` | Camera smoothly transitions from maze view to arena close-up |
| `BATTLE_SPAWN` | Reposition bot meshes inside arena tiles |
| `BATTLE_ACTION` | Animate attack beam/glow, update HP bars, show action log |
| `ITEM_SPAWNED` | Show medkit/powerup mesh in the arena |
| `GAME_OVER` | Show winner banner, victory lights, end screen overlay |

**`GridRenderer`** (`frontend/scene/gridRenderer.js`):
- Creates Three.js `BoxGeometry` meshes for each of the 7×7 cells
- Walls → tall dark boxes, floor → thin flat boxes, entry → green glowing tile
- Trap visuals handled separately by `trap.js` objects

**Bot meshes** (`frontend/objects/aegis.js`, `velo.js`):
- Each bot is a 3D sphere with orbital rings and glowing eye elements
- They animate (bob, pulse, rotate) continuously
- Movement animates their position in world space between grid tiles

**`SceneSetup`** (`frontend/scene/sceneSetup.js`):
- The Three.js render loop calls `renderer.render(scene, camera)` every animation frame
- Camera shifts from maze top-down view to arena close-up during transition

---

## 4. Module-by-Module Code Explanation

### `frontend/index.html`

The single HTML file that acts as the shell. It contains two top-level `div`s:

1. **`#start-screen`** — The animated title/mode selection screen. Has two `<canvas>` elements (one per bot) animated by `main.js`. Hidden after game starts.
2. **`#game-screen`** — The in-game HUD with HP bars (`#hp-aegis`, `#hp-velo`), banner div, action log, Three.js mount point (`#game-container`), bottom HUD with phase/turn info, and the human player control panel (directional + attack buttons).

All JS files are loaded via `<script>` tags at the bottom in dependency order:
`gameState.js` → `sceneSetup.js` → `gridRenderer.js` → `aegis.js` → `velo.js` → `arena.js` → `trap.js` → `coreEngine.js` → `replayEngine.js` → `main.js`

---

### `frontend/style.css`

Pure CSS that styles the entire sci-fi dark theme. Key classes:
- `.start-bg`, `.start-scanlines`, `.start-grid-lines` — animated background layers
- `.mode-btn`, `.start-play-btn` — mode selection UI
- `.hp-bar-container`, `.hp-fill` — HP bar overlays on the game screen
- `.game-hud` — bottom status bar (phase, turn, PAUSE/RESET)
- `.human-controls` — directional pad and attack buttons for human mode

---

### `frontend/main.js`

The main orchestrator for the frontend. Responsibilities:

- **`initStartScreen()`** — Wires up mode buttons and START button. Animates bot portraits on canvases using 2D Canvas API (orbital glow effect).
- **`launchGame(mode)`** — Fades the start screen and calls `startGameWithMode`.
- **`startGameWithMode(mode)`** — Creates `SceneSetup`, instantiates the correct engine (`ReplayEngine` for AI-vs-AI, `CoreEngine` for human modes), calls `engine.init()`, and starts a `setInterval` for UI updates.
- **`updateGameUI()`** — Runs every 200 ms. Pulls HP and turn data from the engine to update the DOM HP bars, HUD phase text, and turn counter.
- **`setupHumanControls()`** — Attaches click handlers to the directional and attack buttons, each calling `humanAction({ type: ... })`.
- **`humanAction(action)`** — Passes the human's chosen action to `engine.submitHumanAction(action)`.

---

### `frontend/game/gameState.js`

A plain JavaScript object (singleton) that is the **frontend source of truth** for all game data:

- `phase` — `"maze"` | `"transition"` | `"battle"` | `"finished"`
- `maze` — A 7×7 2D array of cell type characters (`'.'`, `'#'`, `'A'`)
- `arenaEntry` — `{ x: 3, y: 1 }` — matches backend constant
- `aegis` / `velo` — Agent state objects with `x`, `y`, `hp`, `alive`, `isDefending`, `path`, `pathIndex`
- `traps` — Array of `{ x, y, active }` objects
- `powerUp` — Power-up state
- Helper methods: `gridToWorld(x, y)`, `getCellType(x, y)`, `isInArena(x, y)`, `worldToGrid(vec)`

This object is read by `GridRenderer`, `ReplayEngine`, and the engine modules to keep visuals in sync.

---

### `frontend/scene/sceneSetup.js`

Creates and owns the Three.js rendering infrastructure:

- **Scene**: `THREE.Scene` with dark blue-black background and fog
- **Camera**: Orthographic (top-down) — provides a 2D-like grid view. During transition, camera animates to a tighter view of the arena.
- **Renderer**: `THREE.WebGLRenderer` with antialiasing, shadow maps enabled (`PCFSoftShadowMap`)
- **Lighting**:
  - `AmbientLight` at 60% intensity for base illumination
  - `DirectionalLight` from above-right that casts shadows with a 2048×2048 shadow map
  - Fill `DirectionalLight` from the left with a blue tint for sci-fi atmosphere
  - Dynamic arena spotlights (via `setupArenaLights()`) added during battle phase

---

### `frontend/scene/gridRenderer.js`

Builds the visual representation of the 7×7 grid using Three.js meshes:

- **`mazeGroup`**: `THREE.Group` holding all non-arena tile meshes
- **`trapGroup`**: `THREE.Group` holding trap visual objects

For each grid cell:
- **Wall cells** → `BoxGeometry(1, 1.5, 1)` dark mesh, casts shadows
- **Floor cells** → `BoxGeometry(0.95, 0.1, 0.95)` flat mesh
- **Entry cell** at `(3, 1)` → flat mesh with green emissive glow (`0x22AA44`)
- **Arena cells** → skipped (handled by `arena.js`)

Trap visuals are created by `trap.js` and added to `trapGroup`. The `showMaze()` / `hideMaze()` methods toggle group visibility when the phase changes.

---

### `frontend/engine/coreEngine.js`

A **self-contained game engine** used in human-vs-AI modes. It runs the full game logic entirely in the browser (no backend needed):

- **Maze generation** (`generateMaze()`): Creates a `mazeData` structure for 7×7 cells with random traps, fixed walls, spawn, exit. Runs `verifyPath()` via BFS to ensure reachability.
- **Bot AI** in maze phase: Simple greedy BFS toward the exit, implemented client-side.
- **Minimax combat** for AEGIS (`minimaxDecision()`): A client-side implementation of Minimax at depth 4 with alpha-beta pruning, mirroring the Python backend.
- **Greedy combat** for VELO: Inline greedy priority logic.
- **Human action handling**: When `waitingForHuman == true`, the engine pauses the AI turn and waits for `submitHumanAction(action)` to be called from `main.js`.
- **Three.js integration**: Directly manipulates Three.js objects (`aegis`, `velo` bot meshes) and updates `gameState`.

---

### `frontend/engine/replayEngine.js`

Used exclusively in **AI-vs-AI mode**. It is a pure playback driver:

1. **`startGame()`**: POSTs to `/api/game/start`, then GETs `/api/game/replay`
2. Stores the event array in `this.replay`
3. **`update(dt)`**: Called every animation frame. Uses a timer to advance one event every N milliseconds (delay varies by event type)
4. **`_processEvent(event)`**: Dispatches the event to registered listeners using a simple pub/sub pattern (`on(event, fn)` / `emit(event, data)`)
5. Has `pause()` / `resume()` / `stop()` controls

---

### `frontend/objects/`

Each file exports a class responsible for one type of 3D object:

**`aegis.js`** / **`velo.js`**: Bot mesh factories. Each bot is composed of:
- A glowing sphere core with radial gradient material
- Orbital ring `TorusGeometry` with emissive color
- Hovering animation (Y-axis sine wave)
- `moveTo(x, y)` method that interpolates position smoothly

**`arena.js`**: Builds the 3×3 battle arena floor using glowing platform tiles, adds a subtle point light above the center for drama.

**`trap.js`**: Creates trap tile visuals — red pulsing floor tiles with a glow effect. The `deactivate()` method is called if a bot steps on the trap (turns off the glow).

---

### `frontend/server.py`

A standard Python `http.server.SimpleHTTPRequestHandler` subclass that:

- **Serves static files** from the `frontend/` directory (HTML, CSS, JS)
- **Handles GET routes**:
  - `/api/game/state` → returns current state snapshot from `game_controller.get_current_state()`
  - `/api/game/status` → returns `{ status: "running"|"finished", phase, turn }`
  - `/api/game/replay` → returns full `replay` list as JSON
- **Handles POST routes**:
  - `/api/game/start` → creates a new `GameController`, runs `simulate_full_game()`, returns summary
- Uses a module-level `game_controller` global so the same game instance is shared across all API calls
- Adds `Access-Control-Allow-Origin: *` header to all JSON responses

---

### `core/grid.py`

The foundation module. Defines:

**Enums:**
- `CellType`: `WALL`, `PATH`, `TRAP`, `ENTRY`, `ARENA`
- `ItemType`: `MEDKIT`, `POWERUP`
- `Action`: `MOVE`, `DEFEND`, `PULSE_STRIKE`, `LOGIC_BURST`, `ELEMENTAL_BEAM`, `WAIT`
- `Direction`: `UP`, `DOWN`, `LEFT`, `RIGHT` (as `(dr, dc)` tuples)

**Constants:**
```python
GRID_SIZE = 7
ARENA_START = 2       # Arena begins at row/col 2
ARENA_END = 4         # Arena ends at row/col 4 (inclusive), making a 3×3
INITIAL_HP = 100
PULSE_STRIKE_DAMAGE = 5
LOGIC_BURST_DAMAGE = 10
ELEMENTAL_BEAM_DAMAGE = 25
DEFEND_REDUCTION = 0.2  # Defender takes only 20% of damage
TRAP_DAMAGE = 1
MEDKIT_HEAL = 20
```

**`Grid` base class:**
- `is_valid_cell(row, col)` — bounds check
- `is_walkable(row, col)` — returns False for walls
- `get_neighbors(row, col)` — returns all 4 adjacent walkable cells
- `get_cell_type(row, col)` — returns the `CellType` enum value

---

### `core/maze.py`

`Maze(Grid)` — Generates and manages the 7×7 maze:

- **`_reset_to_paths()`**: Fills entire grid with `PATH` cells
- **`_mark_arena_cells()`**: Sets center 3×3 to `ARENA` type
- **`_set_arena_entry()`**: Sets `(3, 1)` to `ENTRY` type and stores `self.arena_entry = (3, 1)`
- **`place_traps(protected_cells, trap_count)`**: Randomly selects maze-only `PATH` cells (not protected) and marks them `TRAP`, adding to `self.traps` set
- **`get_neighbors(row, col, maze_phase=False)`**: Overridden to exclude `ARENA` cells during maze phase (so bots cannot enter arena until they reach the entry point), and exclude `WALL` cells always
- **`is_maze_cell(row, col)`**: Returns True if cell is outside the 3×3 arena zone
- **`is_arena_cell(row, col)`**: Returns True if inside the 3×3 arena zone
- **`find_path_bfs(start, goal)`**: BFS for path validation (not used for AI decisions)
- **`validate_paths_to_entry(spawns)`**: Ensures BFS reachability from each spawn to entry

---

### `core/arena.py`

`Arena(Grid)` — Manages the 3×3 battle arena (uses local coordinates 0–2):

- `items: Dict[Tuple, ItemType]` — positions of active items
- `item_usage: Dict[Tuple, Set[str]]` — tracks which agents have used each item
- **`can_pickup_item(row, col, agent_name)`**: Returns True if the cell has an item the agent hasn't collected yet
- **`get_item(row, col, agent_name)`**: Returns the item and removes it from the arena (one-time pickup)
- **`spawn_powerup(occupied_positions)`**: Places a single POWERUP in a random empty arena cell (only once per game)
- **`spawn_health_pack(occupied_positions)`**: Places a single MEDKIT in a random empty arena cell (only once per game)
- **`convert_to_arena_coords(global_pos)`**: Converts from 7×7 global coordinates to 3×3 local coordinates (`global - ARENA_START`)
- **`display()`**: ASCII visualization of the arena (used for CLI output)

---

### `core/game_state_manager.py`

`GameStateManager` — Centralized state store for the entire game session:

- Holds `aegis` and `velo` state dicts (position, HP, alive, inArena, isDefending)
- Defines spawn positions: `AGENT_SPAWN_AEGIS = (0, 3)`, `AGENT_SPAWN_VELO = (6, 3)`
- Has state machine methods: `change_state(new_state)`, `next_maze_turn()`, `next_battle_turn()`
- Provides helper methods: `move_agent()`, `damage_agent()`, `heal_agent()`, `set_defending()`
- Generates initial trap positions in `_generate_traps()` (overridden by the Maze's actual placement)
- Tracks `maze_winner` and `battle_winner` strings

---

### `core/game_controller.py`

`GameController` — The master orchestrator. This is the single class that runs the entire game simulation and is the only class the server interacts with:

- **`simulate_full_game()`**: Calls the three phases in sequence
- **`_emit(event_type, ...)`**: Appends a structured dict to `self.replay`
- **`_agent_snapshot(agent)`**: Creates a `{ x, y, hp, alive, inArena }` dict for replay
- **`get_current_state()`**: Returns the latest state from `self.state` as a dict for API responses
- **`get_replay()`**: Returns `self.replay` — the list of all events — for the frontend

---

### `agents/agent_base.py`

`Agent` — The base class all bots inherit from. Implements all combat mechanics:

- **`move(new_position)`**: Updates `self.position` and records in `action_history`
- **`take_damage(damage)`**: Applies defend reduction if `is_defending`, decrements HP, resets defend flag
- **`defend()`**: Sets `is_defending = True`
- **`pulse_strike(target)`**: Deals `PULSE_STRIKE_DAMAGE = 5` if adjacent; ×1.5 with powerup
- **`logic_burst(target)`**: Deals `LOGIC_BURST_DAMAGE = 10` if adjacent AND `logic_burst_charge == 3`; resets charge to 0
- **`elemental_beam(target)`**: Deals `ELEMENTAL_BEAM_DAMAGE = 25` if adjacent AND not yet used; sets `elemental_beam_used = True`
- **`pickup_item(item)`**: Heals 20 HP (MEDKIT) or sets `has_powerup = True` (POWERUP)
- **`can_perform_action(action)`**: Enforces cooldowns:
  - `MOVE` cannot appear in the last 3 actions (prevents move-spamming)
  - `DEFEND` cannot appear in the last 1 action (no back-to-back defending)
  - `LOGIC_BURST` requires `logic_burst_charge == 3`
  - `ELEMENTAL_BEAM` requires `elemental_beam_used == False`

---

### `agents/aegis.py`

`AegisAgent(Agent)` — Blue AI, strategic and defensive:

**Maze Phase — A* Search:**
- Uses `AStarPathfinder` with `avoid_traps=True` (traps cost 10 movement points instead of 1)
- Always follows the optimal path to the arena entry while preferring trap-free routes
- Falls back to greedy Manhattan distance move if A* returns no path

**Combat Phase — Minimax (depth 5) with Alpha-Beta Pruning:**
- `decide_combat_action()` iterates over all possible actions, runs `_minimax()` for each, picks the action with the highest evaluated score
- `_minimax()`: Recursive tree search. Maximizing node = AEGIS picks the best action. Minimizing node = VELO picks the worst action for AEGIS (simulated with copies of both agents).
- `_apply_action()`: Static helper that applies an action to a `deepcopy` of the agents so the original state is never modified during search.
- `_evaluate()`: Heuristic function that scores any game state from AEGIS's perspective.
- `_action_priority()`: Used for deterministic tie-breaking; prefers offensive actions.

---

### `agents/velo.py`

`VeloAgent(Agent)` — Red AI, aggressive and fast:

**Maze Phase — Uniform Cost Search:**
- Uses `UniformCostSearch` with all moves costing 1 (no trap penalty)
- Finds the geometrically shortest path, accepting trap damage as a risk
- Falls back to greedy Manhattan distance if UCS returns no path

**Combat Phase — Greedy Heuristic:**
- `decide_combat_action()` uses a fixed priority list evaluated against the current state:
  1. Elemental Beam if it's a kill shot or opponent is at high HP
  2. Logic Burst if charged
  3. Pulse Strike if adjacent
  4. Defend if low HP or opponent is nearly charged
  5. Move toward opponent (greedy, picks neighbor closest to target)
  6. Defend / Wait as last resort

---

### `ai/pathfinding.py`

Contains two pathfinding algorithm implementations, both operating on `Maze` instances:

**`AStarPathfinder`:**
- Priority queue: `(f_score, counter, current_pos, path, g_score)`
- `heuristic(pos, goal)`: Manhattan distance
- Trap penalty: `move_cost = 10` if `avoid_traps=True` and cell is a trap, else `1`
- Maintains `best_g_score` dict to avoid re-exploring nodes with worse cost
- Returns full path from start to goal, or empty list if unreachable

**`UniformCostSearch`:**
- Priority queue: `(cost, counter, current_pos, path)`
- All moves cost 1 (uniform)
- No heuristic — pure cost-based expansion (equivalent to Dijkstra's algorithm)
- Both algorithms call `maze.get_neighbors(row, col, maze_phase=True)` which excludes arena cells, so bots can only enter through the designated entry point

---

### `main.py`

The command-line entry point. Creates a `GameController`, calls `simulate_full_game()`, and prints the final state to the terminal. Used for quick testing without the browser frontend.

```python
from core.game_controller import GameController
controller = GameController()
controller.simulate_full_game()
print(controller.get_current_state())
```

---

## 5. AI Algorithm Deep Dive

### A* Search (AEGIS Maze Phase)

A* finds the optimal path from start to goal using the formula:

$$f(n) = g(n) + h(n)$$

Where:
- $g(n)$ = actual cost from start to node $n$ (1 per step, 10 per trap step)
- $h(n)$ = Manhattan distance heuristic from $n$ to the goal
- $f(n)$ = total estimated cost through $n$

A* is **complete** (always finds a path if one exists) and **optimal** (finds the cheapest path given an admissible heuristic). With `avoid_traps=True`, AEGIS routes around traps unless the detour is more costly than the trap damage.

### Uniform Cost Search (VELO Maze Phase)

UCS expands nodes in order of their accumulated cost with no heuristic:

$$f(n) = g(n)$$

With all moves costing 1, UCS degenerates to BFS — finding the shortest path by step count. VELO does not penalize traps, so it takes the most direct route regardless of hazards.

### Minimax with Alpha-Beta Pruning (AEGIS Combat Phase)

Minimax models the combat as a **zero-sum two-player game**. AEGIS (maximizer) wants to maximize the evaluation score; VELO (minimizer) tries to minimize it.

$$\text{Minimax}(n, d, \alpha, \beta) = \begin{cases} \text{evaluate}(n) & d = 0 \text{ or terminal} \\ \max_a \text{Minimax}(\text{child}, d-1, \alpha, \beta) & \text{if maximizing} \\ \min_a \text{Minimax}(\text{child}, d-1, \alpha, \beta) & \text{if minimizing} \end{cases}$$

**Alpha-Beta pruning** skips subtrees that cannot affect the final decision:
- $\alpha$ = best value the maximizer can guarantee
- $\beta$ = best value the minimizer can guarantee
- Prune when $\beta \leq \alpha$

At depth 5, AEGIS searches up to $6^5 = 7776$ terminal states in the worst case, but pruning typically reduces this by ~50–70%.

### Greedy Heuristic (VELO Combat Phase)

Greedy evaluation checks the **current state only** (depth 0). It applies a fixed priority order without any lookahead. This makes VELO fast but exploitable by strategic opponents like AEGIS. VELO excels at applying immediate pressure but may miss multi-step setups.

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  index.html ──loads──► main.js                                   │
│                           │                                      │
│             ┌─────────────┴──────────────┐                       │
│             │                            │                       │
│      AI-vs-AI Mode               Human Mode                      │
│             │                            │                       │
│      ReplayEngine                   CoreEngine                   │
│             │                       (client-side AI)             │
│             │                                                    │
│    POST /api/game/start                                          │
│    GET  /api/game/replay                                         │
│             │                                                    │
│    Replay event list ◄──────────────────────────────┐           │
│             │                                        │           │
│    ┌────────▼────────┐                               │           │
│    │  SceneSetup     │ ◄── Three.js scene, camera    │           │
│    │  GridRenderer   │ ◄── 7×7 tile meshes           │           │
│    │  aegis.js       │ ◄── Bot 3D meshes             │           │
│    │  velo.js        │                               │           │
│    │  arena.js       │                               │           │
│    └─────────────────┘                               │           │
└──────────────────────────────────────────────────────┼───────────┘
                                                       │
                                HTTP (JSON)            │
                                                       │
┌──────────────────────────────────────────────────────┼───────────┐
│                      PYTHON BACKEND                   │           │
│                                                       │           │
│  frontend/server.py                                   │           │
│       │                                               │           │
│       ▼                                               │           │
│  GameController.simulate_full_game() ─────────────────┘           │
│       │                                                           │
│       ├── _run_maze_phase()                                       │
│       │       ├── Maze()           ◄── core/maze.py               │
│       │       ├── AegisAgent()     ◄── agents/aegis.py            │
│       │       │     └── AStarPathfinder()  ◄── ai/pathfinding.py  │
│       │       └── VeloAgent()      ◄── agents/velo.py             │
│       │             └── UniformCostSearch() ◄── ai/pathfinding.py │
│       │                                                           │
│       ├── _run_transition_phase()                                 │
│       │                                                           │
│       └── _run_battle_phase()                                     │
│               ├── Arena()          ◄── core/arena.py              │
│               ├── AegisAgent.decide_combat_action()  (Minimax)    │
│               └── VeloAgent.decide_combat_action()   (Greedy)     │
│                                                                   │
│  All decisions → replay[] event list → JSON API response          │
└───────────────────────────────────────────────────────────────────┘
```

---

*This document covers every file, class, method, and data flow in Neuron Bot Wars — from the moment the user clicks START to the final GAME_OVER event rendered in the browser.*
