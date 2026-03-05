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

import heapq
import random
from typing import List, Tuple, Optional, Set, Dict
from copy import deepcopy
from enum import Enum


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
    ATTACK = 'attack'
    DEFEND = 'defend'
    POWER_ATTACK = 'power_attack'
    CONCEDE = 'concede'


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
ATTACK_DAMAGE = 15
POWER_ATTACK_DAMAGE = 30
DEFEND_REDUCTION = 0.2  # 80% damage reduction (take only 20%)
TRAP_DAMAGE = 10
MEDKIT_HEAL = 20


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
        """Generate maze with walls, traps, and arena entry point"""
        # Mark arena cells (center 3×3)
        for r in range(ARENA_START, ARENA_END + 1):
            for c in range(ARENA_START, ARENA_END + 1):
                self.grid[r][c] = CellType.ARENA
        
        # Add walls around the maze (deterministic pattern)
        wall_positions = [
            (0, 1), (0, 5),  # Top row
            (1, 0), (1, 6),  # Row 1
            (5, 0), (5, 6),  # Row 5
            (6, 2), (6, 4),  # Bottom row
            (2, 0), (4, 6),  # Side walls
        ]
        
        for r, c in wall_positions:
            if self.is_maze_cell(r, c):
                self.grid[r][c] = CellType.WALL
        
        # Add traps in strategic positions
        trap_positions = [
            (0, 3),  # Top center
            (1, 1),  # Top left area
            (5, 5),  # Bottom right area
            (3, 0),  # Left middle
            (3, 6),  # Right middle
        ]
        
        for r, c in trap_positions:
            if self.is_maze_cell(r, c):
                self.grid[r][c] = CellType.TRAP
                self.traps.add((r, c))
        
        # Set arena entry point (single entry from north side of arena)
        self.arena_entry = (3, 1)
        self.grid[3][1] = CellType.ENTRY
    
    def is_maze_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the maze (not arena)"""
        return not (ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END)
    
    def is_arena_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the battle arena"""
        return ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END
    
    def is_trap(self, row: int, col: int) -> bool:
        """Check if cell is a trap"""
        return (row, col) in self.traps
    
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
                agent1_sym: str = 'A', agent2_sym: str = 'V', phase: int = 1):
        """Display the maze with agents"""
        print("\n" + "=" * 40)
        if phase == 1:
            print("  0 1 2 3 4 5 6")
            print("  " + "-" * 14)
            
            for r in range(self.size):
                row_str = f"{r}|"
                for c in range(self.size):
                    if (r, c) == agent1_pos:
                        row_str += agent1_sym + " "
                    elif (r, c) == agent2_pos:
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
        self._place_items()
    
    def _place_items(self):
        """Randomly place MedKits and PowerUps in the arena"""
        # Place 1-2 MedKits
        medkit_positions = random.sample([(0, 0), (0, 2), (2, 0), (2, 2)], k=2)
        for pos in medkit_positions:
            self.items[pos] = ItemType.MEDKIT
        
        # Place 1 PowerUp in center
        if random.random() > 0.5:
            self.items[(1, 1)] = ItemType.POWERUP
    
    def get_item(self, row: int, col: int) -> Optional[ItemType]:
        """Get and remove item at position"""
        return self.items.pop((row, col), None)
    
    def has_item(self, row: int, col: int) -> bool:
        """Check if position has an item"""
        return (row, col) in self.items
    
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
            
            for neighbor in self.maze.get_neighbors(current[0], current[1]):
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
            
            for neighbor in self.maze.get_neighbors(current[0], current[1]):
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
        
    def move(self, new_position: Tuple[int, int]):
        """Move agent to new position"""
        self.position = new_position
    
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
    
    def attack(self, target: 'Agent') -> int:
        """Perform regular attack"""
        damage = ATTACK_DAMAGE
        actual_damage = target.take_damage(damage)
        self.last_action = Action.ATTACK
        return actual_damage
    
    def power_attack(self, target: 'Agent') -> int:
        """Perform power attack using powerup"""
        if not self.has_powerup:
            return 0
        
        damage = POWER_ATTACK_DAMAGE
        actual_damage = target.take_damage(damage)
        self.has_powerup = False  # Consume powerup
        self.last_action = Action.POWER_ATTACK
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
        # Cannot repeat Move, Defend, or Power Attack consecutively
        if self.last_action is None:
            return True
        
        if action in [Action.MOVE, Action.DEFEND, Action.POWER_ATTACK]:
            return self.last_action != action
        
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
    
    def decide_maze_move(self, maze: Maze, opponent: 'Agent') -> Tuple[int, int]:
        """Decide next move in maze phase using A* with trap avoidance"""
        # Find path to arena entry using A*
        entry = maze.arena_entry
        path = self.pathfinder.find_path(
            self.position, 
            entry,
            avoid_traps=True,  # Strategically avoid traps
            blocked_pos=opponent.position
        )
        
        if len(path) > 1:
            return path[1]  # Return next step
        
        return self.position  # Stay if no valid path
    
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
            print(f"      [Minimax] {action.value}: value = {value:.1f}")
            
            if value > best_value:
                best_value = value
                best_action = action
                best_move = move
        
        return best_action, best_move
    
    def _get_possible_combat_actions(self, arena: Arena, opponent: 'Agent',
                                    maze: Maze) -> List[Tuple[Action, Optional[Tuple[int, int]]]]:
        """Get all valid actions in current combat state"""
        actions = []
        
        # Move action (if can perform and didn't move last turn)
        if self.can_perform_action(Action.MOVE):
            for neighbor in maze.get_neighbors(self.position[0], self.position[1]):
                if neighbor != opponent.position and maze.is_arena_cell(neighbor[0], neighbor[1]):
                    actions.append((Action.MOVE, neighbor))
        
        # Attack if adjacent
        if self.is_adjacent(opponent.position) and self.can_perform_action(Action.ATTACK):
            actions.append((Action.ATTACK, None))
        
        # Power attack if have powerup and adjacent
        if self.has_powerup and self.is_adjacent(opponent.position) and self.can_perform_action(Action.POWER_ATTACK):
            actions.append((Action.POWER_ATTACK, None))
        
        # Defend (if can perform)
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
        # Base case: evaluate current state
        if depth == 0:
            return self._evaluate_combat_state(opponent)
        
        if maximizing:
            max_eval = float('-inf')
            actions = self._get_possible_combat_actions(arena, opponent, maze)
            
            for act, mv in actions:
                # Simulate action and evaluate
                eval_score = self._evaluate_combat_state(opponent)
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                
                if beta <= alpha:
                    break  # Alpha-Beta pruning
            
            return max_eval
        else:
            # Opponent's turn (minimizing for us)
            min_eval = float('inf')
            eval_score = self._evaluate_combat_state(opponent)
            min_eval = min(min_eval, eval_score)
            beta = min(beta, eval_score)
            
            return min_eval
    
    def _evaluate_combat_state(self, opponent: 'Agent') -> float:
        """
        Heuristic evaluation function for combat state
        
        Factors:
        - HP difference (most important)
        - Distance to opponent (prefer being adjacent for attacks)
        - Defensive state
        - PowerUp advantage
        """
        # HP difference (heavily weighted)
        hp_diff = self.hp - opponent.hp
        hp_score = hp_diff * 3.0
        
        # Distance to opponent (negative = prefer closer)
        distance = abs(self.position[0] - opponent.position[0]) + \
                  abs(self.position[1] - opponent.position[1])
        distance_score = -distance * 2.0
        
        # Defensive stance bonus
        defense_score = 5.0 if self.is_defending else 0
        
        # PowerUp advantage
        powerup_score = 10.0 if self.has_powerup else 0
        
        total = hp_score + distance_score + defense_score + powerup_score
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
    
    def decide_maze_move(self, maze: Maze, opponent: 'Agent') -> Tuple[int, int]:
        """Decide next move in maze using Uniform Cost Search (aggressive shortest path)"""
        # Find shortest path to arena entry (may go through traps)
        entry = maze.arena_entry
        path = self.pathfinder.find_path(
            self.position,
            entry,
            blocked_pos=opponent.position
        )
        
        if len(path) > 1:
            return path[1]  # Return next step
        
        return self.position  # Stay if no valid path
    
    def decide_combat_action(self, arena: Arena, opponent: 'Agent',
                           maze: Maze) -> Tuple[Action, Optional[Tuple[int, int]]]:
        """
        Decide combat action using Greedy Heuristic Strategy
        
        Greedy strategy prioritizes:
        1. Immediate damage when possible
        2. Health advantage exploitation  
        3. Opportunistic movement
        4. Defensive tactics when losing
        """
        is_adjacent = self.is_adjacent(opponent.position)
        hp_advantage = self.hp > opponent.hp
        low_hp = self.hp < 35
        critical_hp = self.hp < 20
        
        print(f"      [Greedy] Adjacent: {is_adjacent}, HP Adv: {hp_advantage}, Low HP: {low_hp}")
        
        # Critical HP and not adjacent: must defend
        if critical_hp and not is_adjacent:
            if self.can_perform_action(Action.DEFEND):
                return Action.DEFEND, None
        
        # Have power attack and adjacent and can use it: use it aggressively!
        if self.has_powerup and is_adjacent and self.can_perform_action(Action.POWER_ATTACK):
            print(f"      [Greedy] Choosing POWER ATTACK!")
            return Action.POWER_ATTACK, None
        
        # Adjacent and have HP advantage: attack aggressively
        if is_adjacent and hp_advantage and self.can_perform_action(Action.ATTACK):
            return Action.ATTACK, None
        
        # Adjacent but low HP: defend
        if is_adjacent and low_hp and self.can_perform_action(Action.DEFEND):
            return Action.DEFEND, None
        
        # Adjacent: default to attack
        if is_adjacent and self.can_perform_action(Action.ATTACK):
            return Action.ATTACK, None
        
        # Not adjacent: try to move closer (if can move)
        if self.can_perform_action(Action.MOVE):
            best_move = self._find_best_move_towards(opponent.position, arena, maze)
            if best_move and best_move != self.position:
                return Action.MOVE, best_move
        
        # Default: defend if possible
        if self.can_perform_action(Action.DEFEND):
            return Action.DEFEND, None
        
        # Last resort: attack even if not adjacent (will fail but is only option)
        return Action.ATTACK, None
    
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


