import sys
import random

# Force UTF-8 output so Unicode/emoji characters don't crash on Windows (cp1252)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from core.game_controller import GameController

def main():
    """Main entry point for Neuron Bot Wars"""
    random.seed()  # Use random seed for varied gameplay
    
    controller = GameController()
    controller.simulate_full_game()
    
    # Print final state for debugging
    print("\nFinal Game State:")
    print(controller.get_current_state())

if __name__ == "__main__":
    main()
