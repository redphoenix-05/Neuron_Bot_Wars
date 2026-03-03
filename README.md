# Neuron Bot Wars - AI vs AI Turn-Based Game

A console-based game where two AI agents compete first in navigating a maze, then battle in an arena.

## Game Overview

### Agents
- **AEGIS (A)**: Uses Minimax with Alpha-Beta Pruning for strategic decision-making
- **VELO (V)**: Uses A* Search for pathfinding and Greedy heuristic for combat

### Game Structure

#### Phase 1: Maze Navigation (6×6 Grid)
- **Grid Layout**: 
  - Outer ring forms a maze with walls (#) and paths (.)
  - Inner 4×4 cells [1-4][1-4] form the Battle Arena
- **Objective**: Reach the Battle Arena first
- **Movement**: Up, Down, Left, Right (1 cell per turn)
- **HP Assignment**:
  - First agent to enter: **120 HP**
  - Second agent to enter: **100 HP**

#### Phase 2: Combat
- **Location**: Inside the 4×4 arena only
- **Actions Available**:
  - **Move**: Move to adjacent cell
  - **Attack**: Deal 20 damage (only if adjacent to opponent)
  - **Defend**: Reduce incoming damage by 50% for one turn
  - **Concede**: Surrender the match
- **Victory Condition**: Reduce opponent's HP to 0 or force concession

## How to Run

```bash
python neuron_bot_wars.py
```

The game will:
1. Display initial agent spawn positions
2. Show the grid after each turn
3. Wait for you to press Enter to advance to the next turn
4. Log all actions and HP changes
5. Announce the winner when the game ends

## AI Algorithms

### A* Pathfinding (VELO - Maze Phase)
- Uses Manhattan distance heuristic
- Finds optimal path to arena
- Avoids opponent's position

### Minimax with Alpha-Beta Pruning (AEGIS - Both Phases)
- Evaluates move sequences up to depth 3
- Optimizes for HP advantage and positioning
- Alpha-beta pruning for efficiency

### Greedy Heuristic (VELO - Combat Phase)
- Prioritizes immediate advantage
- Attacks when HP advantage exists
- Defends when HP is low
- Moves closer when not adjacent

## Game Features

✓ Fully deterministic (except initial spawn)
✓ No randomness in combat
✓ ASCII grid visualization
✓ Turn-by-turn action logs
✓ Health tracking and updates
✓ Clean, modular code structure

## Code Structure

- **Grid & Environment**: Maze generation and cell management
- **Agent Classes**: AEGIS and VELO with their respective strategies
- **Search Algorithms**: A* pathfinding, Minimax with Alpha-Beta
- **Game Controller**: Phase management and turn execution

## Example Output

```
==================================================
       NEURON BOT WARS - AI vs AI
==================================================

Initializing game...

AEGIS (A) spawned at: (0, 0)
VELO (V) spawned at: (5, 2)

--------------------------------------------------
PHASE 1: MAZE NAVIGATION
--------------------------------------------------
Objective: Reach the inner 4×4 Battle Arena
First agent to enter gets 120 HP, second gets 100 HP

==============================
  0 1 2 3 4 5
  ------------
0|A . # . # . |
1|# . . . . . |
2|. . . . . . |
3|. . . . . . |
4|# . . . . . |
5|# . V # . # |
  ------------
==============================
```

## Requirements

- Python 3.7 or higher
- No external dependencies (uses only standard library)

---

**Author**: Ariyan Afyab Spandan & Himel Hossain
**Date**: March 2, 2026  
**License**: Open Source
