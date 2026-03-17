/**
 * Arena Visual
 * Combat arena with special effects
 */

class ArenaVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();
    
    this.createArena();
    this.scene.add(this.group);
  }
  
  createArena() {
    const arenaStart = this.gameState.arena.start;
    const arenaEnd = this.gameState.arena.end;
    
    // Create metallic arena floor
    for (let y = arenaStart; y <= arenaEnd; y++) {
      for (let x = arenaStart; x <= arenaEnd; x++) {
        const pos = this.gameState.gridToWorld(x, y);
        
        const tileGeometry = new THREE.PlaneGeometry(1, 1);
        const tileMaterial = new THREE.MeshStandardMaterial({
          color: 0x1a4d3a,
          roughness: 0.3,
          metalness: 0.7,
          emissive: 0x2d7a5e,
          emissiveIntensity: 0.2
        });
        
        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.position.set(pos.x, 0.02, pos.z);
        tile.receiveShadow = true;
        this.group.add(tile);
      }
    }
    
    // Create glowing border
    this.createBorder();
  }
  
  createBorder() {
    const arenaStart = this.gameState.arena.start;
    const arenaEnd = this.gameState.arena.end;
    
    // Border positions
    const corners = [
      { x: arenaStart - 0.5, y: arenaStart - 0.5 },
      { x: arenaEnd + 0.5, y: arenaStart - 0.5 },
      { x: arenaEnd + 0.5, y: arenaEnd + 0.5 },
      { x: arenaStart - 0.5, y: arenaEnd + 0.5 }
    ];
    
    // Create glowing edges
    for (let i = 0; i < corners.length; i++) {
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      
      const startPos = this.gameState.gridToWorld(current.x, current.y);
      const endPos = this.gameState.gridToWorld(next.x, next.y);
      
      const edgeLength = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) + 
        Math.pow(endPos.z - startPos.z, 2)
      );
      
      // Main edge
      const edgeGeometry = new THREE.BoxGeometry(edgeLength, 0.12, 0.08);
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2
      });
      
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.position.set(
        (startPos.x + endPos.x) / 2,
        0.12,
        (startPos.z + endPos.z) / 2
      );
      
      const angle = Math.atan2(endPos.z - startPos.z, endPos.x - startPos.x);
      edge.rotation.y = angle;
      
      edge.castShadow = true;
      this.group.add(edge);
      
      // Glow effect around edge
      const glowGeometry = new THREE.BoxGeometry(edgeLength, 0.06, 0.15);
      const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.4
      });
      
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.set(
        (startPos.x + endPos.x) / 2,
        0.08,
        (startPos.z + endPos.z) / 2
      );
      glow.rotation.y = angle;
      this.group.add(glow);
    }
    
    // Create center spotlight effect
    this.createSpotlight();
  }
  
  createSpotlight() {
    // Arena center position
    const centerX = -0.5;
    const centerZ = -0.5;
    
    // Glowing center circle
    const centerGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 32);
    const centerMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a534d,
      emissive: 0x2d7a5e,
      emissiveIntensity: 0.15,
      metalness: 0.5
    });
    
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.position.set(centerX, 0.01, centerZ);
    center.receiveShadow = true;
    this.group.add(center);
  }
  
  /**
   * Animate arena activation (combat phase start)
   */
  activateCombat() {
    // Increase glow intensity
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Gradually increase all emissions
      this.group.children.forEach(child => {
        if (child.material.emissive) {
          child.material.emissiveIntensity = 0.2 + progress * 0.4;
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  /**
   * Deactivate arena (back to normal)
   */
  deactivateCombat() {
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Gradually decrease emissions
      this.group.children.forEach(child => {
        if (child.material.emissive) {
          child.material.emissiveIntensity = 0.6 - progress * 0.4;
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  /**
   * Create battle flash effect at arena center
   */
  createBattleFlash() {
    const flashGeometry = new THREE.SphereGeometry(2, 16, 16);
    const flashMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.5
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.set(-0.5, 0.5, -0.5);
    this.group.add(flash);
    
    const duration = 150;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      flash.material.opacity = 0.5 * (1 - progress);
      flash.scale.set(1 + progress * 0.5, 1 + progress * 0.5, 1 + progress * 0.5);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.group.remove(flash);
      }
    };
    
    animate();
  }
  
  /**
   * Get arena mesh group
   */
  getMesh() {
    return this.group;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArenaVisual;
}
