import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

/**
 * CameraController updates the third‑person camera based on input and the player's position.
 */
export class CameraController {
    constructor(camera, inputManager) {
      this.camera = camera;
      this.inputManager = inputManager;
      this.cameraOffset = new THREE.Vector3(0, 6, -4);
      this.cameraTargetOffset = new THREE.Vector3(0, 1, 0);
      this.rotationAngle = -1.5;
      this.zoomDistance = 6;
      this.minZoom = 2;
      this.maxZoom = 15;
    }
    
    setPlayer(player) {
      this.player = player;
    }

    // How would I handle going indoors / into tunels?
    
    update() {
      const { mouseDeltaX, mouseDeltaY, sensitivity, zoomDelta, mouseDown, isCanvasActive } = this.inputManager;
      // Adjust rotation and vertical offset based on mouse movement.
      if (mouseDown && document.pointerLockElement) {
        this.rotationAngle += mouseDeltaX * sensitivity;
        const horizontalFactor = 1 - Math.abs(mouseDeltaY) * 0.0005;
        this.rotationAngle *= horizontalFactor;
        this.cameraOffset.y = THREE.MathUtils.clamp(
          this.cameraOffset.y + mouseDeltaY * sensitivity * 2,
          2, 8
        );
      } else if (isCanvasActive) {
        this.rotationAngle += mouseDeltaX * sensitivity;
        const verticalOffset = this.cameraOffset.y + mouseDeltaY * sensitivity * 2;
        this.cameraOffset.y = THREE.MathUtils.clamp(verticalOffset, 2, 8);
      }
      
      // Update zoom (clamped).
      // this.zoomDistance += zoomDelta;
      // this.zoomDistance = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomDistance));
      // Update zoom
      const zoomSpeed = 0.1;
      const zoomFactor = 1 + this.inputManager.zoomDelta * zoomSpeed;
      this.zoomDistance *= zoomFactor;
      this.cameraOffset.y *= zoomFactor;
      this.zoomDistance = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomDistance));
      this.cameraOffset.y = Math.max(2, Math.min(8, this.cameraOffset.y));
      
      // Update the camera's position relative to the player.
      if (this.player) {
        this.camera.position.set(
          this.player.position.x + this.zoomDistance * Math.cos(this.rotationAngle),
          this.player.position.y + this.cameraOffset.y,
          this.player.position.z + this.zoomDistance * Math.sin(this.rotationAngle)
        );
        const targetPosition = this.player.position.clone().add(this.cameraTargetOffset);
        this.camera.lookAt(targetPosition);
      }
      
      // Reset accumulated mouse deltas.
      this.inputManager.resetMouseDelta();
    }
}