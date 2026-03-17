/**
 * Grid Renderer Module
 * Creates and manages the visual representation of the grid
 */

class GridRenderer {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);
    
    this.tiles = [];
    this.trapVisuals = [];
    
    this.createGrid();
    this.createArena();
    this.createTraps();
  }
  
  /**
   * Create the base grid tiles
   */
  createGrid() {
    const SIZE = this.gameState.gridSize;
    
    for (let y = 0; y < SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < SIZE; x++) {
        const pos = this.gameState.gridToWorld(x, y);
        
        // Determine tile type
        const cellType = this.gameState.getCellType(x, y);
        let tileGeometry, tileMaterial;
        
        if (cellType === '#') {
          // Wall - dark, impassable
          tileGeometry = new THREE.BoxGeometry(1, 0.2, 1);
          tileMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.8,
            metalness: 0.2
          });
        } else {
          // Path, trap entry, or arena
          tileGeometry = new THREE.PlaneGeometry(1, 1);
          tileMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.7,
            metalness: 0.1
          });
        }
        
        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.receiveShadow = true;
        tile.castShadow = cellType === '#';
        
        if (cellType === '#') {
          tile.position.set(pos.x, 0.1, pos.z);
        } else {
          tile.position.set(pos.x, -0.01, pos.z);
        }
        
        this.gridGroup.add(tile);
        this.tiles[y][x] = tile;
      }
    }
  }
  
  /**
   * Create arena highlight with glow
   */
  createArena() {
    const arenaStart = this.gameState.arena.start;
    const arenaEnd = this.gameState.arena.end;
    const arenaSize = this.gameState.arena.size;
    
    // Create glow border around arena
    const borderGeometry = new THREE.BufferGeometry();
    const borderVertices = [];
    
    for (let y = arenaStart; y <= arenaEnd; y++) {
      for (let x = arenaStart; x <= arenaEnd; x++) {
        const pos = this.gameState.gridToWorld(x, y);
        
        // Create slightly raised floor tile
        const floorGeometry = new THREE.PlaneGeometry(1, 1);
        const floorMaterial = new THREE.MeshStandardMaterial({
          color: 0x0a4a2e,
          roughness: 0.4,
          metalness: 0.6,
          emissive: 0x1a6a4e,
          emissiveIntensity: 0.3
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(pos.x, 0.02, pos.z);
        floor.receiveShadow = true;
        this.gridGroup.add(floor);
      }
    }
    
    // Create arena border edges
    const corners = [
      { x: arenaStart - 0.5, y: arenaStart - 0.5 },
      { x: arenaEnd + 0.5, y: arenaStart - 0.5 },
      { x: arenaEnd + 0.5, y: arenaEnd + 0.5 },
      { x: arenaStart - 0.5, y: arenaEnd + 0.5 }
    ];
    
    for (let i = 0; i < corners.length; i++) {
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      
      const startPos = this.gameState.gridToWorld(current.x, current.y);
      const endPos = this.gameState.gridToWorld(next.x, next.y);
      
      const edgeLength = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) + 
        Math.pow(endPos.z - startPos.z, 2)
      );
      
      const edgeGeometry = new THREE.BoxGeometry(edgeLength, 0.1, 0.05);
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
      });
      
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.position.set(
        (startPos.x + endPos.x) / 2,
        0.1,
        (startPos.z + endPos.z) / 2
      );
      
      const angle = Math.atan2(endPos.z - startPos.z, endPos.x - startPos.x);
      edge.rotation.y = angle;
      
      this.gridGroup.add(edge);
    }
  }
  
  /**
   * Create visual traps on the grid
   */
  createTraps() {
    const traps = this.gameState.traps;
    
    traps.forEach(trap => {
      const pos = this.gameState.gridToWorld(trap.x, trap.y);
      
      // Create spike trap
      const spikeGroup = new THREE.Group();
      
      // Main pit hole
      const pitGeometry = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);
      const pitMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a0a1a,
        roughness: 0.9,
        metalness: 0.1
      });
      
      const pit = new THREE.Mesh(pitGeometry, pitMaterial);
      pit.position.y = -0.05;
      spikeGroup.add(pit);
      
      // Create 3 spikes
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const spikeGeometry = new THREE.ConeGeometry(0.08, 0.3, 8);
        const spikeMaterial = new THREE.MeshStandardMaterial({
          color: 0x660000,
          emissive: 0x330000,
          metalness: 0.7,
          roughness: 0.3
        });
        
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        spike.position.x = Math.cos(angle) * 0.15;
        spike.position.z = Math.sin(angle) * 0.15;
        spike.position.y = 0.08;
        spike.castShadow = true;
        spikeGroup.add(spike);
      }
      
      // Glow effect around trap
      const glowGeometry = new THREE.CircleGeometry(0.5, 16);
      const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x880000,
        emissive: 0x440000,
        emissiveIntensity: 0.2
      });
      
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.y = -0.09;
      spikeGroup.add(glow);
      
      spikeGroup.position.set(pos.x, 0, pos.z);
      this.gridGroup.add(spikeGroup);
      this.trapVisuals.push(spikeGroup);
    });
  }
  
  /**
   * Animate trap activation (red flash)
   */
  activateTrap(x, y) {
    const trap = this.trapVisuals.find(t => 
      Math.abs(t.position.x - this.gameState.gridToWorld(x, y).x) < 0.1 &&
      Math.abs(t.position.z - this.gameState.gridToWorld(x, y).z) < 0.1
    );
    
    if (trap) {
      const startTime = Date.now();
      const duration = 200;
      
      // Find the glow material
      const glowMesh = trap.children[1];
      if (glowMesh) {
        const originalEmissiveIntensity = 0.2;
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Flash effect
          glowMesh.material.emissiveIntensity = 0.2 + (Math.sin(progress * Math.PI * 4) * 0.8);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            glowMesh.material.emissiveIntensity = originalEmissiveIntensity;
          }
        };
        
        animate();
      }
    }
  }
  
  /**
   * Get grid group
   */
  getGridGroup() {
    return this.gridGroup;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridRenderer;
}
