"""
Clean Game Controller
Manages game flow, turns, and AI decisions.
Uses AegisAgent (A* + Minimax) and VeloAgent (UCS + Greedy) for real AI.
Records every turn as a structured replay event for the frontend visualizer.
"""

import random
from core.game_state_manager import GameStateManager
from agents.aegis import AegisAgent
from agents.velo import VeloAgent
from ai.pathfinding import AStarPathfinder, UniformCostSearch
from core.maze import Maze
from core.arena import Arena
from core.grid import Action, TRAP_DAMAGE, ARENA_START, ARENA_END, ItemType


class GameController:
    """Main game controller - manages game flow without freezing"""
    
    def __init__(self):
        self.state = GameStateManager()
        self.max_maze_iterations = 50
        self.max_battle_iterations = 200
        self.replay = []
        self.maze = None
        self.maze_agent_aegis = None
        self.maze_agent_velo = None
    
    def _agent_snapshot(self, agent_obj):
        """Create a snapshot dict of an agent for replay events."""
        return {
            'x': agent_obj.position[0],
            'y': agent_obj.position[1],
            'hp': agent_obj.hp,
            'alive': agent_obj.is_alive(),
            'inArena': agent_obj.in_arena
        }
    
    def _emit(self, event_type, turn, phase, aegis_agent, velo_agent, **extra):
        """Append a replay event."""
        entry = {
            'type': event_type,
            'turn': turn,
            'phase': phase,
            'aegis': self._agent_snapshot(aegis_agent),
            'velo': self._agent_snapshot(velo_agent),
        }
        entry.update(extra)
        self.replay.append(entry)
    
    def simulate_full_game(self):
        """Run a complete game simulation"""
        print("\n" + "=" * 70)
        print(" " * 20 + "NEURON BOT WARS")
        print(" " * 15 + "AI Combat Visualization")
        print("=" * 70)
        
        self.replay = []
        
        # Phase 1: Maze Navigation
        self._run_maze_phase()
        
        # Phase 2: Transition
        self._run_transition_phase()
        
        # Phase 3: Battle
        self._run_battle_phase()
        
        # Phase 4: End
        self._print_results()
    
    def _run_maze_phase(self):
        """Run maze navigation phase using real A* and UCS pathfinding"""
        print("\n" + "-" * 70)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 70)
        
        # Create maze
        self.maze = Maze()
        
        # Create agents at spawn positions
        aegis_agent = AegisAgent(self.state.AGENT_SPAWN_AEGIS)
        velo_agent = VeloAgent(self.state.AGENT_SPAWN_VELO)
        
        # Assign pathfinders
        aegis_agent.pathfinder = AStarPathfinder(self.maze)
        velo_agent.pathfinder = UniformCostSearch(self.maze)
        
        # Place traps (6-10)
        trap_count = random.randint(6, 10)
        protected = {self.state.AGENT_SPAWN_AEGIS, self.state.AGENT_SPAWN_VELO, self.maze.arena_entry}
        self.maze.place_traps(protected_cells=protected, trap_count=trap_count)
        
        # Sync trap positions to state
        self.state.traps = list(self.maze.traps)
        
        print(f"AEGIS spawns at: {self.state.AGENT_SPAWN_AEGIS}")
        print(f"VELO spawns at: {self.state.AGENT_SPAWN_VELO}")
        print(f"Arena Entry: {self.maze.arena_entry}")
        print(f"Total Traps: {len(self.state.traps)}")
        
        self.state.change_state(self.state.STATE_MAZE)
        
        # Emit GAME_START
        self._emit('GAME_START', 0, 'maze', aegis_agent, velo_agent,
                    traps=[list(t) for t in self.state.traps],
                    arenaEntry=list(self.maze.arena_entry),
                    aegisSpawn=list(self.state.AGENT_SPAWN_AEGIS),
                    veloSpawn=list(self.state.AGENT_SPAWN_VELO))
        
        aegis_done = False
        velo_done = False
        maze_winner = None
        iteration = 0
        
        while iteration < self.max_maze_iterations:
            if aegis_done and velo_done:
                break
            
            iteration += 1
            self.state.next_maze_turn()
            
            # AEGIS move
            if not aegis_done:
                old_pos = aegis_agent.position
                next_pos = aegis_agent.decide_maze_move(self.maze)
                
                trap_hit = False
                damage = 0
                
                if next_pos != old_pos:
                    aegis_agent.move(next_pos)
                    
                    # Check trap
                    if next_pos in self.maze.traps:
                        trap_hit = True
                        damage = TRAP_DAMAGE
                        aegis_agent.hp = max(0, aegis_agent.hp - damage)
                    
                    # Sync to state
                    self.state.aegis['x'] = next_pos[0]
                    self.state.aegis['y'] = next_pos[1]
                    self.state.aegis['hp'] = aegis_agent.hp
                    
                    self._emit('MAZE_MOVE', self.state.turn, 'maze', aegis_agent, velo_agent,
                               agent='aegis',
                               **{'from': list(old_pos), 'to': list(next_pos),
                                  'trapHit': trap_hit, 'damage': damage})
                    
                    status = f"→ ({next_pos[0]}, {next_pos[1]})"
                    if trap_hit:
                        status += f" [TRAP -{damage} HP]"
                    print(f"[Turn {self.state.turn}] AEGIS(HP:{aegis_agent.hp}) {status}")
                    
                    # Check if reached arena entry
                    if next_pos == self.maze.arena_entry:
                        aegis_done = True
                        if maze_winner is None:
                            maze_winner = 'aegis'
                            self._emit('MAZE_WINNER', self.state.turn, 'maze', aegis_agent, velo_agent,
                                       agent='aegis')
                            print(f"  >> AEGIS reached arena entry FIRST!")
            
            # VELO move
            if not velo_done:
                old_pos = velo_agent.position
                next_pos = velo_agent.decide_maze_move(self.maze)
                
                trap_hit = False
                damage = 0
                
                if next_pos != old_pos:
                    velo_agent.move(next_pos)
                    
                    # Check trap
                    if next_pos in self.maze.traps:
                        trap_hit = True
                        damage = TRAP_DAMAGE
                        velo_agent.hp = max(0, velo_agent.hp - damage)
                    
                    # Sync to state
                    self.state.velo['x'] = next_pos[0]
                    self.state.velo['y'] = next_pos[1]
                    self.state.velo['hp'] = velo_agent.hp
                    
                    self._emit('MAZE_MOVE', self.state.turn, 'maze', aegis_agent, velo_agent,
                               agent='velo',
                               **{'from': list(old_pos), 'to': list(next_pos),
                                  'trapHit': trap_hit, 'damage': damage})
                    
                    status = f"→ ({next_pos[0]}, {next_pos[1]})"
                    if trap_hit:
                        status += f" [TRAP -{damage} HP]"
                    print(f"[Turn {self.state.turn}] VELO(HP:{velo_agent.hp}) {status}")
                    
                    # Check if reached arena entry
                    if next_pos == self.maze.arena_entry:
                        velo_done = True
                        if maze_winner is None:
                            maze_winner = 'velo'
                            self._emit('MAZE_WINNER', self.state.turn, 'maze', aegis_agent, velo_agent,
                                       agent='velo')
                            print(f"  >> VELO reached arena entry FIRST!")
        
        if iteration >= self.max_maze_iterations:
            print(f"\n! Max maze turns reached ({self.max_maze_iterations})")
        else:
            print(f"\n✓ Both agents reached arena entry!")
        
        # Store state
        self.state.maze_winner = maze_winner
        self.maze_agent_aegis = aegis_agent
        self.maze_agent_velo = velo_agent
    
    def _run_transition_phase(self):
        """Run transition phase — move agents to battle spawn positions inside arena"""
        print("\n" + "-" * 70)
        print("PHASE TRANSITION: MAZE → BATTLE")
        print("-" * 70)
        
        self.state.change_state(self.state.STATE_TRANSITION)
        
        aegis_agent = self.maze_agent_aegis
        velo_agent = self.maze_agent_velo
        
        # Battle spawn positions inside the 3×3 arena (rows 2-4, cols 2-4)
        # AEGIS at (3, 2) — left side of arena
        # VELO at (3, 4)  — right side of arena
        aegis_battle_pos = (3, 2)
        velo_battle_pos = (3, 4)
        
        # Update agent positions
        aegis_agent.position = aegis_battle_pos
        aegis_agent.in_arena = True
        velo_agent.position = velo_battle_pos
        velo_agent.in_arena = True
        
        # Sync to state
        self.state.aegis['x'] = aegis_battle_pos[0]
        self.state.aegis['y'] = aegis_battle_pos[1]
        self.state.aegis['inArena'] = True
        self.state.velo['x'] = velo_battle_pos[0]
        self.state.velo['y'] = velo_battle_pos[1]
        self.state.velo['inArena'] = True
        
        print(f"✓ AEGIS spawning at battle position {aegis_battle_pos}")
        print(f"✓ VELO spawning at battle position {velo_battle_pos}")
        
        self._emit('TRANSITION', self.state.turn, 'transition', aegis_agent, velo_agent)
        self._emit('BATTLE_SPAWN', self.state.turn, 'transition', aegis_agent, velo_agent,
                    aegisPos=list(aegis_battle_pos), veloPos=list(velo_battle_pos))
    
    def _run_battle_phase(self):
        """Run battle phase using real AegisAgent (Minimax) and VeloAgent (Greedy) AI"""
        print("\n" + "-" * 70)
        print("PHASE 2: BATTLE ARENA")
        print("-" * 70)
        
        self.state.change_state(self.state.STATE_BATTLE)
        
        arena = Arena()
        aegis_agent = self.maze_agent_aegis
        velo_agent = self.maze_agent_velo
        
        # Sync HP from state (in case maze damage was applied)
        aegis_agent.hp = self.state.aegis['hp']
        velo_agent.hp = self.state.velo['hp']
        
        iteration = 0
        
        while iteration < self.max_battle_iterations:
            # Check win conditions
            if not aegis_agent.is_alive():
                print(f"\n✗ AEGIS defeated!")
                self.state.battle_winner = 'velo'
                break
            if not velo_agent.is_alive():
                print(f"\n✗ VELO defeated!")
                self.state.battle_winner = 'aegis'
                break
            
            iteration += 1
            self.state.next_battle_turn()
            
            # ── AEGIS turn ──
            if aegis_agent.is_alive() and velo_agent.is_alive():
                action, move_target = aegis_agent.decide_combat_action(arena, velo_agent, self.maze)
                damage = 0
                attack_type = None
                
                if action == Action.MOVE and move_target:
                    aegis_agent.move(move_target)
                elif action == Action.PULSE_STRIKE:
                    damage = aegis_agent.pulse_strike(velo_agent)
                    attack_type = 'pulse_strike'
                elif action == Action.LOGIC_BURST:
                    damage = aegis_agent.logic_burst(velo_agent)
                    attack_type = 'logic_burst'
                elif action == Action.ELEMENTAL_BEAM:
                    damage = aegis_agent.elemental_beam(velo_agent)
                    attack_type = 'elemental_beam'
                elif action == Action.DEFEND:
                    aegis_agent.defend()
                elif action == Action.WAIT:
                    aegis_agent.wait()
                
                # Charge logic burst for next turn
                if action != Action.LOGIC_BURST:
                    aegis_agent.logic_burst_charge = min(3, aegis_agent.logic_burst_charge + 1)
                
                # Sync state
                self.state.aegis['x'] = aegis_agent.position[0]
                self.state.aegis['y'] = aegis_agent.position[1]
                self.state.aegis['hp'] = aegis_agent.hp
                self.state.aegis['alive'] = aegis_agent.is_alive()
                self.state.velo['hp'] = velo_agent.hp
                self.state.velo['alive'] = velo_agent.is_alive()
                
                self._emit('BATTLE_ACTION', self.state.turn, 'battle', aegis_agent, velo_agent,
                            agent='aegis',
                            action=action.value,
                            target=list(move_target) if move_target else None,
                            damage=damage,
                            attackType=attack_type,
                            aegisHpAfter=aegis_agent.hp,
                            veloHpAfter=velo_agent.hp)
                
                action_str = action.value
                dmg_str = f" -{damage}HP" if damage > 0 else ""
                print(f"[Turn {self.state.turn}] AEGIS: {action_str}{dmg_str} | AEGIS:{aegis_agent.hp} VELO:{velo_agent.hp}")
                
                # Check if velo died from this action
                if not velo_agent.is_alive():
                    self.state.battle_winner = 'aegis'
                    break
            
            # ── VELO turn ──
            if aegis_agent.is_alive() and velo_agent.is_alive():
                action, move_target = velo_agent.decide_combat_action(arena, aegis_agent, self.maze)
                damage = 0
                attack_type = None
                
                if action == Action.MOVE and move_target:
                    velo_agent.move(move_target)
                elif action == Action.PULSE_STRIKE:
                    damage = velo_agent.pulse_strike(aegis_agent)
                    attack_type = 'pulse_strike'
                elif action == Action.LOGIC_BURST:
                    damage = velo_agent.logic_burst(aegis_agent)
                    attack_type = 'logic_burst'
                elif action == Action.ELEMENTAL_BEAM:
                    damage = velo_agent.elemental_beam(aegis_agent)
                    attack_type = 'elemental_beam'
                elif action == Action.DEFEND:
                    velo_agent.defend()
                elif action == Action.WAIT:
                    velo_agent.wait()
                
                # Charge logic burst for next turn
                if action != Action.LOGIC_BURST:
                    velo_agent.logic_burst_charge = min(3, velo_agent.logic_burst_charge + 1)
                
                # Sync state
                self.state.velo['x'] = velo_agent.position[0]
                self.state.velo['y'] = velo_agent.position[1]
                self.state.velo['hp'] = velo_agent.hp
                self.state.velo['alive'] = velo_agent.is_alive()
                self.state.aegis['hp'] = aegis_agent.hp
                self.state.aegis['alive'] = aegis_agent.is_alive()
                
                self._emit('BATTLE_ACTION', self.state.turn, 'battle', aegis_agent, velo_agent,
                            agent='velo',
                            action=action.value,
                            target=list(move_target) if move_target else None,
                            damage=damage,
                            attackType=attack_type,
                            aegisHpAfter=aegis_agent.hp,
                            veloHpAfter=velo_agent.hp)
                
                action_str = action.value
                dmg_str = f" -{damage}HP" if damage > 0 else ""
                print(f"[Turn {self.state.turn}] VELO: {action_str}{dmg_str} | AEGIS:{aegis_agent.hp} VELO:{velo_agent.hp}")
                
                # Check if aegis died from this action
                if not aegis_agent.is_alive():
                    self.state.battle_winner = 'velo'
                    break
            
            # ── Item spawn triggers ──
            if aegis_agent.hp <= 20 or velo_agent.hp <= 20:
                if not arena.health_spawned:
                    occupied = {aegis_agent.position, velo_agent.position}
                    spawned = arena.spawn_health_pack(occupied)
                    if spawned:
                        # Find the spawned medkit position
                        for pos, item in arena.items.items():
                            if item == ItemType.MEDKIT:
                                global_pos = (pos[0] + ARENA_START, pos[1] + ARENA_START)
                                self._emit('ITEM_SPAWNED', self.state.turn, 'battle', aegis_agent, velo_agent,
                                            itemType='medkit', pos=list(global_pos))
                                print(f"  >> Medkit spawned at {global_pos}")
                                break
            
            # ── Item pickup check ──
            for agent_obj, agent_name in [(aegis_agent, 'aegis'), (velo_agent, 'velo')]:
                arena_pos = arena.convert_to_arena_coords(agent_obj.position)
                if arena.can_pickup_item(arena_pos[0], arena_pos[1], agent_obj.name):
                    item = arena.get_item(arena_pos[0], arena_pos[1], agent_obj.name)
                    if item:
                        agent_obj.pickup_item(item)
                        # Sync HP after potential heal
                        self.state.aegis['hp'] = aegis_agent.hp
                        self.state.velo['hp'] = velo_agent.hp
                        item_name = 'medkit' if item == ItemType.MEDKIT else 'powerup'
                        self._emit('ITEM_COLLECTED', self.state.turn, 'battle', aegis_agent, velo_agent,
                                    agent=agent_name, itemType=item_name,
                                    pos=list(agent_obj.position))
                        print(f"  >> {agent_name.upper()} collected {item_name}")
        
        # Handle max iterations
        if iteration >= self.max_battle_iterations:
            print(f"\n! Max battle turns reached ({self.max_battle_iterations})")
            if aegis_agent.hp > velo_agent.hp:
                self.state.battle_winner = 'aegis'
            elif velo_agent.hp > aegis_agent.hp:
                self.state.battle_winner = 'velo'
            else:
                self.state.battle_winner = 'draw'
        
        # Determine overall winner
        self.state.winner = self.state.battle_winner
        
        # Emit GAME_OVER
        self._emit('GAME_OVER', self.state.turn, 'finished', aegis_agent, velo_agent,
                    winner=self.state.winner or 'draw',
                    mazeWinner=self.state.maze_winner,
                    battleWinner=self.state.battle_winner,
                    aegisFinalHp=aegis_agent.hp,
                    veloFinalHp=velo_agent.hp)
    
    def _print_results(self):
        """Print game results"""
        self.state.change_state(self.state.STATE_FINISHED)
        
        print("\n" + "=" * 70)
        print(" " * 25 + "GAME OVER")
        print("=" * 70)
        print(f"\nTotal Turns: {self.state.turn}")
        print(f"Maze Turns: {self.state.maze_turn}")
        print(f"Battle Turns: {self.state.battle_turn}")
        print(f"Maze Winner: {self.state.maze_winner}")
        print(f"Battle Winner: {self.state.battle_winner}")
        print(f"\nFinal Stats:")
        print(f"  AEGIS: {self.state.aegis['hp']} HP")
        print(f"  VELO: {self.state.velo['hp']} HP")
        
        winner = self.state.winner
        if winner == 'aegis':
            print(f"\n🏆 AEGIS WINS!")
        elif winner == 'velo':
            print(f"\n🏆 VELO WINS!")
        else:
            print(f"\n⚖️  DRAW!")
        
        print(f"\nReplay events: {len(self.replay)}")
        print("=" * 70)
    
    def get_current_state(self):
        """Get current game state"""
        return self.state.get_state()
    
    def get_replay(self):
        """Get the full replay event list"""
        return self.replay
    
    def get_events(self):
        """Get game events"""
        return self.state.events


# Export
__all__ = ['GameController']
