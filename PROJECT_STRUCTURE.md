# Neuro Bot Wars - Complete Project Structure

## 📁 Project Overview

Neuron Bot Wars is a comprehensive AI simulation project with:
- **Backend**: Python game logic and AI agents
- **Frontend**: Real-time 3D visualization using Three.js

```
Neuron_Bot_Wars/
├── README.md                           # Main project README
├── .gitignore                         # Git ignore file
│
├── backend/                           # Original Python game
│   ├── __init__.py
│   ├── main.py                        # Main entry point
│   ├── PROJECT_SUMMARY.md
│   ├── neuro_bot_wars_project_proposal.md
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── agent_base.py             # Base agent class
│   │   ├── aegis.py                  # AEGIS AI agent
│   │   └── velo.py                   # VELO AI agent
│   │
│   ├── ai/
│   │   ├── __init__.py
│   │   └── pathfinding.py            # A* and UCS algorithms
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── grid.py                   # Grid constants and types
│   │   ├── maze.py                   # Maze generation
│   │   └── arena.py                  # Arena and combat
│   │
│   └── game/
│       ├── __init__.py
│       └── game_logic.py             # Main game controller
│
├── frontend/                          # Three.js Web Visualization
│   ├── index.html                    # Main HTML file ⭐
│   ├── style.css                     # Styling
│   ├── main.js                       # Application controller
│   ├── server.py                     # Simple HTTP server
│   │
│   ├── README.md                     # Frontend documentation
│   ├── QUICKSTART.md                 # Quick start guide
│   ├── INTEGRATION_GUIDE.md          # Backend integration guide
│   │
│   ├── game/
│   │   └── gameState.js              # Game state model
│   │
│   ├── scene/
│   │   ├── sceneSetup.js            # Three.js scene setup
│   │   └── gridRenderer.js          # Grid and maze rendering
│   │
│   └── objects/
│       ├── aegis.js                 # AEGIS visual object
│       ├── velo.js                  # VELO visual object
│       ├── trap.js                  # Trap visual objects
│       └── arena.js                 # Arena visual object
│
└── docs/                             # Documentation
    ├── PROJECT_STRUCTURE.md          # This file
    ├── DEPLOYMENT.md                # Deployment guide
    └── API.md                       # API reference
```

## 🎮 Backend Components

### `agents/`
- **agent_base.py**: Base `Agent` class with core mechanics
  - Movement and combat actions
  - HP management
  - Action history tracking
  
- **aegis.py**: AEGIS AI Agent
  - Uses A* pathfinding algorithm
  - Defensive tactics
  - Strategic movement
  
- **velo.py**: VELO AI Agent
  - Uses Uniform Cost Search pathfinding
  - Aggressive tactics
  - Tactical combat

### `ai/`
- **pathfinding.py**: AI algorithms
  - A* pathfinding (AEGIS)
  - Uniform Cost Search (VELO)
  - Heuristics and cost functions

### `core/`
- **grid.py**: Game constants and enums
  - Cell types (WALL, PATH, TRAP, ARENA, ENTRY)
  - Game parameters (HP, damage values)
  - Direction and action types
  
- **maze.py**: Maze generation and management
  - Dynamic maze generation
  - Trap placement
  - Path validation
  
- **arena.py**: Combat arena (3×3)
  - Item spawning (health kits, power-ups)
  - Arena-specific mechanics
  - Combat damage handling

### `game/`
- **game_logic.py**: Main game orchestrator
  - Game phases (Maze Navigation, Combat)
  - Turn management
  - Agent AI decision making
  - Combat resolution

## 🌐 Frontend Components

### `game/gameState.js`
Central game state management:
```javascript
{
  gridSize: 7,
  aegis: { x, y, hp, alive, inArena },
  velo: { x, y, hp, alive, inArena },
  traps: [{ x, y }, ...],
  maze: [[cellTypes]],
  phase: 1 or 2,
  turnCount,
  arenaEntry: { x, y }
}
```

### `scene/sceneSetup.js`
Three.js scene initialization:
- Scene, camera, renderer setup
- Orthographic camera for top-down view
- Lighting (ambient, directional, point lights)
- Window resize handling

### `scene/gridRenderer.js`
Grid and maze visualization:
- Creates 7×7 tile grid
- Renders maze cells
- Creates arena highlight
- Manages trap visuals

### `objects/aegis.js`
AEGIS visual representation:
- Blue sphere with metallic plating
- Glowing outline effect
- Movement animations
- HP-based glow intensity

### `objects/velo.js`
VELO visual representation:
- Red icosahedron with spikes
- Pulsing aggressive glow
- Fast movement with rotation
- HP-based core intensity

