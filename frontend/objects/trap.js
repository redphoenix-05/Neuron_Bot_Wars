/**
 * Trap Visual Objects
 * Spike traps with particle effects
 */

class TrapVisual {
  constructor(scene, x, z) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = { x, z };
    
    this.createTrap();
    this.scene.add(this.group);
  }
  
  createTrap() {
    // Pit hole (dark circle)
    const pitGeometry = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 12);
    const pitMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.95,
      metalness: 0.05
    });
    
    const pit = new THREE.Mesh(pitGeometry, pitMaterial);
    pit.position.y = -0.08;
    pit.receiveShadow = true;
    this.group.add(pit);
    
    // Spike formations (3-4 spikes)
    const spikeCount = 4;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + Math.random() * 0.3;
      const distance = 0.15 + Math.random() * 0.1;
      
      const spikeGeometry = new THREE.ConeGeometry(0.08, 0.35, 8);
      const spikeMaterial = new THREE.MeshStandardMaterial({
        color: 0x660000,
        emissive: 0x330000,
        emissiveIntensity: 0.2,
        metalness: 0.7,
        roughness: 0.3
      });
      
      const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
      spike.position.x = Math.cos(angle) * distance;
      spike.position.z = Math.sin(angle) * distance;
      spike.position.y = 0.1;
      spike.castShadow = true;
      this.group.add(spike);
    }
    
    // Glowing pit bottom
    const glowGeometry = new THREE.CircleGeometry(0.32, 16);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0x440000,
      emissive: 0x880000,
      emissiveIntensity: 0.2
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = -0.08;
    this.group.add(glow);
    
    this.group.position.set(this.position.x, 0, this.position.z);
  }
  
  /**
   * Trigger trap activation (flash and particle effect)
   */
  activate() {
    this.flashEffect();
    this.createParticles();
  }
  
  flashEffect() {
    const duration = 200;
    const startTime = Date.now();
    const glowMesh = this.group.children[2];
    const originalIntensity = 0.2;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Rapid pulsing
      const pulse = Math.sin(progress * Math.PI * 6) * 0.5 + 0.2;
      glowMesh.material.emissiveIntensity = pulse;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        glowMesh.material.emissiveIntensity = originalIntensity;
      }
    };
    
    animate();
  }
  
  /**
   * Create particle burst effect
   */
  createParticles() {
    const particleCount = 8;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      
      const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const particleMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xff6666,
        emissiveIntensity: 0.8
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.copy(this.group.position);
      particle.position.y = 0.1;
      this.scene.add(particle);
      
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 1 + Math.random() * 2;
      
      const startTime = Date.now();
      const lifetime = 400;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / lifetime, 1);
        
        particle.position.x += vx * 0.016;
        particle.position.z += vz * 0.016;
        particle.position.y += vy * 0.016 - 0.1 * progress; // Gravity
        
        particle.material.opacity = 1 - progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(particle);
        }
      };
      
      animate();
    }
  }
  
  /**
   * Get the trap mesh group
   */
  getMesh() {
    return this.group;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrapVisual;
}
