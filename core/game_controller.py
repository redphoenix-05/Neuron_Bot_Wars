"""
Clean Game Controller
Manages game flow, turns, and AI decisions
"""

import random
from core.game_state_manager import GameStateManager


class GameController:
    """Main game controller - manages game flow without freezing"""
    
    def __init__(self):
        self.state = GameStateManager()
        self.max_maze_iterations = 50
        self.max_battle_iterations = 200
    
    def simulate_full_game(self):
        """Run a complete game simulation"""
        print("\n" + "=" * 70)
        print(" " * 20 + "NEURON BOT WARS")
        print(" " * 15 + "AI Combat Visualization")
        print("=" * 70)
        
        # Phase 1: Maze Navigation
        self._run_maze_phase()
        
        # Phase 2: Transition
        self._run_transition_phase()
        
        # Phase 3: Battle
        self._run_battle_phase()
        
        # Phase 4: End
        self._print_results()
    
    def _run_maze_phase(self):
        """Run maze navigation phase"""
        print("\n" + "-" * 70)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 70)
        print(f"AEGIS spawns at: {self.state.AGENT_SPAWN_AEGIS}")
        print(f"VELO spawns at: {self.state.AGENT_SPAWN_VELO}")
        print(f"Arena Entry: {self.state.ARENA_ENTRY}")
        print(f"Total Traps: {len(self.state.traps)}")
        
        self.state.change_state(self.state.STATE_MAZE)
        iteration = 0
        
        while iteration < self.max_maze_iterations:
            # Check if both reached arena
            if self.state.aegis['inArena'] and self.state.velo['inArena']:
                print(f"\n✓ Both agents reached arena entry!")
                break
            
            iteration += 1
            self.state.next_maze_turn()
            
            # AEGIS move
            if not self.state.aegis['inArena']:
                next_pos = self._choose_maze_move(self.state.aegis, 'aegis')
                if next_pos:
                    self.state.move_agent('aegis', next_pos[0], next_pos[1])
                    status = f"→ ({next_pos[0]}, {next_pos[1]})"
                    if (next_pos[0], next_pos[1]) in self.state.traps:
                        status += f" [TRAP -10 HP]"
                    print(f"[Turn {self.state.turn}] AEGIS(HP:{self.state.aegis['hp']}) {status}")
            
            # VELO move
            if not self.state.velo['inArena']:
                next_pos = self._choose_maze_move(self.state.velo, 'velo')
                if next_pos:
                    self.state.move_agent('velo', next_pos[0], next_pos[1])
                    status = f"→ ({next_pos[0]}, {next_pos[1]})"
                    if (next_pos[0], next_pos[1]) in self.state.traps:
                        status += f" [TRAP -10 HP]"
                    print(f"[Turn {self.state.turn}] VELO(HP:{self.state.velo['hp']}) {status}")
        
        if iteration >= self.max_maze_iterations:
            print(f"\n! Max maze turns reached ({self.max_maze_iterations})")
    
    def _choose_maze_move(self, agent, agent_name):
        """Choose next move towards arena entry"""
        x, y = agent['x'], agent['y']
        target_x, target_y = self.state.ARENA_ENTRY
        
        # Simple pathfinding: move towards entry
        moves = []
        
        # Prefer moves that get closer to target
        if x < target_x:
            moves.append((x + 1, y))
        elif x > target_x:
            moves.append((x - 1, y))
        
        if y < target_y:
            moves.append((x, y + 1))
        elif y > target_y:
            moves.append((x, y - 1))
        
        # Add alternative moves
        if not moves or (x == target_x and y == target_y):
            # Try adjacent moves
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.state.GRID_SIZE and 0 <= ny < self.state.GRID_SIZE:
                    # Avoid arena cells during maze phase
                    if not (self.state.ARENA_START <= nx <= self.state.ARENA_END and 
                           self.state.ARENA_START <= ny <= self.state.ARENA_END):
                        moves.append((nx, ny))
        
        # Remove duplicates and invalid moves
        valid_moves = []
        for nx, ny in moves:
            if 0 <= nx < self.state.GRID_SIZE and 0 <= ny < self.state.GRID_SIZE:
                # Can enter arena if at entry point
                if (nx, ny) == self.state.ARENA_ENTRY or not (
                    self.state.ARENA_START <= nx <= self.state.ARENA_END and 
                    self.state.ARENA_START <= ny <= self.state.ARENA_END):
                    if (nx, ny) not in valid_moves:
                        valid_moves.append((nx, ny))
        
        if valid_moves:
            return valid_moves[0]
        return None
    
    def _run_transition_phase(self):
        """Run transition phase"""
        print("\n" + "-" * 70)
        print("PHASE TRANSITION: MAZE → BATTLE")
        print("-" * 70)
        print("✓ Arena becoming visible...")
        print("✓ Camera zooming in...")
        
        self.state.change_state(self.state.STATE_TRANSITION)
        
        # Spawn agents in battle arena
        print(f"✓ AEGIS spawning at battle position (4, 3)")
        print(f"✓ VELO spawning at battle position (4, 5)")
        
        self.state.aegis['x'] = 4
        self.state.aegis['y'] = 3
        self.state.velo['x'] = 4
        self.state.velo['y'] = 5
        self.state.aegis['inArena'] = True
        self.state.velo['inArena'] = True
    
    def _run_battle_phase(self):
        """Run battle phase"""
        print("\n" + "-" * 70)
        print("PHASE 2: BATTLE ARENA")
        print("-" * 70)
        
        self.state.change_state(self.state.STATE_BATTLE)
        iteration = 0
        
        while iteration < self.max_battle_iterations:
            # Check win conditions
            if not self.state.aegis['alive']:
                print(f"\n✗ AEGIS defeated!")
                self.state.winner = 'velo'
                break
            
            if not self.state.velo['alive']:
                print(f"\n✗ VELO defeated!")
                self.state.winner = 'aegis'
                break
            
            iteration += 1
            self.state.next_battle_turn()
            
            # AEGIS attacks
            aegis_damage = random.randint(8, 15)
            self.state.damage_agent('velo', aegis_damage)
            print(f"[Turn {self.state.turn}] AEGIS attacks VELO for {aegis_damage} damage! VELO HP: {self.state.velo['hp']}")
            
            if not self.state.velo['alive']:
                break
            
            # VELO attacks back
            velo_damage = random.randint(8, 15)
            self.state.damage_agent('aegis', velo_damage)
            print(f"[Turn {self.state.turn}] VELO attacks AEGIS for {velo_damage} damage! AEGIS HP: {self.state.aegis['hp']}")
            
            if not self.state.aegis['alive']:
                break
        
        if iteration >= self.max_battle_iterations:
            print(f"\n! Max battle turns reached ({self.max_battle_iterations})")
            # Winner based on remaining HP
            if self.state.aegis['hp'] > self.state.velo['hp']:
                self.state.winner = 'aegis'
            elif self.state.velo['hp'] > self.state.aegis['hp']:
                self.state.winner = 'velo'
            else:
                self.state.winner = 'draw'
    
    def _print_results(self):
        """Print game results"""
        self.state.change_state(self.state.STATE_FINISHED)
        
        print("\n" + "=" * 70)
        print(" " * 25 + "GAME OVER")
        print("=" * 70)
        print(f"\nTotal Turns: {self.state.turn}")
        print(f"Maze Turns: {self.state.maze_turn}")
        print(f"Battle Turns: {self.state.battle_turn}")
        print(f"\nFinal Stats:")
        print(f"  AEGIS: {self.state.aegis['hp']} HP")
        print(f"  VELO: {self.state.velo['hp']} HP")
        
        if hasattr(self.state, 'winner'):
            winner = self.state.winner
            if winner == 'aegis':
                print(f"\n🏆 AEGIS WINS!")
            elif winner == 'velo':
                print(f"\n🏆 VELO WINS!")
            else:
                print(f"\n⚖️  DRAW!")
        
        print("\n" + "=" * 70)
    
    def get_current_state(self):
        """Get current game state"""
        return self.state.get_state()
    
    def get_events(self):
        """Get game events"""
        return self.state.events


# Export
__all__ = ['GameController']
