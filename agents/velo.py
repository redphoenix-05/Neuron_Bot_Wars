from typing import Tuple, Optional, List

from core.grid import Action, ELEMENTAL_BEAM_DAMAGE
from core.maze import Maze
from core.arena import Arena
from agents.agent_base import Agent

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

        # Default action if nothing else is suitable
        if self.can_perform_action(Action.DEFEND):
            return Action.DEFEND, None
        
        # Last resort
        return Action.WAIT, None
    
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

        # Wait is always possible
        actions.append((Action.WAIT, None))
        
        return actions
