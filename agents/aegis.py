import random
from copy import deepcopy
from typing import Tuple, Optional, List

from core.grid import Action
from core.maze import Maze
from core.arena import Arena
from agents.agent_base import Agent

class AegisAgent(Agent):
    """
    AEGIS - Strategic AI (Blue Agent)
    
    Maze Phase: Uses A* Search with Manhattan distance heuristic, avoids traps
    Combat Phase: Uses Minimax with Alpha-Beta Pruning for optimal decisions
    """
    
    def __init__(self, position: Tuple[int, int]):
        super().__init__("AEGIS", "A", position, "Blue")
        self.pathfinder = None  # Will be set by game controller
        self.minimax_depth = 4  # Increased Depth so Minimax can see beyond the 3-turn Movement cooldown
    
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
