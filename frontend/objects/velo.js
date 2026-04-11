/**
 * Velo Agent Visual
 * Red sphere — reference style from neuro_bot_wars.html.
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
    // Reference: SphereGeometry(0.4, 16, 16), color 0xFF2222
    this.material = new THREE.MeshStandardMaterial({
      color: 0xFF2222,
      transparent: true,
      opacity: 1.0
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), this.material);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
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

  /** Idle animation — gentle y-bob */
  updateIdle(dt) {
    this.group.position.y = 0.3 + Math.sin(Date.now() * 0.0025) * 0.04;
  }

  /** Damage flash — white then back to red */
  animateDamage() {
    const origColor = 0xFF2222;
    const dmgColor  = 0xFFFFFF;
    const dur = 250;
    const start = Date.now();

    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      this.material.color.lerpColors(
        new THREE.Color(dmgColor), new THREE.Color(origColor), p
      );
      if (p < 1) requestAnimationFrame(anim);
      else this.material.color.setHex(origColor);
    };
    anim();
  }

  setDefending(defending) {
    this.material.color.setHex(defending ? 0xFF8888 : 0xFF2222);
  }

  updateHPDisplay(hp, maxHp) { /* HP displayed in UI, not on mesh */ }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VeloVisual;
}
