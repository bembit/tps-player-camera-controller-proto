// PlayerController.js
import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

// --- Configuration Constants ---
// Contains tunable parameters for player behavior.
const PLAYER_CONFIG = {
    WALK_SPEED: 3.5,      // Player movement speed when walking (units per second).
    RUN_SPEED: 10.0,       // Player movement speed when sprinting (units per second).
    GRAVITY: -19.6,       // Acceleration due to gravity (units per second squared). Adjusted for game feel.
    JUMP_HEIGHT: 1.8,     // The desired height the player should reach when jumping (units).
    ROTATION_SPEED: 0.15, // Controls how quickly the player rotates to face movement direction (0 = no rotation, 1 = instant). Slerp factor.
    ANIM_FADE_DURATION: 0.2, // Default time in seconds for animations to fade in/out smoothly.
    MODEL_FORWARD_DIRECTION: new THREE.Vector3(0, 0, 1), // Assumed forward vector of the player model mesh. Must match the model's orientation in its file.
    MOVEMENT_INPUT_THRESHOLD: 0.001, // Small value to prevent calculations when input is negligible.
};

// Stores the names of the animations as defined in the player's model file.
export const ANIM_NAMES = {
    IDLE: 'stand',    // Animation for standing still.
    WALK: 'walk',     // Animation for walking.
    RUN: 'run',      // Animation for running/sprinting.
    JUMP: 'jumpUp',   // Animation for the upward phase of the jump.
    FALL: 'jumpDown', // Optional: Animation for the falling phase (looping).
    // LAND: 'land',     // Optional: Short animation played upon landing.
};
// --- End Configuration ---

/**
 * Manages the player character's state, movement, physics, and animations.
 * Reads input from InputManager, updates the player model's transform,
 * and interacts with the animation system.
 */
export class PlayerController {
    /**
     * Initializes the PlayerController.
     * @param {THREE.Object3D} player - The 3D model object representing the player.
     * @param {THREE.Camera} camera - The main game camera, used for calculating movement direction.
     * @param {InputManager} inputManager - The input manager instance to read player input state.
     * @param {object|null} modelAnimations - Optional object containing the THREE.AnimationMixer and actions map for the player model. Expected format: { mixer: THREE.AnimationMixer, actions: { 'animName': THREE.AnimationAction, ... } }
     */
    constructor(player, camera, inputManager, modelAnimations = null) {
        /** @type {THREE.Object3D} The player's 3D model. */
        this.player = player;
        /** @type {THREE.Camera} The main game camera. */
        this.camera = camera;
        /** @type {InputManager} Reference to the input manager. */
        this.inputManager = inputManager;
        /** @type {{mixer: THREE.AnimationMixer, actions: Object.<string, THREE.AnimationAction>}|null} Animation data. */
        this.modelAnimations = modelAnimations;
        /** @type {THREE.AnimationAction | null} The currently active animation action. */
        this.currentAnimation = null;

        /** @type {number} Player walk speed (units/sec). */
        this.walkSpeed = PLAYER_CONFIG.WALK_SPEED;
        /** @type {number} Player run speed (units/sec). */
        this.runSpeed = PLAYER_CONFIG.RUN_SPEED;
        /** @type {number} The current movement speed, determined by walking/running state. */
        this.movementSpeed = this.walkSpeed;
        /** @type {THREE.Vector3} The player's current horizontal velocity vector (units/sec). Captures direction and speed on the XZ plane. */
        this.horizontalVelocity = new THREE.Vector3();

        /** @type {boolean} Flag indicating if the player is currently in the jump state. */
        this.isJumping = false;
        /** @type {number} Acceleration due to gravity (units/sec^2). */
        this.gravity = PLAYER_CONFIG.GRAVITY;
        /** @type {number} Desired jump height (units). */
        this.jumpHeight = PLAYER_CONFIG.JUMP_HEIGHT;
        /** @type {number} The player's current vertical velocity (units/sec). */
        this.velocityY = 0;

        // Store animation names for easy access
        /** @type {object} Map of animation state names to actual animation clip names. */
        this.animNames = ANIM_NAMES;
        // Check if optional animations exist in the loaded model's actions
        /** @type {boolean} True if a 'fall' animation action exists. */
        this.hasFallAnimation = this.modelAnimations?.actions[this.animNames.FALL] !== undefined;
        /** @type {boolean} True if a 'land' animation action exists. */
        this.hasLandAnimation = this.modelAnimations?.actions[this.animNames.LAND] !== undefined;

        // Initialize the starting animation (usually Idle)
        if (this.modelAnimations?.actions[this.animNames.IDLE]) {
            this.switchAnimation(this.animNames.IDLE, 0); // Start idle instantly
        }
    }

