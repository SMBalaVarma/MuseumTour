import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import Stats from "three/addons/libs/stats.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js"
import { CSS2DRenderer ,CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// import {gsap} from 'gsap';

const stats = new Stats();
document.body.appendChild(stats.dom);

// Player parameters
const player = {
  height: 4,
  speed: 0.1,
  sideTurnSpeed: 0.05,
  verticalTurnSpeed: 0.5,
  gravity: 0.18,
};

// html elements
const container = document.querySelector(".container");
const space_3d = document.querySelector(".image-container");
const close_btn = document.querySelector(".close-btn");
const loading_screen = document.querySelector(".loading-container");
const crosshair = document.querySelector("#crosshair");

// essential variables
let collider_mesh_array;
let keyPressed = {};
let isColliding_frwd = false;
let isColliding_back = false;
let isColliding_left = false;
let isColliding_right = false;
let loaded = false;
let is_pointer_locked = false;
let object_selected = false;
let model;
let interactable_objects = [];

// camera
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// scene
const scene = new THREE.Scene();

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.render(scene, camera);

// keyboard event to store the status of key press
addEventListener("keydown", (e) => {
  keyPressed[e.key.toLowerCase()] = true;
});
addEventListener("keyup", (e) => {
  keyPressed[e.key.toLowerCase()] = false;
});

// pitch and yaw object creation
// pitch stores the camera as a child and yaw stores pitch as a child
// when pitch and yaw rotate the camera moves inherently as the camera is a child of yaw and pitch
var pitchObj = new THREE.Object3D();
pitchObj.add(camera);

var yawObj = new THREE.Object3D();
yawObj.position.y = player.height;
yawObj.position.z = 15;
yawObj.add(pitchObj);
scene.add(yawObj);

var player_obj = new THREE.Object3D();
player_obj.add(yawObj);

// Player movement dunction
function player_movement() {
  if (is_pointer_locked && keyPressed["w"] && !isColliding_frwd) {
    yawObj.position.x += Math.sin(-yawObj.rotation.y) * player.speed;
    yawObj.position.z += -Math.cos(-yawObj.rotation.y) * player.speed;
  }
  if (is_pointer_locked && keyPressed["s"] && !isColliding_back) {
    yawObj.position.x -= Math.sin(-yawObj.rotation.y) * player.speed;
    yawObj.position.z -= -Math.cos(-yawObj.rotation.y) * player.speed;
  }
  if (is_pointer_locked && keyPressed["a"] && !isColliding_left) {
    yawObj.position.x -=
      Math.sin(-yawObj.rotation.y + Math.PI / 2) * player.speed;
    yawObj.position.z -=
      -Math.cos(-yawObj.rotation.y + Math.PI / 2) * player.speed;
  }
  if (is_pointer_locked && keyPressed["d"] && !isColliding_right) {
    yawObj.position.x -=
      Math.sin(-yawObj.rotation.y - Math.PI / 2) * player.speed;
    yawObj.position.z -=
      -Math.cos(-yawObj.rotation.y - Math.PI / 2) * player.speed;
  }
  if (keyPressed["q"]) {
    yawObj.position.y += player.speed * 0.6;
  }
  if (keyPressed["e"]) {
    yawObj.position.y -= player.speed * 0.6;
  }
}

// Pointer lock over redner element

function lock_pointer() {
  console.log("before locking");
  if (!is_pointer_locked && !object_selected) {
    console.log("locking");
    rendererEl.requestPointerLock();
  }
}

addEventListener("keyup", (e) => {
  if (e.key == "Escape") {
    document.exitPointerLock();
    is_pointer_locked = false;
  }
});

function change_lock_state() {
  if (is_pointer_locked) is_pointer_locked = false;
  else is_pointer_locked = true;
  console.log("lock status changed:", is_pointer_locked);
}
const rendererEl = renderer.domElement;
rendererEl.addEventListener("click", lock_pointer);

// pointer unlock
document.addEventListener("pointerlockchange", change_lock_state);

// raycast
const raycast_frwd = new THREE.Raycaster();
const raycast_back = new THREE.Raycaster();
const raycast_left = new THREE.Raycaster();
const raycast_right = new THREE.Raycaster();
const raycast_down = new THREE.Raycaster();

raycast_frwd.far = 2;
raycast_back.far = 2;
raycast_left.far = 2;
raycast_right.far = 2;
raycast_down.far = 10;

// collision threshold
let surrounding_raycast_dist = 1.5;
let height_raycast_dist = 2;

// function to check collisions
function update() {
  const raycast_origin = yawObj.position; //raycast origin

  // raycast directions
  const frwd_direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
    yawObj.quaternion
  );
  const back_direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
    yawObj.quaternion
  );
  const left_direction = new THREE.Vector3(-1, 0, 0).applyQuaternion(
    yawObj.quaternion
  );
  const right_direction = new THREE.Vector3(1, 0, 0).applyQuaternion(
    yawObj.quaternion
  );
  const bottom_direction = new THREE.Vector3(0, -1, 0).applyQuaternion(
    yawObj.quaternion
  );

  raycast_frwd.set(raycast_origin, frwd_direction);
  raycast_back.set(raycast_origin, back_direction);
  raycast_left.set(raycast_origin, left_direction);
  raycast_right.set(raycast_origin, right_direction);
  raycast_down.set(raycast_origin, bottom_direction);

  const intersects_frwd = raycast_frwd.intersectObjects(collider_mesh_array);
  const intersects_back = raycast_back.intersectObjects(collider_mesh_array);
  const intersects_left = raycast_left.intersectObjects(collider_mesh_array);
  const intersects_right = raycast_right.intersectObjects(collider_mesh_array);
  const intersects_down = raycast_down.intersectObjects(collider_mesh_array);

  // logic to stop moving when collision is detected
  if (
    intersects_frwd.length > 0 &&
    intersects_frwd[0].distance < surrounding_raycast_dist
  ) {
    isColliding_frwd = true;
  } else {
    isColliding_frwd = false;
  }

  if (
    intersects_back.length > 0 &&
    intersects_back[0].distance < surrounding_raycast_dist
  ) {
    isColliding_back = true;
  } else {
    isColliding_back = false;
  }

  if (
    intersects_left.length > 0 &&
    intersects_left[0].distance < surrounding_raycast_dist
  ) {
    isColliding_left = true;
  } else {
    isColliding_left = false;
  }

  if (
    intersects_right.length > 0 &&
    intersects_right[0].distance < surrounding_raycast_dist
  ) {
    isColliding_right = true;
  } else {
    isColliding_right = false;
  }

  if (
    intersects_down.length > 0 &&
    intersects_down[0].distance < height_raycast_dist
  ) {
    yawObj.position.y = intersects_down[0].point.y + height_raycast_dist;
  } else if (
    intersects_down.length > 0 &&
    intersects_down[0].distance > height_raycast_dist + 0.1
  ) {
    yawObj.position.y -=
      (intersects_down[0].distance - height_raycast_dist) * player.gravity;
  }
}

