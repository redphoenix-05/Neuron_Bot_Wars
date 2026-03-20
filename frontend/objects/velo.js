/**
 * Velo Agent Visual
 * Red icosahedron robot with aggressive glow — faster animation feel.
 */

class VeloVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();

    this.gridX = gameState.velo.x;
    this.gridY = gameState.velo.y;

    this.createVelo();
    this.syncPosition();

    this.scene.add(this.group);
  }

  createVelo() {
    // Main body — red icosahedron (sharper look)
    const bodyGeo = new THREE.IcosahedronGeometry(0.25, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, emissive: 0xff1744,
      emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.15
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Glow
    const glowGeo = new THREE.IcosahedronGeometry(0.28, 3);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xff5722, emissive: 0xff9100,
      emissiveIntensity: 0.6, transparent: true,
      opacity: 0.35, side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.set(1.2, 1.2, 1.2);
    this.group.add(glow);

    // Spikes
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const spikeGeo = new THREE.ConeGeometry(0.06, 0.3, 8);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0xff5722, metalness: 0.8, roughness: 0.2
      });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.x = Math.cos(angle) * 0.25;
      spike.position.z = Math.sin(angle) * 0.25;
      spike.position.y = 0.15;
      spike.rotation.z = -Math.PI / 4;
      spike.castShadow = true;
      this.group.add(spike);
    }

    // Core light
    const coreGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff5722, emissive: 0xff5722,
      emissiveIntensity: 1.0, metalness: 0.4
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.15;
    this.group.add(core);

    // Pulsing ring
    const ringGeo = new THREE.TorusGeometry(0.35, 0.015, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, emissive: 0xff1744,
      emissiveIntensity: 0.5, metalness: 0.9
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 4;
    ring.castShadow = true;
    this.group.add(ring);

    // Arrow
    const arrowGeo = new THREE.ConeGeometry(0.07, 0.2, 8);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff5722, metalness: 0.7 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 0.22;
    arrow.position.z = 0.12;
    arrow.castShadow = true;
    this.group.add(arrow);
  }

  setGridPosition(gx, gy, instant = false) {
    this.gridX = gx;
    this.gridY = gy;
    if (instant) this.syncPosition();
  }

  syncPosition() {
    const pos = this.gameState.gridToWorld(this.gridX, this.gridY);
    this.group.position.set(pos.x, 0.3, pos.z);
  }

  updatePosition(agentState) {
    if (agentState) {
      this.gridX = agentState.x;
      this.gridY = agentState.y;
    } else {
      this.gridX = this.gameState.velo.x;
      this.gridY = this.gameState.velo.y;
    }
    this.syncPosition();
  }

  /** Idle — aggressive pulsing + slow rotation */
  updateIdle(dt) {
    const t = Date.now() * 0.003;
    // Pulse glow
    if (this.group.children[1]) {
      this.group.children[1].material.emissiveIntensity = 0.4 + Math.sin(t) * 0.2;
    }
    // Slow rotation for aggressive feel
    this.group.rotation.y += dt * 0.5;
  }

  animateDamage() {
    const body = this.group.children[0];
    const origColor = 0xff1744;
    const dmgColor  = 0xffffff;
    const dur = 250;
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
    glow.material.emissiveIntensity = defending ? 1.0 : 0.6;
  }

  updateHPDisplay(hp, maxHp) {
    if (this.group.children[6]) { // core
      this.group.children[6].material.emissiveIntensity = 0.5 + (hp / maxHp) * 0.5;
    }
  }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VeloVisual;
}