    /**
     * Calculates the intended movement direction vector based on WASD input
     * relative to the camera's current orientation on the horizontal plane.
     * @returns {THREE.Vector3} A normalized vector representing the desired movement direction in world space (XZ plane). Returns zero vector if no input.
     */
    calculateMovementDirection() {
        // Temporary vector to store raw input direction (X: A/D, Z: W/S)
        const direction = new THREE.Vector3();
        if (this.inputManager.keys.KeyW) direction.z += 1; // Forward
        if (this.inputManager.keys.KeyS) direction.z -= 1; // Backward
        if (this.inputManager.keys.KeyA) direction.x += 1; // Left Strafe
        if (this.inputManager.keys.KeyD) direction.x -= 1; // Right Strafe

        // If no direction keys are pressed, return zero vector immediately.
        if (direction.lengthSq() === 0) { // Use lengthSq for efficiency (avoids sqrt)
            return direction;
        }

        // Get the camera's forward direction projected onto the horizontal plane (XZ)
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward); // Get camera's world direction
        cameraForward.y = 0; // Ignore vertical component
        cameraForward.normalize(); // Make it a unit vector

        // Calculate the camera's right direction on the horizontal plane
        const cameraRight = new THREE.Vector3();
        // Use world UP vector (0,1,0) and camera's forward to get the right vector via cross product
        cameraRight.crossVectors(this.camera.up, cameraForward).normalize();

        // Combine the raw input direction with the camera's orientation
        // moveVector = (cameraForward * input.z) + (cameraRight * input.x)
        const moveVector = new THREE.Vector3()
            .addScaledVector(cameraForward, direction.z) // Add forward/backward component
            .addScaledVector(cameraRight, direction.x);  // Add left/right strafe component

