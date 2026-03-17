/**
 * Velo Agent Visual
 * Red circular robot with aggressive glow
 */

class VeloVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();
    
    this.createVelo();
    this.updatePosition();
    
    this.scene.add(this.group);
  }
  
  createVelo() {
    // Main body - red icosahedron for sharper look
    const bodyGeometry = new THREE.IcosahedronGeometry(0.25, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff1744,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.15
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    
    // Aggressive glow outline
    const glowGeometry = new THREE.IcosahedronGeometry(0.28, 3);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5722,
      emissive: 0xff9100,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.set(1.2, 1.2, 1.2);
    this.group.add(glow);
    
    // Sharp spike formations
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const spikeGeometry = new THREE.ConeGeometry(0.06, 0.3, 8);
      const spikeMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5722,
        metalness: 0.8,
        roughness: 0.2
      });
      
      const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
      spike.position.x = Math.cos(angle) * 0.25;
      spike.position.z = Math.sin(angle) * 0.25;
      spike.position.y = 0.15;
      spike.rotation.z = -Math.PI / 4;
      spike.castShadow = true;
      this.group.add(spike);
    }
    
    // Aggressive core light
    const coreGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5722,
      emissive: 0xff5722,
      emissiveIntensity: 1.0,
      metalness: 0.4
    });
    
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.15;
    this.group.add(core);
    
    // Pulsing ring around body
    const ringGeometry = new THREE.TorusGeometry(0.35, 0.015, 8, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff1744,
      emissiveIntensity: 0.5,
      metalness: 0.9
    });
    
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 4;
    ring.castShadow = true;
    this.group.add(ring);
    
    // Directional indicator (more aggressive)
    const arrowGeometry = new THREE.ConeGeometry(0.07, 0.2, 8);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5722,
      metalness: 0.7
    });
    
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.y = 0.22;
    arrow.position.z = 0.12;
    arrow.castShadow = true;
    this.group.add(arrow);
    
    // Start pulsing animation
    this.startPulseAnimation();
  }
  
  startPulseAnimation() {
    const animate = () => {
      const time = Date.now() * 0.003;
      const pulse = Math.sin(time) * 0.2 + 0.4;
      
      if (this.group.children[1]) {
        this.group.children[1].material.emissiveIntensity = pulse;
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
  
  updatePosition(agentState = null) {
    // If agentState is provided (from backend), use it
    if (agentState) {
      const pos = this.gameState.gridToWorld(agentState.x, agentState.y);
      this.group.position.set(pos.x, 0.3, pos.z);
    } else {
      // Otherwise use gameState directly
      const pos = this.gameState.gridToWorld(this.gameState.velo.x, this.gameState.velo.y);
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
        
        // Easing function with more aggressive feel
        const eased = progress < 0.5 
          ? 2 * progress * progress 
          : -1 + (4 - 2 * progress) * progress;
        
        this.group.position.x = startPos.x + (endPos.x - startPos.x) * eased;
        this.group.position.z = startPos.z + (endPos.z - startPos.z) * eased;
        
        // Higher bounce effect
        this.group.position.y = 0.3 + Math.sin(progress * Math.PI) * 0.15;
        
        // Rotation during movement
        this.group.rotation.y += 0.1;
        
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
   * Animate taking damage (intense red flash)
   */
  animateDamage() {
    const originalColor = 0xff1744;
    const damageColor = 0xff0000;
    const duration = 250;
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
   * Animate defending (shield effect)
   */
  setDefending(defending) {
    const glowMesh = this.group.children[1];
    if (defending) {
      glowMesh.material.emissiveIntensity = 1.0;
    } else {
      glowMesh.material.emissiveIntensity = 0.6;
    }
  }
  
  /**
   * Update HP display
   */
  updateHPDisplay(hp, maxHp) {
    // HP indicator via core intensity
    this.group.children[3].material.emissiveIntensity = 0.5 + (hp / maxHp) * 0.5;
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
  module.exports = VeloVisual;
}
