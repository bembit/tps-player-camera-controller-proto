import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Third-Person Camera Variables
// const cameraOffset = new THREE.Vector3(0, 4, -6); // Camera position relative to player
const cameraOffset = new THREE.Vector3(0, 6, -4); // Camera position relative to player
const cameraTargetOffset = new THREE.Vector3(0, 1, 0); // Target position offset (player's head level)
let rotationAngle = -1.5; // Horizontal rotation around the player

// Target the canvas element
const canvas = document.getElementById('starfield-canvas');

// Create a green grass tile
const grassGeometry = new THREE.PlaneGeometry(64, 64); // Width and height of the tile
const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Green color
const grassTile = new THREE.Mesh(grassGeometry, grassMaterial);

// Rotate the tile to lie flat on the ground
grassTile.rotation.x = -Math.PI / 2; // Rotate to face upward
grassTile.position.set(0, 0, 0); // Place it at the center of the scene
grassTile.receiveShadow = true; // Enable shadows for the grass tile
scene.add(grassTile);

// // Ambient Light for Base Illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// Create directional light
const sunlight = new THREE.DirectionalLight(0xffffff, 1); // White light with intensity 1
sunlight.position.set(10, 20, 10); // Position it above and at an angle
scene.add(sunlight);
sunlight.castShadow = true;

// Configure shadow properties for better performance
sunlight.shadow.mapSize.width = 2048; // Higher value = sharper shadows (default is 512)
sunlight.shadow.mapSize.height = 2048;
sunlight.shadow.camera.near = 0.5; // Start of shadow casting
sunlight.shadow.camera.far = 50; // End of shadow casting
sunlight.shadow.camera.left = -32; // Adjust bounds to cover scene
sunlight.shadow.camera.right = 32;
sunlight.shadow.camera.top = 32;
sunlight.shadow.camera.bottom = -32;

// Renderer with the selected canvas
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled = true; // Enable shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows (optional)

// Track keys
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
};
document.addEventListener('keydown', (event) => {
    if (event.key in keys) keys[event.key] = true;
    if (event.key === "Shift") keys.shift = true;
});
document.addEventListener('keyup', (event) => {
    if (event.key in keys) keys[event.key] = false;
    if (event.key === "Shift") keys.shift = false;
});

let isCanvasActive = false; // Track if the canvas is active

canvas.addEventListener('mousedown', () => {
    isCanvasActive = true; // Activate mouse control
});

document.addEventListener('mouseup', () => {
    isCanvasActive = false; // Deactivate mouse control
});

canvas.addEventListener('mouseout', () => {
    isCanvasActive = false; // Deactivate when mouse leaves the canvas
});

// Update player movement function
function calculatePlayerMovement() {
    const direction = new THREE.Vector3();
    if (keys.w) direction.z += 1; // Forward
    if (keys.s) direction.z -= 1; // Backward
    if (keys.a) direction.x += 1; // Left
    if (keys.d) direction.x -= 1; // Right

    // Ensure direction is aligned with the camera's orientation
    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    camera.getWorldDirection(cameraForward); // Camera forward direction
    cameraForward.y = 0; // Ignore vertical movement
    cameraForward.normalize();

    cameraRight.crossVectors(camera.up, cameraForward); // Camera right direction

    // Calculate movement vector relative to camera orientation
    const moveVector = new THREE.Vector3()
        .addScaledVector(cameraForward, direction.z)
        .addScaledVector(cameraRight, direction.x);

    return moveVector.normalize().multiplyScalar(movementSpeed);
}

let currentAnimation = null; // Track the current animation
const transitionDuration = 0.5; // Time in seconds for transitions

let isJumping = false; // Flag to track if the player is jumping
// let jumpHeight = 1; // Adjust the height of the jump
// let gravity = -0.005; 
let gravity = -0.002;
let velocityY = 1; // Vertical velocity for jumping
let jumpDuration = 100;

