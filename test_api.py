#!/usr/bin/env python3
import urllib.request
import json
import sys

# Test backend directly
print("=" * 60)
print("Testing Backend Game Logic")
print("=" * 60)

from core.game_controller import GameController

print("\n1. Creating game controller...")
gc = GameController()
print("   ✓ Created")

print("2. Running simulation...")
gc.simulate_full_game()
print("   ✓ Simulation complete")

state = gc.get_current_state()
print(f"\n3. Game Results:")
print(f"   Turn: {state['turn']}")
print(f"   Phase: {state['phase']}")
print(f"   AEGIS HP: {state['aegis']['hp']}")
print(f"   VELO HP: {state['velo']['hp']}")
print(f"   Traps: {len(state['traps'])}")

print("\n" + "=" * 60)
print("Testing API Endpoint")
print("=" * 60)

try:
    print("\n1. Starting new game via API...")
    req = urllib.request.Request('http://localhost:8000/api/game/start', method='POST')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("   ✓ Backend game started successfully!")
        state = data.get('state', {})
        print(f"\n2. API Response:")
        print(f"   Turn: {state.get('turn')}")
        print(f"   Phase: {state.get('phase')}")
        print(f"   AEGIS HP: {state.get('aegis', {}).get('hp')}")
        print(f"   VELO HP: {state.get('velo', {}).get('hp')}")
        print(f"   Traps: {len(state.get('traps', []))}")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("\n✓ All tests passed!")