// Camera look around mechanic
addEventListener("mousemove", (e) => {
  if (is_pointer_locked && e.movementX) {
    yawObj.rotation.y -= e.movementX * 0.002; //holds camera as a child
  }
  if (is_pointer_locked && e.movementY) {
    pitchObj.rotation.x -= e.movementY * 0.002;
    pitchObj.rotation.x = Math.max(
      //limiting turnup and down angle
      -Math.PI / 2,
      Math.min(Math.PI / 2, pitchObj.rotation.x)
    );
  }
});

new RGBELoader().load("assets/museum_of_ethnography_2k.hdr", function(hdri){
  hdri.mapping = THREE.EquirectangularReflectionMapping;

  scene.environment = hdri
})

// Load manager
const manager = new THREE.LoadingManager();
manager.onStart = function () {
  console.log("started");
};
manager.onProgress = function () {
  console.log("loading");
};
manager.onLoad = function () {
  console.log(scene.children)
  let collider_mesh = model.children[0].children[0]; //pushing the collider object to an array
  collider_mesh_array = model.children[0].children[0].children; //pushing the collider object to an array
  loaded = true;
  const transparent_boxes = model.children[0].children[1].children[0].children[43]
  console.log(transparent_boxes)
  transparent_boxes.traverse((mesh)=>{
    mesh.material.transparent = true;
    mesh.material.opacity = 0;
  })
  console.log(model.children[0].children[0]);
  collider_mesh.traverse((mesh)=>{
    if(mesh.material != undefined){
      mesh.material.transparent = true;
      mesh.material.opacity = 0
    }
  })
  interactable_objects = model.children[0].children[2].children;
  // interactable_objects.forEach(element => {
  //   console.log(element.name, element.position)
  // });
  loading_screen.style.display = "none";
  crosshair.style.display = "block";
  createSprite()
};
manager.onError = function (e) {
  console.log("error: ", e);
};

