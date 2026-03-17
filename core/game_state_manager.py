"""
Clean Game State Manager
Manages all game state and emits events for frontend synchronization
"""

class GameStateManager:
    """Central state management for the game"""
    
    def __init__(self):
        # Game phases
        self.STATE_MAZE = 'maze'
        self.STATE_TRANSITION = 'transition'
        self.STATE_BATTLE = 'battle'
        self.STATE_FINISHED = 'finished'
        
        # Current state
        self.current_state = self.STATE_MAZE
        self.turn = 0
        self.maze_turn = 0
        self.battle_turn = 0
        
        # Configuration
        self.MAX_MAZE_TURNS = 50
        self.MAX_BATTLE_TURNS = 200
        self.TRAP_DAMAGE = 10
        self.GRID_SIZE = 7
        self.ARENA_START = 2
        self.ARENA_END = 4
        self.ARENA_ENTRY = (2, 3)  # Entry to arena
        self.AGENT_SPAWN_AEGIS = (0, 3)  # AEGIS starts here
        self.AGENT_SPAWN_VELO = (6, 3)   # VELO starts here
        
        # Agent data
        self.aegis = {
            'name': 'AEGIS',
            'color': 'blue',
            'x': self.AGENT_SPAWN_AEGIS[0],
            'y': self.AGENT_SPAWN_AEGIS[1],
            'hp': 100,
            'maxHp': 100,
            'alive': True,
            'inArena': False,
            'isDefending': False
        }
        
        self.velo = {
            'name': 'VELO',
            'color': 'red',
            'x': self.AGENT_SPAWN_VELO[0],
            'y': self.AGENT_SPAWN_VELO[1],
            'hp': 100,
            'maxHp': 100,
            'alive': True,
            'inArena': False,
            'isDefending': False
        }
        
        # Trap positions
        self.traps = []
        self._generate_traps()
        
        # Game events (for debugging/synchronization)
        self.events = []
    
    def _generate_traps(self):
        """Generate trap positions in maze (not arena, not at spawn/entry)"""
        import random
        self.traps = []
        
        protected = {self.AGENT_SPAWN_AEGIS, self.AGENT_SPAWN_VELO, self.ARENA_ENTRY}
        
        candidates = []
        for x in range(self.GRID_SIZE):
            for y in range(self.GRID_SIZE):
                # Skip arena cells
                if self.ARENA_START <= x <= self.ARENA_END and self.ARENA_START <= y <= self.ARENA_END:
                    continue
                # Skip protected cells
                if (x, y) in protected:
                    continue
                candidates.append((x, y))
        
        # Place 15-20 traps (25-30% density among maze cells)
        num_traps = random.randint(15, 20)
        self.traps = random.sample(candidates, min(num_traps, len(candidates)))
    
    def move_agent(self, agent_name, new_x, new_y):
        """Move agent to new position"""
        agent = self.aegis if agent_name == 'aegis' else self.velo
        agent['x'] = new_x
        agent['y'] = new_y
        
        # Check if entered arena
        if self.ARENA_START <= new_x <= self.ARENA_END and self.ARENA_START <= new_y <= self.ARENA_END:
            agent['inArena'] = True
        
        # Check for trap hit
        if (new_x, new_y) in self.traps:
            self.damage_agent(agent_name, self.TRAP_DAMAGE)
            self._add_event(f'TRAP_HIT', {'agent': agent_name, 'damage': self.TRAP_DAMAGE, 'pos': (new_x, new_y)})
        
        self._add_event('AGENT_MOVED', {'agent': agent_name, 'x': new_x, 'y': new_y})
    
    def damage_agent(self, agent_name, damage):
        """Apply damage to agent"""
        agent = self.aegis if agent_name == 'aegis' else self.velo
        
        if agent['isDefending']:
            damage = int(damage * 0.2)  # 80% reduction means take only 20%
            agent['isDefending'] = False
            self._add_event('DEFEND_BLOCKED', {'agent': agent_name, 'damage': damage})
        
        agent['hp'] = max(0, agent['hp'] - damage)
        
        if agent['hp'] == 0:
            agent['alive'] = False
            self._add_event('AGENT_DEFEATED', {'agent': agent_name})
        
        self._add_event('DAMAGE_APPLIED', {'agent': agent_name, 'damage': damage, 'hp': agent['hp']})
    
    def heal_agent(self, agent_name, amount):
        """Heal agent"""
        agent = self.aegis if agent_name == 'aegis' else self.velo
        agent['hp'] = min(agent['maxHp'], agent['hp'] + amount)
        self._add_event('AGENT_HEALED', {'agent': agent_name, 'amount': amount, 'hp': agent['hp']})
    
    def set_defending(self, agent_name, defending):
        """Set defend mode"""
        agent = self.aegis if agent_name == 'aegis' else self.velo
        agent['isDefending'] = defending
    
    def change_state(self, new_state):
        """Change game state"""
        if new_state != self.current_state:
            old_state = self.current_state
            self.current_state = new_state
            self._add_event('STATE_CHANGED', {'from': old_state, 'to': new_state})
    
    def next_maze_turn(self):
        """Increment maze turn counters"""
        self.maze_turn += 1
        self.turn += 1
        self._add_event('MAZE_TURN_START', {'turn': self.turn, 'mazeTurn': self.maze_turn})
    
    def next_battle_turn(self):
        """Increment battle turn counters"""
        self.battle_turn += 1
        self.turn += 1
        self._add_event('BATTLE_TURN_START', {'turn': self.turn, 'battleTurn': self.battle_turn})
    
    def get_state(self):
        """Get current game state as dict"""
        return {
            'turn': self.turn,
            'mazeTurn': self.maze_turn,
            'battleTurn': self.battle_turn,
            'phase': 1 if self.current_state == self.STATE_MAZE else 2,
            'aegis': self.aegis.copy(),
            'velo': self.velo.copy(),
            'traps': self.traps.copy(),
            'gridSize': self.GRID_SIZE,
            'arenaStart': self.ARENA_START,
            'arenaEnd': self.ARENA_END,
            'arenaEntry': list(self.ARENA_ENTRY),
            'gameOver': self.current_state == self.STATE_FINISHED
        }
    
    def _add_event(self, event_type, data):
        """Add event to event log"""
        self.events.append({
            'type': event_type,
            'turn': self.turn,
            'data': data
        })
        
        # Keep only last 100 events
        if len(self.events) > 100:
            self.events.pop(0)
    
    def reset(self):
        """Reset game state"""
        self.turn = 0
        self.maze_turn = 0
        self.battle_turn = 0
        self.current_state = self.STATE_MAZE
        self.events = []
        
        # Reset agents
        self.aegis['x'] = self.AGENT_SPAWN_AEGIS[0]
        self.aegis['y'] = self.AGENT_SPAWN_AEGIS[1]
        self.aegis['hp'] = 100
        self.aegis['alive'] = True
        self.aegis['inArena'] = False
        self.aegis['isDefending'] = False
        
        self.velo['x'] = self.AGENT_SPAWN_VELO[0]
        self.velo['y'] = self.AGENT_SPAWN_VELO[1]
        self.velo['hp'] = 100
        self.velo['alive'] = True
        self.velo['inArena'] = False
        self.velo['isDefending'] = False
        
        # Regenerate traps
        self._generate_traps()


# Export
__all__ = ['GameStateManager']