const initialJumpVelocity = (jumpDuration / 2) * Math.abs(gravity); // (time to peak) * abs(gravity)

let horizontalVelocity = new THREE.Vector3(); // To store horizontal movement (X, Z)

// Update the player movement, including jump handling
function updatePlayerMovement() {
    if (!player) return;
    
    let playerAnimations = modelAnimations[models[0].path]?.actions; // Ensure animations are loaded

    // Calculate horizontal movement
    const movement = calculatePlayerMovement(); // Get horizontal movement (X, Z)
    horizontalVelocity.copy(movement); // Store the horizontal velocity

    // Handle jumping
    if (isJumping) {
        // Apply gravity to simulate falling
        velocityY += gravity;

        // Apply vertical movement
        player.position.y += velocityY;

        // If the player reaches the ground again, end the jump
        if (player.position.y <= 0) {
            player.position.y = 0; // Keep player at ground level
            isJumping = false; // End the jump
            velocityY = 0; // Reset vertical velocity
        }

        // Apply horizontal movement while jumping
        player.position.x += horizontalVelocity.x;
        player.position.z += horizontalVelocity.z;

        // Trigger the jump animation (only if not already in the jump animation)
        const jumpAnimation = playerAnimations['jumpUp'];
        if (currentAnimation !== jumpAnimation) {
            if (currentAnimation) currentAnimation.fadeOut(transitionDuration);
            jumpAnimation.reset().fadeIn(transitionDuration).play();
            currentAnimation = jumpAnimation;
        }
    } else {
        // Handle standing or running animations when not jumping
        const isMoving = movement.length() > 0;

        if (isMoving) {
            // change animation
            const targetAnimation = keys.shift ? 'run' : 'walk';
            // change movement speed
            movementSpeed = keys.shift ? 0.1 : 0.05;

            if (currentAnimation !== playerAnimations[targetAnimation]) {
                if (currentAnimation) currentAnimation.fadeOut(transitionDuration);
                playerAnimations[targetAnimation].reset().fadeIn(transitionDuration).play();
                currentAnimation = playerAnimations[targetAnimation];
            }

            // Smoothly rotate player to face the movement direction
            const lookDirection = movement.clone().normalize();
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1), // Default forward direction
                lookDirection
            );
            player.quaternion.slerp(targetQuaternion, 0.1); // Adjust 0.1 for smoother or faster turning

        } else {
            if (currentAnimation !== playerAnimations['stand']) {
                // Transition to standing animation
                if (currentAnimation) currentAnimation.fadeOut(transitionDuration);
                playerAnimations['stand'].reset().fadeIn(transitionDuration).play();
                currentAnimation = playerAnimations['stand'];
            }
        }

        // Apply horizontal movement when not jumping
        player.position.x += horizontalVelocity.x;
        player.position.z += horizontalVelocity.z;
    }
}

// Trigger jump (bind to a key press or action)
document.addEventListener('keydown', (event) => {
    if (event.key === ' ' && !isJumping) { // Spacebar to jump
        isJumping = true;
        // velocityY = jumpHeight; // Apply initial vertical velocity
        velocityY = initialJumpVelocity; // Apply initial vertical velocity
        console.log(velocityY);
    }
});

// Mouse movement to rotate camera around the player
document.addEventListener('mousemove', (event) => {
    if (!isCanvasActive) return; // Rotate only when the canvas is active

    const sensitivity = 0.003; // Adjust sensitivity
    rotationAngle += event.movementX * sensitivity; // Rotate horizontally

    // TODO: Add vertical rotation
    // 1. these needs more math and to reduce horizontal while both are in action.
    const verticalOffset = cameraOffset.y + event.movementY * sensitivity * 2;
    cameraOffset.y = THREE.MathUtils.clamp(verticalOffset, 2, 8); // Limit vertical range
});

// when holding right click keep the mouse position at the start of the click
let mouseDown = false;
const sensitivity = 0.003;

