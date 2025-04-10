import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';

import { InputManager } from './InputManager.js';
import { CameraController } from './CameraController.js';
import { PlayerController } from './PlayerController.js';
import { ModelLoader } from './ModelLoader.js';

//  BUGS
// 1. Shift + wasd is bugged - while pressing shift to spring the WASD keys do not work and when stopping, the reverse of direction input is stuck, so the character moves / behaves like crazy.
// 2. Left click drag should rotate around the player always and not rorate movement direction ( not just while standing still) - camera turn on movement most likely

/**
 * MainGame ties together the scene, renderer, controllers, managers, CEOs, and animation loop.
 */
class MainGame {
  constructor() {
    // Set up scene, camera, and renderer.
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.canvas = document.getElementById('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.inputManager = new InputManager(this.canvas);
    
    // Set up the clock and mixers for animations.
    this.clock = new THREE.Clock();
    this.mixers = [];
    
    this.cameraController = new CameraController(this.camera, this.inputManager);
    
    // scale normalization
    this.models = [
      {
        path: './models/catwoman.glb',
        position: { x: 0, y: 0, z: 0 },
        scale: 1,
      },
      {
        path: './models/supergirl.glb',
        position: { x: 3, y: 0, z: 0 },
        scale: 0.5,
      },
      {
        path: './models/flash.glb',
        position: { x: -3, y: 0, z: 0 },
        scale: 1,
      },
    ];

    this.envModels = [
      {
        path: './models/horse.glb',
        position: { x: 12, y: 0, z: 12 },
        scale: 1,
        rotation: { x: 0, y: 1.5, z: 1.5}
      },
      {
        path: './models/horse.glb',
        position: { x: -12, y: 0, z: -12 },
        scale: 1,
        rotation: { x: -1, y: 2, z: 2}
      },
      {
        path: './models/horse.glb',
        position: { x: -12, y: 0, z: 12 },
        scale: 1,
        rotation: { x: -1, y: 2, z: 2}
      },
      {
        path: './models/horse.glb',
        position: { x: 12, y: 0, z: -12 },
        scale: 1,
        rotation: { x: -1, y: 2, z: 2}
      },
    ]
    
    this.loadModels();

    this.addLights();

    this.addTile();
    
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.animate();
  }

  normalizeModelScale(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    console.log(maxDimension);
    const scaleFactor = 3.0 / maxDimension;
    console.log(scaleFactor);
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
}

  addTile() {
      // Create a tile to see something. Helps with testing and motion.
      const grassGeometry = new THREE.PlaneGeometry(64, 64);
      const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const grassTile = new THREE.Mesh(grassGeometry, grassMaterial);
      
      grassTile.rotation.x = -Math.PI / 2; // Rotate the tile to face upward.
      grassTile.position.set(0, 0, 0);
      grassTile.receiveShadow = true;
      this.scene.add(grassTile);
  }

  addLights() {
      // Add some base lights for testing.
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      this.scene.add(ambientLight);
      
      const sunlight = new THREE.DirectionalLight(0xffffff, 1);
      sunlight.position.set(10, 20, 10);
      sunlight.castShadow = true;
      this.scene.add(sunlight);
      
      sunlight.shadow.mapSize.width = 2048;
      sunlight.shadow.mapSize.height = 2048;
      sunlight.shadow.camera.near = 0.5;
      sunlight.shadow.camera.far = 50;
      sunlight.shadow.camera.left = -32;
      sunlight.shadow.camera.right = 32;
      sunlight.shadow.camera.top = 32;
      sunlight.shadow.camera.bottom = -32;
      this.scene.add(sunlight);
  }
  
  loadModels() {
    this.models.forEach((config) => {
      ModelLoader.loadModel(
        config,
        (gltf, model) => {
          this.scene.add(model);
          this.normalizeModelScale(model);
          
          // Set up animations if they exist.
          let modelAnimations = null;
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const actions = {};
            gltf.animations.forEach((clip) => {
              const action = mixer.clipAction(clip);
              actions[clip.name] = action;
            });
            // Start the "stand" animation by default if available.
            if (gltf.animations[4]) {
              actions[gltf.animations[4].name].play();
            }
            this.mixers.push(mixer);
            modelAnimations = { mixer, actions };
          }
          
          // Create the PlayerController with the loaded model.
          this.playerController = new PlayerController(model, this.camera, this.inputManager, modelAnimations);
          
          // Pass the player model to the CameraController.
          this.cameraController.setPlayer(model);
        },
        (error) => {
          console.error('Failed to load model:', error);
        }
      );
    });
    // Load the static test models. 
    this.envModels.forEach((config) => {
      ModelLoader.loadModel(
        config,
        (gltf, model) => {
          this.normalizeModelScale(model);
          this.scene.add(model);
        },
        (error) => {
          console.error('Failed to load model:', error);
        }
      );
    })
  }
  
  onWindowResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
  
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const delta = this.clock.getDelta(); // Get time delta

    // Update all animation mixers.
    this.mixers.forEach((mixer) => mixer.update(delta));

    // Update the player (movement/animations) and camera.
    // Pass delta to playerController.update
    if (this.playerController) this.playerController.update(delta);

    // Camera update might also benefit from delta for smoothing, but let's focus on player first
    this.cameraController.update(); // Optional: pass delta here too if smoothing needed

    this.renderer.render(this.scene, this.camera);
  }
}

const game = new MainGame();