// ==========================================
// 1. KHỞI TẠO CƠ BẢN & MÔI TRƯỜNG
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.fog = new THREE.FogExp2(0x1a1a1a, 0.05); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; // FIX LỖI 1: Khóa trục xoay, chống lộn cổ 360 độ
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x444455, 0.7); 
scene.add(ambientLight);
const flashLight = new THREE.PointLight(0xffeedd, 1, 15); 
camera.add(flashLight);
scene.add(camera);

// ==========================================
// 2. TEXTURE VÀ BẢN ĐỒ (SIZE 12x12)
// ==========================================
function createBrickTexture(color = '#443333') {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
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

// 0: Rỗng, 1: Tường, 2: Cửa Thoát (Mật mã), 3: Cửa Khóa (Chìa), 4: Tủ trốn
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
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a22, roughness: 0.8 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const doorMatKey = new THREE.MeshStandardMaterial({ color: 0x0055ff, roughness: 0.5 }); // Cửa cần chìa
const doorMatExit = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5 }); // Cửa mật mã
const wardrobeMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }); // Tủ gỗ

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
            kDoor.gridX = x; kDoor.gridZ = z; // Lưu tọa độ mảng
            scene.add(kDoor); keyDoors.push(kDoor);
        } else if (mapGrid[z][x] === 4) {
            let ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT, UNIT*0.8), wardrobeMat);
            ward.position.set(posX, UNIT / 2, posZ);
            scene.add(ward); wardrobes.push(ward);
        }
    }
}

// ==========================================
// 3. VẬT PHẨM (CHÌA KHÓA & GIẤY MẬT MÁ)
// ==========================================
let keyItem = null;
let noteItem = null;
const PASSWORD = "732";

// Chìa khóa
const keyGroup = new THREE.Group();
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 });
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), goldMat); shaft.rotation.z = Math.PI/2; keyGroup.add(shaft);
const head = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), goldMat); head.position.x = -0.3; keyGroup.add(head);
keyGroup.position.set(10 * UNIT, 0.5, 10 * UNIT); // Đặt ở góc xa
scene.add(keyGroup);
keyItem = keyGroup;

// Tờ giấy chứa mật mã
const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
noteItem = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), paperMat);
noteItem.rotation.x = -Math.PI / 2;
noteItem.position.set(1 * UNIT, 0.1, 1 * UNIT);
scene.add(noteItem);


// ==========================================
// 4. QUÁI VẬT & AI TUẦN TRA
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x330000, roughness: 1 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 

const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat); mHead.position.y = 3.5;
const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat); eyeL.position.set(-0.2, 3.6, 0.4);
const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat); eyeR.position.set(0.2, 3.6, 0.4);
monster.add(mHead, eyeL, eyeR);
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2), skinMat); body.position.y = 2; monster.add(body);
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat); legL.position.set(-0.25, 0.75, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat); legR.position.set(0.25, 0.75, 0);
monster.add(legL, legR);
scene.add(monster);

// Biến AI
let monDirX = 1; let monDirZ = 0; // Hướng đi tuần tra hiện tại
let monsterState = 'patrol'; // 'patrol' hoặc 'chase'


// ==========================================
// 5. ĐIỀU KHIỂN & VA CHẠM
// ==========================================
let hasKey = false;
let hasCode = false;
let isHiding = false;
let lastPlayerPos = new THREE.Vector3(); // Lưu vị trí trước khi trốn
let isPlaying = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Check va chạm với tường và các cửa đang đóng
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

// -- PC CONTROL --
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

// -- MOBILE CONTROL (FIX MULTI-TOUCH 100%) --
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';

let lookTouchId = null, joyTouchId = null;
let touchLookStartX = 0, touchLookStartY = 0;
let joyX = 0, joyY = 0;
const lookZone = document.getElementById('touch-look-zone');
const joyBase = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');

// Ngón Xoay (Look)
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
            camera.rotation.y -= dx * 0.005;
            camera.rotation.x -= dy * 0.005;
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

// Ngón Joystick (Move)
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
            if(dist > 30) { dx = (dx/dist)*30; dy = (dy/dist)*30; }
            joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            joyX = dx / 30; joyY = dy / 30;
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
// 6. TƯƠNG TÁC LẤY VẬT PHẨM & TRỐN
// ==========================================
const btnAction = document.getElementById('btn-action');
const promptUI = document.getElementById('prompt');

