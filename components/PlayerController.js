import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

/**
 * PlayerController computes player movement, jump physics, and handles animation changes.
 */
export class PlayerController {
  constructor(player, camera, inputManager, modelAnimations = null) {
    this.player = player;
    this.camera = camera;
    this.inputManager = inputManager;
    this.modelAnimations = modelAnimations;
    this.currentAnimation = null;
    this.movementSpeed = 0.1;
    this.horizontalVelocity = new THREE.Vector3();
    // Jump parameters
    this.isJumping = false;
    this.gravity = -0.002;
    this.velocityY = 1;
    this.jumpDuration = 100;
    this.initialJumpVelocity = (this.jumpDuration / 2) * Math.abs(this.gravity);
  }
  
  calculatePlayerMovement() {
    const direction = new THREE.Vector3();
    if (this.inputManager.keys.w) direction.z += 1;
    if (this.inputManager.keys.s) direction.z -= 1;
    if (this.inputManager.keys.a) direction.x += 1;
    if (this.inputManager.keys.d) direction.x -= 1;
    
    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    this.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();
    cameraRight.crossVectors(this.camera.up, cameraForward);
    
    const moveVector = new THREE.Vector3()
      .addScaledVector(cameraForward, direction.z)
      .addScaledVector(cameraRight, direction.x);
    
    return moveVector.normalize().multiplyScalar(this.movementSpeed);
  }
  
  update() {
    // Check for jump trigger from the InputManager.
    if (this.inputManager.jumpTriggered && !this.isJumping) {
      this.triggerJump();
      this.inputManager.jumpTriggered = false;
    }
    
    const movement = this.calculatePlayerMovement();
    this.horizontalVelocity.copy(movement);
    
    if (this.isJumping) {
      this.velocityY += this.gravity;
      this.player.position.y += this.velocityY;
      if (this.player.position.y <= 0) {
        this.player.position.y = 0;
        this.isJumping = false;
        this.velocityY = 0;
      }
      this.player.position.x += this.horizontalVelocity.x;
      this.player.position.z += this.horizontalVelocity.z;
      
      if (this.modelAnimations) {
        const playerAnimations = this.modelAnimations.actions;
        const jumpAnimation = playerAnimations['jumpUp'];
        if (jumpAnimation && this.currentAnimation !== jumpAnimation) {
          if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
          jumpAnimation.reset().fadeIn(0.5).play();
          this.currentAnimation = jumpAnimation;
        }
      }
    } else {
      const isMoving = movement.length() > 0;
      if (isMoving) {
        // Switch animations based on key.
        const targetAnimation = this.inputManager.keys.shift ? 'run' : 'walk';
        this.movementSpeed = this.inputManager.keys.shift ? 0.1 : 0.05;
        if (this.modelAnimations && this.currentAnimation !== this.modelAnimations.actions[targetAnimation]) {
          if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
          this.modelAnimations.actions[targetAnimation].reset().fadeIn(0.5).play();
          this.currentAnimation = this.modelAnimations.actions[targetAnimation];
        }
        // Rotate player toward the movement direction.
        // TODO: Only when holding right click !
        const lookDirection = movement.clone().normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          lookDirection
        );
        this.player.quaternion.slerp(targetQuaternion, 0.1);
      } else {
        if (this.modelAnimations && this.currentAnimation !== this.modelAnimations.actions['stand']) {
          if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
          this.modelAnimations.actions['stand'].reset().fadeIn(0.5).play();
          this.currentAnimation = this.modelAnimations.actions['stand'];
        }
      }
      this.player.position.x += this.horizontalVelocity.x;
      this.player.position.z += this.horizontalVelocity.z;
    }
  }
  
  triggerJump() {
    this.isJumping = true;
    this.velocityY = this.initialJumpVelocity;
  }
}