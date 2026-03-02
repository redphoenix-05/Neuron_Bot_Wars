"""
Neuron Bot Wars - AI vs AI Turn-Based Game
==========================================
A console-based game where two AI agents compete in a maze, then battle in an arena.

Agents:
- AEGIS (A): Uses Minimax with Alpha-Beta Pruning
- VELO (V): Uses A* Search (maze) + Greedy strategy (combat)

Game Structure:
- Phase 1: Maze Navigation (6×6 grid with outer maze and inner 4×4 arena)
- Phase 2: Combat (turn-based combat in the arena)
"""

import heapq
import random
from typing import List, Tuple, Optional, Set
from copy import deepcopy
from enum import Enum


# =============================================================================
# CONSTANTS AND ENUMS
# =============================================================================

class CellType(Enum):
    """Types of cells in the grid"""
    WALL = '#'
    PATH = '.'
    ARENA = ' '


class Action(Enum):
    """Available actions during combat"""
    MOVE = 'move'
    ATTACK = 'attack'
    DEFEND = 'defend'
    CONCEDE = 'concede'


class Direction(Enum):
    """Movement directions"""
    UP = (-1, 0)
    DOWN = (1, 0)
    LEFT = (0, -1)
    RIGHT = (0, 1)


# Game constants
GRID_SIZE = 6
ARENA_START = 1
ARENA_END = 4
FIRST_AGENT_HP = 120
SECOND_AGENT_HP = 100
BASE_ATTACK_DAMAGE = 20
DEFEND_REDUCTION = 0.5


# =============================================================================
# GRID ENVIRONMENT
# =============================================================================

