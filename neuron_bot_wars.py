"""
Neuron Bot Wars - AI vs AI Turn-Based Game
==========================================
A console-based simulation where two AI agents navigate a maze, then battle in an arena.

Agents:
- AEGIS (Blue): Strategic AI using A* (maze) + Minimax with Alpha-Beta Pruning (combat)
- VELO (Red): Aggressive AI using Uniform Cost Search (maze) + Greedy Heuristics (combat)

Game Structure:
- Phase 1: Maze Navigation (7×7 grid with outer maze ring and center 3×3 arena)  
- Phase 2: Combat (turn-based combat in the arena with items and strategic actions)

Requirements:
- 7×7 grid world
- Center 3×3 Battle Arena
- Maze features: walls, traps, entry point
- Arena items: MedKit (+20 HP), Power Up (boost attack)
- Combat actions: Move, Attack (15 dmg), Defend (80% reduction), Power Attack, Concede
- Action restrictions: Cannot repeat Move, Defend, Power Attack consecutively
"""

import sys
import heapq
import random
from typing import List, Tuple, Optional, Set, Dict
from copy import deepcopy
from enum import Enum

# Force UTF-8 output so Unicode/emoji characters don't crash on Windows (cp1252)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


# =============================================================================
# CONSTANTS AND ENUMS
# =============================================================================

class CellType(Enum):
    """Types of cells in the grid"""
    WALL = '#'      # Wall - impassable
    PATH = '.'      # Open path
    TRAP = 'T'      # Trap - causes 10 HP damage
    ENTRY = 'E'     # Arena entry point
    ARENA = ' '     # Arena cell


class ItemType(Enum):
    """Items that can appear in the arena"""
    MEDKIT = 'H'     # Restores 20 HP
    POWERUP = 'P'    # Boosts next attack damage


class Action(Enum):
    """Available actions during combat"""
    MOVE = 'move'
    DEFEND = 'defend'
    PULSE_STRIKE = 'pulse_strike'
    LOGIC_BURST = 'logic_burst'
    ELEMENTAL_BEAM = 'elemental_beam'


class Direction(Enum):
    """Movement directions"""
    UP = (-1, 0)
    DOWN = (1, 0)
    LEFT = (0, -1)
    RIGHT = (0, 1)


# Game constants
GRID_SIZE = 7
ARENA_START = 2  # Arena starts at row/col 2
ARENA_END = 4    # Arena ends at row/col 4 (3×3 arena)
INITIAL_HP = 100
PULSE_STRIKE_DAMAGE = 10
LOGIC_BURST_DAMAGE = 20
ELEMENTAL_BEAM_DAMAGE = 30
DEFEND_REDUCTION = 0.2  # 80% damage reduction (take only 20%)
TRAP_DAMAGE = 10
MEDKIT_HEAL = 20
MIN_SPAWN_DISTANCE = 3
MAX_MAZE_TURNS = 200


# =============================================================================
# GRID ENVIRONMENT CLASSES
# =============================================================================

class Grid:
    """Base class for grid management"""
    
    def __init__(self, size: int):
        """Initialize a grid of given size"""
        self.size = size
        self.grid = [[CellType.PATH for _ in range(size)] for _ in range(size)]
    
    def is_valid_cell(self, row: int, col: int) -> bool:
        """Check if cell coordinates are within grid bounds"""
        return 0 <= row < self.size and 0 <= col < self.size
    
    def is_walkable(self, row: int, col: int) -> bool:
        """Check if agent can walk on this cell"""
        if not self.is_valid_cell(row, col):
            return False
        return self.grid[row][col] != CellType.WALL
    
    def get_neighbors(self, row: int, col: int) -> List[Tuple[int, int]]:
        """Get all valid neighboring cells (up, down, left, right)"""
        neighbors = []
        for direction in Direction:
            dr, dc = direction.value
            new_row, new_col = row + dr, col + dc
            if self.is_walkable(new_row, new_col):
                neighbors.append((new_row, new_col))
        return neighbors
    
    def get_cell_type(self, row: int, col: int) -> CellType:
        """Get the type of cell at given position"""
        if self.is_valid_cell(row, col):
            return self.grid[row][col]
        return CellType.WALL