### `objects/trap.js`
Trap visual effects:
- Pit hole with spike formations
- Activation flash and particles
- Dynamic particle burst effect

### `objects/arena.js`
Arena visualization:
- 3×3 metallic combat floor
- Glowing neon border
- Corner spotlights
- Combat phase activation effects

### `main.js`
Application controller:
- Orchestrates all visuals
- Animation loop management
- UI control handlers
- Demo simulation or WebSocket connection

## 🎯 Game Phases

### Phase 1: Maze Navigation
- Agents move from spawn to arena entry
- Maze is 7×7 grid
- Traps scatter damage
- AI uses pathfinding algorithms

### Phase 2: Combat Arena
- Battle in 3×3 center arena
- Turn-based combat system
- Multiple attack types available
- Ends when one agent dies

## 🔄 Communication Protocol

### Demo Mode (Default)
- Frontend runs pre-programmed demo moves
- Useful for testing visualization

### WebSocket Mode (Production)
- Python backend sends JSON game state
- Frontend updates visualization in real-time
- 60 FPS smooth animations

```json
{
  "aegis": {
    "x": 3,
    "y": 3,
    "hp": 85,
    "alive": true,
    "inArena": true
  },
  "velo": {
    "x": 2,
    "y": 3,
    "hp": 92,
    "alive": true,
    "inArena": true
  },
  "traps": [
    {"x": 2, "y": 1},
    {"x": 4, "y": 5}
  ],
  "phase": 2,
  "turnCount": 15,
  "arenaEntry": {"x": 2, "y": 3}
}
```

## 📊 Technical Stack

### Backend
- **Language**: Python 3.7+
- **Threading**: asyncio for WebSocket server
- **Networking**: websockets library
- **Algorithms**: A*, Uniform Cost Search

### Frontend
- **Graphics**: Three.js (r128)
- **Language**: JavaScript ES6+
- **Styling**: CSS3 with animations
- **Server**: Python http.server

## 🚀 Getting Started

### Run Backend Only
```bash
cd backend
python main.py
```

### Run Frontend Only (Demo)
```bash
cd frontend
python server.py
# Open http://localhost:8000
```

### Run Both Together
1. Terminal 1: `cd backend && python main.py`
2. Terminal 2: `cd frontend && python server.py`
3. Browser: `http://localhost:8000`

See INTEGRATION_GUIDE.md for detailed setup.

## 🎨 Visual Design

### Colors
- **AEGIS**: Blue (#1e90ff) with calm glow
- **VELO**: Red (#ff1744) with aggressive glow
- **Arena**: Green (#00ff88) glowing border
- **Traps**: Red (#ff4444) with dark pit
- **Maze**: Dark gray (#1a1a2e)

### Camera
- **View**: Top-down orthographic
- **Tilt**: Directly overhead
- **Zoom**: Adjustable for arena focus
- **Follow**: Static or agent-centered

### Animations
- **Movement**: 400-500ms tile-to-tile
- **Damage**: 200-300ms flash effect
- **Particle effects**: Burst on trap activation
- **Glow**: Continuous pulsing

## 📈 Performance Metrics

- **Target FPS**: 60
- **Load Time**: < 2 seconds
- **Memory**: ~100MB
- **Network**: <1KB per frame (WebSocket)

## 🔧 Configuration

### Game Parameters (backend)
- Grid size: 7×7
- Arena size: 3×3
- Initial HP: 100
- Trap damage: 10
- Combat timeout: 1000 turns

### Visual Parameters (frontend)
- Tile size: 1 unit
- Camera height: 10 units
- Animation speed: 0.4-0.5 seconds
- Particle lifetime: 400ms

## 📚 Documentation

- **README.md**: Project overview
- **QUICKSTART.md**: 30-second setup
- **INTEGRATION_GUIDE.md**: Backend connection
- **API.md**: Function reference (if created)
- **DEPLOYMENT.md**: Production deployment

## 🐛 Debugging

### Frontend Console (F12)
- Check for JavaScript errors
- Monitor WebSocket connection
- Inspect game state

### Backend Logs
- Run with `--debug` flag
- Enable Python logging
- Monitor game state printouts

## 🌟 Future Enhancements

- [ ] Save/replay system
- [ ] Multiple game modes
- [ ] Difficulty settings
- [ ] Statistics dashboard
- [ ] Real-time spectator mode
- [ ] Network multiplayer testing
- [ ] Advanced AI strategies
- [ ] Custom maze designer

## 📝 License

Part of the Neuron Bot Wars project.

## 👥 Contributors

- AI Backend: Python implementation
- Visualization: Three.js/WebGL

---

For questions, see the respective README files in backend/ and frontend/ directories.
