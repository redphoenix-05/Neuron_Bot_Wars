/**
 * Arena Visual
 * Combat arena with glowing borders. Supports show/hide for phase toggling.
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
    const s = this.gameState.arena.start;
    const e = this.gameState.arena.end;

    // Arena floor tiles
    for (let y = s; y <= e; y++) {
      for (let x = s; x <= e; x++) {
        const pos = this.gameState.gridToWorld(x, y);
        const tileGeo = new THREE.PlaneGeometry(1, 1);
        const tileMat = new THREE.MeshStandardMaterial({
          color: 0x1a4d3a, roughness: 0.3, metalness: 0.7,
          emissive: 0x2d7a5e, emissiveIntensity: 0.2
        });
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(pos.x, 0.02, pos.z);
        tile.rotation.x = -Math.PI / 2;
        tile.receiveShadow = true;
        this.group.add(tile);
      }
    }

    this.createBorder();
  }

  createBorder() {
    const s = this.gameState.arena.start;
    const e = this.gameState.arena.end;

    const corners = [
      { x: s - 0.5, y: s - 0.5 },
      { x: e + 0.5, y: s - 0.5 },
      { x: e + 0.5, y: e + 0.5 },
      { x: s - 0.5, y: e + 0.5 }
    ];

    for (let i = 0; i < corners.length; i++) {
      const cur  = corners[i];
      const next = corners[(i + 1) % corners.length];
      const sp   = this.gameState.gridToWorld(cur.x, cur.y);
      const ep   = this.gameState.gridToWorld(next.x, next.y);

      const len = Math.sqrt((ep.x - sp.x) ** 2 + (ep.z - sp.z) ** 2);

      // Edge bar
      const edgeGeo = new THREE.BoxGeometry(len, 0.12, 0.08);
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88, emissive: 0x00ff88,
        emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2
      });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set((sp.x + ep.x) / 2, 0.12, (sp.z + ep.z) / 2);
      edge.rotation.y = Math.atan2(ep.z - sp.z, ep.x - sp.x);
      edge.castShadow = true;
      this.group.add(edge);

      // Glow bar
      const glowGeo = new THREE.BoxGeometry(len, 0.06, 0.15);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88, emissive: 0x00ff88,
        emissiveIntensity: 0.2, transparent: true, opacity: 0.4
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set((sp.x + ep.x) / 2, 0.08, (sp.z + ep.z) / 2);
      glow.rotation.y = edge.rotation.y;
      this.group.add(glow);
    }

    this.createSpotlight();
  }

  createSpotlight() {
    const pos = this.gameState.gridToWorld(3, 3);
    const centerGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.1, 32);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x1a534d, emissive: 0x2d7a5e,
      emissiveIntensity: 0.15, metalness: 0.5
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.set(pos.x, 0.01, pos.z);
    center.receiveShadow = true;
    this.group.add(center);
  }

  /** Show arena */
  show() { this.group.visible = true; }

  /** Hide arena */
  hide() { this.group.visible = false; }

  /** Activate combat glow */
  activateCombat() {
    const dur = 500;
    const start = Date.now();
    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      this.group.children.forEach(child => {
        if (child.material && child.material.emissive) {
          child.material.emissiveIntensity = 0.2 + p * 0.4;
        }
      });
      if (p < 1) requestAnimationFrame(anim);
    };
    anim();
  }

  /** Deactivate */
  deactivateCombat() {
    this.group.children.forEach(child => {
      if (child.material && child.material.emissive) {
        child.material.emissiveIntensity = 0.2;
      }
    });
  }

  /** Battle flash */
  createBattleFlash() {
    const pos = this.gameState.gridToWorld(3, 3);
    const flashGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xffff00, emissive: 0xffff00,
      emissiveIntensity: 1.0, transparent: true, opacity: 0.5
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(pos.x, 0.5, pos.z);
    this.group.add(flash);

    const dur = 150;
    const start = Date.now();
    const anim = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      flash.material.opacity = 0.5 * (1 - p);
      flash.scale.set(1 + p * 0.5, 1 + p * 0.5, 1 + p * 0.5);
      if (p < 1) requestAnimationFrame(anim);
      else this.group.remove(flash);
    };
    anim();
  }

  getMesh() { return this.group; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArenaVisual;
}