document.addEventListener('mousedown', (event) => {
    if (event.button === 2) { // Right-click
        mouseDown = true;
        document.body.requestPointerLock();
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 2) { // Right-click
        mouseDown = false;
        document.exitPointerLock();
    }
});

// Mouse movement to rotate camera around the player
document.addEventListener('mousemove', (event) => {
    if (!mouseDown || !document.pointerLockElement) return; // Rotate only when holding right-click

    // Rotate horizontally
    rotationAngle += event.movementX * sensitivity;

    // Reduce horizontal rotation when moving vertically
    const horizontalFactor = 1 - Math.abs(event.movementY) * 0.0005; // Reduce X rotation slightly when Y is active
    rotationAngle *= horizontalFactor; 

    // Adjust vertical offset (clamped)
    cameraOffset.y = THREE.MathUtils.clamp(
        cameraOffset.y + event.movementY * sensitivity * 2,
        2, 8
    );
});

// block default browser right click menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

// Camera zoom limits
const minZoom = 2; // Minimum distance from the player
const maxZoom = 15; // Maximum distance from the player
let zoomDistance = 6; // Initial zoom distance (matches the z-offset in cameraOffset)

// Update TPS Camera with zoom
function updateTPSCamera() {
    if (!player) return; // Ensure the player model is loaded

    // init rotationAngle was set to -1.5 to offset the updateTPSCamera
    camera.position.set(
        player.position.x + zoomDistance * Math.cos(rotationAngle), // Zoom dynamically adjusts x-axis offset
        player.position.y + cameraOffset.y,                        // Maintain vertical height
        player.position.z + zoomDistance * Math.sin(rotationAngle) // Zoom dynamically adjusts z-axis offset
    );

    // Look at the player character
    const targetPosition = player.position.clone().add(cameraTargetOffset);
    camera.lookAt(targetPosition);
}

// scroll event for zoom
// could use some smoothing later
// easing, linear functions.
canvas.addEventListener('wheel', (event) => {
    event.preventDefault(); // Prevent default scrolling behavior

    const zoomSpeed = 0.5; // Adjust zoom speed
    zoomDistance += event.deltaY * 0.01 * zoomSpeed; // Zoom in or out based on scroll direction

    // Clamp zoom distance between min and max
    zoomDistance = Math.max(minZoom, Math.min(maxZoom, zoomDistance));
});

const clock = new THREE.Clock();

const modelAnimations = {}; // Store animations for each model
console.log(modelAnimations);

let movementSpeed = 0.1;

let player;

// Load the player model
function loadModel(config) {
    const loader = new GLTFLoader();

    loader.load(config.path,(gltf) => {
            const model = gltf.scene;
            model.position.set(config.position.x, config.position.y, config.position.z);
            model.scale.set(config.scale, config.scale, config.scale);

            scene.add(model);
            // Enable shadows for the player
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            // shadows are in meshes, not in the model itself
            // model.receiveShadow = true;
            player = model; // Assign the model to the player

            // Handle animations
            if (gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                const actions = {};

                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    actions[clip.name] = action;
                });

                actions[gltf.animations[4].name].play(); // play the "stand" animation
                mixers.push(mixer);
                modelAnimations[config.path] = { mixer, actions };
            }
        },
        undefined,
        (error) => console.error('Error loading model:', error)
    );
}

// global array for mixers (if animations are used)
const mixers = [];

const models = [
    {
        path: './catwoman.glb',
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
        lookAtCamera: false,
        animations: true,
        lights: [
            { type: 'SpotLight', color: 0x0ffffff, intensity: 5, distance: 1000, position: { x: 0, y: 5, z: -5 } }
        ]
    },
];

models.forEach((modelConfig) => loadModel(modelConfig));


// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update mixers
    const delta = clock.getDelta();
    mixers.forEach((mixer) => mixer.update(delta));

    // Update player movement and TPS camera
    updatePlayerMovement();
    updateTPSCamera();

    // Render the scene
    renderer.render(scene, camera);
}

// Start animation
animate();

// Handle resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

