// PlayerController.js
import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

export class PlayerController {
    constructor(player, camera, inputManager, modelAnimations = null) {
        this.player = player;
        this.camera = camera;
        this.inputManager = inputManager;
        this.modelAnimations = modelAnimations;
        this.currentAnimation = null;

        // --- Movement Speeds (Units per SECOND now) ---
        this.walkSpeed = 3.5; // Adjust these based on your desired speed
        this.runSpeed = 10.0;
        this.movementSpeed = this.walkSpeed; // Current speed
        this.horizontalVelocity = new THREE.Vector3();

        // --- Jump Physics Parameters ---
        this.isJumping = false;
        this.gravity = -9.8 * 2.0; // Realistic gravity is -9.8 m/s^2. Scale as needed for game feel.
        this.jumpHeight = 2;     // Desired jump height in world units.
        this.velocityY = 0;        // Current vertical speed (Units per SECOND).
        // Remove initialJumpVelocity and jumpDuration - we calculate velocity from height.

        // --- Animation Names (Ensure these match your GLB) ---
        this.animNames = {
            idle: 'stand',
            walk: 'walk',
            run: 'run',
            jump: 'jumpUp',      // Animation for going up
            fall: 'jumpDown',    // Optional: Looping animation for falling
            // land: 'stand',        // Optional: Short animation for landing
        };
        this.hasFallAnimation = this.modelAnimations?.actions[this.animNames.fall] !== undefined;
        this.hasLandAnimation = this.modelAnimations?.actions[this.animNames.land] !== undefined;
    }

    calculateMovementDirection() {
        // ... (This function remains the same, calculating normalized direction) ...
        const direction = new THREE.Vector3();
        if (this.inputManager.keys.KeyW) direction.z += 1;
        if (this.inputManager.keys.KeyS) direction.z -= 1;
        if (this.inputManager.keys.KeyA) direction.x += 1;
        if (this.inputManager.keys.KeyD) direction.x -= 1;

        if (direction.lengthSq() === 0) {
            return direction;
        }

        const cameraForward = new THREE.Vector3();
        const cameraRight = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        cameraRight.crossVectors(this.camera.up, cameraForward).normalize();

        const moveVector = new THREE.Vector3()
            .addScaledVector(cameraForward, direction.z)
            .addScaledVector(cameraRight, direction.x);

        return moveVector.normalize();
    }

    switchAnimation(targetAnimName, fadeDuration = 0.2) {
        if (!this.modelAnimations || !this.modelAnimations.actions) return;
        const targetAction = this.modelAnimations.actions[targetAnimName];
        if (!targetAction) {
            // console.warn(`Animation "${targetAnimName}" not found!`);
            return; // Silently return if optional animation is missing
        }
        if (this.currentAnimation === targetAction) return; // Already playing

        if (this.currentAnimation) {
            // If switching from 'land', don't fade out, just stop
            if (this.currentAnimation === this.modelAnimations.actions[this.animNames.land]) {
                 this.currentAnimation.stop();
            } else {
                 this.currentAnimation.fadeOut(fadeDuration);
            }
        }
        targetAction.reset().setEffectiveWeight(1.0).fadeIn(fadeDuration).play();
        this.currentAnimation = targetAction;

        // Handle non-looping animations like land
        if (targetAnimName === this.animNames.land) {
            targetAction.clampWhenFinished = true;
            targetAction.loop = THREE.LoopOnce;
        } else {
            targetAction.loop = THREE.LoopRepeat; // Ensure others loop
        }
    }

    update(delta) {
        // --- Input & State Update ---
        // Read current input state - needed for ground movement AND landing animations
        const isMoving = this.inputManager.isMoving();
        const isSprinting = this.inputManager.isSprinting();

        // --- Calculate Horizontal Movement (ONLY IF ON GROUND) ---
        // We only calculate a *new* horizontal velocity based on input if we are not jumping.
        // If we *are* jumping, this.horizontalVelocity retains its value from the moment of takeoff.
        if (!this.isJumping) {
            this.movementSpeed = isSprinting ? this.runSpeed : this.walkSpeed;
            const moveDirection = this.calculateMovementDirection();
            // Calculate the velocity for this frame if on ground
            this.horizontalVelocity = moveDirection.clone().multiplyScalar(this.movementSpeed);
        }
        // If isJumping is true, the calculation above is skipped, and this.horizontalVelocity
        // keeps the value it had just before this.isJumping became true.

        // --- Jump Trigger Logic ---
        // Check for jump trigger - This happens *after* potentially calculating ground velocity,
        // so the takeoff velocity is correctly stored in this.horizontalVelocity.
        if (this.inputManager.jumpTriggered && !this.isJumping) {
            this.isJumping = true; // Set jumping state
            // Calculate initial vertical velocity for the jump
            this.velocityY = Math.sqrt(-2 * this.gravity * this.jumpHeight);
            this.inputManager.jumpTriggered = false; // Consume trigger
            this.switchAnimation(this.animNames.jump); // Play jump animation
            // No need to explicitly store horizontalVelocity here,
            // it already holds the value calculated just before this block (if on ground)
            // or retains its value from the previous frame (if jump was triggered mid-air somehow, though we prevent that)
        }

        // --- Physics & Position Update ---
        let justLanded = false;
        if (this.isJumping) {
            // Apply gravity to vertical velocity
            this.velocityY += this.gravity * delta;
            // Apply vertical velocity to position
            this.player.position.y += this.velocityY * delta;

            // Optional: Switch to falling animation if moving downwards
            if (this.hasFallAnimation && this.velocityY <= 0) {
                this.switchAnimation(this.animNames.fall);
            }

            // Ground check
            if (this.player.position.y <= 0) {
                this.player.position.y = 0; // Clamp to ground
                this.isJumping = false;      // Stop jumping state
                this.velocityY = 0;         // Reset vertical velocity
                justLanded = true;           // Flag that we just hit the ground
                // horizontalVelocity will be recalculated next frame based on input now
            }
        }

        // --- Apply Horizontal Movement ---
        // This happens regardless of jumping state.
        // If jumping, it uses the horizontalVelocity captured at takeoff.
        // If on ground, it uses the horizontalVelocity calculated based on current input.
        this.player.position.x += this.horizontalVelocity.x * delta;
        this.player.position.z += this.horizontalVelocity.z * delta;

        // --- Rotation (Only applies when !isJumping, so it's already correct) ---
        if (isMoving && !this.isJumping) {
            if (this.horizontalVelocity.lengthSq() > 0.001) { // Check velocity length now
                // Use normalized horizontal velocity for direction if available,
                // otherwise calculate from moveDirection if needed (though horizontalVelocity should be fine)
                const lookDirection = this.horizontalVelocity.clone().normalize();
                const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 0, 1),
                    lookDirection
                );
                this.player.quaternion.slerp(targetQuaternion, 0.15);
            }
        }

        // --- Animation Update (Handles justLanded and !isJumping cases) ---
        if (justLanded) {
            if (this.hasLandAnimation) {
                this.switchAnimation(this.animNames.land);
            } else {
                const targetGroundAnim = isMoving ? (isSprinting ? this.animNames.run : this.animNames.walk) : this.animNames.idle;
                this.switchAnimation(targetGroundAnim);
            }
        } else if (!this.isJumping) {
            if (!this.currentAnimation || this.currentAnimation.loop === THREE.LoopRepeat) {
                const targetGroundAnim = isMoving ? (isSprinting ? this.animNames.run : this.animNames.walk) : this.animNames.idle;
                this.switchAnimation(targetGroundAnim);
            }
        }
    }
}