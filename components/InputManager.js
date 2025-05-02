// InputManager.js

/**
 * Manages all raw browser input events (keyboard, mouse buttons, mouse movement, wheel).
 * Stores the current state of keys and mouse actions, making it available to other systems.
 * It accumulates mouse movement and wheel deltas per frame, which need to be reset externally after consumption.
 */
export class InputManager {
  /**
   * Initializes the InputManager and binds event listeners.
   * @param {HTMLCanvasElement} canvas - The canvas element to bind mouse events like click and wheel to.
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} Reference to the canvas element. */
    this.canvas = canvas;

    /** @type {Object.<string, boolean>} Stores the state of relevant keyboard keys (true if pressed). Uses KeyboardEvent.code for keys. */
    this.keys = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false, // Movement
      ShiftLeft: false,
      ShiftRight: false, // Sprint modifier
      Space: false, // Jump key
    };

    /** @type {boolean} Flag indicating if the jump action was triggered (typically on key up). Needs to be consumed (set back to false) by the player controller. */
    this.jumpTriggered = false;

    /** @type {number} Accumulated horizontal mouse movement since the last resetMouseDelta() call. */
    this.mouseDeltaX = 0;
    /** @type {number} Accumulated vertical mouse movement since the last resetMouseDelta() call. */
    this.mouseDeltaY = 0;
    /** @type {number} Accumulated mouse wheel scroll delta since the last resetMouseDelta() call. Positive=scroll down/away, Negative=scroll up/towards. */
    this.zoomDelta = 0;

    /** @type {boolean} Flag indicating if the mouse cursor is currently over the canvas element. */
    this.isCanvasActive = false;
    /** @type {Object.<string, boolean>} Stores the state of mouse buttons (true if pressed). */
    this.mouseDown = { left: false, middle: false, right: false };

    // Sensitivity moved to CameraController as it's primarily camera-related tuning.
    // this.sensitivity = 0.003;

    // Bind all necessary event listeners.
    this._bindEvents();
  }

  /**
   * Sets up all the necessary DOM event listeners for keyboard and mouse input.
   * Private method, called by the constructor.
   */
  _bindEvents() {
    // --- Keyboard Events ---
    document.addEventListener("keydown", (event) => {
      // Check if the pressed key (using event.code for layout independence) is one we track.
      if (event.code in this.keys) {
        this.keys[event.code] = true; // Mark the key as pressed.
      }
      // Prevent default browser action for Space bar (scrolling).
      if (event.code === "Space") {
        event.preventDefault();
        this.jumpTriggered = true; // Flag that jump should occur. Consumed by PlayerController.
      }
      // Could add handling for other keys or modifiers here if needed.
    });

    document.addEventListener("keyup", (event) => {
      // Check if the released key is one we track.
      if (event.code in this.keys) {
        this.keys[event.code] = false; // Mark the key as released.
      }
    });

    // --- Mouse Focus Events ---
    // Track if the mouse is over the canvas. Useful for context-specific actions.
    this.canvas.addEventListener("mouseover", () => {
      this.isCanvasActive = true;
    });
    this.canvas.addEventListener("mouseout", () => {
      this.isCanvasActive = false;
    });

    // --- Mouse Movement Events ---
    document.addEventListener("mousemove", (event) => {
      // Accumulate mouse movement deltas (event.movementX/Y).
      // Accumulate only if:
      // 1. Pointer lock is active (ideal for camera control).
      // 2. OR a mouse button is pressed *while* the cursor is over the canvas (for drag interactions).
      if (
        document.pointerLockElement === document.body ||
        (this.isCanvasActive &&
          (this.mouseDown.left ||
            this.mouseDown.right ||
            this.mouseDown.middle))
      ) {
        this.mouseDeltaX += event.movementX;
        this.mouseDeltaY += event.movementY;
      }
    });

    // --- Mouse Button Events ---
    // Listen for mouse button presses.
    document.addEventListener("mousedown", (event) => {
      // Only process clicks that *originate* on the canvas element.
      if (event.target === this.canvas) {
        // Left mouse button (button code 0)
        if (event.button === 0) this.mouseDown.left = true;
        // Middle mouse button (button code 1)
        if (event.button === 1) {
          this.mouseDown.middle = true;
          event.preventDefault(); // Prevent default middle-click behavior (e.g., autoscroll).
        }
        // Right mouse button (button code 2)
        if (event.button === 2) {
          this.mouseDown.right = true;
          // Request browser pointer lock when right button is pressed on canvas (for camera control).
          document.body
            .requestPointerLock()
            .catch((err) =>
              console.log(
                "Pointer lock request failed. User interaction likely required.",
                err
              )
            );
        }
      }
    });
    // Listen for mouse button releases.
    document.addEventListener("mouseup", (event) => {
      // Release button state regardless of where the mouseup happens (robustness).
      if (event.button === 0) this.mouseDown.left = false;
      if (event.button === 1) this.mouseDown.middle = false;
      if (event.button === 2) {
        this.mouseDown.right = false;
        // Exit pointer lock if it's currently active and was likely initiated by us.
        if (document.pointerLockElement === document.body) {
          document.exitPointerLock();
        }
      }
    });

    // --- Mouse Wheel Event ---
    // Listen for wheel events specifically on the canvas to control zoom.
    document.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault(); // Prevent default page scrolling action.
        const scrollAmount = event.deltaY; // Get scroll delta (positive=down, negative=up).
        // Normalize deltaY for consistency across browsers/platforms (optional).
        const normalizedDelta =
          Math.sign(scrollAmount) * Math.min(Math.abs(scrollAmount), 30); // Clamp magnitude.
        // Accumulate the normalized delta, scaled down for sensitivity control.
        this.zoomDelta += normalizedDelta * 0.01; // Scaling factor might become a constant.
      },
      { passive: false }
    ); // passive: false is required to allow preventDefault().

    // --- Context Menu Event ---
    // Prevent the default browser context menu from appearing on right-click over the canvas.
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault()
    );

    // --- Pointer Lock Event ---
    // Handle changes in pointer lock state (e.g., user pressing Esc).
    document.addEventListener(
      "pointerlockchange",
      () => {
        if (document.pointerLockElement !== document.body) {
          // Pointer lock was lost. If the right mouse button was logically 'down'
          // for camera control, we might need to reset its state here, depending on desired behavior.
          // Example: Ensure right mouse isn't stuck 'down' if Esc is pressed.
          // if (this.mouseDown.right) {
          //     this.mouseDown.right = false;
          // }
        }
      },
      false
    );
  }

  /**
   * Resets the accumulated mouse movement and zoom deltas.
   * This MUST be called each frame after the deltas have been processed (usually by CameraController)
   * to prepare for accumulating the next frame's input.
   */
  resetMouseDelta() {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.zoomDelta = 0;
    // Note: jumpTriggered is NOT reset here; it's reset by PlayerController after it's consumed.
  }

  /**
   * Helper method to quickly check if any movement key (WASD) is currently pressed.
   * @returns {boolean} True if W, A, S, or D is pressed.
   */
  isMoving() {
    return this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD;
  }

  /**
   * Helper method to quickly check if a sprint modifier key (Shift) is currently pressed.
   * @returns {boolean} True if Left Shift or Right Shift is pressed.
   */
  isSprinting() {
    return this.keys.ShiftLeft || this.keys.ShiftRight;
  }
}