function tryInteract() {
    if(!isPlaying) return;

    // 1. Trạng thái đang trốn -> Bấm để chui ra
    if (isHiding) {
        isHiding = false;
        camera.position.copy(lastPlayerPos); // Trả về vị trí cũ
        updateHUD();
        return;
    }

    // 2. Chui vào tủ trốn (Wardrobe)
    for(let w of wardrobes) {
        if (camera.position.distanceTo(w.position) < 5) {
            isHiding = true;
            lastPlayerPos.copy(camera.position); // Nhớ chỗ đứng
            camera.position.set(w.position.x, 2, w.position.z); // Hút vào giữa tủ
            updateHUD();
            return;
        }
    }

    // 3. Nhặt Chìa Khóa
    if (keyItem && camera.position.distanceTo(keyItem.position) < 5) {
        scene.remove(keyItem); keyItem = null; hasKey = true; updateHUD(); return;
    }

    // 4. Nhặt Mật Mã
    if (noteItem && camera.position.distanceTo(noteItem.position) < 5) {
        scene.remove(noteItem); noteItem = null; hasCode = true; updateHUD();
        alert(`Bạn đọc mảnh giấy: "Mật mã thoát hiểm là ${PASSWORD}"`); return;
    }

    // 5. Mở cửa Khóa (Xanh dương)
    for (let i = keyDoors.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(keyDoors[i].position) < 5) {
            if (hasKey) {
                scene.remove(keyDoors[i]);
                mapGrid[keyDoors[i].gridZ][keyDoors[i].gridX] = 0; // Xóa tường ảo
                keyDoors.splice(i, 1);
                hasKey = false; // Dùng 1 lần mất chìa
                updateHUD();
            } else { alert("Cửa đã bị khóa! Cần tìm chìa khóa Xanh."); }
            return;
        }
    }

    // 6. Mở cửa Thoát (Xanh lá)
    if (camera.position.distanceTo(exitDoor.position) < 5) {
        let nhap = prompt("Nhập mật mã 3 số để mở cửa:");
        if (nhap === PASSWORD) endGame("CHÚC MỪNG! BẠN ĐÃ THOÁT!", "#00ff00");
        else if (nhap !== null) alert("Mật mã sai!");
    }
}

btnAction.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); tryInteract(); }, { passive: false });
btnAction.addEventListener('mousedown', tryInteract);
document.addEventListener('keydown', (e) => { if(e.code === 'KeyE') tryInteract(); });


// ==========================================
// 7. VÒNG LẶP GAME & TRÍ TUỆ NHÂN TẠO (AI)
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    if (!isPlaying) return;

    let delta = clock.getDelta();
    let time = clock.getElapsedTime();

    // -- Di chuyển Player (Chỉ khi không trốn) --
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

    // -- Hoạt ảnh Vật phẩm --
    if(keyItem) { keyItem.rotation.y += delta; keyItem.position.y = 0.5 + Math.sin(time * 3) * 0.1; }

    // -- QUÁI VẬT AI (TUẦN TRA & ĐUỔI BẮT) --
    const distToPlayer = monster.position.distanceTo(camera.position);
    
    // Nếu gần & người chơi đang KHÔNG trốn -> Bật chế độ Chase
    if (distToPlayer < 12 && !isHiding) monsterState = 'chase';
    else monsterState = 'patrol';

    let monSpeed = (monsterState === 'chase' ? 3.0 : 1.5) * delta; // Đi tuần chậm, rượt nhanh hơn chút

    if (monsterState === 'chase') {
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const monDir = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        
        // Quái trượt theo tường
        if(!checkCollision(monster.position.x + monDir.x * monSpeed, monster.position.z)) monster.position.x += monDir.x * monSpeed;
        if(!checkCollision(monster.position.x, monster.position.z + monDir.z * monSpeed)) monster.position.z += monDir.z * monSpeed;
        
        if (distToPlayer < 1.5) endGame("BẠN ĐÃ BỊ BẮT!", "#ff3333");
    } 
    else { // Chế độ Đi tuần (Patrol)
        let nextX = monster.position.x + monDirX * monSpeed;
        let nextZ = monster.position.z + monDirZ * monSpeed;
        
        // Nếu đụng tường lúc đi tuần, chọn hướng random khác
        if (checkCollision(nextX, nextZ)) {
            let dirs = [[1,0], [-1,0], [0,1], [0,-1]];
            let r = Math.floor(Math.random() * 4);
            monDirX = dirs[r][0]; monDirZ = dirs[r][1];
        } else {
            monster.position.x = nextX; monster.position.z = nextZ;
            // Xoay mặt theo hướng đi
            let targetAngle = Math.atan2(monDirX, monDirZ);
            monster.rotation.y = targetAngle;
        }
    }

    // Hoạt ảnh chân quái
    legL.position.z = Math.sin(time * (monsterState==='chase'?10:5)) * 0.3;
    legR.position.z = -Math.sin(time * (monsterState==='chase'?10:5)) * 0.3;

    // -- Chữ gợi ý --
    let showP = false;
    if (!isHiding) {
        if(keyItem && camera.position.distanceTo(keyItem.position) < 5) showP = true;
        if(noteItem && camera.position.distanceTo(noteItem.position) < 5) showP = true;
        if(camera.position.distanceTo(exitDoor.position) < 5) showP = true;
        keyDoors.forEach(d => { if(camera.position.distanceTo(d.position) < 5) showP = true; });
        wardrobes.forEach(w => { if(camera.position.distanceTo(w.position) < 5) showP = true; });
    }
    promptUI.style.display = showP ? 'block' : 'none';
    if(showP) promptUI.innerText = "Bấm ✋ / Phím E";

    renderer.render(scene, camera);
}

// ==========================================
// 8. QUẢN LÝ TRẠNG THÁI MÀN HÌNH
// ==========================================
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    
    // Đặt lại các biến
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
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Bắt đầu render
animate();
