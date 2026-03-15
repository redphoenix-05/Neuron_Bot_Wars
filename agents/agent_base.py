from typing import Tuple
from core.grid import (
    Action, ItemType, INITIAL_HP, PULSE_STRIKE_DAMAGE, 
    LOGIC_BURST_DAMAGE, ELEMENTAL_BEAM_DAMAGE, 
    DEFEND_REDUCTION, MEDKIT_HEAL
)

class Agent:
    """Base class for AI agents"""
    
    def __init__(self, name: str, symbol: str, position: Tuple[int, int], color: str):
        self.name = name
        self.symbol = symbol
        self.position = position
        self.color = color  # "Blue" or "Red"
        self.hp = INITIAL_HP
        self.in_arena = False
        self.is_defending = False
        self.has_powerup = False
        self.action_history = []  # Track history for constraints
        self.logic_burst_charge = 0
        self.elemental_beam_used = False
        
    def _record_action(self, action: Action):
        self.action_history.append(action)
        if len(self.action_history) > 10:
            self.action_history.pop(0)

    def move(self, new_position: Tuple[int, int]):
        """Move agent to new position"""
        self.position = new_position
        self._record_action(Action.MOVE)
    
    def take_damage(self, damage: int) -> int:
        """Apply damage to agent, returns actual damage taken"""
        actual_damage = damage
        if self.is_defending:
            actual_damage = int(damage * DEFEND_REDUCTION)
            print(f"      {self.name} is DEFENDING! Damage reduced to {actual_damage}")
            self.is_defending = False  # Defense only lasts one turn
        
        self.hp = max(0, self.hp - actual_damage)
        return actual_damage
    
    def defend(self):
        """Enter defensive stance"""
        self.is_defending = True
        self._record_action(Action.DEFEND)

    def wait(self):
        """Wait for a turn without taking action."""
        self._record_action(Action.WAIT)

    def pulse_strike(self, target: 'Agent') -> int:
        """Perform pulse strike attack"""
        if not self.is_adjacent(target.position):
            self._record_action(Action.PULSE_STRIKE)
            return 0
        damage = PULSE_STRIKE_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self._record_action(Action.PULSE_STRIKE)
        return actual_damage

    def logic_burst(self, target: 'Agent') -> int:
        """Perform logic burst attack"""
        if self.logic_burst_charge < 3:
            return 0
        if not self.is_adjacent(target.position):
            self.logic_burst_charge = 0
            self._record_action(Action.LOGIC_BURST)
            return 0
        
        damage = LOGIC_BURST_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self.logic_burst_charge = 0
        self._record_action(Action.LOGIC_BURST)
        return actual_damage

    def elemental_beam(self, target: 'Agent') -> int:
        """Perform elemental beam attack"""
        if self.elemental_beam_used:
            return 0
        if not self.is_adjacent(target.position):
            self.elemental_beam_used = True
            self._record_action(Action.ELEMENTAL_BEAM)
            return 0
        
        damage = ELEMENTAL_BEAM_DAMAGE
        if self.has_powerup:
            damage = int(damage * 1.5)
            self.has_powerup = False
        actual_damage = target.take_damage(damage)
        self.elemental_beam_used = True
        self._record_action(Action.ELEMENTAL_BEAM)
        return actual_damage
    
    def pickup_item(self, item: ItemType):
        """Pick up an item"""
        if item == ItemType.MEDKIT:
            old_hp = self.hp
            self.hp = min(100, self.hp + MEDKIT_HEAL)
            healed = self.hp - old_hp
            print(f"      {self.name} picked up MEDKIT! Healed {healed} HP")
        elif item == ItemType.POWERUP:
            self.has_powerup = True
            print(f"      {self.name} picked up POWER UP!")
    
    def is_alive(self) -> bool:
        """Check if agent is still alive"""
        return self.hp > 0
    
    def is_adjacent(self, other_pos: Tuple[int, int]) -> bool:
        """Check if another position is adjacent (for melee attacks)"""
        row_diff = abs(self.position[0] - other_pos[0])
        col_diff = abs(self.position[1] - other_pos[1])
        return (row_diff == 1 and col_diff == 0) or (row_diff == 0 and col_diff == 1)
    
    def can_perform_action(self, action: Action) -> bool:
        """Check if action can be performed (respects action restrictions)"""
        if not self.action_history:
            # If no actions have been performed yet, unless it needs charge, return True
            pass
        
        if action == Action.MOVE and Action.MOVE in self.action_history[-3:]:
            return False
        
        if action == Action.DEFEND and Action.DEFEND in self.action_history[-1:]:
            return False

        if action == Action.LOGIC_BURST and self.logic_burst_charge < 3:
            return False

        if action == Action.ELEMENTAL_BEAM and self.elemental_beam_used:
            return False
        
        return True
