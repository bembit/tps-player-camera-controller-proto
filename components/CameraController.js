// CameraController.js
import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

// --- Configuration Constants ---
// Tunable parameters for the third-person camera behavior.
const CAMERA_CONFIG = {
    PITCH_LIMIT_MIN_Y: 2,  // Minimum camera height relative to player pivot. Controls min pitch angle.
    PITCH_LIMIT_MAX_Y: 8,  // Maximum camera height relative to player pivot. Controls max pitch angle.
    ZOOM_MIN: 2,         // Minimum distance from player pivot.
    ZOOM_MAX: 15,        // Maximum distance from player pivot.
    INITIAL_ZOOM: 6,       // Starting distance from the player.
    INITIAL_Y_OFFSET: 6,   // Starting height offset (defines initial pitch along with zoom).
    INITIAL_ROTATION: -1.5,// Initial horizontal rotation angle in radians (approx -86 degrees).
    SENSITIVITY_X: 0.003,  // Multiplier for horizontal mouse movement affecting rotation.
    SENSITIVITY_Y: 0.003,  // Multiplier for vertical mouse movement affecting pitch (Y offset).
    ZOOM_SENSITIVITY: 0.1, // Multiplier for mouse wheel scrolling affecting zoom distance. << ADJUSTED SENSITIVITY >>
    TARGET_OFFSET_Y: 1.0,  // Vertical offset from the player's base position (pivot) where the camera should lookAt.
};
// --- End Configuration ---

/**
 * Manages the third-person camera system.
 * Updates the camera's position and orientation based on player position,
 * mouse input (rotation, pitch), and mouse wheel input (zoom).
 */
export class CameraController {
    /**
     * Initializes the CameraController.
     * @param {THREE.PerspectiveCamera} camera - The camera object to control.
     * @param {InputManager} inputManager - The input manager instance to read mouse/wheel state.
     */
    constructor(camera, inputManager) {
        /** @type {THREE.PerspectiveCamera} The camera being controlled. */
        this.camera = camera;
        /** @type {InputManager} Reference to the input manager. */
        this.inputManager = inputManager;
        /** @type {THREE.Object3D | null} Reference to the player object the camera should follow. */
        this.player = null; // Set via setPlayer()

        /** @type {number} Current horizontal rotation angle around the player (radians). */
        this.rotationAngle = CAMERA_CONFIG.INITIAL_ROTATION;
        /** @type {number} Current zoom distance from the player's pivot point. */
        this.zoomDistance = CAMERA_CONFIG.INITIAL_ZOOM;
        /** @type {number} Current vertical offset of the camera from the player's pivot point (controls pitch). */
        this.yOffset = CAMERA_CONFIG.INITIAL_Y_OFFSET;

        /** @type {THREE.Vector3} Offset from player position for the camera's lookAt target. */
        this.cameraTargetOffset = new THREE.Vector3(0, CAMERA_CONFIG.TARGET_OFFSET_Y, 0);
    }

    /**
     * Sets the player object for the camera to follow.
     * @param {THREE.Object3D} player - The player's 3D model.
     */
    setPlayer(player) {
        this.player = player;
    }

    /**
     * Updates the camera's position and lookAt target based on input and player position.
     * This version implements proportional zoom for distance and height.
     * Does NOT use delta time smoothing.
     */
    update() {
        // If no player is set yet, do nothing.
        if (!this.player) return;

        // Get mouse input state from the InputManager for this frame.
        const { mouseDeltaX, mouseDeltaY, zoomDelta, mouseDown, isCanvasActive } = this.inputManager;

        // --- Update Camera State based on Input ---

        // Rotation (Horizontal Orbit) - Adjust based on mouse X movement.
        if (mouseDown.right || (mouseDown.left && isCanvasActive)) {
            this.rotationAngle -= mouseDeltaX * CAMERA_CONFIG.SENSITIVITY_X;
        }

        // Pitch (Vertical Orbit) - Adjust the Y-offset based ONLY on mouse Y movement.
        if (mouseDown.right || (mouseDown.left && isCanvasActive)) {
            this.yOffset += mouseDeltaY * CAMERA_CONFIG.SENSITIVITY_Y * 2;
            // Clamp the Y-offset here after mouse movement adjustment.
            this.yOffset = THREE.MathUtils.clamp(
                this.yOffset,
                CAMERA_CONFIG.PITCH_LIMIT_MIN_Y,
                CAMERA_CONFIG.PITCH_LIMIT_MAX_Y
            );
        }

        // Zoom - Adjust distance AND Y-offset proportionally based on mouse wheel scroll delta.
        if (zoomDelta !== 0) {
            // Calculate zoom factor. A positive zoomDelta (scroll down/away) should increase distance.
            // Use a structure similar to the user's snippet: 1 + delta * sensitivity
            // NOTE: Ensure InputManager's zoomDelta has the correct sign for your desired scroll direction.
            // Assuming positive zoomDelta = zoom out:
            const zoomFactor = 1.0 + zoomDelta * CAMERA_CONFIG.ZOOM_SENSITIVITY;

            // Apply zoom factor to both distance and height offset to maintain angle.
            this.zoomDistance *= zoomFactor;
            this.yOffset *= zoomFactor; // <<<< KEY CHANGE: Scale Y offset proportionally

            // Clamp the zoom distance *after* scaling.
            this.zoomDistance = Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, this.zoomDistance));
            // Clamp the Y-offset *after* scaling to ensure it stays within pitch limits.
            this.yOffset = THREE.MathUtils.clamp(
                this.yOffset,
                CAMERA_CONFIG.PITCH_LIMIT_MIN_Y,
                CAMERA_CONFIG.PITCH_LIMIT_MAX_Y
            );
        }


        // --- Calculate Final Camera Position ---
        // Start with the player's current world position.
        const cameraPosition = this.player.position.clone();

        // Calculate the horizontal offset based on rotation angle and zoom distance.
        const horizontalOffsetX = this.zoomDistance * Math.sin(this.rotationAngle);
        const horizontalOffsetZ = this.zoomDistance * Math.cos(this.rotationAngle);

        // Add the horizontal offset to the player's position.
        cameraPosition.x += horizontalOffsetX;
        cameraPosition.z += horizontalOffsetZ;

        // Add the calculated vertical offset (which now reflects both pitch input and zoom scaling).
        cameraPosition.y += this.yOffset;

        // Set the camera's final calculated position.
        this.camera.position.copy(cameraPosition);


        // --- Update LookAt ---
        // Calculate the point the camera should look at.
        const lookAtTarget = this.player.position.clone().add(this.cameraTargetOffset);
        // Make the camera look at the calculated target point.
        this.camera.lookAt(lookAtTarget);


        // --- Reset Input Deltas ---
        // Crucial: Reset accumulated mouse deltas in InputManager for the next frame.
        this.inputManager.resetMouseDelta();
    }
}