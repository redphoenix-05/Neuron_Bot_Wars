# Neuron Bot Wars - AI vs AI Turn-Based Game

A console-based simulation where two AI agents navigate a maze with traps, then battle in an arena using strategic AI algorithms.

## 🎮 Game Overview

### 🤖 AI Agents

- **AEGIS (Blue Agent)** - Strategic AI
  - **Maze Navigation**: A* Search with Manhattan distance heuristic (avoids traps)
  - **Combat Strategy**: Minimax with Alpha-Beta Pruning (depth 2)
  - **Personality**: Defensive, strategic, calculates optimal moves

- **VELO (Red Agent)** - Aggressive AI
  - **Maze Navigation**: Uniform Cost Search (shortest path, may risk traps)
  - **Combat Strategy**: Greedy Heuristic (seeks immediate advantage)
  - **Personality**: Offensive, risk-taking, prioritizes damage

### 🗺️ Game Structure

#### Phase 1: Maze Navigation (7×7 Grid)

**Grid Layout**:
```
M M M M M M M
M M M M M M M
M M A A A M M
M M A A A M M
M M A A A M M
M M M M M M M
M M M M M M M
```
- **M** = Maze cells (outer ring)
- **A** = Battle Arena (center 3×3)

**Maze Features**:
- `.` = Empty path (walkable)
- `#` = Wall (impassable)
- `T` = Trap (deals 10 HP damage)
- `E` = Arena entry point (single entrance)

**Objective**: Navigate from spawn position to arena entry point

**Spawn Rules**:
- Agents spawn randomly in maze cells
- Must spawn far from arena entry (minimum Manhattan distance ≥ 3)
- Cannot spawn on walls, traps, or entry point
- Maze generation is validated so both spawns always have a path to `E`
- If maze navigation exceeds 200 turns, the maze regenerates (deadlock safety)

#### Phase 2: Battle Arena (3×3 Grid)

**Arena Items**:
- **MedKit (H)**: Restores 20 HP (disappears after use)
- **Power Up (P)**: Spawns once (only when any agent reaches 50 HP or less), boosts next attack to 30 damage

**Combat Actions**:
1. **Move** - Move to adjacent cell (can pick up items)
2. **Attack** - Deal 15 damage (requires adjacency)
3. **Defend** - Reduce incoming damage by 80% for one turn
4. **Power Attack** - Deal 30 damage using power-up (requires adjacency + power-up)
5. **Concede** - Surrender the match

**Action Restrictions** (prevents consecutive repeats):
- Cannot Move → Move
- Cannot Defend → Defend
- Cannot Power Attack → Power Attack
- Attack can repeat consecutively

**Victory Conditions**:
- Reduce opponent's HP to 0
- Opponent concedes

## 🚀 How to Run

```bash
python neuron_bot_wars.py
```

**Game Flow**:
1. Displays game initialization and spawn positions
2. Shows maze grid with agent positions after each turn
3. Waits for Enter key to advance to next turn
4. Logs all actions, trap activations, HP changes
5. Transitions to arena when both agents reach entry
6. Displays combat actions and AI decision reasoning
7. Announces winner with final statistics

**Example Output**:
```
🤖 AEGIS (Blue) spawned at: (0, 0)
   Strategy: A* pathfinding (avoids traps) + Minimax combat

🤖 VELO (Red) spawned at: (6, 6)
   Strategy: Uniform Cost Search (risky) + Greedy combat

🎯 Arena Entry Point: (3, 1)
```

## 🧠 AI Algorithms

### A* Pathfinding (AEGIS - Maze Phase)
- **Heuristic**: Manhattan distance to goal
- **Strategy**: Avoids traps by assigning higher cost (5x) to trap cells
- **Benefit**: Safer navigation, preserves HP for combat

### Uniform Cost Search (VELO - Maze Phase)
- **Strategy**: Pure shortest path (all moves cost 1)
- **Behavior**: Will take traps if they're on shortest path
- **Benefit**: Fastest route to arena, aggressive playstyle

### Minimax with Alpha-Beta Pruning (AEGIS - Combat)
- **Depth**: 2 levels of lookahead
- **Evaluation Function**:
  - HP difference (weight: 3.0)
  - Distance to opponent (weight: -2.0, closer is better)
  - Defensive stance bonus (5.0)
  - Power-up advantage (10.0)
- **Pruning**: Alpha-Beta cutoffs reduce search space
- **Benefit**: Optimal strategic decisions, considers opponent's best responses

### Greedy Heuristic Strategy (VELO - Combat)
- **Decision Priority**:
  1. Power Attack if available and adjacent
  2. Attack if adjacent and HP advantage
  3. Defend if low HP and not adjacent
  4. Move closer to opponent
  5. Defend as fallback
- **Benefit**: Fast decisions, aggressive damage-dealing

## 📋 Game Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| Grid Size | 7×7 | Total world size |
| Arena Size | 3×3 | Center battle arena |
| Initial HP | 100 | Starting health |
| Attack Damage | 15 | Regular attack |
| Power Attack Damage | 30 | With power-up |
| Defend Reduction | 80% | Damage reduced to 20% |
| Trap Damage | 10 | HP lost on trap |
| MedKit Heal | 20 | HP restored |

