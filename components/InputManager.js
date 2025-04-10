// InputManager.js

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        // Use event.code values for keys for better reliability
        this.keys = {
            KeyW: false, KeyA: false, KeyS: false, KeyD: false,
            ShiftLeft: false, ShiftRight: false,
            Space: false // Use 'Space' for jump key code
        };
        // Rename jumpTriggered for clarity, or handle directly in PlayerController
        // For now, let's keep jumpTriggered but associate it with Space keyup
        this.jumpTriggered = false;
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
        this.zoomDelta = 0;
        this.isCanvasActive = false; // Consider renaming? maybe isMouseOverCanvas
        this.mouseDown = { left: false, middle: false, right: false }; // Track buttons separately
        this.sensitivity = 0.003;
        this._bindEvents();
    }

    _bindEvents() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            // Use event.code for reliable key identification
            if (event.code in this.keys) {
                this.keys[event.code] = true;
            }
            // Prevent default browser behavior for spacebar scroll
            if (event.code === 'Space') {
                 event.preventDefault();
            }
        });
        document.addEventListener('keyup', (event) => {
            if (event.code in this.keys) {
                this.keys[event.code] = false;
            }
            // Trigger jump specifically on Space key up
            if (event.code === 'Space') {
                this.jumpTriggered = true;
            }
        });

        // Canvas activation / Mouse focus - Simplified logic might be needed
        this.canvas.addEventListener('mouseover', () => { this.isCanvasActive = true; }); // Use mouseover/out
        this.canvas.addEventListener('mouseout', () => { this.isCanvasActive = false; });

        // Mouse movement events – Check for right mouse button down for camera control
        document.addEventListener('mousemove', (event) => {
            // Pointer lock handles movement capture implicitly
            if (document.pointerLockElement === document.body || this.mouseDown.left) { // Rotate camera if right mouse down OR left mouse down on canvas
                 this.mouseDeltaX += event.movementX;
                 this.mouseDeltaY += event.movementY;
            }
            // If just hovering over canvas without click, maybe don't rotate? Adjust as needed.
            // else if (this.isCanvasActive && this.mouseDown.left) { // Example: Only rotate on left drag over canvas
            //     this.mouseDeltaX += event.movementX;
            //     this.mouseDeltaY += event.movementY;
            // }
        });

        // Mouse button events
        document.addEventListener('mousedown', (event) => {
             if (event.target === this.canvas) { // Only register clicks on the canvas
                if (event.button === 0) this.mouseDown.left = true;
                if (event.button === 1) this.mouseDown.middle = true; // Middle mouse often needs preventDefault
                if (event.button === 2) {
                    this.mouseDown.right = true;
                    document.body.requestPointerLock(); // Lock pointer on right click
                }
             }
        });
        document.addEventListener('mouseup', (event) => {
            // Release regardless of target for robustness
            if (event.button === 0) this.mouseDown.left = false;
            if (event.button === 1) this.mouseDown.middle = false;
            if (event.button === 2) {
                this.mouseDown.right = false;
                if (document.pointerLockElement === document.body) {
                    document.exitPointerLock(); // Unlock pointer on right mouse up
                }
            }
        });

        // Zoom with the mouse wheel.
        // this.canvas.addEventListener('wheel', (event) => { // Attach to canvas to only zoom when mouse is over it
        //     event.preventDefault(); // Prevent page scroll
        //     const zoomSpeed = 0.5;
        //     // Normalize deltaY (browsers report differently)
        //     const delta = Math.sign(event.deltaY);
        //     this.zoomDelta += delta * zoomSpeed; // Simpler accumulation
        // }, { passive: false }); // Need passive: false to allow preventDefault

        // // Prevent default context menu on right-click.
        // this.canvas.addEventListener('contextmenu', (event) => event.preventDefault()); // Only prevent on canvas

        document.addEventListener('wheel', (event) => { // Attach to canvas to only zoom when mouse is over it
            // event.preventDefault(); // Prevent page scroll
            const zoomSpeed = 0.5;
            // Normalize deltaY (browsers report differently)
            const delta = Math.sign(event.deltaY);
            this.zoomDelta += delta * zoomSpeed; // Simpler accumulation
        }, { passive: false }); // Need passive: false to allow preventDefault

        // Prevent default context menu on right-click.
        this.canvas.addEventListener('contextmenu', (event) => event.preventDefault()); // Only prevent on canvas
    }

    // Reset deltas at the end of the frame (usually called by CameraController)
    resetMouseDelta() {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
        this.zoomDelta = 0;
        // We reset jumpTriggered AFTER it's consumed in PlayerController.update
    }

    // Helper to check if moving
    isMoving() {
        return this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD;
    }

    // Helper to check if sprinting
    isSprinting() {
        return this.keys.ShiftLeft || this.keys.ShiftRight;
    }
}