// ==========================================
// 1. KHỞI TẠO CƠ BẢN & MÔI TRƯỜNG
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);
scene.fog = new THREE.FogExp2(0x222222, 0.04); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x555566, 0.6); 
scene.add(ambientLight);
const flashLight = new THREE.PointLight(0xffeedd, 1, 15); 
camera.add(flashLight);
scene.add(camera);

// ==========================================
// 2. TEXTURE VÀ BẢN ĐỒ
// ==========================================
function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#443333'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
        for (let j = 0; j < 4; j++) {
            let offset = (i % 2) * 32;
            ctx.beginPath(); ctx.moveTo(j * 64 + offset, i * 64); ctx.lineTo(j * 64 + offset, (i + 1) * 64); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,2,1],
    [1,0,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1],
    [1,0,0,0,0,0,1,0,0,1],
    [1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,0,0,1,1,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];
const UNIT = 5;
const walls = [];

const wallMat = new THREE.MeshStandardMaterial({ map: createBrickTexture(), roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x333322, roughness: 0.8 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(22.5, 0, 22.5);
scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(22.5, 5, 22.5);
scene.add(ceil);

let exitDoor;
for (let z = 0; z < 10; z++) {
    for (let x = 0; x < 10; x++) {
        if (mapGrid[z][x] === 1) {
            let wall = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat);
            wall.position.set(x * UNIT, UNIT / 2, z * UNIT);
            scene.add(wall);
            walls.push(wall);
        } else if (mapGrid[z][x] === 2) {
            let doorMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5 });
            exitDoor = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), doorMat);
            exitDoor.position.set(x * UNIT, UNIT / 2, z * UNIT);
            scene.add(exitDoor);
        }
    }
}

// ==========================================
// 3. VẬT PHẨM VÀ QUÁI VẬT
// ==========================================
const keys = [];
function createKey(x, z) {
    const keyGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.2 });
    
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), goldMat);
    shaft.rotation.z = Math.PI / 2;
    keyGroup.add(shaft);
    
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), goldMat);
    head.position.x = -0.3;
    keyGroup.add(head);
    
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.05), goldMat);
    tooth.position.set(0.2, -0.1, 0);
    keyGroup.add(tooth);

    keyGroup.position.set(x * UNIT, 0.5, z * UNIT);
    scene.add(keyGroup);
    keys.push(keyGroup);
}
// Đặt chìa khóa
createKey(1, 1);
createKey(8, 7);
createKey(1, 7);

const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 

const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
mHead.position.y = 3.5;
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat);
eyeL.position.set(-0.2, 3.6, 0.4);
const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat);
eyeR.position.set(0.2, 3.6, 0.4);
monster.add(mHead, eyeL, eyeR);

const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2), skinMat);
body.position.y = 2;
monster.add(body);

const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat);
legL.position.set(-0.25, 0.75, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat);
legR.position.set(0.25, 0.75, 0);
monster.add(legL, legR);

monster.position.set(8 * UNIT, 0, 1 * UNIT);
scene.add(monster);

// ==========================================
// 4. HỆ THỐNG ĐIỀU KHIỂN & VA CHẠM
// ==========================================
let playerKeys = 0;
let isPlaying = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
camera.position.set(1 * UNIT, 2, 8 * UNIT); 

function checkCollision(x, z) {
    let gridX = Math.round(x / UNIT);
    let gridZ = Math.round(z / UNIT);
    if (gridX < 0 || gridX > 9 || gridZ < 0 || gridZ > 9) return true;
    return mapGrid[gridZ][gridX] === 1;
}

// -- ĐIỀU KHIỂN PC --
document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') moveForward = true;
    if(e.code === 'KeyS') moveBackward = true;
    if(e.code === 'KeyA') moveLeft = true;
    if(e.code === 'KeyD') moveRight = true;
});
document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') moveForward = false;
    if(e.code === 'KeyS') moveBackward = false;
    if(e.code === 'KeyA') moveLeft = false;
    if(e.code === 'KeyD') moveRight = false;
});

let isLocked = false;
document.addEventListener('click', () => { if(isPlaying && !isMobile) document.body.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === document.body; });
document.addEventListener('mousemove', (e) => {
    if (isLocked) {
        camera.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
    }
});

// -- ĐIỀU KHIỂN MOBILE (ĐÃ FIX LỖI CUỘN TRANG) --
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) {
    document.getElementById('joystick-base').style.display = 'block';
}

let touchLookStartX = 0, touchLookStartY = 0;
const lookZone = document.getElementById('touch-look-zone');

lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Chặn lướt web
    touchLookStartX = e.changedTouches[0].clientX;
    touchLookStartY = e.changedTouches[0].clientY;
}, { passive: false });

lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    if(!isPlaying) return;
    let dx = e.changedTouches[0].clientX - touchLookStartX;
    let dy = e.changedTouches[0].clientY - touchLookStartY;
    
    camera.rotation.y -= dx * 0.005;
    camera.rotation.x -= dy * 0.005;
    camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
    
    touchLookStartX = e.changedTouches[0].clientX;
    touchLookStartY = e.changedTouches[0].clientY;
}, { passive: false });

let joyX = 0, joyY = 0;
const joyBase = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');

joyBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
}, { passive: false });

joyBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(!isPlaying) return;
    let rect = joyBase.getBoundingClientRect();
    let cx = rect.left + rect.width/2;
    let cy = rect.top + rect.height/2;
    let dx = e.changedTouches[0].clientX - cx;
    let dy = e.changedTouches[0].clientY - cy;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > 30) { dx = (dx/dist)*30; dy = (dy/dist)*30; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyX = dx / 30; joyY = dy / 30;
}, { passive: false });

joyBase.addEventListener('touchend', (e) => {
    e.preventDefault();
    joyStick.style.transform = `translate(-50%, -50%)`;
    joyX = 0; joyY = 0;
}, { passive: false });


// ==========================================
// 5. TƯƠNG TÁC LẤY VẬT PHẨM
// ==========================================
const btnAction = document.getElementById('btn-action');
const promptUI = document.getElementById('prompt');

function tryInteract() {
    // Tăng bán kính lấy chìa khóa lên 5 để cực kỳ dễ lấy
    for (let i = keys.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(keys[i].position) < 5) {
            scene.remove(keys[i]);
            keys.splice(i, 1);
            playerKeys++;
            document.getElementById('info').innerText = `🔑 Chìa khóa: ${playerKeys} / 3`;
            return; 
        }
    }
    // Mở cửa thoát
    if (camera.position.distanceTo(exitDoor.position) < 5) {
        if (playerKeys >= 3) {
            endGame("CHÚC MỪNG! BẠN ĐÃ THOÁT!", "#00ff00");
        } else {
            promptUI.innerText = "Cần đủ 3 chìa khóa mới mở được cửa!";
            promptUI.style.display = 'block';
            setTimeout(() => promptUI.style.display = 'none', 2000);
        }
    }
}

// Bắt sự kiện bấm Mobile
btnAction.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    tryInteract();
}, { passive: false });

// PC
btnAction.addEventListener('mousedown', tryInteract);
document.addEventListener('keydown', (e) => { if(e.code === 'KeyE') tryInteract(); });

// ==========================================
// 6. VÒNG LẶP GAME CHÍNH (UPDATE)
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    if (!isPlaying) return;

    let delta = clock.getDelta();
    let time = clock.getElapsedTime();

    // Di chuyển Player
    velocity.set(0,0,0);
    if (moveForward) velocity.z = -1;
    if (moveBackward) velocity.z = 1;
    if (moveLeft) velocity.x = -1;
    if (moveRight) velocity.x = 1;
    
    if(joyY !== 0) velocity.z = joyY;
    if(joyX !== 0) velocity.x = joyX;

    velocity.normalize().multiplyScalar(4 * delta);
    direction.copy(velocity);
    direction.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

    if (!checkCollision(camera.position.x + direction.x, camera.position.z)) {
        camera.position.x += direction.x;
    }
    if (!checkCollision(camera.position.x, camera.position.z + direction.z)) {
        camera.position.z += direction.z;
    }

    // Hoạt ảnh chìa khóa
    keys.forEach(k => { k.rotation.y += delta; k.position.y = 0.5 + Math.sin(time * 3) * 0.1; });

    // Quái vật đuổi
    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 15) { 
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const monSpeed = 2.5 * delta;
        const monDir = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        
        if(!checkCollision(monster.position.x + monDir.x * monSpeed, monster.position.z)) {
            monster.position.x += monDir.x * monSpeed;
        }
        if(!checkCollision(monster.position.x, monster.position.z + monDir.z * monSpeed)) {
            monster.position.z += monDir.z * monSpeed;
        }

        legL.position.z = Math.sin(time * 10) * 0.3;
        legR.position.z = -Math.sin(time * 10) * 0.3;
        
        if (distToPlayer < 1.5) {
            endGame("BẠN ĐÃ BỊ BẮT!", "#ff3333");
        }
    }

    // Hiện chữ nhắc nhở (Đã sửa lại khoảng cách thành 5)
    let showP = false;
    keys.forEach(k => { if(camera.position.distanceTo(k.position) < 5) showP = true; });
    if(camera.position.distanceTo(exitDoor.position) < 5) showP = true;
    promptUI.style.display = showP ? 'block' : 'none';
    if(showP) promptUI.innerText = "Bấm ✋ LẤY / Phím E";

    renderer.render(scene, camera);
}

// ==========================================
// 7. QUẢN LÝ MÀN HÌNH (TRẠNG THÁI)
// ==========================================
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    
    playerKeys = 0;
    document.getElementById('info').innerText = `🔑 Chìa khóa: 0 / 3`;
    camera.position.set(1 * UNIT, 2, 8 * UNIT);
    camera.rotation.set(0, 0, 0);
    monster.position.set(8 * UNIT, 0, 1 * UNIT);
    
    clock.start();
    isPlaying = true;
}

function endGame(message, color) {
    isPlaying = false;
    document.getElementById('ui').classList.add('hidden');
    document.getElementById('game-over').classList.remove('hidden');
    const title = document.getElementById('end-title');
    title.innerText = message;
    title.style.color = color;
    if(isLocked) document.exitPointerLock();
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Chạy khởi tạo loop
animate();