// lighting
const light = new THREE.AmbientLight();
scene.add(light);

const point = new THREE.PointLight(0xff0000, 20);
point.position.y = 5.5;
point.castShadow = true;
// scene.add(point)

const direction = new THREE.DirectionalLight();
direction.intensity = 10;
direction.castShadow = true;
// scene.add(direction);
renderer.shadowMap.antialias = true;

//GLTF loader
const loader = new GLTFLoader(manager);
loader.load("assets/museum_final_01.glb", (gltf) => {
  model = gltf.scene;
  model.traverse((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  scene.add(model);
});

// test box
const box1 = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial()
);
box1.position.y = 4;
// scene.add(box1);

const box2 = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial()
);
box2.position.y = 4;
box2.position.x = -2;
// scene.add(box2);

const box3 = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial()
);
box3.position.y = 4;
box3.position.x = 2;
// scene.add(box3);

const blur_material = new THREE.MeshPhysicalMaterial();
blur_material.transmission = 0.5;
blur_material.thickness = 0.1;
blur_material.roughness = 0.4;
const blur_plane = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50, 12, 12),
  blur_material
);
blur_material.side = THREE.DoubleSide;
blur_plane.rotateX(Math.PI);
// 
// //----- CSS2D Renderer
//
// texture for hot spot
const circleTexture = new THREE.TextureLoader().load('./assets/circle.png');
// // createing sprite material
const spriteMaterial = new THREE.SpriteMaterial({
  map: circleTexture,
  depthTest: false,
  depthWrite: false,
  sizeAttenuation: false,
});
const sprite = new THREE.Sprite(spriteMaterial);
sprite.scale.set(0.02, 0.02, 0.02);
let spriteArr = [];

function createSprite() {
    interactable_objects.forEach(element => {
      let obj_name = element.name;
      const pos = element.getWorldPosition(new THREE.Vector3())
      console.log(pos);
      let locX = pos.x
      let locY = pos.y
      let locZ = pos.z
      // //
      const size_obj = new THREE.Box3().setFromObject(element).getSize(new THREE.Vector3())
      console.log(size_obj);
      // let sizeX = size_obj.x ;
      let sizeY = size_obj.y/2;
      // let sizeZ = size_obj.z;
      const spriteClone = sprite.clone();
      spriteClone.position.set(locX,locY-sizeY + 0.2,locZ );
      spriteClone.name = obj_name;
      scene.add(spriteClone);
      spriteArr.push(spriteClone);
      })  
};
// //  flag for toggle btw hover and click ---------- needs toggle btw clk and dlbclk

let object_clicked = false;

// // css2d renderer
const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement);
// // div ele on hover
const model_name = document.createElement('h2')
const model_period = document.createElement('h5');
const hoverContainer = document.createElement('div');
hoverContainer.classList.add('hotspot');
hoverContainer.appendChild(model_name);
hoverContainer.appendChild(model_period);
const hoverCont = new CSS2DObject(hoverContainer);
scene.add(hoverCont)
// // div ele on click
const heading = document.createElement('h2')
const year = document.createElement('h5');
const info = document.createElement('p');
const dbl_click = document.createElement('p')
dbl_click.classList.add("dbl_click")
const clickContainer = document.createElement('div')
clickContainer.classList.add('annotation')
clickContainer.appendChild(heading);
clickContainer.appendChild(year);
clickContainer.appendChild(info);
clickContainer.appendChild(dbl_click)
const DataContainer = new CSS2DObject(clickContainer);
scene.add(DataContainer)

// // fetching Json Data
let fetchedData;

fetch('data.json')
  .then(response => response.json())
  .then(data => {
    fetchedData = data
  })
  .catch(error => console.error('Error fetching data:', error));


// data fetched
let data;