class Maze(Grid):
    """Maze environment with walls, traps, and arena entry"""
    
    def __init__(self):
        """Initialize a 7×7 maze with center 3×3 arena"""
        super().__init__(GRID_SIZE)
        self.arena_entry = None  # Single entry point to arena
        self.traps = set()  # Track trap positions
        self._generate_maze()
    
    def _generate_maze(self):
        """Generate maze layout (arena + entry + random walls)."""
        self._reset_to_paths()
        self._mark_arena_cells()
        self._set_arena_entry()
        self._place_random_walls()

    def _reset_to_paths(self):
        """Reset full grid to walkable path cells before generation."""
        self.grid = [[CellType.PATH for _ in range(self.size)] for _ in range(self.size)]
        self.traps.clear()

    def _mark_arena_cells(self):
        """Mark center 3×3 as the battle arena."""
        for r in range(ARENA_START, ARENA_END + 1):
            for c in range(ARENA_START, ARENA_END + 1):
                self.grid[r][c] = CellType.ARENA

    def _set_arena_entry(self):
        """Set single maze-to-arena entry cell."""
        self.arena_entry = (3, 1)
        self.grid[3][1] = CellType.ENTRY

    def _get_entry_neighbors(self) -> Set[Tuple[int, int]]:
        """Get all cells adjacent to the arena entry (must always be walkable)."""
        entry_r, entry_c = self.arena_entry
        neighbors = set()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = entry_r + dr, entry_c + dc
            if self.is_valid_cell(nr, nc) and self.is_maze_cell(nr, nc):
                neighbors.add((nr, nc))
        return neighbors

    def _place_random_walls(self, wall_count: int = 8):
        """Randomly place walls only in maze cells, never in arena/entry/entry neighbors."""
        entry_neighbors = self._get_entry_neighbors()
        candidates = []
        for r in range(self.size):
            for c in range(self.size):
                if not self.is_maze_cell(r, c):
                    continue
                if (r, c) == self.arena_entry:
                    continue
                if (r, c) in entry_neighbors:
                    continue
                candidates.append((r, c))

        for r, c in random.sample(candidates, k=min(wall_count, len(candidates))):
            self.grid[r][c] = CellType.WALL

    def place_traps(self, protected_cells: Set[Tuple[int, int]], trap_count: int = 4):
        """
        Place traps after path validation.
        Protected cells are never replaced, so validated routes remain trap-free.
        """
        self.traps.clear()

        candidates = []
        for r in range(self.size):
            for c in range(self.size):
                pos = (r, c)
                if not self.is_maze_cell(r, c):
                    continue
                if pos == self.arena_entry or pos in protected_cells:
                    continue
                if self.grid[r][c] == CellType.PATH:
                    candidates.append(pos)

        for r, c in random.sample(candidates, k=min(trap_count, len(candidates))):
            self.grid[r][c] = CellType.TRAP
            self.traps.add((r, c))

    def find_path_bfs(self, start: Tuple[int, int], goal: Tuple[int, int]) -> List[Tuple[int, int]]:
        """Validate reachability with BFS and return one shortest path."""
        if start == goal:
            return [start]

        queue = [start]
        came_from: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {start: None}

        while queue:
            current = queue.pop(0)
            if current == goal:
                break

            for neighbor in self.get_neighbors(current[0], current[1], maze_phase=True):
                if neighbor in came_from:
                    continue
                came_from[neighbor] = current
                queue.append(neighbor)

        if goal not in came_from:
            return []

        path = []
        cur = goal
        while cur is not None:
            path.append(cur)
            cur = came_from[cur]
        path.reverse()
        return path

    def validate_paths_to_entry(
        self, spawns: List[Tuple[int, int]]
    ) -> Tuple[bool, Dict[Tuple[int, int], List[Tuple[int, int]]]]:
        """Ensure each spawn has a valid route to arena entry."""
        paths: Dict[Tuple[int, int], List[Tuple[int, int]]] = {}
        for spawn in spawns:
            path = self.find_path_bfs(spawn, self.arena_entry)
            if not path:
                return False, {}
            paths[spawn] = path
        return True, paths
    
    def is_maze_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the maze (not arena)"""
        return not (ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END)
    
    def is_arena_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the battle arena"""
        return ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END
    
    def is_trap(self, row: int, col: int) -> bool:
        """Check if cell is a trap"""
        return (row, col) in self.traps
    
    def is_walkable(self, row: int, col: int, maze_phase: bool = False) -> bool:
        """Check if agent can walk on this cell"""
        if not self.is_valid_cell(row, col):
            return False
        
        cell_type = self.grid[row][col]
        
        # Walls are never walkable
        if cell_type == CellType.WALL:
            return False
        
        # During maze phase, arena cells are not walkable (they're hidden)
        # Only the entry point allows transition to arena
        if maze_phase and cell_type == CellType.ARENA:
            return False
        
        return True
    
    def get_neighbors(self, row: int, col: int, maze_phase: bool = False) -> List[Tuple[int, int]]:
        """Get all valid neighboring cells (up, down, left, right)"""
        neighbors = []
        for direction in Direction:
            dr, dc = direction.value
            new_row, new_col = row + dr, col + dc
            if self.is_walkable(new_row, new_col, maze_phase):
                neighbors.append((new_row, new_col))
        return neighbors
    
    def get_valid_spawn_cells(self, min_distance_from_entry: int = 3) -> List[Tuple[int, int]]:
        """Get valid spawn positions in maze, far from arena entry"""
        valid_cells = []
        for r in range(self.size):
            for c in range(self.size):
                if self.is_maze_cell(r, c) and self.is_walkable(r, c):
                    # Must be far from entry and not a trap
                    if not self.is_trap(r, c) and self.grid[r][c] != CellType.ENTRY:
                        distance = abs(r - self.arena_entry[0]) + abs(c - self.arena_entry[1])
                        if distance >= min_distance_from_entry:
                            valid_cells.append((r, c))
        return valid_cells
    
    def display(self, agent1_pos: Tuple[int, int], agent2_pos: Tuple[int, int],
                agent1_sym: str = 'A', agent2_sym: str = 'V', phase: int = 1,
                agent1_in_arena: bool = False, agent2_in_arena: bool = False):
        """Display the maze with agents"""
        print("\n" + "=" * 40)
        if phase == 1:
            print("  0 1 2 3 4 5 6")
            print("  " + "-" * 14)
            
            for r in range(self.size):
                row_str = f"{r}|"
                for c in range(self.size):
                    # Don't show agents who have already entered the arena
                    if (r, c) == agent1_pos and not agent1_in_arena:
                        row_str += agent1_sym + " "
                    elif (r, c) == agent2_pos and not agent2_in_arena:
                        row_str += agent2_sym + " "
                    else:
                        cell_type = self.grid[r][c]
                        # Hide arena during maze phase (show as empty space)
                        if cell_type == CellType.ARENA:
                            row_str += "  "
                        else:
                            row_str += cell_type.value + " "
                print(row_str + "|")
            
            print("  " + "-" * 14)
        print("=" * 40 + "\n")


class Arena(Grid):
    """Battle arena with items"""
    
    def __init__(self):
        """Initialize 3×3 battle arena"""
        super().__init__(3)  # Arena is 3×3
        self.items: Dict[Tuple[int, int], ItemType] = {}
        self.item_usage: Dict[Tuple[int, int], Set[str]] = {}  # Track which agents used each item
        self.powerup_spawned = False
        self.powerup_taken = False
        self.health_spawned = False
        self.health_taken = False
        self._place_items()
    
    def _place_items(self):
        """No initial items. Items are spawned after half-HP trigger in combat."""
        return
    
    def can_pickup_item(self, row: int, col: int, agent_name: str) -> bool:
        """Check if agent can pick up item at position"""
        pos = (row, col)
        if pos not in self.items:
            return False
        # Agent can only pick up each item once
        return agent_name not in self.item_usage.get(pos, set())
    
    def get_item(self, row: int, col: int, agent_name: str) -> Optional[ItemType]:
        """Get item at position and track usage. Special items are one-time pickups."""
        pos = (row, col)
        if pos not in self.items:
            return None
        
        # Check if agent already used this item
        if agent_name in self.item_usage.get(pos, set()):
            return None
        
        # Mark item as used by this agent
        self.item_usage[pos].add(agent_name)
        item = self.items[pos]
        
        # PowerUp and MedKit are single-use: remove immediately after first pickup
        if item == ItemType.POWERUP:
            del self.items[pos]
            del self.item_usage[pos]
            self.powerup_taken = True
        elif item == ItemType.MEDKIT:
            del self.items[pos]
            del self.item_usage[pos]
            self.health_taken = True
        
        return item
    
    def has_item(self, row: int, col: int) -> bool:
        """Check if position has an item"""
        return (row, col) in self.items
    
    def spawn_powerup(self, occupied_global_positions: Set[Tuple[int, int]]) -> bool:
        """Spawn a single power-up once in a random empty arena cell."""
        if self.powerup_spawned:
            return False

        candidates = []
        for r in range(3):
            for c in range(3):
                global_pos = (r + ARENA_START, c + ARENA_START)
                if global_pos in occupied_global_positions:
                    continue
                if (r, c) in self.items:
                    continue
                candidates.append((r, c))

        if candidates:
            pos = random.choice(candidates)
            self.items[pos] = ItemType.POWERUP
            self.item_usage[pos] = set()
            self.powerup_spawned = True
            return True
        return False

    def spawn_health_pack(self, occupied_global_positions: Set[Tuple[int, int]]) -> bool:
        """Spawn a single health pickup once in a random empty arena cell."""
        if self.health_spawned:
            return False

        candidates = []
        for r in range(3):
            for c in range(3):
                global_pos = (r + ARENA_START, c + ARENA_START)
                if global_pos in occupied_global_positions:
                    continue
                if (r, c) in self.items:
                    continue
                candidates.append((r, c))

        if candidates:
            pos = random.choice(candidates)
            self.items[pos] = ItemType.MEDKIT
            self.item_usage[pos] = set()
            self.health_spawned = True
            return True
        return False
    
    def convert_to_arena_coords(self, global_pos: Tuple[int, int]) -> Tuple[int, int]:
        """Convert global grid position to arena-local coordinates"""
        return (global_pos[0] - ARENA_START, global_pos[1] - ARENA_START)
    
    def display(self, agent1_pos: Tuple[int, int], agent2_pos: Tuple[int, int],
                agent1_sym: str = 'A', agent2_sym: str = 'V'):
        """Display the battle arena with agents and items"""
        print("\n" + "#" * 40)
        print("#" + " " * 14 + "BATTLE ARENA" + " " * 14 + "#")
        print("#" * 40)
        print("  0 1 2")
        print("  " + "-" * 6)
        
        for r in range(3):
            row_str = f"{r}|"
            for c in range(3):
                # Convert to global coordinates
                global_r, global_c = r + ARENA_START, c + ARENA_START
                
                if (global_r, global_c) == agent1_pos:
                    row_str += agent1_sym + " "
                elif (global_r, global_c) == agent2_pos:
                    row_str += agent2_sym + " "
                elif (r, c) in self.items:
                    row_str += self.items[(r, c)].value + " "
                else:
                    row_str += ". "
            print(row_str + "|")
        
        print("  " + "-" * 6)
        print("#" * 40 + "\n")


