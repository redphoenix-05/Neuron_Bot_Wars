# Neuro Bot Wars - 3D Visualization

A stunning 3D visualization of the **Neuro Bot Wars** AI simulation using **Three.js** and **WebGL**.

## Overview

This frontend visualization displays a tactical 3D board game where two AI agents (**Aegis** and **Velo**) navigate through a 7×7 maze and battle in a central 3×3 arena.

### Visual Features

- **Top-down tactical view** with orthographic camera
- **7×7 grid maze** with trap obstacles
- **Glowing arena** (3×3 center battle zone)
- **Animated agents** with smooth movement
  - **AEGIS**: Blue circular robot with metallic plating
  - **VELO**: Red aggressive robot with spikes
- **Interactive traps** with particle effects
- **Real-time HP tracking** for both agents
- **Phase transitions** (Maze Navigation → Combat)
- **Dynamic lighting** with arena spotlights

## Project Structure

```
frontend/
├── index.html                 # Main HTML file
├── style.css                  # Styling and layout
├── main.js                    # Application controller
│
├── game/
│   └── gameState.js           # Game state management
│
├── scene/
│   ├── sceneSetup.js          # Three.js scene, camera, renderer
│   └── gridRenderer.js        # Grid and maze visual
│
└── objects/
    ├── aegis.js               # Aegis agent visual
    ├── velo.js                # Velo agent visual
    ├── trap.js                # Trap visuals
    └── arena.js               # Arena visuals and effects
```

## Quick Start

### Option 1: Using Python's Built-in HTTP Server

```bash
# Navigate to the frontend directory
cd frontend

# Python 3.x
python -m http.server 8000

# Or Python 2.x
python -m SimpleHTTPServer 8000
```

Then open your browser to: `http://localhost:8000`

### Option 2: Using Node.js http-server

```bash
# Install http-server globally
npm install -g http-server

# Navigate to frontend directory
cd frontend

# Run server
http-server
```

Open: `http://localhost:8080`

### Option 3: Direct File Access

Simply open `frontend/index.html` in your browser (may have CORS limitations).

## How to Use

### Controls

- **START** - Begin game simulation
- **PAUSE** - Pause the demo
- **RESET** - Restart the visualization

### Game Display

- **Left panel**: Agent stats with HP bars
- **Top right**: Current phase and turn counter
- **Right panel**: Legend for visual elements

## Game State Management

The visualization reads from `gameState.js` which contains:

```javascript
gameState = {
  gridSize: 7,
  aegis: { x, y, hp, alive, inArena },
  velo: { x, y, hp, alive, inArena },
  traps: [{ x, y }, ...],
  maze: [[...]], // Cell types
  phase: 1 or 2,
  turnCount: number,
  ...
}
```

## Connecting to Python Backend

To connect this visualization to your Python game:

1. **Setup a WebSocket server** in your Python backend
2. **Emit game state** after each turn
3. **Update `gameState.js`** in the frontend with new positions
4. **Visualization automatically updates** via the animation loop

### Example Integration

```javascript
// In main.js, replace simulateGame() with WebSocket listener
const ws = new WebSocket('ws://localhost:8000');

ws.onmessage = (event) => {
  const state = JSON.parse(event.data);
  
  // Update game state
  gameState.aegis = state.aegis;
  gameState.velo = state.velo;
  gameState.phase = state.phase;
  gameState.traps = state.traps;
  // ... etc
};
```

## Visual Elements

### AEGIS (Blue Agent)
- Color: Bright Blue (#1e90ff)
- Design: Smooth sphere with metallic bands
- Glow: Calm blue outline
- Movement: Smooth sliding with slight bounce
- Indicator: Forward-pointing cone

### VELO (Red Agent)
- Color: Aggressive Red (#ff1744)
- Design: Sharp icosahedron with spike formations
- Glow: Pulsing orange-red aura
- Movement: Fast sliding with higher bounce and rotation
- Indicator: Forward-pointing spike

### Maze Grid
- Path cells: Dark gray
- Wall cells: Even darker with raised appearance
- Trap cells: Dark pit with red spikes and glow

### Arena (3×3 Center)
- Surface: Glowing green metallic floor
- Border: Neon green glow effect
- Lights: Corner spotlights that activate during combat

### Traps
- Appearance: Pit with spike formations
- Activation: Red flash with particle burst
- Effect: Glowing pit hole with 3-4 spikes

## Performance Optimization

- **Modular design**: Each object manages its own meshes
- **Reusable geometries**: Shared materials for similar objects
- **Efficient animations**: RequestAnimationFrame for smooth 60 FPS
- **Culling**: Three.js automatically culls off-screen objects

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Requires WebGL support (most modern browsers).

## Dependencies

- **Three.js** (r128) - CDN hosted
- HTML5 / CSS3
- JavaScript ES6+

No npm/package installation required!

## Customization

### Change Agent Appearance

```javascript
// In frontend/objects/aegis.js or velo.js
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e90ff,        // Change color
  metalness: 0.8,         // Adjust glossiness
  roughness: 0.2,         // Adjust texture
  emissiveIntensity: 0.3  // Adjust glow
});
```

### Modify Animation Speed

```javascript
// In agents' animateMovement()
duration = 0.5  // seconds
```

### Adjust Camera View

```javascript
// In scene/sceneSetup.js
const viewSize = 10;  // Zoom level
```

## Troubleshooting

### "Cannot find variable" errors
- Ensure all script files are in the HTML in correct order
- Check browser console for missing files

### Black screen
- Verify WebGL is enabled in browser
- Check for JavaScript errors in console (F12)
- Ensure Three.js CDN is accessible

### Agents not moving
- Check `gameState.moveAgent()` is being called
- Verify `updateAgentPositions()` loop is active
- Check animation promises resolve correctly

## Future Enhancements

- [ ] Mouse/keyboard camera controls
- [ ] Real-time connection to Python backend
- [ ] Damage indicators and combat animations
- [ ] Sound effects and music
- [ ] Particle system improvements
- [ ] Custom maze generation display
- [ ] Replay system for recorded games
- [ ] Statistics and analytics dashboard

## License

Part of the **Neuron Bot Wars** project.

## Credits

- **Visualization**: Three.js and WebGL
- **AI Simulation**: Python backend
- **Design**: Tactical cyberpunk aesthetic

---

**For questions or support, check the main Neuron Bot Wars repository.**
