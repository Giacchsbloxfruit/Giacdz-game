// CẤP CỨU: Chặn triệt để hành vi trượt/cuộn trang web trên điện thoại
document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });

// ==========================================
// 1. KHỞI TẠO CƠ BẢN & MÔI TRƯỜNG 3D
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151515);
scene.fog = new THREE.FogExp2(0x151515, 0.06); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; // FIX TUYỆT ĐỐI: Khóa trục xoay, không bị lộn cổ 360 độ

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x333344, 0.8); 
scene.add(ambientLight);
const flashLight = new THREE.PointLight(0xffeedd, 1.2, 12); 
camera.add(flashLight);
scene.add(camera);

// ==========================================
// 2. TẠO TEXTURE VÀ BẢN ĐỒ (12x12)
// ==========================================
function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a2e2b'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#1a1110'; ctx.lineWidth = 4;
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

// 0: Trống, 1: Tường, 2: Cửa thoát hiểm, 3: Cửa khóa chìa, 4: Tủ trốn
const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,2,1],
    [1,0,1,0,3,0,1,1,1,0,1,1],
    [1,0,1,0,1,0,0,0,1,0,0,1],
    [1,0,0,0,1,1,1,0,1,1,0,1],
    [1,1,1,0,0,0,0,0,0,1,0,1],
    [1,0,4,0,1,1,1,1,0,0,0,1],
    [1,0,1,0,1,0,0,1,1,1,0,1],
    [1,0,1,0,3,0,0,0,0,0,0,1],
    [1,0,0,0,1,1,1,1,1,1,4,1],
    [1,1,1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1]
];

const UNIT = 5;
const walls = [];
const wardrobes = [];
let keyDoors = [];
let exitDoor;

const wallMat = new THREE.MeshStandardMaterial({ map: createBrickTexture(), roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x22221f, roughness: 0.8 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
const doorMatKey = new THREE.MeshStandardMaterial({ color: 0x1144aa, roughness: 0.4 }); 
const doorMatExit = new THREE.MeshStandardMaterial({ color: 0x00aa22, roughness: 0.4 }); 
const wardrobeMat = new THREE.MeshStandardMaterial({ color: 0x4a3319, roughness: 0.7 }); 

const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(27.5, 0, 27.5);
scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(27.5, 5, 27.5);
scene.add(ceil);

for (let z = 0; z < 12; z++) {
    for (let x = 0; x < 12; x++) {
        let posX = x * UNIT; let posZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let wall = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat);
            wall.position.set(posX, UNIT / 2, posZ);
            scene.add(wall); walls.push(wall);
        } else if (mapGrid[z][x] === 2) {
            exitDoor = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), doorMatExit);
            exitDoor.position.set(posX, UNIT / 2, posZ);
            scene.add(exitDoor);
        } else if (mapGrid[z][x] === 3) {
            let kDoor = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), doorMatKey);
            kDoor.position.set(posX, UNIT / 2, posZ);
            kDoor.gridX = x; kDoor.gridZ = z;
            scene.add(kDoor); keyDoors.push(kDoor);
        } else if (mapGrid[z][x] === 4) {
            let ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT, UNIT*0.8), wardrobeMat);
            ward.position.set(posX, UNIT / 2, posZ);
            scene.add(ward); wardrobes.push(ward);
        }
    }
}

// ==========================================
// 3. VẬT PHẨM (CHÌA KHÓA & MẬT MÃ)
// ==========================================
let keyItem = null;
let noteItem = null;
const PASSWORD = "582";

const keyGroup = new THREE.Group();
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9 });
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), goldMat); shaft.rotation.z = Math.PI/2; keyGroup.add(shaft);
const head = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), goldMat); head.position.x = -0.25; keyGroup.add(head);
keyGroup.position.set(10 * UNIT, 0.5, 10 * UNIT);
scene.add(keyGroup);
keyItem = keyGroup;

const paperMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
noteItem = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), paperMat);
noteItem.rotation.x = -Math.PI / 2;
noteItem.position.set(1 * UNIT, 0.05, 1 * UNIT);
scene.add(noteItem);

// ==========================================
// 4. QUÁI VẬT & TRÍ TUỆ NHÂN TẠO (AI)
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x2b1111, roughness: 0.9 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 

const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat); mHead.position.y = 3.5;
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08), eyeMat); eyeL.position.set(-0.2, 3.6, 0.4);
const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08), eyeMat); eyeR.position.set(0.2, 3.6, 0.4);
monster.add(mHead, eyeL, eyeR);
const mBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 2), skinMat); mBody.position.y = 2; monster.add(mBody);
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5), skinMat); legL.position.set(-0.2, 0.75, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5), skinMat); legR.position.set(0.2, 0.75, 0);
monster.add(legL, legR);
scene.add(monster);

let monDirX = 1; let monDirZ = 0; 
let monsterState = 'patrol'; 