// crosshair raycast
const crosshair_raycast = new THREE.Raycaster();
crosshair_raycast.far = 5;
let prev_selected = null;
let crosshair_intersects = [];

function crosshair_logic() {
  if (!fetchedData) {
    console.error('Data not fetched yet');
    return;
  }
  crosshair_raycast.set(
    camera.getWorldPosition(new THREE.Vector3()),
    camera.getWorldDirection(new THREE.Vector3())
  );

  crosshair_intersects =
    crosshair_raycast.intersectObjects(interactable_objects);

  if (crosshair_intersects.length > 0 && !object_selected && !object_clicked) {
    prev_selected = crosshair_intersects[0];
    // crosshair_intersects[0].object.material.color.set(0xff00000);
    const selectedObject = prev_selected.object;
    addSelectedObject(selectedObject);
    outlinePass.selectedObjects = selectedObjects;
    gsap.to(crosshair_intersects[0].object.scale, {
      x: 1.1,
      y: 1.1,
      z: 1.1,
      duration: 1,
    });
    
    const intersectedObject = crosshair_intersects[0].object;
    //
    // // Get intersected object position
    //
    const position = new THREE.Vector3()
    intersectedObject.getWorldPosition(position);
    let posX = position.x;
    let posY = position.y;
    let posZ = position.z;
    console.log(posX , posY, posZ);

    // // check which object is intersected and stores in data var 
    const objectName = crosshair_intersects[0].object.name
    data = fetchedData[objectName];
    if(data){
      // console.log(data.name ,data.period, data.data);
      hoverContainer.classList.add('hover');
      model_name.textContent = data.name
      model_period.textContent = `Time : ${data.period}`
      let offset = 1
      hoverCont.position.set(posX ,posY,posZ)
    }

  } else {
    if (prev_selected != null) {
      prev_selected.object.material.color.set(0xffffff);
      outlinePass.selectedObjects = [];
      gsap.to(prev_selected.object.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1,
      });
      // toggle 
      hoverContainer.classList.remove('hover');
      hoverContainer.classList.add('hide');
    }
  }
}

let height = space_3d.offsetHeight;
let width = space_3d.offsetWidth;

console.log(width, height);

class new_scene {
  constructor(obj) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.obj = obj.clone();

    this.height = space_3d.clientHeight;
    this.width = space_3d.clientWidth;

    this.axis_helper = new THREE.AxesHelper(100000)
    this.scene.add(this.axis_helper)

    this.size = 5
    this.test = new THREE.Mesh(new THREE.BoxGeometry(this.size, this.size, this.size), new THREE.MeshBasicMaterial())
    
    // this.scene.add(this.test)

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      0.1,
      10000
    );
    this.initiate();
  }

  initiate() {
    const renderEl_2 = this.renderer.domElement;
    this.renderer.setSize(this.width, this.height);
    space_3d.appendChild(renderEl_2);
    this.controls = new OrbitControls(this.camera, renderEl_2);
    this.obj.position.x = 0
    this.obj.position.y = 0
    this.obj.position.z = 0
    this.scene.add(this.obj);
    this.camera.position.z = 15 
    this.dir = new THREE.Vector3()
    this.obj.getWorldDirection(this.dir)
    console.log(this.dir)
    // this.camera.lookAt(this.obj.position)
    // this.controls.target=this.obj.position

    const ambient = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambient);
  }

  destroy() {
    space_3d.removeChild(this.renderer.domElement);
    this.renderer.dispose();
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    object_selected = false;
  }
}

let scene_2 = null;

close_btn.addEventListener("click", () => {
  scene_2.destroy();
  scene_2 = null;
  container.style.display = "none";
  lock_pointer();
});

let హలో = 23;
console.log(హలో);

function animation() {
  scene_2.renderer.render(scene_2.scene, scene_2.camera);
  if (scene_2 == null) cancelAnimationFrame();
  else requestAnimationFrame(animation);
}

// 
// //  html content info on double click
//
const name_of_model = document.querySelector(".heading");
const year_of_model = document.querySelector(".year");
const category_of_model = document.querySelector(".category");
const info_of_model = document.querySelector(".info-text");

