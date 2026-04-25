# Neuron Bot Wars — Complete Project Overview

## What Is This?

**Neuron Bot Wars** is an AI combat simulation game where two autonomous bots — **AEGIS** (blue) and **VELO** (red) — compete across two phases: a maze navigation race and a 1v1 battle arena fight. The entire simulation runs in Python (standard library only — no pip packages needed) with a browser-based frontend for visualization.

---

## How to Run

```bash
# Start the server (no venv needed — pure standard library)
python frontend/server.py

# Then open in browser:
# http://localhost:8000/index.html

# Or run simulation in terminal only (no browser):
python main.py
```

---

## Project Structure

```
Neuron_Bot_Wars/
│
├── main.py                    # CLI entry point — runs one full simulation
├── test_api.py                # Manual test script for backend + API
│
├── core/                      # Game engine
│   ├── grid.py                # Constants, enums (CellType, Action, Direction), Grid base class
│   ├── maze.py                # 7×7 maze world — walls, traps, arena entry
│   ├── arena.py               # 3×3 battle arena — items, pickups
│   ├── game_state_manager.py  # Central state store (phase, HP, positions, events)
│   └── game_controller.py     # Orchestrator — runs all phases, builds replay log
│
├── agents/
│   ├── agent_base.py          # Base Agent class — HP, attacks, defend, action history
│   ├── aegis.py               # AEGIS AI — A* maze + Minimax combat
│   └── velo.py                # VELO AI  — UCS maze + Greedy combat
│
├── ai/
│   └── pathfinding.py         # A* and Uniform Cost Search implementations
│
├── game/
│   └── game_logic.py          # (Legacy / unused — core logic lives in core/)
│
└── frontend/
    ├── server.py              # HTTP server + REST API (port 8000)
    ├── index.html             # Main HTML shell
    ├── style.css              # All visual styling
    ├── main.js                # Frontend bootstrap
    ├── engine/
    │   ├── coreEngine.js      # Main game loop driver
    │   ├── animationController.js  # Smooth step-by-step replay animation
    │   └── replayEngine.js    # Parses and plays back replay event list
    ├── game/
    │   └── gameState.js       # Frontend state mirror
    ├── objects/
    │   ├── aegis.js           # AEGIS sprite/render object
    │   ├── velo.js            # VELO sprite/render object
    │   ├── arena.js           # Arena render object
    │   └── trap.js            # Trap render object
    └── scene/
        ├── sceneSetup.js      # Three.js scene initialization
        └── gridRenderer.js    # Grid/maze rendering
```

---

## The Grid

The world is a **7×7 grid** (rows 0–6, cols 0–6), indexed as `(row, col)`.

```
Col:  0   1   2   3   4   5   6
Row 0 [ ] [ ] [ ] [ ] [ ] [ ] [ ]
Row 1 [ ] [ ] [ ] [ ] [ ] [ ] [ ]
Row 2 [ ] [ ] [A] [A] [A] [ ] [ ]
Row 3 [S] [E] [A] [A] [A] [ ] [S]
Row 4 [ ] [ ] [A] [A] [A] [ ] [ ]
Row 5 [ ] [ ] [ ] [ ] [ ] [ ] [ ]
Row 6 [ ] [ ] [ ] [ ] [ ] [ ] [ ]

S = spawn  |  E = arena entry  |  A = arena cell
```

| Zone | Cells | Description |
|------|-------|-------------|
| Maze | All cells NOT in rows/cols 2–4 | Open paths + traps |
| Arena | Rows 2–4, cols 2–4 (3×3 center) | Battle zone |
| Arena Entry | `(3, 1)` | Single door from maze to arena |
| AEGIS Spawn | `(0, 3)` | Top-center |
| VELO Spawn | `(6, 3)` | Bottom-center |

---

## Game Phases (States)

There are **4 phases**. They are stored in `GameStateManager.current_state`.

### Phase 1 — `maze`
- Both bots navigate from their spawn to the arena entry at `(3, 1)`.
- They move simultaneously (AEGIS first, then VELO each turn).
- Traps are placed randomly in maze cells (6–10 traps). Each trap hit costs 1 HP.
- Max turns: **50**.
- First to reach `(3, 1)` is the **maze winner** (bragging rights, no mechanical bonus currently).