// ==========================================
// 5. HỆ THỐNG ĐIỀU KHIỂN & VA CHẠM (FIX MULTI-TOUCH 100%)
// ==========================================
let hasKey = false;
let hasCode = false;
let isHiding = false;
let lastPlayerPos = new THREE.Vector3();
let isPlaying = false;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

function checkCollision(x, z) {
    let gridX = Math.round(x / UNIT); let gridZ = Math.round(z / UNIT);
    if (gridX < 0 || gridX > 11 || gridZ < 0 || gridZ > 11) return true;
    let block = mapGrid[gridZ][gridX];
    return block === 1 || block === 2 || block === 3 || block === 4;
}

function updateHUD() {
    let txt = `🔑 Chìa: ${hasKey ? "1" : "0"} | 📜 Mật mã: ${hasCode ? PASSWORD : "???"}`;
    if(isHiding) txt = "👀 ĐANG TRỐN TRONG TỦ (Bấm LẤY để ra)";
    document.getElementById('info').innerText = txt;
}

// Bàn phím PC
document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') moveForward = true; if(e.code === 'KeyS') moveBackward = true;
    if(e.code === 'KeyA') moveLeft = true; if(e.code === 'KeyD') moveRight = true;
});
document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') moveForward = false; if(e.code === 'KeyS') moveBackward = false;
    if(e.code === 'KeyA') moveLeft = false; if(e.code === 'KeyD') moveRight = false;
});
let isLocked = false;
document.addEventListener('click', () => { if(isPlaying && !isMobile) document.body.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === document.body; });
document.addEventListener('mousemove', (e) => {
    if (isLocked && !isHiding) {
        camera.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
    }
});

// Cảm ứng Mobile (Chống kẹt ngón & Xoay mượt)
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';

let lookTouchId = null, joyTouchId = null;
let touchLookStartX = 0, touchLookStartY = 0;
let joyX = 0, joyY = 0;
const lookZone = document.getElementById('touch-look-zone');
const joyBase = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');

// 1. Ngón tay xoay góc nhìn (Vùng phải)
lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(lookTouchId === null) {
            lookTouchId = e.changedTouches[i].identifier;
            touchLookStartX = e.changedTouches[i].clientX;
            touchLookStartY = e.changedTouches[i].clientY;
            break;
        }
    }
}, { passive: false });

lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === lookTouchId) {
            let dx = e.changedTouches[i].clientX - touchLookStartX;
            let dy = e.changedTouches[i].clientY - touchLookStartY;
            camera.rotation.y -= dx * 0.004;
            camera.rotation.x -= dy * 0.004;
            camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
            touchLookStartX = e.changedTouches[i].clientX;
            touchLookStartY = e.changedTouches[i].clientY;
        }
    }
}, { passive: false });

lookZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null;
    }
}, { passive: false });

// 2. Ngón tay điều khiển Joystick (Vùng trái)
joyBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(joyTouchId === null) { joyTouchId = e.changedTouches[i].identifier; break; }
    }
}, { passive: false });

joyBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === joyTouchId) {
            let rect = joyBase.getBoundingClientRect();
            let dx = e.changedTouches[i].clientX - (rect.left + rect.width/2);
            let dy = e.changedTouches[i].clientY - (rect.top + rect.height/2);
            let dist = Math.sqrt(dx*dx + dy*dy);
            if(dist > 35) { dx = (dx/dist)*35; dy = (dy/dist)*35; }
            joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            joyX = dx / 35; joyY = dy / 35;
        }
    }
}, { passive: false });

const resetJoy = (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === joyTouchId) {
            joyTouchId = null; joyStick.style.transform = `translate(-50%, -50%)`; joyX = 0; joyY = 0;
        }
    }
};
joyBase.addEventListener('touchend', resetJoy, { passive: false });
joyBase.addEventListener('touchcancel', resetJoy, { passive: false });

// ==========================================
// 6. TƯƠNG TÁC VẬT PHẨM & TRỐN
// ==========================================
const btnAction = document.getElementById('btn-action');
const promptUI = document.getElementById('prompt');

function tryInteract() {
    if(!isPlaying) return;

    if (isHiding) {
        isHiding = false;
        camera.position.copy(lastPlayerPos);
        updateHUD();
        return;
    }

    for(let w of wardrobes) {
        if (camera.position.distanceTo(w.position) < 5) {
            isHiding = true;
            lastPlayerPos.copy(camera.position);
            camera.position.set(w.position.x, 2, w.position.z);
            updateHUD();
            return;
        }
    }

    if (keyItem && camera.position.distanceTo(keyItem.position) < 5) {
        scene.remove(keyItem); keyItem = null; hasKey = true; updateHUD(); return;
    }

    if (noteItem && camera.position.distanceTo(noteItem.position) < 5) {
        scene.remove(noteItem); noteItem = null; hasCode = true; updateHUD();
        alert(`Bạn nhặt được mảnh giấy: Mật mã mở cửa thoát hiểm là ${PASSWORD}`); return;
    }

    for (let i = keyDoors.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(keyDoors[i].position) < 5) {
            if (hasKey) {
                scene.remove(keyDoors[i]);
                mapGrid[keyDoors[i].gridZ][keyDoors[i].gridX] = 0;
                keyDoors.splice(i, 1);
                hasKey = false;
                updateHUD();
            } else { alert("Cửa bị khóa! Cần tìm chìa khóa vàng."); }
            return;
        }
    }

    if (camera.position.distanceTo(exitDoor.position) < 5) {
        let nhap = prompt("Nhập mật mã 3 số để mở cửa thoát hiểm:");
        if (nhap === PASSWORD) endGame("CHÚC MỪNG! BẠN ĐÃ THOÁT THÀNH CÔNG!", "#00ff00");
        else if (nhap !== null) alert("Mật mã không đúng!");
    }
}

