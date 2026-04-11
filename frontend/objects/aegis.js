/**
 * Aegis Agent Visual
 * Blue sphere — reference style from neuro_bot_wars.html.
 */

class AegisVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();

    this.gridX = gameState.aegis.x;
    this.gridY = gameState.aegis.y;

    this.createAegis();
    this.syncPosition();

    this.scene.add(this.group);
  }

  createAegis() {
    // Reference: SphereGeometry(0.4, 16, 16), color 0x2255FF
    this.material = new THREE.MeshStandardMaterial({
      color: 0x2255FF,
      transparent: true,
      opacity: 1.0
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), this.material);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
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

  /** Idle animation — gentle y-bob */
  updateIdle(dt) {
    this.group.position.y = 0.3 + Math.sin(Date.now() * 0.002) * 0.04;
  }

  /** Damage flash — red then back to blue */
  animateDamage() {
    const origColor = 0x2255FF;
    const dmgColor  = 0xFF0000;
    const dur = 300;
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
    this.material.color.setHex(defending ? 0x88aaff : 0x2255FF);
  }

  updateHPDisplay(hp, maxHp) { /* HP displayed in UI, not on mesh */ }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisVisual;
}