# =============================================================================
# PATHFINDING ALGORITHMS
# =============================================================================

class AStarPathfinder:
    """A* search algorithm for pathfinding with heuristic"""
    
    def __init__(self, maze: Maze):
        self.maze = maze
    
    def heuristic(self, pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        """Manhattan distance heuristic"""
        return abs(pos[0] - goal[0]) + abs(pos[1] - goal[1])
    
    def find_path(self, start: Tuple[int, int], goal: Tuple[int, int],
                  avoid_traps: bool = True,
                  blocked_pos: Optional[Tuple[int, int]] = None) -> List[Tuple[int, int]]:
        """
        Find shortest path from start to goal using A* search.
        
        Args:
            start: Starting position
            goal: Goal position
            avoid_traps: If True, prefer paths that avoid traps
            blocked_pos: Position to treat as blocked (e.g., opponent position)
            
        Returns:
            List of positions from start to goal, or empty list if no path found
        """
        if start == goal:
            return [start]
        
        # Priority queue: (f_score, counter, current_pos, path, g_score)
        counter = 0
        open_set = [(0, counter, start, [start], 0)]
        closed_set: Set[Tuple[int, int]] = set()
        best_g_score: Dict[Tuple[int, int], float] = {start: 0}
        
        while open_set:
            _, _, current, path, g_score = heapq.heappop(open_set)
            
            if current == goal:
                return path
            
            if current in closed_set:
                continue
            
            closed_set.add(current)
            
            # Use maze_phase=True to exclude arena cells from pathfinding
            for neighbor in self.maze.get_neighbors(current[0], current[1], maze_phase=True):
                if neighbor in closed_set or neighbor == blocked_pos:
                    continue
                
                # Calculate cost (add penalty for traps if avoiding)
                move_cost = 1
                if avoid_traps and self.maze.is_trap(neighbor[0], neighbor[1]):
                    move_cost = 5  # Higher cost to discourage going through traps
                
                new_g_score = g_score + move_cost
                
                # Skip if we've found a better path to this neighbor
                if neighbor in best_g_score and new_g_score >= best_g_score[neighbor]:
                    continue
                
                best_g_score[neighbor] = new_g_score
                new_path = path + [neighbor]
                h_score = self.heuristic(neighbor, goal)
                f_score = new_g_score + h_score
                
                counter += 1
                heapq.heappush(open_set, (f_score, counter, neighbor, new_path, new_g_score))
        
        return []  # No path found


class UniformCostSearch:
    """Uniform Cost Search algorithm (Dijkstra's) for finding shortest path"""
    
    def __init__(self, maze: Maze):
        self.maze = maze
    
    def find_path(self, start: Tuple[int, int], goal: Tuple[int, int],
                  blocked_pos: Optional[Tuple[int, int]] = None) -> List[Tuple[int, int]]:
        """
        Find shortest path using Uniform Cost Search (no heuristic).
        VELO uses this for aggressive shortest-path approach (may go through traps).
        
        Args:
            start: Starting position
            goal: Goal position  
            blocked_pos: Position to treat as blocked
            
        Returns:
            List of positions from start to goal, or empty list if no path found
        """
        if start == goal:
            return [start]
        
        # Priority queue: (cost, counter, current_pos, path)
        counter = 0
        open_set = [(0, counter, start, [start])]
        closed_set: Set[Tuple[int, int]] = set()
        best_cost: Dict[Tuple[int, int], float] = {start: 0}
        
        while open_set:
            cost, _, current, path = heapq.heappop(open_set)
            
            if current == goal:
                return path
            
            if current in closed_set:
                continue
            
            closed_set.add(current)
            
            # Use maze_phase=True to exclude arena cells from pathfinding
            for neighbor in self.maze.get_neighbors(current[0], current[1], maze_phase=True):
                if neighbor in closed_set or neighbor == blocked_pos:
                    continue
                
                new_cost = cost + 1  # Uniform cost (all moves cost 1)
                
                # Skip if we've found a better path to this neighbor
                if neighbor in best_cost and new_cost >= best_cost[neighbor]:
                    continue
                
                best_cost[neighbor] = new_cost
                new_path = path + [neighbor]
                
                counter += 1
                heapq.heappush(open_set, (new_cost, counter, neighbor, new_path))
        
        return []  # No path found


# =============================================================================
# AGENT CLASSES
# =============================================================================

class Agent:
    """Base class for AI agents"""
    
    def __init__(self, name: str, symbol: str, position: Tuple[int, int], color: str):
        self.name = name
        self.symbol = symbol
        self.position = position
        self.color = color  # "Blue" or "Red"
        self.hp = INITIAL_HP
        self.in_arena = False
        self.is_defending = False
        self.has_powerup = False
        self.last_action = None  # Track last action for restrictions
        self.logic_burst_charge = 0
        self.elemental_beam_used = False
        
    def move(self, new_position: Tuple[int, int]):
        """Move agent to new position"""
        self.position = new_position
        self.last_action = Action.MOVE
    
    def take_damage(self, damage: int) -> int:
        """Apply damage to agent, returns actual damage taken"""
        actual_damage = damage
        if self.is_defending:
            actual_damage = int(damage * DEFEND_REDUCTION)
            print(f"      {self.name} is DEFENDING! Damage reduced to {actual_damage}")
            self.is_defending = False  # Defense only lasts one turn
        
        self.hp = max(0, self.hp - actual_damage)
        return actual_damage
    
    def defend(self):
        """Enter defensive stance"""
        self.is_defending = True
        self.last_action = Action.DEFEND

    def pulse_strike(self, target: 'Agent') -> int:
        """Perform pulse strike attack"""
        damage = PULSE_STRIKE_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self.last_action = Action.PULSE_STRIKE
        return actual_damage

    def logic_burst(self, target: 'Agent') -> int:
        """Perform logic burst attack"""
        if self.logic_burst_charge < 3:
            return 0
        
        damage = LOGIC_BURST_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self.logic_burst_charge = 0
        self.last_action = Action.LOGIC_BURST
        return actual_damage

    def elemental_beam(self, target: 'Agent') -> int:
        """Perform elemental beam attack"""
        if self.elemental_beam_used:
            return 0
        
        damage = ELEMENTAL_BEAM_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self.elemental_beam_used = True
        self.last_action = Action.ELEMENTAL_BEAM
        return actual_damage
    
    def pickup_item(self, item: ItemType):
        """Pick up an item"""
        if item == ItemType.MEDKIT:
            old_hp = self.hp
            self.hp = min(100, self.hp + MEDKIT_HEAL)
            healed = self.hp - old_hp
            print(f"      {self.name} picked up MEDKIT! Healed {healed} HP")
        elif item == ItemType.POWERUP:
            self.has_powerup = True
            print(f"      {self.name} picked up POWER UP!")
    
    def is_alive(self) -> bool:
        """Check if agent is still alive"""
        return self.hp > 0
    
    def is_adjacent(self, other_pos: Tuple[int, int]) -> bool:
        """Check if another position is adjacent (for melee attacks)"""
        row_diff = abs(self.position[0] - other_pos[0])
        col_diff = abs(self.position[1] - other_pos[1])
        return (row_diff == 1 and col_diff == 0) or (row_diff == 0 and col_diff == 1)
    
    def can_perform_action(self, action: Action) -> bool:
        """Check if action can be performed (respects action restrictions)"""
        if self.last_action is None:
            return True
        
        if action == Action.MOVE and self.last_action == Action.MOVE:
            return False
        
        if action == Action.DEFEND and self.last_action == Action.DEFEND:
            return False

        if action == Action.LOGIC_BURST and self.logic_burst_charge < 3:
            return False

        if action == Action.ELEMENTAL_BEAM and self.elemental_beam_used:
            return False
        
        return True


class AegisAgent(Agent):
    """
    AEGIS - Strategic AI (Blue Agent)
    
    Maze Phase: Uses A* Search with Manhattan distance heuristic, avoids traps
    Combat Phase: Uses Minimax with Alpha-Beta Pruning for optimal decisions
    """
    
    def __init__(self, position: Tuple[int, int]):
        super().__init__("AEGIS", "A", position, "Blue")
        self.pathfinder = None  # Will be set by game controller
        self.minimax_depth = 2  # Depth for minimax search
    
    def decide_maze_move(self, maze: Maze) -> Tuple[int, int]:
        """Decide next move in maze phase using A* with trap avoidance.
        Each bot navigates its own private maze copy, so no opponent blocking needed."""
        entry = maze.arena_entry
        path = self.pathfinder.find_path(
            self.position,
            entry,
            avoid_traps=True,
        )

        if len(path) > 1:
            return path[1]  # Return next step

        # Fallback: Greedy move toward entry if no A* path found
        neighbors = maze.get_neighbors(self.position[0], self.position[1], maze_phase=True)
        if neighbors:
            return min(neighbors, key=lambda n: abs(n[0] - entry[0]) + abs(n[1] - entry[1]))

        return self.position  # Stay if truly no valid moves
    
    def decide_combat_action(self, arena: Arena, opponent: 'Agent', 
                           maze: Maze) -> Tuple[Action, Optional[Tuple[int, int]]]:
        """Decide combat action using Minimax with Alpha-Beta Pruning"""
        best_action = Action.DEFEND
        best_move = None
        best_value = float('-inf')
        
        # Get all possible actions
        possible_actions = self._get_possible_combat_actions(arena, opponent, maze)
        
        if not possible_actions:
            return Action.DEFEND, None
        
        # Evaluate each action using minimax
        for action, move in possible_actions:
            value = self._minimax_evaluate(action, move, opponent, arena, maze,
                                         depth=self.minimax_depth, alpha=float('-inf'),
                                         beta=float('inf'), maximizing=False)
            
            if value > best_value:
                best_value = value
                best_action = action
                best_move = move
        
        return best_action, best_move
    
    def _get_possible_combat_actions(self, arena: Arena, opponent: 'Agent',
                                    maze: Maze) -> List[Tuple[Action, Optional[Tuple[int, int]]]]:
        """Get all valid actions in current combat state"""
        actions = []
        
        # Move action
        if self.can_perform_action(Action.MOVE):
            for neighbor in maze.get_neighbors(self.position[0], self.position[1]):
                if neighbor != opponent.position and maze.is_arena_cell(neighbor[0], neighbor[1]):
                    actions.append((Action.MOVE, neighbor))
        
        # Pulse Strike
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.PULSE_STRIKE):
            actions.append((Action.PULSE_STRIKE, None))
        
        # Logic Burst
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.LOGIC_BURST):
            actions.append((Action.LOGIC_BURST, None))

        # Elemental Beam
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.ELEMENTAL_BEAM):
            actions.append((Action.ELEMENTAL_BEAM, None))

        # Defend
        if self.can_perform_action(Action.DEFEND):
            actions.append((Action.DEFEND, None))
        
        return actions
    
    def _minimax_evaluate(self, action: Action, move: Optional[Tuple[int, int]],
                         opponent: 'Agent', arena: Arena, maze: Maze,
                         depth: int, alpha: float, beta: float, maximizing: bool) -> float:
        """
        Minimax with Alpha-Beta Pruning evaluation
        
        Evaluates game state assuming both players play optimally
        """
        # Create copies to simulate the action
        sim_self = deepcopy(self)
        sim_opponent = deepcopy(opponent)

        # Simulate the action
        if action == Action.MOVE:
            sim_self.move(move)
        elif action == Action.PULSE_STRIKE:
            sim_self.pulse_strike(sim_opponent)
        elif action == Action.LOGIC_BURST:
            sim_self.logic_burst(sim_opponent)
        elif action == Action.ELEMENTAL_BEAM:
            sim_self.elemental_beam(sim_opponent)
        elif action == Action.DEFEND:
            sim_self.defend()

        # Base case: evaluate current state
        if depth == 0 or not sim_self.is_alive() or not sim_opponent.is_alive():
            return sim_self._evaluate_combat_state(sim_opponent)
        
        if maximizing:
            max_eval = float('-inf')
            actions = sim_self._get_possible_combat_actions(arena, sim_opponent, maze)
            
            if not actions:
                return sim_self._evaluate_combat_state(sim_opponent)
            
            for act, mv in actions:
                eval_score = sim_self._minimax_evaluate(act, mv, sim_opponent, arena, maze, depth - 1, alpha, beta, False)
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                
                if beta <= alpha:
                    break  # Alpha-Beta pruning
            
            return max_eval
        else:
            # Opponent's turn - just evaluate their best greedy move
            min_eval = float('inf')
            
            # Opponent attempts to get the best state for themselves
            opponent_actions = sim_opponent._get_possible_combat_actions(arena, sim_self, maze)
            
            if not opponent_actions:
                return sim_self._evaluate_combat_state(sim_opponent)

            for act, mv in opponent_actions:
                # Simulate opponent's action
                test_self = deepcopy(sim_self)
                test_opponent = deepcopy(sim_opponent)
                
                if act == Action.MOVE:
                    test_opponent.move(mv)
                elif act == Action.PULSE_STRIKE:
                    test_opponent.pulse_strike(test_self)
                elif act == Action.LOGIC_BURST:
                    test_opponent.logic_burst(test_self)
                elif act == Action.ELEMENTAL_BEAM:
                    test_opponent.elemental_beam(test_self)
                elif act == Action.DEFEND:
                    test_opponent.defend()
                
                # Evaluate the resulting state from our perspective
                eval_score = test_self._evaluate_combat_state(test_opponent)
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            
            return min_eval

    def _evaluate_combat_state(self, opponent: 'Agent') -> float:
        """
        Heuristic evaluation function for combat state
        
        Factors:
        - HP difference (most important)
        - Distance to opponent (heavily prefer being adjacent for attacks)
        - Charge readiness
        - Elemental Beam availability
        """
        if not self.is_alive():
            return float('-inf')
        if not opponent.is_alive():
            return float('inf')

        # HP difference (heavily weighted)
        hp_diff = self.hp - opponent.hp
        hp_score = hp_diff * 3.0
        
        # Distance to opponent (HEAVILY penalize if not adjacent)
        distance = abs(self.position[0] - opponent.position[0]) + \
                  abs(self.position[1] - opponent.position[1])
        
        # Much higher penalty for being far away (but still adjacent = distance 1)
        if distance == 0:
            distance_score = 100.0  # Same spot (shouldn't happen but huge bonus)
        elif distance == 1:
            distance_score = 50.0  # Adjacent - HUGE bonus for attack opportunity
        else:
            distance_score = -distance * 5.0  # Much higher penalty for being distant
        
        # Logic Burst ready
        logic_burst_score = 10.0 if self.logic_burst_charge == 3 else self.logic_burst_charge * 2.0

        # Elemental Beam availability (only valuable if adjacent!)
        elemental_beam_score = 25.0 if (not self.elemental_beam_used and distance == 1) else (5.0 if not self.elemental_beam_used else 0)
        
        # Add some randomness to make the game less predictable
        random_factor = random.uniform(-3, 3)

        total = hp_score + distance_score + logic_burst_score + elemental_beam_score + random_factor
        return total