btnAction.addEventListener('touchstart', (e) => { e.preventDefault(); tryInteract(); }, { passive: false });
btnAction.addEventListener('mousedown', tryInteract);
document.addEventListener('keydown', (e) => { if(e.code === 'KeyE') tryInteract(); });

// ==========================================
// 7. VÒNG LẶP RENDER & AI QUÁI VẬT
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    if (!isPlaying) return;

    let delta = clock.getDelta();
    let time = clock.getElapsedTime();

    if (!isHiding) {
        velocity.set(0,0,0);
        if (moveForward) velocity.z = -1; if (moveBackward) velocity.z = 1;
        if (moveLeft) velocity.x = -1; if (moveRight) velocity.x = 1;
        if(joyY !== 0) velocity.z = joyY; if(joyX !== 0) velocity.x = joyX;

        velocity.normalize().multiplyScalar(4 * delta);
        direction.copy(velocity);
        direction.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

        if (!checkCollision(camera.position.x + direction.x, camera.position.z)) camera.position.x += direction.x;
        if (!checkCollision(camera.position.x, camera.position.z + direction.z)) camera.position.z += direction.z;
    }

    if(keyItem) { keyItem.rotation.y += delta * 2; keyItem.position.y = 0.5 + Math.sin(time * 4) * 0.1; }

    // Xử lý AI Quái vật tuần tra/truy đuổi
    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 10 && !isHiding) monsterState = 'chase';
    else monsterState = 'patrol';

    let monSpeed = (monsterState === 'chase' ? 2.8 : 1.4) * delta;

    if (monsterState === 'chase') {
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const monDir = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        if(!checkCollision(monster.position.x + monDir.x * monSpeed, monster.position.z)) monster.position.x += monDir.x * monSpeed;
        if(!checkCollision(monster.position.x, monster.position.z + monDir.z * monSpeed)) monster.position.z += monDir.z * monSpeed;
        
        if (distToPlayer < 1.4) endGame("BẠN ĐÃ BỊ QUÁI VẬT BẮT!", "#ff3333");
    } else {
        let nextX = monster.position.x + monDirX * monSpeed;
        let nextZ = monster.position.z + monDirZ * monSpeed;
        if (checkCollision(nextX, nextZ)) {
            let dirs = [[1,0], [-1,0], [0,1], [0,-1]];
            let r = Math.floor(Math.random() * 4);
            monDirX = dirs[r][0]; monDirZ = dirs[r][1];
        } else {
            monster.position.x = nextX; monster.position.z = nextZ;
            monster.rotation.y = Math.atan2(monDirX, monDirZ);
        }
    }

    legL.position.z = Math.sin(time * 8) * 0.25;
    legR.position.z = -Math.sin(time * 8) * 0.25;

    let showP = false;
    if (!isHiding) {
        if(keyItem && camera.position.distanceTo(keyItem.position) < 5) showP = true;
        if(noteItem && camera.position.distanceTo(noteItem.position) < 5) showP = true;
        if(camera.position.distanceTo(exitDoor.position) < 5) showP = true;
        keyDoors.forEach(d => { if(camera.position.distanceTo(d.position) < 5) showP = true; });
        wardrobes.forEach(w => { if(camera.position.distanceTo(w.position) < 5) showP = true; });
    }
    promptUI.style.display = showP ? 'block' : 'none';

    renderer.render(scene, camera);
}

// ==========================================
// 8. ĐIỀU KHIỂN MÀN HÌNH GAME
// ==========================================
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    
    hasKey = false; hasCode = false; isHiding = false;
    updateHUD();
    camera.position.set(1 * UNIT, 2, 7 * UNIT); camera.rotation.set(0, 0, 0);
    monster.position.set(10 * UNIT, 0, 1 * UNIT);
    
    clock.start(); isPlaying = true;
}

function endGame(message, color) {
    isPlaying = false;
    document.getElementById('ui').classList.add('hidden');
    document.getElementById('game-over').classList.remove('hidden');
    const title = document.getElementById('end-title');
    title.innerText = message; title.style.color = color;
    if(isLocked) document.exitPointerLock();
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
