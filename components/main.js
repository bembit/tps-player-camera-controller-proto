// MainGame.js
import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

// Assuming other classes are imported correctly
import { InputManager } from './InputManager.js';
import { CameraController } from './CameraController.js';
import { PlayerController } from './PlayerController.js';
import { ModelLoader } from './ModelLoader.js';

import { ANIM_NAMES } from './PlayerController.js';

// --- Configuration Constants ---
// General scene and rendering settings.
const SCENE_CONFIG = {
    CAMERA_FOV: 75,      // Camera field of view in degrees.
    CAMERA_NEAR: 0.1,    // Camera near clipping plane distance.
    CAMERA_FAR: 1000,    // Camera far clipping plane distance.
    AMBIENT_LIGHT_COLOR: 0xffffff, // Color of the ambient light.
    AMBIENT_LIGHT_INTENSITY: 1.0,   // Intensity of the ambient light.
    SUNLIGHT_COLOR: 0xffffff,       // Color of the directional light (sun).
    SUNLIGHT_INTENSITY: 1.0,        // Intensity of the directional light.
    SUNLIGHT_POSITION: new THREE.Vector3(10, 20, 10), // Position of the directional light source.
    SHADOW_MAP_SIZE: 2048,          // Resolution of the shadow map (higher = sharper but more expensive).
    SHADOW_CAMERA_NEAR: 0.5,        // Near plane for the shadow camera.
    SHADOW_CAMERA_FAR: 50,          // Far plane for the shadow camera.
    SHADOW_CAMERA_BOUNDS: 32,       // Orthographic size of the shadow camera area.
    GROUND_SIZE: 64,                // Width and length of the ground plane.
    GROUND_COLOR: 0x333333,         // Color of the ground plane material.
    DEFAULT_MODEL_NORMALIZE_TARGET_HEIGHT: 3.0, // Target height for models after normalization.
};

// Configuration for the player model. Could be moved to JSON later.
const PLAYER_MODEL_CONFIG = {
    path: './models/catwoman.glb', // Path to the player's GLB file.
    position: { x: 0, y: 0, z: 0 }, // Initial position in the world.
    scale: 1,                      // Initial scale (will be adjusted by normalization).
    isPlayer: true,                // Flag to identify the player model during loading.
};

// Configuration for other static/environment models. Could be moved to JSON later.
const STATIC_MODEL_CONFIGS = [
     { path: './models/supergirl.glb', position: { x: 3, y: 0, z: 0 }, scale: 1000 }, // Example non-player model
     { path: './models/flash.glb', position: { x: -3, y: 0, z: 0 }, scale: 1 },     // Example non-player model
     // ... other static models
];
const ENV_MODEL_CONFIGS = [
     { path: './models/horse.glb', position: { x: 12, y: 0, z: 12 }, scale: 1, rotation: { x: 0, y: 1.5, z: 1.5}}, // Example env model
     { path: './models/horse.glb', position: { x: -12, y: 0, z: -12 }, scale: 1, rotation: { x: -1, y: 2, z: 2}}, // Example env model
     // ... other environment models
];
// --- End Configuration ---


/**
 * The main class that ties everything together.
 * Initializes the THREE.js scene, camera, renderer, loads assets,
 * sets up controllers and managers, and runs the main animation loop.
 */
