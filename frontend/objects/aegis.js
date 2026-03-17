/**
 * Aegis Agent Visual
 * Blue circular robot with glowing outline
 */

class AegisVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();
    
    this.createAegis();
    this.updatePosition();
    
    this.scene.add(this.group);
  }
  
  createAegis() {
    // Main body - blue sphere
    const bodyGeometry = new THREE.SphereGeometry(0.25, 32, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      emissive: 0x1e90ff,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    
    // Glow outline
    const glowGeometry = new THREE.SphereGeometry(0.28, 32, 32);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      emissive: 0x4da6ff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.set(1.15, 1.15, 1.15);
    this.group.add(glow);
    
    // Metallic plating bands
    for (let i = 0; i < 3; i++) {
      const bandGeometry = new THREE.TorusGeometry(0.25, 0.02, 8, 16);
      const bandMaterial = new THREE.MeshStandardMaterial({
        color: 0x0066cc,
        metalness: 0.9,
        roughness: 0.1
      });
      
      const band = new THREE.Mesh(bandGeometry, bandMaterial);
      band.rotation.x = (i - 1) * 0.3;
      band.castShadow = true;
      this.group.add(band);
    }
    
    // Core light orb
    const coreGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x4da6ff,
      emissive: 0x4da6ff,
      emissiveIntensity: 0.8,
      metalness: 0.5
    });
    
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.12;
    this.group.add(core);
    
    // Directional indicator
    const arrowGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      metalness: 0.6
    });
    
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.y = 0.2;
    arrow.position.z = 0.1;
    arrow.castShadow = true;
    this.group.add(arrow);
  }
  
  updatePosition(agentState = null) {
    // If agentState is provided (from backend), use it
    if (agentState) {
      const pos = this.gameState.gridToWorld(agentState.x, agentState.y);
      this.group.position.set(pos.x, 0.3, pos.z);
    } else {
      // Otherwise use gameState directly
      const pos = this.gameState.gridToWorld(this.gameState.aegis.x, this.gameState.aegis.y);
      this.group.position.set(pos.x, 0.3, pos.z);
    }
  }
  
  /**
   * Animate movement from one tile to another
   */
  animateMovement(fromX, fromY, toX, toY, duration = 0.5) {
    const startPos = this.gameState.gridToWorld(fromX, fromY);
    const endPos = this.gameState.gridToWorld(toX, toY);
    
    return new Promise(resolve => {
      const startTime = Date.now();
      const startGroupPos = this.group.position.clone();
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const eased = progress < 0.5 
          ? 2 * progress * progress 
          : -1 + (4 - 2 * progress) * progress;
        
        this.group.position.x = startPos.x + (endPos.x - startPos.x) * eased;
        this.group.position.z = startPos.z + (endPos.z - startPos.z) * eased;
        
        // Slight bounce effect
        this.group.position.y = 0.3 + Math.sin(progress * Math.PI) * 0.1;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.position.y = 0.3;
          this.updatePosition();
          resolve();
        }
      };
      
      animate();
    });
  }
  
  /**
   * Animate taking damage (flash red)
   */
  animateDamage() {
    const originalColor = 0x1e90ff;
    const damageColor = 0xff4444;
    const duration = 300;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const color = new THREE.Color();
      color.lerpColors(
        new THREE.Color(damageColor),
        new THREE.Color(originalColor),
        progress
      );
      
      this.group.children[0].material.emissive.copy(color);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.group.children[0].material.emissive.setHex(originalColor);
      }
    };
    
    animate();
  }
  
  /**
   * Animate defending (increased glow)
   */
  setDefending(defending) {
    const glowMesh = this.group.children[1];
    if (defending) {
      glowMesh.material.emissiveIntensity = 0.8;
    } else {
      glowMesh.material.emissiveIntensity = 0.4;
    }
  }
  
  /**
   * Show HP bar
   */
  updateHPDisplay(hp, maxHp) {
    // HP indicator via glow intensity
    const intensity = 0.2 + (hp / maxHp) * 0.6;
    this.group.children[1].material.emissiveIntensity = intensity;
  }
  
  /**
   * Get the mesh group
   */
  getMesh() {
    return this.group;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisVisual;
}