## 🏗️ Code Structure

### Classes
- **Grid** - Base class for grid management
- **Maze** - 7×7 maze with walls, traps, and arena entry
- **Arena** - 3×3 battle arena with items (MedKits, PowerUps)
- **Agent** - Base class with combat mechanics and item handling
- **AegisAgent** - Strategic AI using A* and Minimax
- **VeloAgent** - Aggressive AI using UCS and Greedy strategy
- **AStarPathfinder** - A* search with trap avoidance
- **UniformCostSearch** - Shortest path algorithm
- **GameController** - Main game loop and phase management

### Algorithms Implemented

1. **A* Search** - Heuristic-based pathfinding (AEGIS maze navigation)
2. **Uniform Cost Search** - Dijkstra's algorithm (VELO maze navigation)
3. **Minimax with Alpha-Beta Pruning** - Game tree search (AEGIS combat)
4. **Greedy Heuristic** - Immediate advantage seeking (VELO combat)

## 🎯 Educational Value

This project demonstrates:
- **Pathfinding Algorithms**: A* vs Uniform Cost Search comparison
- **Game AI**: Minimax vs Greedy strategy tradeoffs
- **Alpha-Beta Pruning**: Search space reduction optimization
- **Heuristic Design**: Evaluation function crafting
- **Object-Oriented Design**: Clean class hierarchy
- **State Management**: Game phases and transitions
- **Action Restrictions**: Strategic gameplay mechanics

## 📊 Example Game Flow

```
============================================================
               NEURON BOT WARS
            AI vs AI Simulation
============================================================

🎮 Game Initializing...

📋 Game Rules:
  • Phase 1: Navigate maze to reach arena entry point
  • Phase 2: Combat in 3×3 arena until one agent wins
  • Traps deal 10 HP damage
  • Attack: 15 damage | Power Attack: 30 damage
  • Defend reduces damage by 80%

🤖 AEGIS (Blue) spawned at: (0, 0)
   Strategy: A* pathfinding (avoids traps) + Minimax combat

🤖 VELO (Red) spawned at: (6, 6)
   Strategy: Uniform Cost Search (risky) + Greedy combat

🎯 Arena Entry Point: (3, 1)

------------------------------------------------------------
PHASE 1: MAZE NAVIGATION
------------------------------------------------------------
Objective: Reach the arena entry point (E)
Legend: . = path, # = wall, T = trap, E = entry, A = arena

========================================
  0 1 2 3 4 5 6
  --------------
0|A . # T # . . |
1|# . . . . . # |
2|. . A A A . . |
3|. E A A A . T |
4|T . A A A # . |
5|. . . . . . . |
6|. . # . # . V |
  --------------
========================================

➤ Press Enter to continue...

TURN 1 - MAZE PHASE
🔵 AEGIS's turn:
   Current position: (0, 0)
   → Moved to (0, 1) (using A* pathfinding)

🔴 VELO's turn:
   Current position: (6, 6)
   → Moved to (5, 6) (using Uniform Cost Search)

...

===== MAZE PHASE COMPLETE =====
===== ENTERING BATTLE ARENA =====

💙 AEGIS HP: 100
❤️  VELO HP: 90  (stepped on trap)

📦 Arena Items:
   H at (2, 2)
   H at (2, 4)
   P at (3, 3)

------------------------------------------------------------
PHASE 2: COMBAT
------------------------------------------------------------

🔵 AEGIS's turn (Minimax AI):
   Position: (2, 2)
   [Minimax] move: value = 15.0
   [Minimax] attack: value = 25.0
   [Minimax] defend: value = 10.0
   Action: ATTACK
   → Attacked VELO for 15 damage!
      VELO HP: 75/100

🔴 VELO's turn (Greedy AI):
   Position: (4, 4)
   [Greedy] Adjacent: True, HP Adv: False, Low HP: False
   Action: ATTACK
   → Attacked AEGIS for 15 damage!
      AEGIS HP: 85/100

...

============================================================
                      GAME OVER
============================================================

🏆 AEGIS WINS! 🏆

📊 Final Statistics:
   Winner: AEGIS (Blue Agent)
   Final HP: 45/100
   Total Turns: 23

   Defeated: VELO
   Final HP: 0/100

============================================================
Thank you for watching Neuron Bot Wars!
============================================================
```

## 🔧 Requirements

- Python 3.7 or higher
- No external dependencies (uses only standard library: `heapq`, `random`, `typing`, `copy`, `enum`)

## 🎓 Learning Outcomes

After studying this code, you will understand:
- How A* heuristic search differs from Uniform Cost Search
- How Minimax algorithm evaluates game positions
- How Alpha-Beta pruning optimizes search efficiency
- How greedy algorithms make fast decisions
- How to implement turn-based game mechanics
- How to design AI agent behaviors
- How to manage game state and phase transitions

---

**Project**: Neuron Bot Wars - AI Simulation  
**Date**: March 5, 2026  
**Purpose**: Educational demonstration of AI algorithms in game development  
**License**: Open Source
