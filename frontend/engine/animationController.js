/**
 * Animation Controller Module
 * Handles smooth movement interpolation and visual effects using deltaTime.
 */

class AnimationController {
  constructor() {
    this.activeAnimations = new Map();
  }

  /** Update all active animations. Returns true if any are still running. */
  update(deltaTime) {
    if (this.activeAnimations.size === 0) return false;

    const completed = [];

    this.activeAnimations.forEach((anim, key) => {
      anim.elapsed += deltaTime;
      const progress = Math.min(anim.elapsed / anim.duration, 1.0);
      const eased = this.easeInOutCubic(progress);

      // Lerp position
      anim.currentPosition.x = this.lerp(anim.startPosition.x, anim.endPosition.x, eased);
      anim.currentPosition.z = this.lerp(anim.startPosition.z, anim.endPosition.z, eased);

      if (anim.onUpdate) {
        anim.onUpdate(anim.currentPosition, eased);
      }

      if (progress >= 1.0) {
        anim.currentPosition.x = anim.endPosition.x;
        anim.currentPosition.z = anim.endPosition.z;
        if (anim.onComplete) anim.onComplete();
        completed.push(key);
      }
    });

    completed.forEach(key => this.activeAnimations.delete(key));
    return this.activeAnimations.size > 0;
  }

  /** Start a new animation */
  addAnimation(key, startPos, endPos, duration, callbacks = {}) {
    const animation = {
      key,
      startPosition:   { x: startPos.x, z: startPos.z },
      endPosition:     { x: endPos.x,   z: endPos.z   },
      currentPosition: { x: startPos.x, z: startPos.z },
      duration,
      elapsed: 0,
      onUpdate:   callbacks.onUpdate   || null,
      onComplete: callbacks.onComplete || null
    };
    this.activeAnimations.set(key, animation);
    return animation;
  }

  stopAnimation(key) { this.activeAnimations.delete(key); }

  isAnimating(key) { return this.activeAnimations.has(key); }

  /** Are ANY animations currently running? */
  hasActiveAnimations() { return this.activeAnimations.size > 0; }

  /** Clear all animations */
  clear() { this.activeAnimations.clear(); }

  lerp(start, end, t) { return start + (end - start) * t; }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  getAnimationProgress(key) {
    if (!this.activeAnimations.has(key)) return 1.0;
    const anim = this.activeAnimations.get(key);
    return Math.min(anim.elapsed / anim.duration, 1.0);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationController;
}
