/**
 * Grid Renderer Module
 * Renders the 7×7 maze grid, traps, and arena highlights.
 * Supports showMaze/hideMaze for phase toggling.
 */

class GridRenderer {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;

    // Separate groups for phase visibility
    this.mazeGroup  = new THREE.Group();
    this.trapGroup  = new THREE.Group();

    this.scene.add(this.mazeGroup);
    this.scene.add(this.trapGroup);

    this.tiles = [];
    this.trapVisuals = [];

    this.createGrid();
    this.createTraps();
  }

  /** Create the 7×7 grid tiles */
  createGrid() {
    const SIZE = this.gameState.gridSize;

    for (let y = 0; y < SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < SIZE; x++) {
        const pos = this.gameState.gridToWorld(x, y);
        const cellType = this.gameState.getCellType(x, y);
        const isArena  = this.gameState.isInArena(x, y);

        let tileGeo, tileMat;

        if (cellType === '#') {
          // Wall — raised dark block
          tileGeo = new THREE.BoxGeometry(0.95, 0.25, 0.95);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a, roughness: 0.8, metalness: 0.2
          });
        } else if (isArena) {
          // Arena cell — slightly different color, will be overlaid by ArenaVisual
          tileGeo = new THREE.BoxGeometry(0.95, 0.05, 0.95);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x0a3a2e, roughness: 0.5, metalness: 0.4,
            emissive: 0x0a3a2e, emissiveIntensity: 0.1
          });
        } else {
          // Path
          tileGeo = new THREE.BoxGeometry(0.95, 0.05, 0.95);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e, roughness: 0.7, metalness: 0.1
          });
        }

        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.receiveShadow = true;
        tile.castShadow = (cellType === '#');

        if (cellType === '#') {
          tile.position.set(pos.x, 0.125, pos.z);
        } else {
          tile.position.set(pos.x, 0.025, pos.z);
        }

        this.mazeGroup.add(tile);
        this.tiles[y][x] = tile;
      }
    }

    // Ground plane beneath grid
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x080818, roughness: 1, metalness: 0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.mazeGroup.add(ground);
  }

  /** Create trap visuals from gameState.traps */
  createTraps() {
    // Clear old
    while (this.trapGroup.children.length > 0) {
      this.trapGroup.remove(this.trapGroup.children[0]);
    }
    this.trapVisuals = [];

    const traps = this.gameState.traps;

    traps.forEach(trap => {
      const pos = this.gameState.gridToWorld(trap.x, trap.y);
      const spikeGroup = new THREE.Group();

      // Pit
      const pitGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);
      const pitMat = new THREE.MeshStandardMaterial({
        color: 0x1a0a1a, roughness: 0.9, metalness: 0.1
      });
      const pit = new THREE.Mesh(pitGeo, pitMat);
      pit.position.y = -0.02;
      spikeGroup.add(pit);

      // Spikes
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const spikeGeo = new THREE.ConeGeometry(0.06, 0.25, 6);
        const spikeMat = new THREE.MeshStandardMaterial({
          color: 0x660000, emissive: 0x330000,
          emissiveIntensity: 0.2, metalness: 0.7, roughness: 0.3
        });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.x = Math.cos(angle) * 0.12;
        spike.position.z = Math.sin(angle) * 0.12;
        spike.position.y = 0.08;
        spike.castShadow = true;
        spikeGroup.add(spike);
      }

      // Glow
      const glowGeo = new THREE.CircleGeometry(0.35, 16);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x880000, emissive: 0x440000, emissiveIntensity: 0.15
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.04;
      spikeGroup.add(glow);

      spikeGroup.position.set(pos.x, 0, pos.z);
      spikeGroup.userData = { gridX: trap.x, gridY: trap.y };
      this.trapGroup.add(spikeGroup);
      this.trapVisuals.push(spikeGroup);
    });
  }

  /** Rebuild trap visuals after new game */
  rebuildTraps() {
    this.createTraps();
  }

  /** Animate trap activation */
  activateTrap(x, y) {
    const trap = this.trapVisuals.find(t =>
      t.userData && t.userData.gridX === x && t.userData.gridY === y
    );

    if (!trap) return;

    const dur = 300;
    const start = Date.now();

    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      trap.children.forEach(child => {
        if (child.material && child.material.emissive) {
          child.material.emissiveIntensity = 0.2 + Math.sin(p * Math.PI * 4) * 0.8;
        }
      });
      if (p < 1) requestAnimationFrame(anim);
      else {
        // Fade out trap after activation
        trap.children.forEach(child => {
          if (child.material) {
            child.material.emissiveIntensity = 0.05;
            child.material.opacity = 0.3;
            child.material.transparent = true;
          }
        });
      }
    };
    anim();
  }

  /** Show maze tiles + traps */
  showMaze() {
    this.mazeGroup.visible = true;
    this.trapGroup.visible = true;
  }

  /** Hide maze tiles + traps (for battle phase) */
  hideMaze() {
    this.mazeGroup.visible = false;
    this.trapGroup.visible = false;
  }

  getGridGroup() { return this.mazeGroup; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridRenderer;
}