class Grid:
    """Manages the game grid with maze and battle arena"""
    
    def __init__(self):
        """Initialize a 6×6 grid with maze and arena"""
        self.size = GRID_SIZE
        self.grid = [[CellType.PATH for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        self._generate_maze()
    
    def _generate_maze(self):
        """Generate maze in outer cells, keep inner 4×4 as arena"""
        # Mark arena cells (inner 4×4)
        for r in range(ARENA_START, ARENA_END + 1):
            for c in range(ARENA_START, ARENA_END + 1):
                self.grid[r][c] = CellType.ARENA
        
        # Add some walls to the maze (outer ring) deterministically
        # Top and bottom rows
        wall_positions = [
            (0, 1), (0, 4),  # Top row
            (5, 0), (5, 3), (5, 5),  # Bottom row
            (1, 0), (4, 0),  # Left column
            (2, 5), (3, 5),  # Right column
        ]
        
        for r, c in wall_positions:
            if self.is_maze_cell(r, c):
                self.grid[r][c] = CellType.WALL
    
    def is_valid_cell(self, row: int, col: int) -> bool:
        """Check if cell coordinates are within grid bounds"""
        return 0 <= row < self.size and 0 <= col < self.size
    
    def is_maze_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the maze (outer ring)"""
        return not (ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END)
    
    def is_arena_cell(self, row: int, col: int) -> bool:
        """Check if cell is part of the battle arena"""
        return ARENA_START <= row <= ARENA_END and ARENA_START <= col <= ARENA_END
    
    def is_walkable(self, row: int, col: int) -> bool:
        """Check if agent can walk on this cell"""
        if not self.is_valid_cell(row, col):
            return False
        return self.grid[row][col] != CellType.WALL
    
    def get_valid_maze_cells(self) -> List[Tuple[int, int]]:
        """Get all valid spawn positions in the maze"""
        valid_cells = []
        for r in range(self.size):
            for c in range(self.size):
                if self.is_maze_cell(r, c) and self.is_walkable(r, c):
                    valid_cells.append((r, c))
        return valid_cells
    
    def get_neighbors(self, row: int, col: int) -> List[Tuple[int, int]]:
        """Get all valid neighboring cells"""
        neighbors = []
        for direction in Direction:
            dr, dc = direction.value
            new_row, new_col = row + dr, col + dc
            if self.is_walkable(new_row, new_col):
                neighbors.append((new_row, new_col))
        return neighbors
    
    def display(self, agent1_pos: Tuple[int, int], agent2_pos: Tuple[int, int],
                agent1_name: str = 'A', agent2_name: str = 'V'):
        """Display the grid with agents"""
        print("\n" + "=" * 30)
        print("  0 1 2 3 4 5")
        print("  " + "-" * 12)
        
        for r in range(self.size):
            row_str = f"{r}|"
            for c in range(self.size):
                if (r, c) == agent1_pos:
                    row_str += agent1_name + " "
                elif (r, c) == agent2_pos:
                    row_str += agent2_name + " "
                else:
                    row_str += self.grid[r][c].value + " "
            print(row_str + "|")
        
        print("  " + "-" * 12)
        print("=" * 30 + "\n")


# =============================================================================
# A* PATHFINDING
# =============================================================================

class AStarPathfinder:
    """A* search algorithm for pathfinding in the maze"""
    
    def __init__(self, grid: Grid):
        self.grid = grid
    
    def heuristic(self, pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        """Manhattan distance heuristic"""
        return abs(pos[0] - goal[0]) + abs(pos[1] - goal[1])
    
    def find_path(self, start: Tuple[int, int], goal: Tuple[int, int],
                  blocked_pos: Optional[Tuple[int, int]] = None) -> List[Tuple[int, int]]:
        """
        Find shortest path from start to goal using A* search.
        Returns list of positions including start and goal.
        """
        if start == goal:
            return [start]
        
        # Priority queue: (f_score, counter, current_pos, path)
        counter = 0
        open_set = [(0, counter, start, [start])]
        closed_set: Set[Tuple[int, int]] = set()
        
        while open_set:
            _, _, current, path = heapq.heappop(open_set)
            
            if current == goal:
                return path
            
            if current in closed_set:
                continue
            
            closed_set.add(current)
            
            for neighbor in self.grid.get_neighbors(current[0], current[1]):
                if neighbor in closed_set or neighbor == blocked_pos:
                    continue
                
                new_path = path + [neighbor]
                g_score = len(new_path) - 1
                h_score = self.heuristic(neighbor, goal)
                f_score = g_score + h_score
                
                counter += 1
                heapq.heappush(open_set, (f_score, counter, neighbor, new_path))
        
        return []  # No path found
    
    def find_nearest_arena_cell(self, start: Tuple[int, int],
                                blocked_pos: Optional[Tuple[int, int]] = None) -> Tuple[int, int]:
        """Find the nearest arena cell from current position"""
        best_cell = None
        best_distance = float('inf')
        
        # Check all arena border cells
        arena_entry_cells = []
        for r in range(ARENA_START, ARENA_END + 1):
            for c in range(ARENA_START, ARENA_END + 1):
                arena_entry_cells.append((r, c))
        
        for cell in arena_entry_cells:
            path = self.find_path(start, cell, blocked_pos)
            if path and len(path) < best_distance:
                best_distance = len(path)
                best_cell = cell
        
        return best_cell if best_cell else (ARENA_START, ARENA_START)


# =============================================================================
# AGENT CLASS
# =============================================================================

class Agent:
    """Base class for AI agents"""
    
    def __init__(self, name: str, symbol: str, position: Tuple[int, int]):
        self.name = name
        self.symbol = symbol
        self.position = position
        self.hp = 100  # Will be set based on arena entry order
        self.in_arena = False
        self.is_defending = False
        self.moved_last_turn = False  # Track if agent moved in previous turn
    
    def move(self, new_position: Tuple[int, int]):
        """Move agent to new position"""
        self.position = new_position
    
    def take_damage(self, damage: int):
        """Apply damage to agent"""
        actual_damage = damage
        if self.is_defending:
            actual_damage = int(damage * DEFEND_REDUCTION)
            self.is_defending = False  # Defense only lasts one turn
        
        self.hp = max(0, self.hp - actual_damage)
        return actual_damage
    
    def defend(self):
        """Enter defensive stance"""
        self.is_defending = True
    
    def is_alive(self) -> bool:
        """Check if agent is still alive"""
        return self.hp > 0
    
    def is_adjacent(self, other_pos: Tuple[int, int]) -> bool:
        """Check if another position is adjacent"""
        row_diff = abs(self.position[0] - other_pos[0])
        col_diff = abs(self.position[1] - other_pos[1])
        return (row_diff == 1 and col_diff == 0) or (row_diff == 0 and col_diff == 1)


class AegisAgent(Agent):
    """AEGIS agent using Minimax with Alpha-Beta Pruning"""
    
    def __init__(self, position: Tuple[int, int]):
        super().__init__("AEGIS", "A", position)
        self.max_depth = 3  # Minimax search depth
    
    def decide_maze_move(self, grid: Grid, opponent: Agent) -> Tuple[int, int]:
        """Decide next move in maze phase using Minimax"""
        # Evaluate all possible moves
        best_move = self.position
        best_score = float('-inf')
        
        possible_moves = grid.get_neighbors(self.position[0], self.position[1])
        
        for move in possible_moves:
            if move == opponent.position:
                continue  # Can't move to opponent's position
            
            # Score based on:
            # 1. Distance to arena (negative, want to minimize)
            # 2. Blocking opponent (positive)
            score = self._evaluate_maze_position(move, opponent.position, grid)
            
            if score > best_score:
                best_score = score
                best_move = move
        
        return best_move
    
    def _evaluate_maze_position(self, pos: Tuple[int, int], opp_pos: Tuple[int, int],
                               grid: Grid) -> float:
        """Evaluate a maze position"""
        # Distance to arena (negative score)
        dist_to_arena = self._distance_to_arena(pos)
        
        # Distance opponent to arena
        opp_dist_to_arena = self._distance_to_arena(opp_pos)
        
        # Prefer being closer to arena than opponent
        score = (opp_dist_to_arena - dist_to_arena) * 10
        
        return score
    
    def _distance_to_arena(self, pos: Tuple[int, int]) -> float:
        """Calculate Manhattan distance to nearest arena cell"""
        r, c = pos
        if ARENA_START <= r <= ARENA_END and ARENA_START <= c <= ARENA_END:
            return 0
        
        # Distance to nearest arena border
        dr = max(0, ARENA_START - r, r - ARENA_END)
        dc = max(0, ARENA_START - c, c - ARENA_END)
        return dr + dc
    
    def decide_combat_action(self, grid: Grid, opponent: Agent) -> Tuple[Action, Optional[Tuple[int, int]]]:
        """Decide combat action using Minimax with Alpha-Beta Pruning"""
        best_action = Action.DEFEND
        best_move = None
        best_value = float('-inf')
        
        # Generate possible actions (respecting movement cooldown)
        actions = self._get_possible_actions(grid, opponent)
        
        for action, move in actions:
            # Simulate the action and evaluate using minimax
            value = self._minimax(grid, opponent, action, move, depth=self.max_depth,
                                 alpha=float('-inf'), beta=float('inf'), maximizing=False)
            
            if value > best_value:
                best_value = value
                best_action = action
                best_move = move
        
        return best_action, best_move
    
    def _get_possible_actions(self, grid: Grid, opponent: Agent) -> List[Tuple[Action, Optional[Tuple[int, int]]]]:
        """Get all possible actions in current state"""
        actions = []
        
        # Move actions (only if didn't move last turn)
        if not self.moved_last_turn:
            for neighbor in grid.get_neighbors(self.position[0], self.position[1]):
                if neighbor != opponent.position and grid.is_arena_cell(neighbor[0], neighbor[1]):
                    actions.append((Action.MOVE, neighbor))
        
        # Attack if adjacent
        if self.is_adjacent(opponent.position):
            actions.append((Action.ATTACK, None))
        
        # Defend
        actions.append((Action.DEFEND, None))
        
        return actions
    
    def _minimax(self, grid: Grid, opponent: Agent, action: Action,
                move: Optional[Tuple[int, int]], depth: int, alpha: float,
                beta: float, maximizing: bool) -> float:
        """Minimax with Alpha-Beta Pruning"""
        if depth == 0:
            return self._evaluate_combat_state(opponent)
        
        if maximizing:
            max_eval = float('-inf')
            actions = self._get_possible_actions(grid, opponent)
            
            for act, mv in actions:
                eval_score = self._minimax(grid, opponent, act, mv, depth - 1,
                                          alpha, beta, False)
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break
            
            return max_eval
        else:
            min_eval = float('inf')
            # Simulate opponent actions (simplified)
            eval_score = self._evaluate_combat_state(opponent)
            min_eval = min(min_eval, eval_score)
            beta = min(beta, eval_score)
            
            return min_eval
    
    def _evaluate_combat_state(self, opponent: Agent) -> float:
        """Evaluate combat state for Minimax"""
        # Simple heuristic: HP difference and distance
        hp_diff = self.hp - opponent.hp
        
        # Distance factor (prefer being adjacent for attacks)
        distance = abs(self.position[0] - opponent.position[0]) + \
                  abs(self.position[1] - opponent.position[1])
        
        distance_score = -distance * 5  # Negative because closer is better
        
        return hp_diff + distance_score


class VeloAgent(Agent):
    """VELO agent using A* Search (maze) and Greedy strategy (combat)"""
    
    def __init__(self, position: Tuple[int, int]):
        super().__init__("VELO", "V", position)
        self.pathfinder = None  # Will be set by game
        self.current_path = []
    
    def decide_maze_move(self, grid: Grid, opponent: Agent) -> Tuple[int, int]:
        """Decide next move in maze using A* pathfinding"""
        # Find path to nearest arena cell
        target = self.pathfinder.find_nearest_arena_cell(self.position, opponent.position)
        path = self.pathfinder.find_path(self.position, target, opponent.position)
        
        if len(path) > 1:
            return path[1]  # Return next step in path
        
        return self.position  # Stay in place if no path
    
    def decide_combat_action(self, grid: Grid, opponent: Agent) -> Tuple[Action, Optional[Tuple[int, int]]]:
        """Decide combat action using Greedy heuristic"""
        # Greedy strategy:
        # 1. If moved last turn, must attack or defend (no consecutive moves)
        # 2. If HP is low and not adjacent, defend
        # 3. If adjacent and HP advantage, attack
        # 4. If not adjacent and can move, move closer
        # 5. Otherwise, balance between attack and defense
        
        is_adjacent = self.is_adjacent(opponent.position)
        hp_advantage = self.hp > opponent.hp
        low_hp = self.hp < 40
        
        # If moved last turn, cannot move again - must attack or defend
        if self.moved_last_turn:
            if is_adjacent:
                return Action.ATTACK, None
            else:
                return Action.DEFEND, None
        
        # If very low HP and not adjacent, defend
        if low_hp and not is_adjacent:
            return Action.DEFEND, None
        
        # If adjacent and have HP advantage, attack
        if is_adjacent and hp_advantage:
            return Action.ATTACK, None
        
        # If adjacent and low HP, defend
        if is_adjacent and low_hp:
            return Action.DEFEND, None
        
        # If adjacent and similar HP, attack
        if is_adjacent:
            return Action.ATTACK, None
        
        # Not adjacent - move closer (only if didn't move last turn)
        best_move = self._find_best_move_towards(opponent.position, grid)
        if best_move != self.position:
            return Action.MOVE, best_move
        
        # Default: defend
        return Action.DEFEND, None
    
    def _find_best_move_towards(self, target: Tuple[int, int], grid: Grid) -> Tuple[int, int]:
        """Find best move towards target position"""
        best_move = self.position
        best_distance = float('inf')
        
        for neighbor in grid.get_neighbors(self.position[0], self.position[1]):
            if grid.is_arena_cell(neighbor[0], neighbor[1]):
                distance = abs(neighbor[0] - target[0]) + abs(neighbor[1] - target[1])
                if distance < best_distance:
                    best_distance = distance
                    best_move = neighbor
        
        return best_move


# =============================================================================
# GAME CONTROLLER
# =============================================================================

class NeuronBotWars:
    """Main game controller"""
    
    def __init__(self):
        self.grid = Grid()
        self.aegis = None
        self.velo = None
        self.turn_count = 0
        self.phase = 1  # 1 = Maze, 2 = Combat
        self.first_in_arena = None
    
    def initialize_game(self):
        """Initialize the game with random agent positions"""
        print("\n" + "=" * 50)
        print("       NEURON BOT WARS - AI vs AI")
        print("=" * 50)
        print("\nInitializing game...")
        
        # Get valid spawn positions
        valid_cells = self.grid.get_valid_maze_cells()
        
        # Spawn agents randomly
        spawn_positions = random.sample(valid_cells, 2)
        
        self.aegis = AegisAgent(spawn_positions[0])
        self.velo = VeloAgent(spawn_positions[1])
        self.velo.pathfinder = AStarPathfinder(self.grid)
        
        print(f"\nAEGIS (A) spawned at: {self.aegis.position}")
        print(f"VELO (V) spawned at: {self.velo.position}")
        print("\n" + "-" * 50)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 50)
        print("Objective: Reach the inner 4×4 Battle Arena")
        print("First agent to enter gets 120 HP, second gets 100 HP")
        
        self.grid.display(self.aegis.position, self.velo.position)
    
    def run_game(self):
        """Main game loop"""
        self.initialize_game()
        
        # Phase 1: Maze Navigation
        while self.phase == 1:
            self._run_maze_turn()
            input("\nPress Enter to continue...")
        
        # Phase 2: Combat
        print("\n" + "=" * 50)
        print("PHASE 2: COMBAT IN THE ARENA")
        print("=" * 50)
        print(f"AEGIS HP: {self.aegis.hp}")
        print(f"VELO HP: {self.velo.hp}")
        
        while self.phase == 2:
            self._run_combat_turn()
            
            if not self.aegis.is_alive():
                self._announce_winner(self.velo)
                break
            elif not self.velo.is_alive():
                self._announce_winner(self.aegis)
                break
            
            input("\nPress Enter to continue...")
    
    def _run_maze_turn(self):
        """Execute one turn of maze navigation"""
        self.turn_count += 1
        print(f"\n{'=' * 50}")
        print(f"TURN {self.turn_count} - MAZE PHASE")
        print(f"{'=' * 50}")
        
        # AEGIS turn
        if not self.aegis.in_arena:
            print(f"\n{self.aegis.name}'s turn:")
            new_pos = self.aegis.decide_maze_move(self.grid, self.velo)
            self.aegis.move(new_pos)
            print(f"  → Moved to {new_pos}")
            
            # Check if entered arena
            if self.grid.is_arena_cell(new_pos[0], new_pos[1]):
                self.aegis.in_arena = True
                self._agent_entered_arena(self.aegis)
        
        # VELO turn
        if not self.velo.in_arena:
            print(f"\n{self.velo.name}'s turn:")
            new_pos = self.velo.decide_maze_move(self.grid, self.aegis)
            self.velo.move(new_pos)
            print(f"  → Moved to {new_pos} (using A* pathfinding)")
            
            # Check if entered arena
            if self.grid.is_arena_cell(new_pos[0], new_pos[1]):
                self.velo.in_arena = True
                self._agent_entered_arena(self.velo)
        
        self.grid.display(self.aegis.position, self.velo.position)
        
        # Check if both entered arena
        if self.aegis.in_arena and self.velo.in_arena:
            self.phase = 2
    
    def _agent_entered_arena(self, agent: Agent):
        """Handle agent entering the arena"""
        print(f"\n>>> {agent.name} has entered the Battle Arena! <<<")
        
        if self.first_in_arena is None:
            self.first_in_arena = agent
            agent.hp = FIRST_AGENT_HP
            print(f"    {agent.name} gets {FIRST_AGENT_HP} HP (entered first)")
        else:
            agent.hp = SECOND_AGENT_HP
            print(f"    {agent.name} gets {SECOND_AGENT_HP} HP (entered second)")
    
    def _run_combat_turn(self):
        """Execute one turn of combat"""
        self.turn_count += 1
        print(f"\n{'=' * 50}")
        print(f"TURN {self.turn_count} - COMBAT PHASE")
        print(f"{'=' * 50}")
        aegis_status = []
        if self.aegis.is_defending:
            aegis_status.append('DEFENDING')
        if self.aegis.moved_last_turn:
            aegis_status.append('MOVED LAST TURN')
        
        velo_status = []
        if self.velo.is_defending:
            velo_status.append('DEFENDING')
        if self.velo.moved_last_turn:
            velo_status.append('MOVED LAST TURN')
        
        print(f"AEGIS HP: {self.aegis.hp} {('[' + ', '.join(aegis_status) + ']') if aegis_status else ''}")
        print(f"VELO HP: {self.velo.hp} {('[' + ', '.join(velo_status) + ']') if velo_status else ''}")
        
        # AEGIS turn
        print(f"\n{self.aegis.name}'s turn (Minimax AI):")
        action, move = self.aegis.decide_combat_action(self.grid, self.velo)
        self._execute_combat_action(self.aegis, self.velo, action, move)
        
        if not self.velo.is_alive():
            return
        
        # VELO turn
        print(f"\n{self.velo.name}'s turn (Greedy AI):")
        action, move = self.velo.decide_combat_action(self.grid, self.aegis)
        self._execute_combat_action(self.velo, self.aegis, action, move)
        
        self.grid.display(self.aegis.position, self.velo.position)
    
    def _execute_combat_action(self, attacker: Agent, defender: Agent,
                               action: Action, move: Optional[Tuple[int, int]]):
        """Execute a combat action"""
        if action == Action.MOVE:
            if move:
                attacker.move(move)
                attacker.moved_last_turn = True  # Set movement cooldown
                print(f"  → Moved to {move} [Cannot move next turn]")
        
        elif action == Action.ATTACK:
            attacker.moved_last_turn = False  # Reset movement cooldown
            if attacker.is_adjacent(defender.position):
                damage = defender.take_damage(BASE_ATTACK_DAMAGE)
                print(f"  → Attacked {defender.name} for {damage} damage!")
                print(f"     {defender.name} HP: {defender.hp}")
            else:
                print(f"  → Cannot attack (not adjacent)")
        
        elif action == Action.DEFEND:
            attacker.moved_last_turn = False  # Reset movement cooldown
            attacker.defend()
            print(f"  → Defending (50% damage reduction next turn)")
        
        elif action == Action.CONCEDE:
            print(f"  → {attacker.name} concedes!")
            attacker.hp = 0
    
    def _announce_winner(self, winner: Agent):
        """Announce the game winner"""
        print("\n" + "=" * 50)
        print("           GAME OVER")
        print("=" * 50)
        print(f"\n🏆 {winner.name} WINS! 🏆")
        print(f"\nFinal HP: {winner.hp}")
        print(f"Total turns: {self.turn_count}")
        print("\n" + "=" * 50)


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Main entry point"""
    game = NeuronBotWars()
    game.run_game()


if __name__ == "__main__":
    main()
