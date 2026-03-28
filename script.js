// BOTÃO MÚSICA
const btn = document.getElementById('musicBtn');
const audio = document.getElementById('bgMusic');
btn.addEventListener('click', () => {
  audio.volume = 0.5;
  audio.play();
});

// FUNDO ANIMADO PROFESSIONAL (Three.js)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('background'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 1;

// PARTICULAS
let particles = new THREE.BufferGeometry();
let count = 5000;
let positions = new Float32Array(count * 3);
for(let i=0; i<count*3; i++){
  positions[i] = (Math.random()-0.5)*10;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions,3));

let material = new THREE.PointsMaterial({
  size: 0.02,
  color: 0x9f8bff,
  transparent: true,
  opacity: 0.7
});
let points = new THREE.Points(particles, material);
scene.add(points);

function animate() {
  requestAnimationFrame(animate);
  points.rotation.x += 0.0005;
  points.rotation.y += 0.0005;
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