        // Return the normalized final direction vector (unit vector)
        return moveVector.normalize();
    }

    /**
     * Switches the currently playing animation smoothly.
     * Handles fading out the previous animation and fading in the new one.
     * Manages non-looping animations like landing.
     * @param {string} targetAnimName - The name (key from ANIM_NAMES) of the animation to switch to.
     * @param {number} [fadeDuration=PLAYER_CONFIG.ANIM_FADE_DURATION] - The duration of the crossfade in seconds.
     */
    switchAnimation(targetAnimName, fadeDuration = PLAYER_CONFIG.ANIM_FADE_DURATION) {
        // Ensure animation data is available
        if (!this.modelAnimations || !this.modelAnimations.actions) return;

        // Get the target animation action from the stored map
        const targetAction = this.modelAnimations.actions[targetAnimName];

        // If the target animation doesn't exist in the model, do nothing
        if (!targetAction) {
            // console.warn(`Animation "${targetAnimName}" not found!`); // Optional warning
            return;
        }

        // If the target animation is already the current one, do nothing
        if (this.currentAnimation === targetAction) return;

        // Fade out the current animation, if one is playing
        if (this.currentAnimation) {
            // Special case: If fading out from 'Land', stop it immediately instead of fading
            if (this.currentAnimation === this.modelAnimations.actions[this.animNames.LAND]) {
                 this.currentAnimation.stop(); // Avoid fade-out if it was landing
            } else {
                 this.currentAnimation.fadeOut(fadeDuration);
            }
        }

        // Reset the target animation, set its weight, fade it in, and play
        targetAction.reset() // Go back to the start
                   .setEffectiveWeight(1.0) // Ensure it has full influence
                   .fadeIn(fadeDuration) // Fade in smoothly
                   .play(); // Start playing

        // Store the new action as the current one
        this.currentAnimation = targetAction;

        // Handle settings for non-looping animations
        if (targetAnimName === this.animNames.LAND) {
            targetAction.clampWhenFinished = true; // Pause on last frame when done
            targetAction.loop = THREE.LoopOnce;   // Play only once
        } else {
            // Ensure all other animations loop by default
            targetAction.loop = THREE.LoopRepeat;
        }
    }

    /**
     * Updates the player's state, position, rotation, and animation each frame.
     * @param {number} delta - The time elapsed since the last frame in seconds. Essential for frame-rate independent physics.
     */
    update(delta) {
        // Get current input states
        const isMoving = this.inputManager.isMoving();       // Is any WASD key pressed?
        const isSprinting = this.inputManager.isSprinting(); // Is Left or Right Shift pressed?

        // --- Calculate Horizontal Movement (ONLY IF ON GROUND) ---
        // This ensures no air control - horizontal velocity is fixed once airborne.
        if (!this.isJumping) {
            // Determine current speed based on sprinting state
            this.movementSpeed = isSprinting ? this.runSpeed : this.walkSpeed;
            // Get the desired movement direction based on input and camera
            const moveDirection = this.calculateMovementDirection();
            // Calculate final horizontal velocity: Velocity = Direction * Speed
            // Use clone() so the original moveDirection isn't modified by multiplyScalar
            this.horizontalVelocity = moveDirection.clone().multiplyScalar(this.movementSpeed);
        }
        // If currently jumping, this.horizontalVelocity retains the value from the moment of takeoff.


        // --- Jump Trigger Logic ---
        // Check if the jump action was triggered and if the player is not already jumping
        if (this.inputManager.jumpTriggered && !this.isJumping) {
            this.isJumping = true; // Enter the jumping state
            // Calculate the initial upward velocity needed to reach the desired jump height
            // Physics formula: v0 = sqrt(-2 * gravity * jumpHeight)
            this.velocityY = Math.sqrt(-2 * this.gravity * this.jumpHeight);
            this.inputManager.jumpTriggered = false; // Consume the jump trigger so it doesn't fire again
            this.switchAnimation(this.animNames.JUMP); // Play the jump animation
            // Note: horizontalVelocity already holds the correct takeoff velocity from the block above.
        }


        // --- Physics & Position Update ---
        let justLanded = false; // Flag to detect the exact frame of landing
        // Apply physics updates only if the player is in the jumping state (which includes falling)
        if (this.isJumping) {
            // Apply gravity to vertical velocity: v = v0 + (g * t)
            this.velocityY += this.gravity * delta;

            // Apply vertical velocity to position: y = y0 + (v * t)
            this.player.position.y += this.velocityY * delta;

            // Optional: Switch to a falling animation if one exists and vertical velocity is negative (moving down)
            if (this.hasFallAnimation && this.velocityY <= 0) {
                this.switchAnimation(this.animNames.FALL);
            }

            // Ground Check: Detect if player has hit or gone below the ground (y=0)
            if (this.player.position.y <= 0) {
                this.player.position.y = 0; // Clamp position exactly to the ground
                this.isJumping = false;      // Exit the jumping state
                this.velocityY = 0;         // Reset vertical velocity
                justLanded = true;           // Set the flag for this frame
                // horizontalVelocity will be recalculated next frame based on input.
            }
        }

        // --- Apply Horizontal Movement ---
        // This occurs whether jumping or on the ground.
        // Uses the velocity calculated this frame (if on ground) or the takeoff velocity (if jumping).
        // Position update: x = x0 + (vx * t)
        this.player.position.x += this.horizontalVelocity.x * delta;
        this.player.position.z += this.horizontalVelocity.z * delta;


        // --- Rotation ---
        // Rotate the player model to face the movement direction, but only when moving on the ground.
        if (isMoving && !this.isJumping) {
             // Check if there is significant horizontal velocity to avoid rotating to zero vector
             if (this.horizontalVelocity.lengthSq() > PLAYER_CONFIG.MOVEMENT_INPUT_THRESHOLD) {
                // Get the normalized direction from the horizontal velocity vector
                const lookDirection = this.horizontalVelocity.clone().normalize();
                // Calculate the target rotation (Quaternion) to align the model's forward with the lookDirection
                const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
                    PLAYER_CONFIG.MODEL_FORWARD_DIRECTION, // Model's default forward
                    lookDirection                          // Desired world direction
                );
                // Smoothly interpolate the player's current rotation towards the target rotation using Spherical Linear Interpolation (slerp)
                this.player.quaternion.slerp(targetQuaternion, PLAYER_CONFIG.ROTATION_SPEED);
             }
        }


        // --- Animation Update ---
        // Handle animation transitions based on state (landing, on ground, moving/idle)
        if (justLanded) {
            // If a landing animation exists, play it.
            if (this.hasLandAnimation) {
                this.switchAnimation(this.animNames.LAND);
                // Note: A more robust system might wait for the land animation to finish
                // before transitioning to idle/walk/run, possibly using the AnimationMixer's 'finished' event.
            } else {
                 // If no landing animation, immediately switch to the appropriate ground animation
                 const targetGroundAnim = isMoving ? (isSprinting ? this.animNames.RUN : this.animNames.WALK) : this.animNames.IDLE;
                 this.switchAnimation(targetGroundAnim);
            }
        } else if (!this.isJumping) { // If on the ground (and not the exact landing frame)
            // Only switch animations if the current one is set to loop (e.g., not interrupting 'Land')
            if (!this.currentAnimation || this.currentAnimation.loop === THREE.LoopRepeat) {
                // Determine target animation based on moving/sprinting state
                const targetGroundAnim = isMoving ? (isSprinting ? this.animNames.RUN : this.animNames.WALK) : this.animNames.IDLE;
                this.switchAnimation(targetGroundAnim); // Switch to the determined ground animation
            }
        }
        // Note: Jump/Fall animations are handled within the isJumping physics block.
    }
}