### Phase 2 — `transition`
- A single snapshot event.
- Both bots teleport to their battle positions inside the arena:
  - AEGIS → `(3, 2)` (left side of arena)
  - VELO  → `(3, 4)` (right side of arena)
- HP carries over from the maze phase.

### Phase 3 — `battle`
- Turn-based combat inside the 3×3 arena.
- AEGIS acts first, then VELO, each turn.
- Max turns: **200**.
- Win condition: reduce opponent's HP to 0.
- Tiebreak (max turns reached): higher HP wins. Exact tie = draw.

### Phase 4 — `finished`
- Game over. Winner is declared.
- The overall winner is whoever won the battle (maze winner is tracked separately but does not affect the overall winner).

---

## Decision Tree — What Happens Each Turn

```
simulate_full_game()
│
├── Phase: maze
│   └── For each turn (up to 50):
│       ├── AEGIS: decide_maze_move()
│       │   └── A* path from position → (3,1), avoids traps
│       │       ├── If path found → take step path[1]
│       │       └── Fallback → greedy (Manhattan distance min)
│       ├── VELO: decide_maze_move()
│       │   └── UCS path from position → (3,1), ignores trap cost
│       │       ├── If path found → take step path[1]
│       │       └── Fallback → greedy (Manhattan distance min)
│       ├── Each step: check for trap hit → -1 HP
│       └── Each step: check if (3,1) reached → mark done
│
├── Phase: transition
│   └── Teleport both agents to battle positions, emit one event
│
├── Phase: battle
│   └── For each turn (up to 200):
│       ├── AEGIS: decide_combat_action() [Minimax, depth 4]
│       │   ├── Build list of possible actions
│       │   │   ├── MOVE (to each adjacent arena cell that is not occupied)
│       │   │   ├── PULSE_STRIKE (if adjacent to opponent)
│       │   │   ├── LOGIC_BURST (if adjacent AND charge == 3)
│       │   │   ├── ELEMENTAL_BEAM (if adjacent AND not yet used)
│       │   │   ├── DEFEND
│       │   │   └── WAIT
│       │   └── Minimax scores each → pick highest value action
│       │
│       ├── VELO: decide_combat_action() [Greedy]
│       │   ├── Elemental Beam if adjacent AND (finishing blow OR opponent HP > 60)
│       │   ├── Logic Burst if adjacent AND charge == 3
│       │   ├── Pulse Strike if adjacent
│       │   ├── Defend if own HP < 40 OR opponent charge ≥ 2 and adjacent
│       │   ├── Move toward opponent (closest arena neighbor)
│       │   └── Defend / Wait as fallback
│       │
│       ├── Item spawn triggers:
│       │   └── If either agent HP ≤ 20 → spawn Medkit (once per game)
│       │
│       └── Item pickup check (both agents, every turn):
│           ├── MEDKIT → heal +20 HP (capped at 100), item removed
│           └── POWERUP → next attack ×1.5 damage, item removed
│
└── Phase: finished
    └── Print/emit results
```

---

## Agents In Detail

### AEGIS (Blue)
| Property | Value |
|----------|-------|
| Spawn | `(0, 3)` |
| Starting HP | 100 |
| Maze Algorithm | **A\*** (Manhattan heuristic, trap penalty = +10 cost) |
| Combat Algorithm | **Minimax with Alpha-Beta Pruning** (depth 4) |
| Minimax evaluates | HP difference, distance to opponent, charge readiness, beam availability |

### VELO (Red)
| Property | Value |
|----------|-------|
| Spawn | `(6, 3)` |
| Starting HP | 100 |
| Maze Algorithm | **UCS / Dijkstra** (no trap penalty — pure shortest path, higher trap risk) |
| Combat Algorithm | **Greedy Heuristic** (immediate advantage: finish > burst > strike > defend > move) |

---

## Combat Actions

| Action | Damage | Condition | Notes |
|--------|--------|-----------|-------|
| `PULSE_STRIKE` | 5 HP | Must be adjacent | Basic reliable attack |
| `LOGIC_BURST` | 10 HP | Must be adjacent, charge must be exactly 3 | Charge increments every turn a non-burst action is taken (max 3). Resets to 0 on use. |
| `ELEMENTAL_BEAM` | 25 HP | Must be adjacent, not yet used | **One-time use per agent per game** |
| `DEFEND` | — | Always available | Next hit reduces damage to 20% of original (80% reduction). Lasts one turn only. |
| `MOVE` | — | Arena cell must be free | Move to adjacent arena cell |
| `WAIT` | — | Always available | Do nothing |

