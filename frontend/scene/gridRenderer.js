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
    const SIZE   = this.gameState.gridSize;
    const entry  = this.gameState.arenaEntry; // { x:3, y:1 }

    for (let x = 0; x < SIZE; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < SIZE; y++) {
        const pos      = this.gameState.gridToWorld(x, y);
        const cellType = this.gameState.getCellType(x, y);
        const isArena  = this.gameState.isInArena(x, y);

        // Arena cells are handled by ArenaVisual — skip them in the maze group
        if (isArena) {
          this.tiles[x][y] = null;
          continue;
        }

        const isEntry = (x === entry.x && y === entry.y);
        const isWall  = (cellType === '#');

        let tileGeo, tileMat;

        if (isWall) {
          // Tall wall — matching reference: BoxGeometry(1, 1.5, 1), dark 0x222233
          tileGeo = new THREE.BoxGeometry(1, 1.5, 1);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x222233, roughness: 0.8, metalness: 0.2
          });
        } else if (isEntry) {
          // Arena entry cell — green, matching reference exit tile 0x22AA44
          tileGeo = new THREE.BoxGeometry(0.95, 0.1, 0.95);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x22AA44, emissive: 0x114422,
            emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.1
          });
        } else {
          // Regular path — reference floor color 0x444455
          tileGeo = new THREE.BoxGeometry(0.95, 0.1, 0.95);
          tileMat = new THREE.MeshStandardMaterial({
            color: 0x444455, roughness: 0.7, metalness: 0.1
          });
        }

        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.receiveShadow = true;
        tile.castShadow = isWall;

        if (isWall) {
          tile.position.set(pos.x, 0.75, pos.z);  // center of 1.5-tall block
        } else {
          tile.position.set(pos.x, 0.05, pos.z);
        }

        this.mazeGroup.add(tile);
        this.tiles[x][y] = tile;
      }
    }

    // Dark ground plane beneath grid (reference: 0x080818)
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x080818, roughness: 1, metalness: 0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.mazeGroup.add(ground);
  }

  /** Create trap visuals from gameState.traps — reference style */
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

      // Colored floor tile (reference: 0x882200 emissive 0x440000)
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x882200, emissive: 0x440000,
        transparent: true, opacity: 1.0
      });
      const floor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), floorMat);
      floor.position.y = 0.05;
      spikeGroup.add(floor);

      // 4 corner spikes (reference: ConeGeometry(0.08, 0.4, 4), color 0xCC4400 emissive 0x441100)
      const spikeOffsets = [
        { x: -0.2, z: -0.2 }, { x:  0.2, z: -0.2 },
        { x: -0.2, z:  0.2 }, { x:  0.2, z:  0.2 }
      ];
      for (const offset of spikeOffsets) {
        const spikeMat = new THREE.MeshStandardMaterial({
          color: 0xCC4400, emissive: 0x441100,
          transparent: true, opacity: 1.0
        });
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), spikeMat);
        spike.position.set(offset.x, 0.3, offset.z);
        spike.castShadow = true;
        spikeGroup.add(spike);
      }

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
