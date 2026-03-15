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
        elif action == Action.WAIT:
            sim_self.wait()

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
                elif act == Action.WAIT:
                    test_opponent.wait()
                
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
