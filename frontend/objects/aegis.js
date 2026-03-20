/**
 * Aegis Agent Visual
 * Blue spherical robot with glowing outline — smooth lerp movement.
 */

class AegisVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();

    // Grid position tracking
    this.gridX = gameState.aegis.x;
    this.gridY = gameState.aegis.y;

    this.createAegis();
    this.syncPosition();

    this.scene.add(this.group);
  }

  createAegis() {
    // Main body — blue sphere
    const bodyGeo = new THREE.SphereGeometry(0.25, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      emissive: 0x1e90ff,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Glow outline
    const glowGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      emissive: 0x4da6ff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.set(1.15, 1.15, 1.15);
    this.group.add(glow);

    // Metallic bands
    for (let i = 0; i < 3; i++) {
      const bandGeo = new THREE.TorusGeometry(0.25, 0.02, 8, 16);
      const bandMat = new THREE.MeshStandardMaterial({
        color: 0x0066cc, metalness: 0.9, roughness: 0.1
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.rotation.x = (i - 1) * 0.3;
      band.castShadow = true;
      this.group.add(band);
    }

    // Core light
    const coreGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x4da6ff, emissive: 0x4da6ff,
      emissiveIntensity: 0.8, metalness: 0.5
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.12;
    this.group.add(core);

    // Arrow indicator
    const arrowGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, metalness: 0.6 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 0.2;
    arrow.position.z = 0.1;
    arrow.castShadow = true;
    this.group.add(arrow);
  }

  /**
   * Set the target grid position.
   * @param {number} gx  Grid X
   * @param {number} gy  Grid Y
   * @param {boolean} instant  If true, teleport immediately (no lerp).
   */
  setGridPosition(gx, gy, instant = false) {
    this.gridX = gx;
    this.gridY = gy;
    if (instant) this.syncPosition();
  }

  /** Snap mesh to current grid position */
  syncPosition() {
    const pos = this.gameState.gridToWorld(this.gridX, this.gridY);
    this.group.position.set(pos.x, 0.3, pos.z);
  }

  /** Called from legacy code — update from gameState */
  updatePosition(agentState) {
    if (agentState) {
      this.gridX = agentState.x;
      this.gridY = agentState.y;
    } else {
      this.gridX = this.gameState.aegis.x;
      this.gridY = this.gameState.aegis.y;
    }
    this.syncPosition();
  }

  /** Idle animation — gentle hover */
  updateIdle(dt) {
    const t = Date.now() * 0.002;
    // Subtle breathing glow
    if (this.group.children[1]) {
      this.group.children[1].material.emissiveIntensity = 0.3 + Math.sin(t) * 0.1;
    }
  }

  /** Damage flash (red → blue) */
  animateDamage() {
    const body = this.group.children[0];
    const origColor = 0x1e90ff;
    const dmgColor  = 0xff4444;
    const dur = 300;
    const start = Date.now();

    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const c = new THREE.Color();
      c.lerpColors(new THREE.Color(dmgColor), new THREE.Color(origColor), p);
      body.material.emissive.copy(c);
      if (p < 1) requestAnimationFrame(anim);
      else body.material.emissive.setHex(origColor);
    };
    anim();
  }

  setDefending(defending) {
    const glow = this.group.children[1];
    glow.material.emissiveIntensity = defending ? 0.8 : 0.4;
  }

  updateHPDisplay(hp, maxHp) {
    const intensity = 0.2 + (hp / maxHp) * 0.6;
    if (this.group.children[1]) {
      this.group.children[1].material.emissiveIntensity = intensity;
    }
  }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisVisual;
}