addEventListener("dblclick", () => {
  crosshair_intersects =
    crosshair_raycast.intersectObjects(interactable_objects);
  if (crosshair_intersects.length > 0 && !object_selected) {
    const obj = crosshair_intersects[0].object;
    if(data){     
      name_of_model.textContent = data.name;
      year_of_model.textContent = data.period;
      category_of_model.textContent = data.category;
      info_of_model.textContent =  data.info;
      container.style.display = "flex";
    }
    scene_2 = new new_scene(obj);
    document.exitPointerLock();
    object_selected = true;
    animation();
  }
});
// // needs to add a ray caste for sprite material

addEventListener("mouseup", ()=>{

})
// // on click object
//
addEventListener("mouseup", () => {
  crosshair_intersects =
    crosshair_raycast.intersectObjects(interactable_objects);
    // // //  sprite material array
    // sprite_intersects = crosshair_raycast.intersectObjects(spriteArr);

    // // sprite material interaction
    // const interacted_sprite = sprite_intersects[0].object;
    // let data2 = fetchedData[interacted_sprite]

  if (crosshair_intersects.length > 0 ) { 
    const intersectedObject = crosshair_intersects[0].object;
    
    const size_obj = new THREE.Box3().setFromObject(intersectedObject).getSize(new THREE.Vector3())
    console.log(size_obj);
    let sizeX = size_obj.x ;
    let sizeY = size_obj.y/2;
    // let sizeZ = size_obj.z;
    const pos_obj = new THREE.Vector3();
    intersectedObject.getWorldPosition(pos_obj);
    let posX = pos_obj.x;
    let posY = pos_obj.y;
    let posZ = pos_obj.z;
    // let offset = 1
    if(data){
      clickContainer.classList.add('show')
      console.log(clickContainer.className);      
      heading.textContent = data.name
      year.textContent = `Time: ${data.period}`
      info.textContent =  data.data
      dbl_click.textContent = "Double click on object for more info...."
      DataContainer.position.set(posX+sizeX, posY+sizeY, posZ);

       // // ------- Gsap ----
      //  gsap.to( camera.lookAt, {
      //   duration: 1,
      //   x: posX,
      //   y: posY,
      //   z: posZ,
      //   onUpdate: function () {
      //       ;
      //   }
      //   } );
        gsap.to(camera.position,{
            x:posX,
            y: posY,
            z : posZ,
            duration : 2,
            // ease: "power1.out",
            onUpdate : function(){
              camera.lookAt(posX,posY,posZ)
            }
        });
    }
    object_clicked = true;
  }else{
    clickContainer.classList.remove('show');
    clickContainer.classList.add('hide')
    object_clicked = false;
  }
});

addEventListener("keyup", (e) => {
  if (e.key == "x" && scene_2 != null) {
    scene_2.destroy();
    scene_2 = null;
    container.style.display = "none";
    lock_pointer();
  }
});

let composer, effectFXAA, outlinePass;

composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
composer.addPass(outlinePass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms["resolution"].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight
);
composer.addPass(effectFXAA);

let selectedObjects = [];

function addSelectedObject(object) {
  selectedObjects = [];
  selectedObjects.push(object);
}

// resize window listener
addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
});

// gui for collision threshold setting
// const gui = new GUI();
// let obj = { threshold: 1 };
// const collison_threshold_folder = gui.addFolder("Collision Threshold");
// collison_threshold_folder
//   .add(obj, "threshold")
//   .min(0)
//   .max(2)
//   .step(0.1)
//   .name("Surrounding Threshold")
//   .onChange((value) => {
//     surrounding_raycast_dist = value;
//   });
// collison_threshold_folder
//   .add(obj, "threshold")
//   .min(0)
//   .max(5)
//   .step(0.1)
//   .name("Height Threshold")
//   .onChange((value) => {
//     height_raycast_dist = value;
//   });

// animate
function animate() {
  // renderer.render(scene, camera);
  composer.render();
  // console.log(camera.getWorldPosition(new THREE.Vector3()))
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
  player_movement(); //player player_movement
  if (loaded) update(); //checks collision
  crosshair_logic();
  box1.rotation.x += 0.01;
  box1.rotation.y += 0.01;

  box2.rotation.x += 0.01;
  box2.rotation.y += 0.01;

  box3.rotation.x += 0.01;
  box3.rotation.y += 0.01;

  stats.update();
}
animate();
