/**
 * Arena Visual
 * Battle arena — reference style from neuro_bot_wars.html:
 *   - 0xCCDD88 yellowish-green floor tiles with EdgesGeometry line overlay
 *   - Single PointLight(0xffffff, 1.2, 8) above arena centre
 *   - Opacity-based fade-in on activateCombat()
 */

class ArenaVisual {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();

    this.tileMeshes = [];  // floor tile meshes (for opacity fade)
    this.lineMeshes = [];  // edge line meshes  (for opacity fade)
    this.arenaLight = null;

    this.createArena();
    this.scene.add(this.group);
  }

  createArena() {
    const s = this.gameState.arena.start;
    const e = this.gameState.arena.end;

    for (let x = s; x <= e; x++) {
      for (let y = s; y <= e; y++) {
        const pos = this.gameState.gridToWorld(x, y);

        // ── Floor tile  (reference: 0xCCDD88 emissive 0x445500, intensity 0.4) ──
        const tileMat = new THREE.MeshStandardMaterial({
          color: 0xCCDD88,
          emissive: 0x445500,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0          // start hidden; fade in via activateCombat()
        });
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), tileMat);
        tile.position.set(pos.x, 0.05, pos.z);
        tile.receiveShadow = true;
        this.group.add(tile);
        this.tileMeshes.push(tile);

        // ── Edge lines  (reference: EdgesGeometry, 0x88AA44) ──
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.1, 0.95));
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x88AA44, transparent: true, opacity: 0
        });
        const lines = new THREE.LineSegments(edgeGeo, lineMat);
        lines.position.set(pos.x, 0.05, pos.z);
        this.group.add(lines);
        this.lineMeshes.push(lines);
      }
    }

    // ── Central point light  (reference: PointLight(0xffffff, 1.2, 8) at y=3) ──
    this.arenaLight = new THREE.PointLight(0xffffff, 0, 8);
    this.arenaLight.position.set(0, 3, 0);
    this.group.add(this.arenaLight);
  }

  /** Show arena group */
  show() { this.group.visible = true; }

  /** Hide arena group (maze phase) */
  hide() { this.group.visible = false; }

  /** Fade in tiles + enable point light — called when battle phase begins */
  activateCombat() {
    const dur   = 500;
    const start = Date.now();

    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);

      this.tileMeshes.forEach(m => { m.material.opacity = p; });
      this.lineMeshes.forEach(m => { m.material.opacity = p; });

      // Ramp up point light to match reference intensity 1.2
      if (this.arenaLight) this.arenaLight.intensity = p * 1.2;

      if (p < 1) requestAnimationFrame(anim);
    };
    anim();
  }

  /** Flash on attack — brief bright pulse */
  createBattleFlash() {
    const dur   = 150;
    const start = Date.now();

    const origIntensity = this.arenaLight ? this.arenaLight.intensity : 1.2;

    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      if (this.arenaLight) {
        this.arenaLight.intensity = origIntensity + (1 - p) * 3;
      }
      if (p < 1) requestAnimationFrame(anim);
      else if (this.arenaLight) this.arenaLight.intensity = origIntensity;
    };
    anim();
  }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArenaVisual;
}
