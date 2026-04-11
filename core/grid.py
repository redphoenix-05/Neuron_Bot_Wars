from enum import Enum
from typing import List, Tuple

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
    WAIT = 'wait'


class Direction(Enum):
    """Movement directions"""
    UP = (-1, 0)
    DOWN = (1, 0)
    LEFT = (0, -1)
    RIGHT = (0, 1)


# Game constants
GRID_SIZE = 7
ARENA_START = 2  # Arena starts at row/col 2
ARENA_END = 4    # Arena ends at row/col 4 (3x3 arena)
INITIAL_HP = 100
PULSE_STRIKE_DAMAGE = 5
LOGIC_BURST_DAMAGE = 10
ELEMENTAL_BEAM_DAMAGE = 25
DEFEND_REDUCTION = 0.2  # 80% damage reduction (take only 20%)
TRAP_DAMAGE = 1
MEDKIT_HEAL = 20
MIN_SPAWN_DISTANCE = 3
MAX_MAZE_TURNS = 200

# =============================================================================
# GRID BASE CLASS
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
