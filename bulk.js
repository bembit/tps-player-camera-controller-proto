import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/GLTFLoader.js';

class TestGame {
  constructor() {
    // Create a minimal scene, camera, and renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.canvas = document.getElementById('starfield-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Third-Person Camera Variables
    this.cameraOffset = new THREE.Vector3(0, 6, -4);
    this.cameraTargetOffset = new THREE.Vector3(0, 1, 0);
    this.rotationAngle = -1.5; // Horizontal rotation around the player
    this.zoomDistance = 6;
    this.minZoom = 2;
    this.maxZoom = 15;

    // Movement state
    this.keys = { w: false, a: false, s: false, d: false, shift: false };
    this.movementSpeed = 0.1;
    this.horizontalVelocity = new THREE.Vector3();

    // Jump settings
    this.isJumping = false;
    this.gravity = -0.002;
    this.velocityY = 1;
    this.jumpDuration = 100;
    this.initialJumpVelocity = (this.jumpDuration / 2) * Math.abs(this.gravity);

    // Player and animation data
    this.player = null;
    this.mixers = [];
    this.modelAnimations = {};
    this.currentAnimation = null;

    // Timing
    this.clock = new THREE.Clock();

    // Mouse control variables
    this.isCanvasActive = false;
    this.mouseDown = false;
    this.sensitivity = 0.003;

    // List of models to load (for testing)
    this.models = [
      {
        path: './catwoman.glb',
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        // Other properties (e.g. animations) can be added as needed
      },
    ];

    // Bind all event listeners
    this._bindEventListeners();

    // Load the models
    this.models.forEach((modelConfig) => this.loadModel(modelConfig));

    // Start the render loop
    this.animate();
  }

  _bindEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', this._onKeyDown.bind(this));
    document.addEventListener('keyup', this._onKeyUp.bind(this));

    // Canvas mouse activation
    this.canvas.addEventListener('mousedown', this._onCanvasMouseDown.bind(this));
    this.canvas.addEventListener('mouseout', this._onCanvasMouseOut.bind(this));
    document.addEventListener('mouseup', this._onCanvasMouseUp.bind(this));

    // Mouse movement (for both normal and pointer lock modes)
    document.addEventListener('mousemove', this._onMouseMove.bind(this));

    // Right-click events for pointer lock rotation
    document.addEventListener('mousedown', this._onDocumentMouseDown.bind(this));
    document.addEventListener('mouseup', this._onDocumentMouseUp.bind(this));

    // Prevent context menu on right-click
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    // Zoom with the mouse wheel
    this.canvas.addEventListener('wheel', this._onWheel.bind(this));

