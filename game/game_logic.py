import random
from copy import deepcopy
from typing import Tuple, Dict, List, Set, Optional

from core.grid import (
    TRAP_DAMAGE, MAX_MAZE_TURNS, MIN_SPAWN_DISTANCE, 
    INITIAL_HP, Action, ARENA_START, ARENA_END
)
from core.maze import Maze
from core.arena import Arena
from agents.agent_base import Agent
from agents.aegis import AegisAgent
from agents.velo import VeloAgent
from ai.pathfinding import AStarPathfinder, UniformCostSearch


class Game:
    """Main game controller for Neuron Bot Wars"""
    
    def __init__(self):
        self.maze = Maze()       # Shared layout reference (used for display)
        self.aegis_maze = None   # AEGIS's private maze copy
        self.velo_maze = None    # VELO's private maze copy
        self.arena = None        # Created when entering combat phase
        self.aegis = None
        self.velo = None
        self.turn_count = 0
        self.maze_turn_count = 0
        self.phase = 1  # 1 = Maze Navigation, 2 = Combat
        self.MAX_COMBAT_TURNS = 1000  # Prevent infinite loops

    def _build_valid_maze_and_spawns(self) -> Tuple[Maze, Tuple[int, int], Tuple[int, int], Dict[Tuple[int, int], List[Tuple[int, int]]]]:
        """
        Generate maze. No walls placed based on request. Traps scattered.
        Agents spawn far from entry, allowing trapped paths.
        """
        candidate_maze = Maze()
        # Set spawn points far from the arena entry
        valid_cells = candidate_maze.get_valid_spawn_cells(min_distance_from_entry=4)
        
        # If the grid didn't give far valid cells, fallback to opposite corners
        if len(valid_cells) >= 2:
            spawns = random.sample(valid_cells, 2)
        else:
            spawns = [(0, 0), (6, 6)]

        # Let traps block paths so they might be forced to move through one
        protected_cells = set(spawns)
        protected_cells.add(candidate_maze.arena_entry)
        candidate_maze.place_traps(protected_cells=protected_cells, trap_count=random.randint(12, 18))
        
        return candidate_maze, spawns[0], spawns[1], {}

    def _reset_maze_phase_due_to_turn_limit(self):
        """Safety fallback: regenerate maze when navigation exceeds turn cap."""
        print("\n[WARNING] MAX MAZE TURN LIMIT REACHED. REGENERATING MAZE TO PREVENT DEADLOCK...")

        self.maze, aegis_spawn, velo_spawn, _ = self._build_valid_maze_and_spawns()
        self.aegis_maze = self.maze
        self.velo_maze = deepcopy(self.maze)
        self.aegis.position = aegis_spawn
        self.velo.position = velo_spawn
        self.aegis.in_arena = False
        self.velo.in_arena = False
        self.maze_turn_count = 0

        self.aegis.pathfinder = AStarPathfinder(self.aegis_maze)
        self.velo.pathfinder = UniformCostSearch(self.velo_maze)

        print(f"   New AEGIS spawn: {self.aegis.position}")
        print(f"   New VELO spawn: {self.velo.position}")
        print(f"   Arena entry remains at: {self.maze.arena_entry}")
    
    def initialize_game(self):
        """Initialize game with agents spawned in maze"""
        print("\n" + "=" * 60)
        print(" " * 15 + "NEURON BOT WARS")
        print(" " * 12 + "AI vs AI Simulation")
        print("=" * 60)
        print("\n[GAME] Initializing...")
        print("\n[RULES] Game Rules:")
        print("  * Phase 1: Navigate maze to reach arena entry point")
        print("  * Phase 2: Combat in 3x3 arena until one agent wins")
        print("  * Traps deal 10 HP damage")
        print("  * Pulse Strike: 10 damage")
        print("  * Logic Burst: 20 damage (3 turns to charge)")
        print("  * Elemental Beam: 30 damage (once per game)")
        print("  * Defend reduces damage by 80%")
        
        # Build a maze that guarantees valid paths from both spawns to entry.
        # Each bot gets its own private deepcopy so they navigate independently.
        self.maze, aegis_spawn, velo_spawn, _ = self._build_valid_maze_and_spawns()
        self.aegis_maze = self.maze
        self.velo_maze = deepcopy(self.maze)

        self.aegis = AegisAgent(aegis_spawn)
        self.aegis.pathfinder = AStarPathfinder(self.aegis_maze)

        self.velo = VeloAgent(velo_spawn)
        self.velo.pathfinder = UniformCostSearch(self.velo_maze)
        
        print(f"\n[BOT] AEGIS ({self.aegis.color}) spawned at: {self.aegis.position}")
        print(f"   Strategy: A* pathfinding (avoids traps) + Minimax combat")
        print(f"\n[BOT] VELO ({self.velo.color}) spawned at: {self.velo.position}")
        print(f"   Strategy: Uniform Cost Search (risky) + Greedy combat")
        
        print(f"\n[TARGET] Arena Entry Point: {self.maze.arena_entry}")
        
        print("\n" + "-" * 60)
        print("PHASE 1: MAZE NAVIGATION")
        print("-" * 60)
        print("Objective: Reach the arena entry point (E)")
        print("Legend: . = path, # = wall, T = trap, E = entry")
        
        self.maze.display(self.aegis.position, self.velo.position, phase=1,
                         agent1_in_arena=self.aegis.in_arena, agent2_in_arena=self.velo.in_arena)
    
    def _wait_for_enter(self, message: str = "Press Enter to continue..."):
        """Pause execution until the user presses Enter."""
        try:
            input(f"\n[PAUSE] {message}")
        except EOFError:
            print("\n[PAUSE] Input unavailable. Continuing automatically...")

    def _ask_continue_after_match(self, current_match: int, max_matches: int) -> bool:
        """Ask whether to continue to the next match or end the series early."""
        while True:
            try:
                choice = input(
                    f"\n[MATCH MENU] Match {current_match} of {max_matches} complete. "
                    "Press Enter to play the next match or type 'end' to stop the series: "
                ).strip().lower()
            except EOFError:
                print("\n[MATCH MENU] Input unavailable. Ending the series.")
                return False

            if choice == "":
                return True
            if choice in {"end", "e", "stop", "quit", "q"}:
                return False

            print("[ERROR] Invalid choice. Press Enter to continue or type 'end' to stop.")

    def run(self):
        """Main game loop with mode selection."""
        mode = self._select_game_mode()
        max_matches = 1 if mode == '1' else 3
        
        aegis_wins = 0
        velo_wins = 0
        draws = 0

        for i in range(max_matches):
            print(f"\n\n{'#' * 60}")
            print(f"MATCH {i + 1} of {max_matches}")
            print(f"{'#' * 60}")
            self.phase = 1
            self.turn_count = 0
            self.maze_turn_count = 0

            winner = self.run_match()

            if winner == "AEGIS":
                aegis_wins += 1
            elif winner == "VELO":
                velo_wins += 1
            elif winner == "DRAW":
                draws += 1

            matches_played = i + 1

            if matches_played < max_matches:
                should_continue = self._ask_continue_after_match(matches_played, max_matches)
                if not should_continue:
                    break

        print("\n" + "=" * 60)
        print(" " * 20 + "FINAL SCORE")
        print("=" * 60)
        print(f"Matches played: {matches_played}")
        print(f"AEGIS: {aegis_wins} wins")
        print(f"VELO: {velo_wins} wins")
        print(f"Draws: {draws}")
        if aegis_wins > velo_wins:
            print("\n[FINAL] AEGIS is the overall winner!")
        elif velo_wins > aegis_wins:
            print("\n[FINAL] VELO is the overall winner!")
        else:
            print("\n[FINAL] It's a draw!")

    def _select_game_mode(self):
        """Lets the user choose between single or three-match mode."""
        while True:
            try:
                choice = input(
                    "\n[GAME MODE] Select mode:\n"
                    "  1: Single Match\n"
                    "  2: Three-Match Series\n"
                    "Enter your choice (1 or 2): "
                ).strip()
                if choice in ['1', '2']:
                    return choice
                print("[ERROR] Invalid choice. Please enter 1 or 2.")
            except EOFError:
                print("\n[MODE] Input unavailable. Defaulting to Single Match.")
                return '1'

    def run_match(self):
        """Runs a single match."""
        self.initialize_game()
        
        # Phase 1: Maze Navigation
        while self.phase == 1:
            self._run_maze_turn()

        # Transition to combat
        self._transition_to_combat()
        
        # Phase 2: Combat
        while self.phase == 2:
            # Check for combat turn limit
            if self.turn_count - self.maze_turn_count > self.MAX_COMBAT_TURNS:
                print(f"\n[TIMEOUT] Match exceeded {self.MAX_COMBAT_TURNS} combat turns. Declaring draw!")
                print(f"AEGIS HP: {self.aegis.hp}")
                print(f"VELO HP: {self.velo.hp}")
                if self.aegis.hp > self.velo.hp:
                    return self._announce_winner(self.aegis)
                elif self.velo.hp > self.aegis.hp:
                    return self._announce_winner(self.velo)
                else:
                    print("\n[DRAW] Both agents survived with equal HP!")
                    self.phase = 3
                    return "DRAW"
            
            self._run_combat_turn()
            
            # Check win conditions
            if not self.aegis.is_alive():
                return self._announce_winner(self.velo)
            elif not self.velo.is_alive():
                return self._announce_winner(self.aegis)
        return None

    