class MainGame {
    /**
     * Initializes the entire game setup.
     */
    constructor() {
        // Core THREE.js components
        /** @type {THREE.Scene} The main scene graph container. */
        this.scene = new THREE.Scene();
        /** @type {THREE.PerspectiveCamera} The primary camera used for rendering. */
        this.camera = new THREE.PerspectiveCamera(
            SCENE_CONFIG.CAMERA_FOV,
            window.innerWidth / window.innerHeight, // Aspect ratio
            SCENE_CONFIG.CAMERA_NEAR,
            SCENE_CONFIG.CAMERA_FAR
        );
        /** @type {HTMLCanvasElement} The canvas element from the HTML. */
        this.canvas = document.getElementById('canvas');
        /** @type {THREE.WebGLRenderer} The renderer instance. */
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true // Allows transparency (if needed for background)
        });
        // Configure renderer settings
        this.renderer.setSize(window.innerWidth, window.innerHeight); // Match window size
        this.renderer.setPixelRatio(window.devicePixelRatio); // Use device pixel ratio for sharpness
        this.renderer.shadowMap.enabled = true; // Enable shadow mapping
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges

        // Managers and Controllers
        /** @type {InputManager} Handles all user input. */
        this.inputManager = new InputManager(this.canvas);
        /** @type {THREE.Clock} Used for getting delta time between frames. */
        this.clock = new THREE.Clock();
        /** @type {Array<THREE.AnimationMixer>} Stores animation mixers for updating animations. */
        this.mixers = [];
        /** @type {CameraController} Manages the third-person camera. */
        this.cameraController = new CameraController(this.camera, this.inputManager);
        /** @type {PlayerController | null} Manages the player character. Initialized after model loads. */
        this.playerController = null;

        // Initialization steps
        this.addLights();         // Add lights to the scene
        this.addTile();           // Add a ground plane
        this.loadModels();        // Load player and other models

        // Event listener for window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Start the main game loop
        this.animate();
    }

    /**
     * Normalizes the scale of a loaded model so its maximum dimension matches a target height.
     * Helps ensure different models have a consistent size in the scene.
     * @param {THREE.Object3D} model - The model object (usually a THREE.Group or THREE.Scene from GLTF).
     */
    normalizeModelScale(model) {
        // Calculate the bounding box of the model to get its size.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size); // Get the dimensions (width, height, depth)

        // Find the largest dimension.
        const maxDimension = Math.max(size.x, size.y, size.z);

        // Avoid division by zero if the model has no size.
        if (maxDimension === 0) return;

        // Calculate the scale factor needed to make the largest dimension match the target height.
        const scaleFactor = SCENE_CONFIG.DEFAULT_MODEL_NORMALIZE_TARGET_HEIGHT / maxDimension;

        // Apply the calculated scale factor uniformly to the model.
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }

    /**
     * Adds a simple ground plane to the scene for reference.
     */
    addTile() {
        // Create geometry and material for the ground plane.
        const grassGeometry = new THREE.PlaneGeometry(SCENE_CONFIG.GROUND_SIZE, SCENE_CONFIG.GROUND_SIZE);
        const grassMaterial = new THREE.MeshLambertMaterial({ color: SCENE_CONFIG.GROUND_COLOR }); // Lambert material reacts to light
        const grassTile = new THREE.Mesh(grassGeometry, grassMaterial);

        // Rotate the plane to lie flat on the XZ axis.
        grassTile.rotation.x = -Math.PI / 2; // Rotate -90 degrees around X-axis
        // Position it at the world origin (can be adjusted).
        grassTile.position.set(0, 0, 0);
        // Allow the ground plane to receive shadows.
        grassTile.receiveShadow = true;

        // Add the tile to the scene.
        this.scene.add(grassTile);
    }

    /**
     * Adds ambient and directional lights to the scene.
     */
    addLights() {
        // Ambient light provides basic illumination for all objects.
        const ambientLight = new THREE.AmbientLight(
            SCENE_CONFIG.AMBIENT_LIGHT_COLOR,
            SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY
        );
        this.scene.add(ambientLight);

        // Directional light simulates sunlight, casting shadows.
        const sunlight = new THREE.DirectionalLight(
            SCENE_CONFIG.SUNLIGHT_COLOR,
            SCENE_CONFIG.SUNLIGHT_INTENSITY
        );
        // Set position (direction comes from origin towards this position).
        sunlight.position.copy(SCENE_CONFIG.SUNLIGHT_POSITION);
        // Enable shadow casting for this light.
        sunlight.castShadow = true;

        // Configure shadow properties for quality and performance.
        sunlight.shadow.mapSize.width = SCENE_CONFIG.SHADOW_MAP_SIZE; // Shadow map resolution (width)
        sunlight.shadow.mapSize.height = SCENE_CONFIG.SHADOW_MAP_SIZE; // Shadow map resolution (height)
        // Define the bounds of the shadow camera's view frustum.
        sunlight.shadow.camera.near = SCENE_CONFIG.SHADOW_CAMERA_NEAR;
        sunlight.shadow.camera.far = SCENE_CONFIG.SHADOW_CAMERA_FAR;
        sunlight.shadow.camera.left = -SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
        sunlight.shadow.camera.right = SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
        sunlight.shadow.camera.top = SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
        sunlight.shadow.camera.bottom = -SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
        // Optional: Adjust shadow bias to prevent shadow acne (self-shadowing artifacts).
        // sunlight.shadow.bias = -0.0001;

        // Add the configured sunlight to the scene.
        this.scene.add(sunlight);

        // Optional: Helper to visualize the shadow camera frustum for debugging.
        // const shadowHelper = new THREE.CameraHelper(sunlight.shadow.camera);
        // this.scene.add(shadowHelper);
    }

    /**
     * Loads all configured 3D models (player, static, environment).
     * Initializes the PlayerController once the player model is loaded.
     */
    loadModels() {
        // Combine all model configurations into one list for iteration.
        // Ensure player config is handled specifically due to controller initialization.
        const allModelConfigs = [PLAYER_MODEL_CONFIG, ...STATIC_MODEL_CONFIGS, ...ENV_MODEL_CONFIGS];

        allModelConfigs.forEach((config) => {
            // Use the static ModelLoader class to load each model.
            ModelLoader.loadModel(
                config,
                // Success callback (onLoad)
                (gltf, model) => {
                    // Add the loaded model object to the scene.
                    this.scene.add(model);

                    // --- Animation Setup ---
                    let modelAnimations = null; // Prepare animation data structure
                    // Check if the loaded GLTF contains animations.
                    if (gltf.animations && gltf.animations.length > 0) {
                        // Create an AnimationMixer for this model.
                        const mixer = new THREE.AnimationMixer(model);
                        // Create a map to store animation actions by name.
                        const actions = {};
                        gltf.animations.forEach((clip) => {
                            // Create an AnimationAction for each clip.
                            actions[clip.name] = mixer.clipAction(clip);
                        });
                        // Store the mixer and actions map.
                        modelAnimations = { mixer, actions };
                        // Add the mixer to the global list for updating in the animate loop.
                        this.mixers.push(mixer);
                    }

                    // --- Player Specific Initialization ---
                    // Check if this loaded model is the designated player model.
                    if (config.isPlayer) {
                         // Normalize the player model's scale.
                        this.normalizeModelScale(model);

                        // Initialize the PlayerController with the loaded player model and its animations.
                        this.playerController = new PlayerController(model, this.camera, this.inputManager, modelAnimations);

                        // Tell the CameraController which object to follow.
                        this.cameraController.setPlayer(model);

                        // Start the default animation (Idle) if it exists
                        if (modelAnimations && modelAnimations.actions[ANIM_NAMES.IDLE]) {
                            modelAnimations.actions[ANIM_NAMES.IDLE].play();
                        }
                    }
                    // --- Non-Player Animation Start ---
                    // Optional: Automatically play the first animation for non-player animated models.
                    else if (modelAnimations && gltf.animations.length > 0) {
                        // Play the first animation found in the GLTF file.
                        const firstClipName = gltf.animations[0].name;
                        modelAnimations.actions[firstClipName].play();
                    }
                },
                // Error callback (onError)
                (error) => {
                    console.error(`Failed to load model (${config.path}):`, error);
                }
            );
        });
    }

    /**
     * Handles the browser window resize event.
     * Updates the renderer size and camera aspect ratio to match the new window dimensions.
     */
    onWindowResize() {
        // Update renderer size.
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Update camera aspect ratio.
        this.camera.aspect = window.innerWidth / window.innerHeight;
        // Apply the changes to the camera projection matrix.
        this.camera.updateProjectionMatrix();
    }

    /**
     * The main animation loop, called repeatedly via requestAnimationFrame.
     * Updates game logic, animations, controllers, and renders the scene.
     */
    animate() {
        // Request the next frame, binding 'this' correctly.
        requestAnimationFrame(this.animate.bind(this));

        // Get the time elapsed since the last frame (delta time in seconds).
        const delta = this.clock.getDelta();

        // Update all active animation mixers.
        this.mixers.forEach((mixer) => mixer.update(delta));

        // Update the player controller logic (physics, movement, state).
        // Pass delta time for frame-rate independent calculations.
        if (this.playerController) {
            this.playerController.update(delta);
        }

        // Update the camera controller logic (position, rotation, zoom).
        // Note: The current CameraController.update doesn't use delta, but could be added for smoothing.
        if (this.cameraController) {
             this.cameraController.update(); // Pass delta if smoothing is implemented
        }


        // Render the scene from the perspective of the camera.
        this.renderer.render(this.scene, this.camera);
    }
}

// Create an instance of the MainGame class to start the application.
const game = new MainGame();