    // Update camera on window resize
    window.addEventListener('resize', this._onWindowResize.bind(this));
  }

  _onKeyDown(event) {
    if (event.key in this.keys) {
      this.keys[event.key] = true;
    }
    if (event.key === 'Shift') {
      this.keys.shift = true;
    }
    // Use spacebar to trigger a jump if not already jumping
    if (event.key === ' ' && !this.isJumping) {
      this.isJumping = true;
      this.velocityY = this.initialJumpVelocity;
    }
  }

  _onKeyUp(event) {
    if (event.key in this.keys) {
      this.keys[event.key] = false;
    }
    if (event.key === 'Shift') {
      this.keys.shift = false;
    }
  }

  _onCanvasMouseDown() {
    this.isCanvasActive = true;
  }

  _onCanvasMouseUp() {
    this.isCanvasActive = false;
  }

  _onCanvasMouseOut() {
    this.isCanvasActive = false;
  }

  _onMouseMove(event) {
    // If pointer lock is active (right-click held)
    if (this.mouseDown && document.pointerLockElement) {
      this.rotationAngle += event.movementX * this.sensitivity;
      const horizontalFactor = 1 - Math.abs(event.movementY) * 0.0005;
      this.rotationAngle *= horizontalFactor;
      this.cameraOffset.y = THREE.MathUtils.clamp(
        this.cameraOffset.y + event.movementY * this.sensitivity * 2,
        2,
        8
      );
    } else if (this.isCanvasActive) {
      // Normal mode: update rotation and vertical offset
      this.rotationAngle += event.movementX * this.sensitivity;
      const verticalOffset = this.cameraOffset.y + event.movementY * this.sensitivity * 2;
      this.cameraOffset.y = THREE.MathUtils.clamp(verticalOffset, 2, 8);
    }
  }

  _onDocumentMouseDown(event) {
    if (event.button === 2) { // Right-click
      this.mouseDown = true;
      document.body.requestPointerLock();
    }
  }

  _onDocumentMouseUp(event) {
    if (event.button === 2) {
      this.mouseDown = false;
      document.exitPointerLock();
    }
  }

  _onWheel(event) {
    event.preventDefault();
    const zoomSpeed = 0.5;
    this.zoomDistance += event.deltaY * 0.01 * zoomSpeed;
    this.zoomDistance = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomDistance));
  }

  _onWindowResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  calculatePlayerMovement() {
    const direction = new THREE.Vector3();
    if (this.keys.w) direction.z += 1;
    if (this.keys.s) direction.z -= 1;
    if (this.keys.a) direction.x += 1;
    if (this.keys.d) direction.x -= 1;

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

  updatePlayerMovement() {
    if (!this.player) return;

    // Retrieve animations for the loaded model (if available)
    const playerAnimations = this.modelAnimations[this.models[0].path]?.actions;
    const movement = this.calculatePlayerMovement();
    this.horizontalVelocity.copy(movement);

    if (this.isJumping) {
      // Apply gravity and update vertical position
      this.velocityY += this.gravity;
      this.player.position.y += this.velocityY;

      // Stop jump when player lands
      if (this.player.position.y <= 0) {
        this.player.position.y = 0;
        this.isJumping = false;
        this.velocityY = 0;
      }
      // Continue applying horizontal movement during a jump
      this.player.position.x += this.horizontalVelocity.x;
      this.player.position.z += this.horizontalVelocity.z;

      // Play jump animation if available
      const jumpAnimation = playerAnimations ? playerAnimations['jumpUp'] : null;
      if (jumpAnimation && this.currentAnimation !== jumpAnimation) {
        if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
        jumpAnimation.reset().fadeIn(0.5).play();
        this.currentAnimation = jumpAnimation;
      }
    } else {
      const isMoving = movement.length() > 0;
      if (isMoving) {
        const targetAnimation = this.keys.shift ? 'run' : 'walk';
        this.movementSpeed = this.keys.shift ? 0.1 : 0.05;

        if (playerAnimations && this.currentAnimation !== playerAnimations[targetAnimation]) {
          if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
          playerAnimations[targetAnimation].reset().fadeIn(0.5).play();
          this.currentAnimation = playerAnimations[targetAnimation];
        }

        // Rotate the player smoothly toward the movement direction
        const lookDirection = movement.clone().normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          lookDirection
        );
        this.player.quaternion.slerp(targetQuaternion, 0.1);
      } else {
        if (playerAnimations && this.currentAnimation !== playerAnimations['stand']) {
          if (this.currentAnimation) this.currentAnimation.fadeOut(0.5);
          playerAnimations['stand'].reset().fadeIn(0.5).play();
          this.currentAnimation = playerAnimations['stand'];
        }
      }
      // Apply horizontal movement when not jumping
      this.player.position.x += this.horizontalVelocity.x;
      this.player.position.z += this.horizontalVelocity.z;
    }
  }

  updateTPSCamera() {
    if (!this.player) return;

    // Update the camera position relative to the player
    this.camera.position.set(
      this.player.position.x + this.zoomDistance * Math.cos(this.rotationAngle),
      this.player.position.y + this.cameraOffset.y,
      this.player.position.z + this.zoomDistance * Math.sin(this.rotationAngle)
    );

    // Make the camera look at the player (with an offset)
    const targetPosition = this.player.position.clone().add(this.cameraTargetOffset);
    this.camera.lookAt(targetPosition);
  }

  loadModel(config) {
    const loader = new GLTFLoader();
    loader.load(
      config.path,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(config.position.x, config.position.y, config.position.z);
        model.scale.set(config.scale, config.scale, config.scale);

        // Add the model to the scene (it’s now the "player")
        this.scene.add(model);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.player = model;

        // Setup animations if any exist
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const actions = {};
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            actions[clip.name] = action;
          });
          // Start with the “stand” animation (adjust index or name as needed)
          actions[gltf.animations[4].name].play();
          this.mixers.push(mixer);
          this.modelAnimations[config.path] = { mixer, actions };
        }
      },
      undefined,
      (error) => console.error('Error loading model:', error)
    );
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const delta = this.clock.getDelta();
    this.mixers.forEach((mixer) => mixer.update(delta));
    this.updatePlayerMovement();
    this.updateTPSCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate the class to start the test
const testGame = new TestGame();
