// ModelLoader.js
import * as THREE from 'https://unpkg.com/three@0.125.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/GLTFLoader.js';

/**
 * A static utility class for loading GLTF/GLB 3D models.
 * Provides a consistent way to load models and apply basic configurations.
 */
export class ModelLoader {
    /**
     * Loads a GLTF model from the specified path and configuration.
     * @param {object} config - Configuration object for the model.
     * @param {string} config.path - The URL path to the GLTF/GLB file.
     * @param {object} [config.position] - Optional initial position {x, y, z}.
     * @param {number} [config.scale] - Optional initial uniform scale factor.
     * @param {object} [config.rotation] - Optional initial rotation {x, y, z} in radians.
     * @param {function(object, THREE.Object3D)} onLoad - Success callback function. Receives the full gltf object and the extracted model scene (THREE.Object3D).
     * @param {function(ErrorEvent)} onError - Error callback function. Receives the error event.
     */
    static loadModel(config, onLoad, onError) {
        // Instantiate the GLTF loader provided by THREE.js examples.
        const loader = new GLTFLoader();

        // Start loading the model from the specified path.
        loader.load(
            config.path,
            // --- Success Callback (gltf) ---
            (gltf) => {
                // The main visual part of the loaded GLTF is usually in gltf.scene.
                const model = gltf.scene;

                // Apply initial position if specified in the config.
                if (config.position) {
                    model.position.set(config.position.x, config.position.y, config.position.z);
                }

                // Apply initial scale if specified in the config.
                // Note: Normalization might happen later in MainGame for player/specific models.
                if (config.scale) {
                    model.scale.set(config.scale, config.scale, config.scale);
                }

                // Apply initial rotation if specified in the config (in radians).
                if (config.rotation) {
                    model.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
                }

                // --- Default Setup ---
                // Traverse through all child meshes within the loaded model.
                model.traverse((child) => {
                    // Check if the child object is a Mesh.
                    if (child.isMesh) {
                        // Enable casting shadows for this mesh.
                        child.castShadow = true;
                        // Enable receiving shadows for this mesh.
                        child.receiveShadow = true;
                        // Optional: Could add more default material adjustments here if needed
                        // e.g., child.material.metalness = 0;
                    }
                });

                // Call the user-provided onLoad callback, passing the full gltf object
                // (which includes animations, cameras, etc.) and the model scene.
                if (onLoad) {
                    onLoad(gltf, model);
                }
            },
            // --- Progress Callback (xhr) ---
            // This callback is typically used to show loading progress (e.g., a percentage).
            // Currently unused, but the argument placeholder is required.
            undefined, // (xhr) => { console.log((xhr.loaded / xhr.total * 100) + '% loaded'); }

            // --- Error Callback (error) ---
            (error) => {
                // Log the error to the console for debugging.
                console.error('Error loading model:', config.path, error);
                // Call the user-provided onError callback if it exists.
                if (onError) {
                    onError(error);
                }
            }
        );
    }
}