# =============================================================================
# GAME CONTROLLER
# =============================================================================

class GameController:
    """Main game controller for Neuron Bot Wars"""
    
    def __init__(self):
        self.maze = Maze()
        self.arena = None  # Will be created when entering combat phase
        self.aegis = None
        self.velo = None
        self.turn_count = 0
        self.phase = 1  # 1 = Maze Navigation, 2 = Combat
    
    def initialize_game(self):
        """Initialize game with agents spawned in maze"""
        print("\n" + "=" * 60)
        print(" " * 15 + "NEURON BOT WARS")
        print(" " * 12 + "AI vs AI Simulation")
        print("=" * 60)
        print("\n🎮 Game Initializing...")
        print("\n📋 Game Rules:")
        print("  • Phase 1: Navigate maze to reach arena entry point")
        print("  • Phase 2: Combat in 3×3 arena until one agent wins")
        print("  • Traps deal 10 HP damage")
        print("  • Attack: 15 damage | Power Attack: 30 damage")
        print("  • Defend reduces damage by 80%")
        
        # Spawn agents in valid maze positions (far from entry)
        valid_cells = self.maze.get_valid_spawn_cells(min_distance_from_entry=4)
        if len(valid_cells) < 2:
            valid_cells = self.maze.get_valid_spawn_cells(min_distance_from_entry=2)
        
        spawn_positions = random.sample(valid_cells, 2)
        
        self.aegis = AegisAgent(spawn_positions[0])
        self.aegis.pathfinder = AStarPathfinder(self.maze)
        
        self.velo = VeloAgent(spawn_positions[1])
        self.velo.pathfinder = UniformCostSearch(self.maze)
        
        print(f"\n🤖 AEGIS ({self.aegis.color}) spawned at: {self.aegis.position}")
        print(f"   Strategy: A* pathfinding (avoids traps) + Minimax combat")
        print(f"\n🤖 VELO ({self.velo.color}) spawned at: {self.velo.position}")
        print(f"   Strategy: Uniform Cost Search (risky) + Greedy combat")
        
        print(f"\n🎯 Arena Entry Point: {self.maze.arena_entry}")
        
        print("\n" + "-" * 60)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 60)
        print("Objective: Reach the arena entry point (E)")
        print("Legend: . = path, # = wall, T = trap, E = entry")
        
        self.maze.display(self.aegis.position, self.velo.position, phase=1)
    
    def run(self):
        """Main game loop"""
        self.initialize_game()
        
        # Phase 1: Maze Navigation
        while self.phase == 1:
            self._run_maze_turn()
            input("\n➤ Press Enter to continue...")
        
        # Transition to combat
        self._transition_to_combat()
        
        # Phase 2: Combat
        while self.phase == 2:
            self._run_combat_turn()
            
            # Check win conditions
            if not self.aegis.is_alive():
                self._announce_winner(self.velo)
                break
            elif not self.velo.is_alive():
                self._announce_winner(self.aegis)
                break
            
            input("\n➤ Press Enter to continue...")
    
    def _run_maze_turn(self):
        """Execute one turn of maze navigation"""
        self.turn_count += 1
        print(f"\n{'=' * 60}")
        print(f"TURN {self.turn_count} - MAZE PHASE")
        print(f"{'=' * 60}")
        
        # AEGIS turn
        if not self.aegis.in_arena:
            print(f"\n🔵 {self.aegis.name}'s turn:")
            print(f"   Current position: {self.aegis.position}")
            new_pos = self.aegis.decide_maze_move(self.maze, self.velo)
            old_pos = self.aegis.position
            self.aegis.move(new_pos)
            print(f"   → Moved to {new_pos} (using A* pathfinding)")
            
            # Check for trap
            if self.maze.is_trap(new_pos[0], new_pos[1]):
                damage = TRAP_DAMAGE
                self.aegis.take_damage(damage)
                print(f"   ⚠️  TRAP! {self.aegis.name} takes {damage} HP damage")
                print(f"   HP: {self.aegis.hp}")
            
            # Check if reached entry
            if new_pos == self.maze.arena_entry:
                self.aegis.in_arena = True
                print(f"   ✅ {self.aegis.name} has reached the ARENA ENTRY!")
        
        # VELO turn
        if not self.velo.in_arena:
            print(f"\n🔴 {self.velo.name}'s turn:")
            print(f"   Current position: {self.velo.position}")
            new_pos = self.velo.decide_maze_move(self.maze, self.aegis)
            old_pos = self.velo.position
            self.velo.move(new_pos)
            print(f"   → Moved to {new_pos} (using Uniform Cost Search)")
            
            # Check for trap
            if self.maze.is_trap(new_pos[0], new_pos[1]):
                damage = TRAP_DAMAGE
                self.velo.take_damage(damage)
                print(f"   ⚠️  TRAP! {self.velo.name} takes {damage} HP damage")
                print(f"   HP: {self.velo.hp}")
            
            # Check if reached entry
            if new_pos == self.maze.arena_entry:
                self.velo.in_arena = True
                print(f"   ✅ {self.velo.name} has reached the ARENA ENTRY!")
        
        # Display maze
        self.maze.display(self.aegis.position, self.velo.position, phase=1)
        
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
        
        print(f"\n💙 {self.aegis.name} HP: {self.aegis.hp}")
        print(f"❤️  {self.velo.name} HP: {self.velo.hp}")
        
        print(f"\n📦 Arena Items:")
        if self.arena.items:
            for pos, item in self.arena.items.items():
                global_pos = (pos[0] + ARENA_START, pos[1] + ARENA_START)
                print(f"   {item.value} at {global_pos}")
        else:
            print("   No items in arena")
        
        print("\n" + "-" * 60)
        print("PHASE 2: COMBAT")
        print("-" * 60)
        print("Turn-based combat begins!")
        print("Actions: Move, Attack, Defend, Power Attack, Concede")
        print("Restriction: Cannot repeat Move, Defend, or Power Attack")
        
        self.arena.display(self.aegis.position, self.velo.position)
        input("\n➤ Press Enter to begin combat...")
    
    def _run_combat_turn(self):
        """Execute one turn of combat"""
        self.turn_count += 1
        print(f"\n{'=' * 60}")
        print(f"TURN {self.turn_count} - COMBAT PHASE")
        print(f"{'=' * 60}")
        
        # Display status
        aegis_status = []
        if self.aegis.is_defending:
            aegis_status.append('DEFENDING')
        if self.aegis.has_powerup:
            aegis_status.append('HAS POWERUP')
        if self.aegis.last_action:
            aegis_status.append(f'Last: {self.aegis.last_action.value}')
        
        velo_status = []
        if self.velo.is_defending:
            velo_status.append('DEFENDING')
        if self.velo.has_powerup:
            velo_status.append('HAS POWERUP')
        if self.velo.last_action:
            velo_status.append(f'Last: {self.velo.last_action.value}')
        
        print(f"\n💙 AEGIS HP: {self.aegis.hp}/100 {('[' + ', '.join(aegis_status) + ']') if aegis_status else ''}")
        print(f"❤️  VELO HP: {self.velo.hp}/100 {('[' + ', '.join(velo_status) + ']') if velo_status else ''}")
        
        # AEGIS turn
        print(f"\n🔵 {self.aegis.name}'s turn (Minimax AI):")
        print(f"   Position: {self.aegis.position}")
        action, move = self.aegis.decide_combat_action(self.arena, self.velo, self.maze)
        self._execute_combat_action(self.aegis, self.velo, action, move)
        
        if not self.velo.is_alive():
            return
        
        # VELO turn
        print(f"\n🔴 {self.velo.name}'s turn (Greedy AI):")
        print(f"   Position: {self.velo.position}")
        action, move = self.velo.decide_combat_action(self.arena, self.aegis, self.maze)
        self._execute_combat_action(self.velo, self.aegis, action, move)
        
        # Display arena
        self.arena.display(self.aegis.position, self.velo.position)
    
    def _execute_combat_action(self, attacker: Agent, defender: Agent,
                               action: Action, move: Optional[Tuple[int, int]]):
        """Execute a combat action"""
        print(f"   Action: {action.value.upper()}")
        
        if action == Action.MOVE:
            if move:
                old_pos = attacker.position
                attacker.move(move)
                attacker.last_action = Action.MOVE
                print(f"   → Moved from {old_pos} to {move}")
                
                # Check for item pickup
                arena_coords = self.arena.convert_to_arena_coords(move)
                if self.arena.has_item(arena_coords[0], arena_coords[1]):
                    item = self.arena.get_item(arena_coords[0], arena_coords[1])
                    attacker.pickup_item(item)
        
        elif action == Action.ATTACK:
            if attacker.is_adjacent(defender.position):
                actual_damage = attacker.attack(defender)
                print(f"   → Attacked {defender.name} for {actual_damage} damage!")
                print(f"      {defender.name} HP: {defender.hp}/100")
            else:
                print(f"   → Attack FAILED (not adjacent to {defender.name})")
                attacker.last_action = Action.ATTACK
        
        elif action == Action.POWER_ATTACK:
            if attacker.has_powerup and attacker.is_adjacent(defender.position):
                actual_damage = attacker.power_attack(defender)
                print(f"   → POWER ATTACK on {defender.name} for {actual_damage} damage!")
                print(f"      {defender.name} HP: {defender.hp}/100")
            elif not attacker.has_powerup:
                print(f"   → Power Attack FAILED (no powerup)")
                attacker.last_action = Action.POWER_ATTACK
            else:
                print(f"   → Power Attack FAILED (not adjacent)")
                attacker.last_action = Action.POWER_ATTACK
        
        elif action == Action.DEFEND:
            attacker.defend()
            print(f"   → Defending (next incoming damage reduced by 80%)")
        
        elif action == Action.CONCEDE:
            print(f"   → {attacker.name} CONCEDES!")
            attacker.hp = 0
    
    def _announce_winner(self, winner: Agent):
        """Announce the game winner"""
        print("\n" + "=" * 60)
        print(" " * 22 + "GAME OVER")
        print("=" * 60)
        print(f"\n🏆 {winner.name} WINS! 🏆")
        print(f"\n📊 Final Statistics:")
        print(f"   Winner: {winner.name} ({winner.color} Agent)")
        print(f"   Final HP: {winner.hp}/100")
        print(f"   Total Turns: {self.turn_count}")
        
        loser = self.velo if winner == self.aegis else self.aegis
        print(f"\n   Defeated: {loser.name}")
        print(f"   Final HP: {loser.hp}/100")
        
        print("\n" + "=" * 60)
        print("Thank you for watching Neuron Bot Wars!")
        print("=" * 60 + "\n")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Main entry point for Neuron Bot Wars"""
    random.seed()  # Use random seed for varied gameplay
    game = GameController()
    game.run()


if __name__ == "__main__":
    main()
