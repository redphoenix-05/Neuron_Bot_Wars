/**
 * Animation Controller Module
 * Handles smooth movement interpolation and visual effects using deltaTime
 */

class AnimationController {
  constructor() {
    this.activeAnimations = new Map();
    this.deltaTime = 0;
  }
  
  /**
   * Update all active animations
   */
  update(deltaTime) {
    this.deltaTime = deltaTime;
    
    const completedAnimations = [];
    
    this.activeAnimations.forEach((animation, key) => {
      animation.elapsed += deltaTime;
      const progress = Math.min(animation.elapsed / animation.duration, 1.0);
      
      // Apply easing
      const easedProgress = this.easeInOutCubic(progress);
      
      // Update position using lerp
      animation.currentPosition.x = this.lerp(
        animation.startPosition.x,
        animation.endPosition.x,
        easedProgress
      );
      animation.currentPosition.z = this.lerp(
        animation.startPosition.z,
        animation.endPosition.z,
        easedProgress
      );
      
      // Update visual
      if (animation.onUpdate) {
        animation.onUpdate(animation.currentPosition, easedProgress);
      }
      
      // Check if animation is complete
      if (progress >= 1.0) {
        animation.currentPosition.x = animation.endPosition.x;
        animation.currentPosition.z = animation.endPosition.z;
        
        if (animation.onComplete) {
          animation.onComplete();
        }
        
        completedAnimations.push(key);
      }
    });
    
    // Remove completed animations
    completedAnimations.forEach(key => this.activeAnimations.delete(key));
  }
  
  /**
   * Start a new animation
   */
  addAnimation(key, startPos, endPos, duration, callbacks = {}) {
    const animation = {
      key,
      startPosition: { x: startPos.x, z: startPos.z },
      endPosition: { x: endPos.x, z: endPos.z },
      currentPosition: { x: startPos.x, z: startPos.z },
      duration: duration,
      elapsed: 0,
      onUpdate: callbacks.onUpdate || null,
      onComplete: callbacks.onComplete || null
    };
    
    this.activeAnimations.set(key, animation);
    return animation;
  }
  
  /**
   * Stop animation
   */
  stopAnimation(key) {
    this.activeAnimations.delete(key);
  }
  
  /**
   * Check if animation is active
   */
  isAnimating(key) {
    return this.activeAnimations.has(key);
  }
  
  /**
   * Linear interpolation
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  }
  
  /**
   * Easing function: ease in-out cubic
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
  
  /**
   * Get animation progress
   */
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
