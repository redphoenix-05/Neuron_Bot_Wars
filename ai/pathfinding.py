import heapq
from typing import Tuple, List, Set, Dict, Optional

from core.maze import Maze

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
                    move_cost = 10  # Reduced penalty to balance gameplay
                
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
