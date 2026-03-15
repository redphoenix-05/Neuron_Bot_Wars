import random
from typing import Tuple, Set, Dict, Optional
from .grid import Grid, ItemType, ARENA_START, ARENA_END

class Arena(Grid):
    """Battle arena with items"""
    
    def __init__(self):
        """Initialize 3x3 battle arena"""
        super().__init__(3)  # Arena is 3x3
        self.items: Dict[Tuple[int, int], ItemType] = {}
        self.item_usage: Dict[Tuple[int, int], Set[str]] = {}  # Track which agents used each item
        self.powerup_spawned = False
        self.powerup_taken = False
        self.health_spawned = False
        self.health_taken = False
        self._place_items()
    
    def _place_items(self):
        """No initial items. Items are spawned after half-HP trigger in combat."""
        return
    
    def can_pickup_item(self, row: int, col: int, agent_name: str) -> bool:
        """Check if agent can pick up item at position"""
        pos = (row, col)
        if pos not in self.items:
            return False
        # Agent can only pick up each item once
        return agent_name not in self.item_usage.get(pos, set())
    
    def get_item(self, row: int, col: int, agent_name: str) -> Optional[ItemType]:
        """Get item at position and track usage. Special items are one-time pickups."""
        pos = (row, col)
        if pos not in self.items:
            return None
        
        # Check if agent already used this item
        if agent_name in self.item_usage.get(pos, set()):
            return None
        
        # Mark item as used by this agent
        self.item_usage[pos].add(agent_name)
        item = self.items[pos]
        
        # PowerUp and MedKit are single-use: remove immediately after first pickup
        if item == ItemType.POWERUP:
            del self.items[pos]
            del self.item_usage[pos]
            self.powerup_taken = True
        elif item == ItemType.MEDKIT:
            del self.items[pos]
            del self.item_usage[pos]
            self.health_taken = True
        
        return item
    
    def has_item(self, row: int, col: int) -> bool:
        """Check if position has an item"""
        return (row, col) in self.items
    
    def spawn_powerup(self, occupied_global_positions: Set[Tuple[int, int]]) -> bool:
        """Spawn a single power-up once in a random empty arena cell."""
        if self.powerup_spawned:
            return False

        candidates = []
        for r in range(3):
            for c in range(3):
                global_pos = (r + ARENA_START, c + ARENA_START)
                if global_pos in occupied_global_positions:
                    continue
                if (r, c) in self.items:
                    continue
                candidates.append((r, c))

        if candidates:
            pos = random.choice(candidates)
            self.items[pos] = ItemType.POWERUP
            self.item_usage[pos] = set()
            self.powerup_spawned = True
            return True
        return False

    def spawn_health_pack(self, occupied_global_positions: Set[Tuple[int, int]]) -> bool:
        """Spawn a single health pickup once in a random empty arena cell."""
        if self.health_spawned:
            return False

        candidates = []
        for r in range(3):
            for c in range(3):
                global_pos = (r + ARENA_START, c + ARENA_START)
                if global_pos in occupied_global_positions:
                    continue
                if (r, c) in self.items:
                    continue
                candidates.append((r, c))

        if candidates:
            pos = random.choice(candidates)
            self.items[pos] = ItemType.MEDKIT
            self.item_usage[pos] = set()
            self.health_spawned = True
            return True
        return False
    
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