**Powerup modifier**: If an agent has a powerup when attacking → damage ×1.5. Powerup consumed on use.
**Defend reduction**: `actual_damage = floor(damage × 0.2)`.

---

## Items (Arena Only)

| Item | Effect | Spawn Trigger | Limit |
|------|--------|--------------|-------|
| `MEDKIT` | +20 HP (capped at max 100) | Either agent reaches ≤ 20 HP | Once per game |
| `POWERUP` | Next attack ×1.5 | (Not yet implemented as automatic spawn — available in Arena class) | Once per game |

Items spawn in a random unoccupied arena cell and disappear after first pickup.

---

## Replay Event System

The game produces a full **replay log** — a list of JSON events emitted by `GameController._emit()`. Each event has this base shape:

```json
{
  "type": "EVENT_TYPE",
  "turn": 12,
  "phase": "maze",
  "aegis": { "x": 0, "y": 3, "hp": 99, "alive": true, "inArena": false },
  "velo":  { "x": 6, "y": 1, "hp": 100, "alive": true, "inArena": false }
}
```

### All Event Types

| Event | Phase | Extra Fields | Meaning |
|-------|-------|-------------|---------|
| `GAME_START` | maze | `traps`, `arenaEntry`, `aegisSpawn`, `veloSpawn` | First event, full initial state |
| `MAZE_MOVE` | maze | `agent`, `from`, `to`, `trapHit`, `damage` | One bot moved one cell |
| `MAZE_WINNER` | maze | `agent` | First bot to reach arena entry |
| `TRANSITION` | transition | — | Phase switch snapshot |
| `BATTLE_SPAWN` | transition | `aegisPos`, `veloPos` | Bots placed in arena |
| `BATTLE_ACTION` | battle | `agent`, `action`, `target`, `damage`, `attackType`, `aegisHpAfter`, `veloHpAfter` | One bot took its combat turn |
| `ITEM_SPAWNED` | battle | `itemType`, `pos` | Medkit or Powerup appeared |
| `ITEM_COLLECTED` | battle | `agent`, `itemType`, `pos` | Bot picked up an item |
| `GAME_OVER` | finished | `winner`, `mazeWinner`, `battleWinner`, `aegisFinalHp`, `veloFinalHp` | Final results |

The frontend's `replayEngine.js` reads this list and animates them step by step.

---

## Backend API

The server (`frontend/server.py`) runs on **port 8000** serving both static files and a REST API.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/game/start` | Run full simulation, return total events + winner |
| `GET` | `/api/game/state` | Return the final state dict |
| `GET` | `/api/game/status` | Return phase, turn, and running/finished status |
| `GET` | `/api/game/replay` | Return the full replay event list |

The game is **fully pre-simulated** on `/start` — the entire game runs server-side and the frontend plays back the recorded replay events.

---

## Constants Reference (`core/grid.py`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `GRID_SIZE` | 7 | 7×7 world grid |
| `ARENA_START` | 2 | Arena begins at row/col 2 |
| `ARENA_END` | 4 | Arena ends at row/col 4 |
| `INITIAL_HP` | 100 | Starting HP for both agents |
| `PULSE_STRIKE_DAMAGE` | 5 | Basic attack damage |
| `LOGIC_BURST_DAMAGE` | 10 | Charged attack damage |
| `ELEMENTAL_BEAM_DAMAGE` | 25 | One-time nuke damage |
| `DEFEND_REDUCTION` | 0.2 | Multiply incoming damage by this when defending |
| `TRAP_DAMAGE` | 1 | HP lost when stepping on a trap |
| `MEDKIT_HEAL` | 20 | HP restored by medkit |

---

## No Dependencies

This project uses **zero third-party packages**. Everything runs on Python's standard library:
- `http.server` / `socketserver` — web server
- `heapq` — priority queue for A* and UCS
- `random`, `copy`, `json`, `pathlib`, `sys` — utilities

No `requirements.txt`, no `venv` needed. Just run with any Python 3.8+ interpreter.
