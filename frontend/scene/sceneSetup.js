/**
 * Scene Setup Module
 * Initializes and manages the Three.js scene, camera, and renderer
 */

class SceneSetup {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e27);
    this.scene.fog = new THREE.Fog(0x0a0e27, 20, 50);
    
    // Create orthographic camera for top-down view
    const aspect = this.width / this.height;
    const viewSize = 10;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2,
      viewSize * aspect / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      100
    );
    this.camera.position.set(0, 10, 0);
    this.camera.lookAt(0, 0, 0);
    this.defaultCameraPos = this.camera.position.clone();
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    this.container.appendChild(this.renderer.domElement);
    
    // Setup lighting
    this.setupLighting();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Main directional light (top-down)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 15, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    
    // Fill light (left side)
    const fillLight = new THREE.DirectionalLight(0x6eb5ff, 0.3);
    fillLight.position.set(-8, 10, -8);
    this.scene.add(fillLight);
    
    // Arena spotlight group (will be managed dynamically)
    this.arenaLights = [];
  }
  
  /**
   * Add arena lights for glow effect
   */
  setupArenaLights() {
    // Remove old arena lights
    this.arenaLights.forEach(light => this.scene.remove(light));
    this.arenaLights = [];
    
    // Arena center
    const arenaCenterX = -0.5;
    const arenaCenterZ = -0.5;
    
    // Create 4 corner lights around arena
    const positions = [
      { x: arenaCenterX - 1.5, z: arenaCenterZ - 1.5 },
      { x: arenaCenterX + 1.5, z: arenaCenterZ - 1.5 },
      { x: arenaCenterX - 1.5, z: arenaCenterZ + 1.5 },
      { x: arenaCenterX + 1.5, z: arenaCenterZ + 1.5 }
    ];
    
    positions.forEach(pos => {
      const light = new THREE.PointLight(0x00ff88, 0, 10);
      light.position.set(pos.x, 3, pos.z);
      light.intensity = 0;
      this.scene.add(light);
      this.arenaLights.push(light);
    });
  }
  
  /**
   * Toggle arena lights for combat phase
   */
  setArenaLightIntensity(intensity) {
    this.arenaLights.forEach(light => {
      light.intensity = intensity;
    });
  }
  
  /**
   * Animate camera zoom to arena
   */
  zoomToArena() {
    const targetPos = this.camera.position.clone();
    targetPos.y = 8;
    return this.animateCameraTo(targetPos, 0.5);
  }
  
  /**
   * Animate camera back to default
   */
  resetCameraZoom() {
    return this.animateCameraTo(this.defaultCameraPos, 0.5);
  }
  
  /**
   * Animate camera to position
   */
  animateCameraTo(targetPos, duration) {
    return new Promise(resolve => {
      const startPos = this.camera.position.clone();
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        this.camera.position.x = startPos.x + (targetPos.x - startPos.x) * progress;
        this.camera.position.y = startPos.y + (targetPos.y - startPos.y) * progress;
        this.camera.position.z = startPos.z + (targetPos.z - startPos.z) * progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  }
  
  /**
   * Handle window resize
   */
  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    const aspect = this.width / this.height;
    const viewSize = 10;
    
    this.camera.left = -viewSize * aspect / 2;
    this.camera.right = viewSize * aspect / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(this.width, this.height);
  }
  
  /**
   * Render the scene
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Get scene object
   */
  getScene() {
    return this.scene;
  }
  
  /**
   * Get camera object
   */
  getCamera() {
    return this.camera;
  }
  
  /**
   * Get renderer object
   */
  getRenderer() {
    return this.renderer;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SceneSetup;
}
