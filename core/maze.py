import random
from typing import List, Tuple, Set, Dict, Optional
from .grid import Grid, CellType, Direction, GRID_SIZE, ARENA_START, ARENA_END

class Maze(Grid):
    """Maze environment with walls, traps, and arena entry"""
    
    def __init__(self):
        """Initialize a 7x7 maze with center 3x3 arena"""
        super().__init__(GRID_SIZE)
        self.arena_entry = None  # Single entry point to arena
        self.traps = set()  # Track trap positions
        self._generate_maze()
    
    def _generate_maze(self):
        """Generate maze layout (arena + entry + random walls)."""
        self._reset_to_paths()
        self._mark_arena_cells()
        self._set_arena_entry()
        # self._place_random_walls() # Removed to allow free movement among traps

    def _reset_to_paths(self):
        """Reset full grid to walkable path cells before generation."""
        self.grid = [[CellType.PATH for _ in range(self.size)] for _ in range(self.size)]
        self.traps.clear()

    def _mark_arena_cells(self):
        """Mark center 3x3 as the battle arena."""
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