class VeloAgent(Agent):
    """
    VELO - Aggressive AI (Red Agent)
    
    Maze Phase: Uses Uniform Cost Search (shortest path, may take risks through traps)
    Combat Phase: Uses Greedy Heuristic Strategy (immediate advantage-seeking)
    """
    
    def __init__(self, position: Tuple[int, int]):
        super().__init__("VELO", "V", position, "Red")
        self.pathfinder = None  # Will be set by game controller (UCS)
    
    def decide_maze_move(self, maze: Maze) -> Tuple[int, int]:
        """Decide next move in maze using Uniform Cost Search (aggressive shortest path).
        Each bot navigates its own private maze copy, so no opponent blocking needed."""
        entry = maze.arena_entry
        path = self.pathfinder.find_path(
            self.position,
            entry,
        )

        if len(path) > 1:
            return path[1]  # Return next step

        # Fallback: Greedy move toward entry if no UCS path found
        neighbors = maze.get_neighbors(self.position[0], self.position[1], maze_phase=True)
        if neighbors:
            return min(neighbors, key=lambda n: abs(n[0] - entry[0]) + abs(n[1] - entry[1]))

        return self.position  # Stay if truly no valid moves
    
    def decide_combat_action(self, arena: Arena, opponent: 'Agent',
                           maze: Maze) -> Tuple[Action, Optional[Tuple[int, int]]]:
        """
        Decide combat action using Greedy Heuristic Strategy
        
        Greedy strategy prioritizes:
        1. Finishing blow with any attack.
        2. Using powerful attacks when available.
        3. Basic attacks if adjacent.
        4. Defensive moves when at a disadvantage.
        5. Positioning.
        """
        is_adjacent = self.is_adjacent(opponent.position)
        
        # 1. Elemental Beam: High priority, one-time use
        if self.can_perform_action(Action.ELEMENTAL_BEAM) and is_adjacent:
            # Use if it's a finishing move or opponent is high on health
            if opponent.hp <= ELEMENTAL_BEAM_DAMAGE or opponent.hp > 60:
                return Action.ELEMENTAL_BEAM, None

        # 2. Logic Burst: Use when charged
        if self.can_perform_action(Action.LOGIC_BURST) and is_adjacent:
            return Action.LOGIC_BURST, None

        # 3. Pulse Strike: Reliable damage
        if self.can_perform_action(Action.PULSE_STRIKE) and is_adjacent:
            return Action.PULSE_STRIKE, None

        # 4. Defend: If low on health or opponent is about to use a strong attack
        if self.can_perform_action(Action.DEFEND):
            if self.hp < 40 or (opponent.logic_burst_charge >= 2 and is_adjacent):
                return Action.DEFEND, None

        # 5. Move: If not adjacent, get closer. If adjacent and need to reposition, move.
        if self.can_perform_action(Action.MOVE):
            best_move = self._find_best_move_towards(opponent.position, arena, maze)
            if best_move and best_move != self.position:
                return Action.MOVE, best_move

        # 6. Default action if nothing else is suitable
        if self.can_perform_action(Action.DEFEND):
            return Action.DEFEND, None
        
        # Last resort
        return Action.PULSE_STRIKE, None
    
    def _find_best_move_towards(self, target: Tuple[int, int], arena: Arena,
                               maze: Maze) -> Optional[Tuple[int, int]]:
        """Find best move to get closer to target"""
        best_move = None
        best_distance = float('inf')
        
        for neighbor in maze.get_neighbors(self.position[0], self.position[1]):
            if maze.is_arena_cell(neighbor[0], neighbor[1]):
                distance = abs(neighbor[0] - target[0]) + abs(neighbor[1] - target[1])
                if distance < best_distance:
                    best_distance = distance
                    best_move = neighbor
        
        return best_move
    
    def _get_possible_combat_actions(self, arena: Arena, opponent: 'Agent',
                                    maze: Maze) -> List[Tuple[Action, Optional[Tuple[int, int]]]]:
        """Get all valid actions in current combat state"""
        actions = []
        
        # Move action
        if self.can_perform_action(Action.MOVE):
            for neighbor in maze.get_neighbors(self.position[0], self.position[1]):
                if neighbor != opponent.position and maze.is_arena_cell(neighbor[0], neighbor[1]):
                    actions.append((Action.MOVE, neighbor))
        
        # Pulse Strike
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.PULSE_STRIKE):
            actions.append((Action.PULSE_STRIKE, None))
        
        # Logic Burst
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.LOGIC_BURST):
            actions.append((Action.LOGIC_BURST, None))

        # Elemental Beam
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.ELEMENTAL_BEAM):
            actions.append((Action.ELEMENTAL_BEAM, None))

        # Defend
        if self.can_perform_action(Action.DEFEND):
            actions.append((Action.DEFEND, None))
        
        return actions


