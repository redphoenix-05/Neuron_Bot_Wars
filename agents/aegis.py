import random
from copy import deepcopy
from typing import Tuple, Optional, List

from core.grid import (
    Action, ELEMENTAL_BEAM_DAMAGE, LOGIC_BURST_DAMAGE,
    PULSE_STRIKE_DAMAGE, INITIAL_HP
)
from core.maze import Maze
from core.arena import Arena
from agents.agent_base import Agent


class AegisAgent(Agent):
    """
    AEGIS - Strategic AI (Blue Agent)

    Maze Phase:   A* Search with Manhattan distance heuristic + trap avoidance.
    Combat Phase: Minimax with Alpha-Beta Pruning (depth 5) and an improved
                  evaluation function that strongly biases AEGIS toward winning.

    Optimisation summary (v2):
      * Minimax depth raised to 5 — sees further ahead.
      * Evaluation weights rebalanced: HP difference is the dominant signal.
      * Adjacency bonus is large but capped to prevent passive loops.
      * Beam and Burst use decisive-finish bonus in evaluation.
      * Fixed priority tie-break: Beam > Burst > Strike > Defend > Move > Wait.
    """

    def __init__(self, position: Tuple[int, int]):
        super().__init__("AEGIS", "A", position, "Blue")
        self.pathfinder = None
        self.minimax_depth = 5

    # ------------------------------------------------------------------
    # Maze Phase
    # ------------------------------------------------------------------

    def decide_maze_move(self, maze: Maze) -> Tuple[int, int]:
        entry = maze.arena_entry
        path = self.pathfinder.find_path(self.position, entry, avoid_traps=True)
        if len(path) > 1:
            return path[1]
        neighbors = maze.get_neighbors(self.position[0], self.position[1], maze_phase=True)
        if neighbors:
            return min(neighbors, key=lambda n: abs(n[0] - entry[0]) + abs(n[1] - entry[1]))
        return self.position

    # ------------------------------------------------------------------
    # Combat Phase
    # ------------------------------------------------------------------

    def decide_combat_action(self, arena: Arena, opponent: 'Agent',
                             maze: Maze) -> Tuple[Action, Optional[Tuple[int, int]]]:
        possible_actions = self._get_possible_combat_actions(arena, opponent, maze)
        if not possible_actions:
            return Action.DEFEND, None

        best_action = possible_actions[0][0]
        best_move   = possible_actions[0][1]
        best_value  = float('-inf')

        for action, move in possible_actions:
            value = self._minimax(action, move, opponent, arena, maze,
                                  depth=self.minimax_depth,
                                  alpha=float('-inf'), beta=float('inf'),
                                  maximizing=False)
            if value > best_value or (
                value == best_value and
                self._action_priority(action) < self._action_priority(best_action)
            ):
                best_value  = value
                best_action = action
                best_move   = move

        return best_action, best_move

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _action_priority(action: Action) -> int:
        order = {Action.ELEMENTAL_BEAM: 0, Action.LOGIC_BURST: 1,
                 Action.PULSE_STRIKE: 2, Action.DEFEND: 3,
                 Action.MOVE: 4, Action.WAIT: 5}
        return order.get(action, 99)

    def _get_possible_combat_actions(self, arena: Arena, opponent: 'Agent',
                                     maze: Maze) -> List[Tuple[Action, Optional[Tuple[int, int]]]]:
        actions = []
        is_adj = self.is_adjacent(opponent.position)

        if is_adj and self.can_perform_action(Action.ELEMENTAL_BEAM):
            actions.append((Action.ELEMENTAL_BEAM, None))
        if is_adj and self.can_perform_action(Action.LOGIC_BURST):
            actions.append((Action.LOGIC_BURST, None))
        if is_adj and self.can_perform_action(Action.PULSE_STRIKE):
            actions.append((Action.PULSE_STRIKE, None))
        if self.can_perform_action(Action.DEFEND):
            actions.append((Action.DEFEND, None))
        if self.can_perform_action(Action.MOVE):
            for nb in maze.get_neighbors(self.position[0], self.position[1]):
                if nb != opponent.position and maze.is_arena_cell(nb[0], nb[1]):
                    actions.append((Action.MOVE, nb))
        actions.append((Action.WAIT, None))
        return actions

    def _minimax(self, action: Action, move: Optional[Tuple[int, int]],
                 opponent: 'Agent', arena: Arena, maze: Maze,
                 depth: int, alpha: float, beta: float, maximizing: bool) -> float:
        sim_self = deepcopy(self)
        sim_opp  = deepcopy(opponent)
        AegisAgent._apply_action(sim_self, sim_opp, action, move)

        if depth == 0 or not sim_self.is_alive() or not sim_opp.is_alive():
            return AegisAgent._evaluate(sim_self, sim_opp)

        if maximizing:
            actions = sim_self._get_possible_combat_actions(arena, sim_opp, maze)
            if not actions:
                return AegisAgent._evaluate(sim_self, sim_opp)
            max_val = float('-inf')
            for act, mv in actions:
                val = sim_self._minimax(act, mv, sim_opp, arena, maze,
                                        depth - 1, alpha, beta, False)
                max_val = max(max_val, val)
                alpha = max(alpha, val)
                if beta <= alpha:
                    break
            return max_val
        else:
            opp_actions = sim_opp._get_possible_combat_actions(arena, sim_self, maze)
            if not opp_actions:
                return AegisAgent._evaluate(sim_self, sim_opp)
            min_val = float('inf')
            for act, mv in opp_actions:
                t_self = deepcopy(sim_self)
                t_opp  = deepcopy(sim_opp)
                AegisAgent._apply_action(t_opp, t_self, act, mv)
                val = AegisAgent._recurse_max(t_self, t_opp, arena, maze, depth - 1, alpha, beta)
                min_val = min(min_val, val)
                beta = min(beta, val)
                if beta <= alpha:
                    break
            return min_val

    @staticmethod
    def _recurse_max(aegis: 'Agent', opp: 'Agent', arena: Arena, maze: Maze,
                     depth: int, alpha: float, beta: float) -> float:
        if depth == 0 or not aegis.is_alive() or not opp.is_alive():
            return AegisAgent._evaluate(aegis, opp)
        actions = aegis._get_possible_combat_actions(arena, opp, maze)
        if not actions:
            return AegisAgent._evaluate(aegis, opp)
        max_val = float('-inf')
        for act, mv in actions:
            val = aegis._minimax(act, mv, opp, arena, maze,
                                 depth - 1, alpha, beta, False)
            max_val = max(max_val, val)
            alpha = max(alpha, val)
            if beta <= alpha:
                break
        return max_val

    @staticmethod
    def _apply_action(actor: 'Agent', target: 'Agent',
                      action: Action, move: Optional[Tuple[int, int]]) -> None:
        if action == Action.MOVE and move is not None:
            actor.move(move)
        elif action == Action.PULSE_STRIKE:
            actor.pulse_strike(target)
        elif action == Action.LOGIC_BURST:
            actor.logic_burst(target)
        elif action == Action.ELEMENTAL_BEAM:
            actor.elemental_beam(target)
        elif action == Action.DEFEND:
            actor.defend()
        elif action == Action.WAIT:
            actor.wait()

    @staticmethod
    def _evaluate(aegis: 'Agent', opponent: 'Agent') -> float:
        if not aegis.is_alive():
            return float('-inf')
        if not opponent.is_alive():
            return float('inf')

        hp_score = (aegis.hp - opponent.hp) * 4.0

        dist = (abs(aegis.position[0] - opponent.position[0]) +
                abs(aegis.position[1] - opponent.position[1]))
        if dist == 1:
            proximity_score = 60.0
        elif dist == 2:
            proximity_score = 20.0
        else:
            proximity_score = -dist * 8.0

        charge_score = aegis.logic_burst_charge * 3.0
        if aegis.logic_burst_charge == 3:
            charge_score += 15.0

        beam_score = 0.0
        if not aegis.elemental_beam_used:
            beam_score = 40.0 if dist == 1 else 10.0

        defend_penalty = -5.0 if aegis.is_defending else 0.0
        jitter = random.uniform(-1.5, 1.5)

        return hp_score + proximity_score + charge_score + beam_score + defend_penalty + jitter