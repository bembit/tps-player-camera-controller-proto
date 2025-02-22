import { GLTFLoader } from 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/GLTFLoader.js';

/**
 * ModelLoader a static utility class for loading GLTF models.
 */
export class ModelLoader {
  static loadModel(config, onLoad, onError) {
    const loader = new GLTFLoader();
    loader.load(
      config.path,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(config.position.x, config.position.y, config.position.z);
        model.scale.set(config.scale, config.scale, config.scale);
        if (config.rotation) {
          console.log(config.rotation)
          model.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
        }
        // Enable shadows on all meshes.
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        if (onLoad) onLoad(gltf, model);
      },
      undefined,
      (error) => {
        if (onError) onError(error);
        console.error('Error loading model:', error);
      }
    );
  }
}