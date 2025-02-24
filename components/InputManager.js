
/**
 * InputManager to define and bind key and mouse events.
 * Not sure about this one yet. Might rewrite to individual methods for each action with a _bindListeners.
 */
export class InputManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = { w: false, a: false, s: false, d: false, shift: false };
      this.jumpTriggered = false;
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
      this.zoomDelta = 0;
      this.isCanvasActive = false;
      this.mouseDown = false;
      this.sensitivity = 0.003;
      this._bindEvents();
    }
    
    _bindEvents() {
      // Keyboard events
      document.addEventListener('keydown', (event) => {
        if (event.key in this.keys) this.keys[event.key] = true;
        if (event.key === 'Shift') this.keys.shift = true;
        if (event.key === ' ') this.jumpTriggered = true;
      });
      document.addEventListener('keyup', (event) => {
        if (event.key in this.keys) this.keys[event.key] = false;
        if (event.key === 'Shift') this.keys.shift = false;
        // Leave jumpTriggered until consumed by PlayerController.
      });
      
      // Canvas activation for mouse control
      this.canvas.addEventListener('mousedown', () => { this.isCanvasActive = true; });
      this.canvas.addEventListener('mouseout', () => { this.isCanvasActive = false; });
      document.addEventListener('mouseup', () => { this.isCanvasActive = false; });
      
      // Mouse movement events – only accumulate movement if pointer lock or canvas is active
      document.addEventListener('mousemove', (event) => {
        if ((this.mouseDown && document.pointerLockElement) || this.isCanvasActive) {
          this.mouseDeltaX += event.movementX;
          this.mouseDeltaY += event.movementY;
        }
      });
      
      // Right-click to trigger pointer lock for camera control.
      document.addEventListener('mousedown', (event) => {
        if (event.button === 2) {
          this.mouseDown = true;
          // THIS. zoom disabled.
          document.body.requestPointerLock();
        }
      });
      document.addEventListener('mouseup', (event) => {
        if (event.button === 2) {
          this.mouseDown = false;
          document.exitPointerLock();
        }
      });
      
      // Zoom with the mouse wheel.
      this.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const zoomSpeed = 0.5;
        this.zoomDelta += event.deltaY * 0.01 * zoomSpeed;
      });
      
      // Prevent default context menu on right-click.
      document.addEventListener('contextmenu', (event) => event.preventDefault());
    }
    
    resetMouseDelta() {
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
      this.zoomDelta = 0;
    }
}
  
  