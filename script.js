// BOTÃO DE MÚSICA
const btn = document.getElementById('musicBtn');
const audio = document.getElementById('bgMusic');
btn.addEventListener('click', () => {
  audio.volume = 0.5;
  audio.play();
});

// PARTICULAS SUAVES NO FUNDO
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
for(let i=0;i<80;i++){
  particles.push({
    x:Math.random()*canvas.width,
    y:Math.random()*canvas.height,
    r:Math.random()*2+1,
    dx:(Math.random()-0.5)*0.3,
    dy:(Math.random()-0.5)*0.3
  });
}

function animate(){
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  particles.forEach(p=>{
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle = '#9f8bff';
    ctx.fill();
    p.x += p.dx;
    p.y += p.dy;
    if(p.x>canvas.width)p.x=0;
    if(p.x<0)p.x=canvas.width;
    if(p.y>canvas.height)p.y=0;
    if(p.y<0)p.y=canvas.height;
  });
  requestAnimationFrame(animate);
}
animate();