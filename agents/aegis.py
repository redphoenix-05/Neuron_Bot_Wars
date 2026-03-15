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
    
    