# =============================================================================
# GAME CONTROLLER
# =============================================================================

class GameController:
    """Main game controller for Neuron Bot Wars"""
    
    def __init__(self):
        self.maze = Maze()       # Shared layout reference (used for display)
        self.aegis_maze = None   # AEGIS's private maze copy
        self.velo_maze = None    # VELO's private maze copy
        self.arena = None        # Created when entering combat phase
        self.aegis = None
        self.velo = None
        self.turn_count = 0
        self.maze_turn_count = 0
        self.phase = 1  # 1 = Maze Navigation, 2 = Combat
        self.MAX_COMBAT_TURNS = 1000  # Prevent infinite loops

    def _build_valid_maze_and_spawns(self) -> Tuple[Maze, Tuple[int, int], Tuple[int, int], Dict[Tuple[int, int], List[Tuple[int, int]]]]:
        """
        Generate maze repeatedly until both spawn points have valid paths to entry.
        Also enforces spawn distance, trap-safe routes, and entry accessibility.
        """
        max_attempts = 200
        for _ in range(max_attempts):
            candidate_maze = Maze()
            valid_cells = candidate_maze.get_valid_spawn_cells(min_distance_from_entry=MIN_SPAWN_DISTANCE)
            if len(valid_cells) < 2:
                continue

            # Enforce equal Manhattan distance from arena entry for both agents.
            entry = candidate_maze.arena_entry
            distance_groups: Dict[int, List[Tuple[int, int]]] = {}
            for cell in valid_cells:
                dist = abs(cell[0] - entry[0]) + abs(cell[1] - entry[1])
                distance_groups.setdefault(dist, []).append(cell)

            same_distance_candidates = [cells for cells in distance_groups.values() if len(cells) >= 2]
            if not same_distance_candidates:
                continue

            chosen_group = random.choice(same_distance_candidates)
            spawns = random.sample(chosen_group, 2)
            valid, paths = candidate_maze.validate_paths_to_entry(spawns)
            if not valid:
                continue

            # Verify entry is accessible (has at least one walkable neighbor).
            entry_neighbors = candidate_maze._get_entry_neighbors()
            if not entry_neighbors:
                continue

            # Keep guaranteed routes and spawn cells trap-free.
            protected_cells: Set[Tuple[int, int]] = set(spawns)
            protected_cells.add(candidate_maze.arena_entry)
            protected_cells.update(entry_neighbors)  # Protect entry neighbors
            for path in paths.values():
                protected_cells.update(path)

            candidate_maze.place_traps(protected_cells=protected_cells, trap_count=4)
            return candidate_maze, spawns[0], spawns[1], paths

        raise RuntimeError("Failed to generate a valid maze after multiple attempts.")

    def _reset_maze_phase_due_to_turn_limit(self):
        """Safety fallback: regenerate maze when navigation exceeds turn cap."""
        print("\n[WARNING] MAX MAZE TURN LIMIT REACHED. REGENERATING MAZE TO PREVENT DEADLOCK...")

        self.maze, aegis_spawn, velo_spawn, _ = self._build_valid_maze_and_spawns()
        self.aegis_maze = self.maze
        self.velo_maze = deepcopy(self.maze)
        self.aegis.position = aegis_spawn
        self.velo.position = velo_spawn
        self.aegis.in_arena = False
        self.velo.in_arena = False
        self.maze_turn_count = 0

        self.aegis.pathfinder = AStarPathfinder(self.aegis_maze)
        self.velo.pathfinder = UniformCostSearch(self.velo_maze)

        print(f"   New AEGIS spawn: {self.aegis.position}")
        print(f"   New VELO spawn: {self.velo.position}")
        print(f"   Arena entry remains at: {self.maze.arena_entry}")
    
    def initialize_game(self):
        """Initialize game with agents spawned in maze"""
        print("\n" + "=" * 60)
        print(" " * 15 + "NEURON BOT WARS")
        print(" " * 12 + "AI vs AI Simulation")
        print("=" * 60)
        print("\n[GAME] Initializing...")
        print("\n[RULES] Game Rules:")
        print("  • Phase 1: Navigate maze to reach arena entry point")
        print("  • Phase 2: Combat in 3×3 arena until one agent wins")
        print("  • Traps deal 10 HP damage")
        print("  • Pulse Strike: 10 damage")
        print("  • Logic Burst: 20 damage (3 turns to charge)")
        print("  • Elemental Beam: 30 damage (once per game)")
        print("  • Defend reduces damage by 80%")
        
        # Build a maze that guarantees valid paths from both spawns to entry.
        # Each bot gets its own private deepcopy so they navigate independently.
        self.maze, aegis_spawn, velo_spawn, _ = self._build_valid_maze_and_spawns()
        self.aegis_maze = self.maze
        self.velo_maze = deepcopy(self.maze)

        self.aegis = AegisAgent(aegis_spawn)
        self.aegis.pathfinder = AStarPathfinder(self.aegis_maze)

        self.velo = VeloAgent(velo_spawn)
        self.velo.pathfinder = UniformCostSearch(self.velo_maze)
        
        print(f"\n[BOT] AEGIS ({self.aegis.color}) spawned at: {self.aegis.position}")
        print(f"   Strategy: A* pathfinding (avoids traps) + Minimax combat")
        print(f"\n[BOT] VELO ({self.velo.color}) spawned at: {self.velo.position}")
        print(f"   Strategy: Uniform Cost Search (risky) + Greedy combat")
        
        print(f"\n[TARGET] Arena Entry Point: {self.maze.arena_entry}")
        
        print("\n" + "-" * 60)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 60)
        print("Objective: Reach the arena entry point (E)")
        print("Legend: . = path, # = wall, T = trap, E = entry")
        
        self.maze.display(self.aegis.position, self.velo.position, phase=1,
                         agent1_in_arena=self.aegis.in_arena, agent2_in_arena=self.velo.in_arena)
    
    def _wait_for_enter(self, message: str = "Press Enter to continue..."):
        """Pause execution until the user presses Enter."""
        try:
            input(f"\n[PAUSE] {message}")
        except EOFError:
            print("\n[PAUSE] Input unavailable. Continuing automatically...")

    def _ask_continue_after_match(self, current_match: int, max_matches: int) -> bool:
        """Ask whether to continue to the next match or end the series early."""
        while True:
            try:
                choice = input(
                    f"\n[MATCH MENU] Match {current_match} of {max_matches} complete. "
                    "Press Enter to play the next match or type 'end' to stop the series: "
                ).strip().lower()
            except EOFError:
                print("\n[MATCH MENU] Input unavailable. Ending the series.")
                return False

            if choice == "":
                return True
            if choice in {"end", "e", "stop", "quit", "q"}:
                return False

            print("[ERROR] Invalid choice. Press Enter to continue or type 'end' to stop.")

    def run(self):
        """Main game loop for up to 5 matches with optional early stop after each match."""
        aegis_wins = 0
        velo_wins = 0
        draws = 0
        max_matches = 5

        for i in range(max_matches):
            print(f"\n\n{'#' * 60}")
            print(f"MATCH {i + 1} of {max_matches}")
            print(f"{'#' * 60}")
            self.phase = 1
            self.turn_count = 0
            self.maze_turn_count = 0

            winner = self.run_match()

            if winner == "AEGIS":
                aegis_wins += 1
            elif winner == "VELO":
                velo_wins += 1
            elif winner == "DRAW":
                draws += 1

            matches_played = i + 1

            if matches_played < max_matches:
                should_continue = self._ask_continue_after_match(matches_played, max_matches)
                if not should_continue:
                    break

        print("\n" + "=" * 60)
        print(" " * 20 + "FINAL SCORE")
        print("=" * 60)
        print(f"Matches played: {matches_played}")
        print(f"AEGIS: {aegis_wins} wins")
        print(f"VELO: {velo_wins} wins")
        print(f"Draws: {draws}")
        if aegis_wins > velo_wins:
            print("\n[FINAL] AEGIS is the overall winner!")
        elif velo_wins > aegis_wins:
            print("\n[FINAL] VELO is the overall winner!")
        else:
            print("\n[FINAL] It's a draw!")

    def run_match(self):
        """Runs a single match."""
        self.initialize_game()
        
        # Phase 1: Maze Navigation
        while self.phase == 1:
            self._run_maze_turn()

        # Transition to combat
        self._transition_to_combat()
        
        # Phase 2: Combat
        while self.phase == 2:
            # Check for combat turn limit
            if self.turn_count - self.maze_turn_count > self.MAX_COMBAT_TURNS:
                print(f"\n[TIMEOUT] Match exceeded {self.MAX_COMBAT_TURNS} combat turns. Declaring draw!")
                print(f"AEGIS HP: {self.aegis.hp}")
                print(f"VELO HP: {self.velo.hp}")
                if self.aegis.hp > self.velo.hp:
                    return self._announce_winner(self.aegis)
                elif self.velo.hp > self.aegis.hp:
                    return self._announce_winner(self.velo)
                else:
                    print("\n[DRAW] Both agents survived with equal HP!")
                    self.phase = 3
                    return "DRAW"
            
            self._run_combat_turn()
            
            # Check win conditions
            if not self.aegis.is_alive():
                return self._announce_winner(self.velo)
            elif not self.velo.is_alive():
                return self._announce_winner(self.aegis)
        return None

    def _run_maze_turn(self):
        """Execute one turn of maze navigation.
        AEGIS and VELO each navigate their own private maze copy so they never block each other."""
        self.turn_count += 1
        self.maze_turn_count += 1

        if self.maze_turn_count > MAX_MAZE_TURNS:
            self._reset_maze_phase_due_to_turn_limit()

        print(f"\n{'=' * 60}")
        print(f"TURN {self.turn_count} - MAZE PHASE")
        print(f"{'=' * 60}")

        # --- AEGIS moves on its own maze copy ---
        if not self.aegis.in_arena:
            planned_aegis = self.aegis.decide_maze_move(self.aegis_maze)
            print(f"\n[BLUE] {self.aegis.name}'s turn:")
            print(f"   Current position: {self.aegis.position}")
            self.aegis.move(planned_aegis)
            print(f"   -> Moved to {planned_aegis} (using A* pathfinding)")

            if self.aegis_maze.is_trap(planned_aegis[0], planned_aegis[1]):
                self.aegis.take_damage(TRAP_DAMAGE)
                print(f"   [TRAP] {self.aegis.name} takes {TRAP_DAMAGE} HP damage")
                print(f"   HP: {self.aegis.hp}")

            if planned_aegis == self.aegis_maze.arena_entry:
                self.aegis.in_arena = True
                print(f"   [SUCCESS] {self.aegis.name} has reached the ARENA ENTRY!")

        # --- VELO moves on its own maze copy ---
        if not self.velo.in_arena:
            planned_velo = self.velo.decide_maze_move(self.velo_maze)
            print(f"\n[RED] {self.velo.name}'s turn:")
            print(f"   Current position: {self.velo.position}")
            self.velo.move(planned_velo)
            print(f"   -> Moved to {planned_velo} (using Uniform Cost Search)")

            if self.velo_maze.is_trap(planned_velo[0], planned_velo[1]):
                self.velo.take_damage(TRAP_DAMAGE)
                print(f"   [TRAP] {self.velo.name} takes {TRAP_DAMAGE} HP damage")
                print(f"   HP: {self.velo.hp}")

            if planned_velo == self.velo_maze.arena_entry:
                self.velo.in_arena = True
                print(f"   [SUCCESS] {self.velo.name} has reached the ARENA ENTRY!")

        # Display shared maze layout with both agents' positions
        self.maze.display(self.aegis.position, self.velo.position, phase=1,
                         agent1_in_arena=self.aegis.in_arena, agent2_in_arena=self.velo.in_arena)
        self._wait_for_enter("Press Enter for the next turn...")

        # Check if both entered arena
        if self.aegis.in_arena and self.velo.in_arena:
            self.phase = 2
    
    def _transition_to_combat(self):
        """Transition from maze to combat phase"""
        print("\n" + "=" * 60)
        print("===== MAZE PHASE COMPLETE =====")
        print("===== ENTERING BATTLE ARENA =====")
        print("=" * 60)
        
        # Create arena
        self.arena = Arena()
        
        # Move agents to arena starting positions (corners)
        arena_corners = [
            (ARENA_START, ARENA_START),      # Top-left
            (ARENA_END, ARENA_END),          # Bottom-right
        ]
        
        self.aegis.move(arena_corners[0])
        self.velo.move(arena_corners[1])
        
        print(f"\n [HEALTH] {self.aegis.name} HP: {self.aegis.hp}")
        print(f" [HEALTH] {self.velo.name} HP: {self.velo.hp}")
        
        print(f"\n[ITEMS] Arena Items:")
        if self.arena.items:
            for pos, item in self.arena.items.items():
                global_pos = (pos[0] + ARENA_START, pos[1] + ARENA_START)
                print(f"   [{item.value}] at {global_pos}")
        else:
            print("   No items in arena")
        
        print("\n" + "-" * 60)
        print("PHASE 2: COMBAT")
        print("-" * 60)
        print("Turn-based combat begins!")
        print("Actions: Move, Defend, Pulse Strike, Logic Burst, Elemental Beam")
        print("Restriction: Cannot repeat Move or Defend consecutively")
        
        self.arena.display(self.aegis.position, self.velo.position)
        self._wait_for_enter("Press Enter for the next turn...")
    
    def _run_combat_turn(self):
        """Execute one turn of combat"""
        self.turn_count += 1
        print(f"\n{'=' * 60}")
        print(f"TURN {self.turn_count} - COMBAT PHASE")
        print(f"{'=' * 60}")
        
        # Increment logic burst charge
        if self.aegis.logic_burst_charge < 3:
            self.aegis.logic_burst_charge += 1
        if self.velo.logic_burst_charge < 3:
            self.velo.logic_burst_charge += 1

        # Display status
        aegis_status = []
        if self.aegis.is_defending:
            aegis_status.append('DEFENDING')
        if self.aegis.has_powerup:
            aegis_status.append('HAS POWERUP')
        if self.aegis.last_action:
            aegis_status.append(f'Last: {self.aegis.last_action.value}')
        aegis_status.append(f'Logic Burst: {self.aegis.logic_burst_charge}/3')
        
        velo_status = []
        if self.velo.is_defending:
            velo_status.append('DEFENDING')
        if self.velo.has_powerup:
            velo_status.append('HAS POWERUP')
        if self.velo.last_action:
            velo_status.append(f'Last: {self.velo.last_action.value}')
        velo_status.append(f'Logic Burst: {self.velo.logic_burst_charge}/3')

        print(f"\n [AEGIS] HP: {self.aegis.hp}/100 {('[' + ', '.join(aegis_status) + ']') if aegis_status else ''}")
        print(f" [VELO] HP: {self.velo.hp}/100 {('[' + ', '.join(velo_status) + ']') if velo_status else ''}")
        
        # AEGIS turn
        if self.aegis.is_alive():
            print(f"\n[AEGIS] Turn (Minimax AI):")
            print(f"   Position: {self.aegis.position}")
            action, move = self.aegis.decide_combat_action(self.arena, self.velo, self.maze)
            self._execute_combat_action(self.aegis, self.velo, action, move)
            self._check_and_spawn_battle_items()

        if not self.velo.is_alive():
            return

        # VELO turn
        if self.velo.is_alive():
            print(f"\n[VELO] Turn (Greedy AI):")
            print(f"   Position: {self.velo.position}")
            action, move = self.velo.decide_combat_action(self.arena, self.aegis, self.maze)
            self._execute_combat_action(self.velo, self.aegis, action, move)
            self._check_and_spawn_battle_items()

        self.arena.display(self.aegis.position, self.velo.position)
        self._wait_for_enter("Press Enter for the next turn...")

    def _execute_combat_action(self, agent: Agent, opponent: Agent, action: Action, move: Optional[Tuple[int, int]]):
        """Executes a combat action for an agent."""
        print(f"   Action: {action.value}")
        if action == Action.MOVE:
            agent.move(move)
            print(f"   -> Moved to {move}")
            # Check for item pickup
            arena_coords = self.arena.convert_to_arena_coords(move)
            if self.arena.can_pickup_item(arena_coords[0], arena_coords[1], agent.name):
                item = self.arena.get_item(arena_coords[0], arena_coords[1], agent.name)
                if item:
                    agent.pickup_item(item)
        elif action == Action.DEFEND:
            agent.defend()
            print(f"   [SHIELD] {agent.name} is defending!")
        elif action == Action.PULSE_STRIKE:
            damage = agent.pulse_strike(opponent)
            print(f"   [PULSE] {agent.name} uses Pulse Strike! Dealt {damage} damage.")
        elif action == Action.LOGIC_BURST:
            damage = agent.logic_burst(opponent)
            if damage > 0:
                print(f"   [LOGIC] {agent.name} uses Logic Burst! Dealt {damage} damage.")
            else:
                print(f"   [LOGIC] Logic Burst not charged!")
        elif action == Action.ELEMENTAL_BEAM:
            damage = agent.elemental_beam(opponent)
            if damage > 0:
                print(f"   [BEAM] {agent.name} uses Elemental Beam! Dealt {damage} damage.")
            else:
                print(f"   [BEAM] Elemental Beam already used!")
        
        agent.last_action = action

    def _check_and_spawn_battle_items(self):
        """Spawns items if agents are low on health."""
        occupied = {self.aegis.position, self.velo.position}
        if self.aegis.hp < 50 or self.velo.hp < 50:
            if not self.arena.health_spawned:
                if self.arena.spawn_health_pack(occupied):
                    print("\n[SPAWN] A MedKit has appeared in the arena!")
            if not self.arena.powerup_spawned:
                if self.arena.spawn_powerup(occupied):
                    print("\n[SPAWN] A Power Up has appeared in the arena!")

    def _announce_winner(self, winner: Agent):
        """Announces the winner of the game."""
        print("\n" + "=" * 60)
        print(" " * 20 + "GAME OVER")
        print("=" * 60)
        print(f"\n[WINNER] The winner is {winner.name} ({winner.color})!")
        print(f"   Remaining HP: {winner.hp}")
        self.phase = 3 # End of game
        return winner.name

    def _check_and_spawn_battle_items(self):
        """
        Spawn one-time battle items when any agent reaches half HP.
        
        Power-up behavior:
        - Spawns only ONCE when any agent reaches 50 HP or less
        - Only the first agent to move onto the power-up cell can grab it
        - Once grabbed, the item is immediately removed (powerup_taken = True)
        - If second agent later reaches 50 HP, no additional power-up spawns
        """
        half_hp = INITIAL_HP // 2
        if self.aegis.hp > half_hp and self.velo.hp > half_hp:
            return

        occupied = {self.aegis.position, self.velo.position}

        if not self.arena.powerup_spawned:
            if self.arena.spawn_powerup(occupied_global_positions=occupied):
                print("\n[POWER] POWER UP HAS SPAWNED IN THE ARENA! (Grab it before your opponent!)")

        if not self.arena.health_spawned:
            if self.arena.spawn_health_pack(occupied_global_positions=occupied):
                print("\n[HEALTH] HEALTH POWER UP HAS SPAWNED IN THE ARENA! (One agent only!)")
    
    
    def _announce_winner(self, winner: Agent):
        """Announces the winner of the game."""
        print("\n" + "=" * 60)
        print(" " * 20 + "GAME OVER")
        print("=" * 60)
        print(f"\n[WINNER] The winner is {winner.name} ({winner.color})!")
        print(f"   Remaining HP: {winner.hp}")
        self.phase = 3 # End of game
        return winner.name


def main():
    """Main entry point for Neuron Bot Wars"""
    random.seed()  # Use random seed for varied gameplay
    game = GameController()
    game.run()


if __name__ == "__main__":
    main()
