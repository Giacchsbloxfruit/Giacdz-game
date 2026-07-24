document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

function showMenu(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// ==========================================
// 1. MÔI TRƯỜNG & VẬT LIỆU TỐI ƯU
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050507);
scene.fog = new THREE.FogExp2(0x050507, 0.04);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x222230, 0.7); scene.add(ambientLight);

const flashLight = new THREE.SpotLight(0xffeedd, 2.0, 25, Math.PI / 4, 0.5, 1);
flashLight.position.set(0, 0, 0); flashLight.castShadow = true;
flashLight.shadow.mapSize.width = 512; flashLight.shadow.mapSize.height = 512;
camera.add(flashLight); scene.add(camera);
const flashTarget = new THREE.Object3D(); flashTarget.position.set(0, 0, -1);
camera.add(flashTarget); flashLight.target = flashTarget;

// Hàm tạo vân gạch/gỗ thủ công cực nhẹ
function createTexture(color, type='brick') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
    if(type==='brick') {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        for (let i=0; i<4; i++) {
            ctx.beginPath(); ctx.moveTo(0, i*64); ctx.lineTo(256, i*64); ctx.stroke();
            for (let j=0; j<4; j++) {
                let offset = (i%2)*32;
                ctx.beginPath(); ctx.moveTo(j*64+offset, i*64); ctx.lineTo(j*64+offset, (i+1)*64); ctx.stroke();
            }
        }
    } else if(type==='wood') {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < 200; i++) { ctx.fillRect(Math.random()*256, 0, Math.random()*2+1, 256); }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

const wallMat = new THREE.MeshLambertMaterial({ map: createTexture('#1a1a1a', 'brick') });
const floorMat = new THREE.MeshLambertMaterial({ map: createTexture('#0a0a0a', 'brick') }); 
floorMat.map.repeat.set(15, 15);
const ceilMat = new THREE.MeshLambertMaterial({ color: 0x050505 });
const woodMat = new THREE.MeshLambertMaterial({ map: createTexture('#3a2415', 'wood') });

const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,1,0,0,0,0,0,1,6,0,1], 
    [1,1,1,1,0,1,0,1,1,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,5,1], 
    [1,0,1,1,1,1,1,1,0,1,1,1,1,0,1],
    [1,0,1,6,0,0,0,1,0,0,0,0,1,0,1], 
    [1,0,1,1,1,1,0,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,4,0,0,0,0,1,0,1,0,1], 
    [1,1,1,1,0,1,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,1,6,0,1,0,0,0,0,0,1], 
    [1,0,1,1,1,1,0,1,1,1,1,1,1,0,1],
    [1,0,3,0,0,0,0,0,0,0,0,0,1,0,1], 
    [1,0,1,1,1,1,1,1,1,1,1,0,1,0,1],
    [1,0,0,6,0,0,0,0,0,0,0,0,0,0,1], 
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const UNIT = 5; let interactables = []; let walls = [];
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(75, 75), floorMat).setRotationFromEuler(new THREE.Euler(-Math.PI/2,0,0)).translateX(35).translateY(-35));
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(75, 75), ceilMat).setRotationFromEuler(new THREE.Euler(Math.PI/2,0,0)).translateX(35).translateY(5).translateZ(-35));

// ==========================================
// 2. THIẾT KẾ CỬA TỰ XOAY & TỦ GỖ CHÂN THỰC
// ==========================================
function getDoorRotation(x, z) {
    if(mapGrid[z] && mapGrid[z][x-1]===1 && mapGrid[z][x+1]===1) return 0; // Cửa kẹp giữa tường ngang
    if(mapGrid[z-1] && mapGrid[z-1][x]===1 && mapGrid[z+1] && mapGrid[z+1][x]===1) return Math.PI/2; // Cửa kẹp giữa tường dọc
    return 0; // Mặc định
}

function createDoor(hexColor, code, gX, gZ) {
    const group = new THREE.Group();
    group.userData = { type: 'door', reqCode: code, gridX: gX, gridZ: gZ, hex: hexColor };
    
    // Khung viền làm to hơn 1 chút để che kín khe hở
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    frame.position.y = UNIT/2; 
    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.85, UNIT*0.9, UNIT*0.55), woodMat);
    body.position.y = UNIT/2;
    
    const pMat = new THREE.MeshBasicMaterial({ color: hexColor });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), pMat); p1.position.y = UNIT*0.7;
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), pMat); p2.position.y = UNIT*0.3;
    
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    knob.position.set(UNIT*0.3, UNIT/2, UNIT*0.3);

    group.add(frame, body, p1, p2, knob);
    group.position.set(gX * UNIT, 0, gZ * UNIT);
    group.rotation.y = getDoorRotation(gX, gZ); // Fix lỗi quay cửa
    scene.add(group); interactables.push(group);
}

function createExitDoor(gX, gZ) {
    const group = new THREE.Group(); group.userData = { type: 'exit', hasChains: true };
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })); frame.position.y = UNIT/2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.85, UNIT*0.9, UNIT*0.55), new THREE.MeshLambertMaterial({ color: 0x222222 })); body.position.y = UNIT/2;
    
    const cMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c1.position.y = UNIT/2; c1.rotation.z = Math.PI/4; c1.position.z = UNIT*0.3;
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c2.position.y = UNIT/2; c2.rotation.z = -Math.PI/4; c2.position.z = UNIT*0.3;
    
    group.chains = [c1, c2]; group.add(frame, body, c1, c2);
    group.position.set(gX * UNIT, 0, gZ * UNIT); group.rotation.y = getDoorRotation(gX, gZ);
    scene.add(group); interactables.push(group);
}

function createWardrobe(gX, gZ) {
    const group = new THREE.Group();
    group.userData = { type: 'wardrobe', pos: new THREE.Vector3(gX*UNIT, 2, gZ*UNIT) };
    
    // Tủ được tạo hình có cánh và tay nắm, vân gỗ
    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.9, UNIT*1.2, UNIT*0.8), woodMat);
    body.position.y = UNIT*0.6;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, UNIT*1.1, UNIT*0.85), lineMat); line.position.y = UNIT*0.6; // Khe giữa 2 cánh
    
    const hMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), hMat); h1.position.set(-0.2, UNIT*0.6, UNIT*0.4);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), hMat); h2.position.set(0.2, UNIT*0.6, UNIT*0.4);
    
    group.add(body, line, h1, h2);
    group.position.set(gX*UNIT, 0, gZ*UNIT);
    // Xoay tủ dựa theo tường
    if(mapGrid[gZ-1] && mapGrid[gZ-1][gX]===1) group.rotation.y = 0; 
    else if(mapGrid[gZ] && mapGrid[gZ][gX-1]===1) group.rotation.y = Math.PI/2;
    scene.add(group); interactables.push(group);
}

for (let z = 0; z < mapGrid.length; z++) {
    for (let x = 0; x < mapGrid[z].length; x++) {
        let pX = x * UNIT, pZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); 
            w.position.set(pX, UNIT/2, pZ); scene.add(w); walls.push(w);
        } else if (mapGrid[z][x] === 2) createExitDoor(x, z);
        else if (mapGrid[z][x] >= 3 && mapGrid[z][x] <= 5) {
            let color = mapGrid[z][x]===3 ? 0x0088ff : (mapGrid[z][x]===4 ? 0x00ff44 : 0xffbb00);
            createDoor(color, mapGrid[z][x], x, z);
        } else if (mapGrid[z][x] === 6) createWardrobe(x, z);
    }
}

// ==========================================
// 3. VẬT PHẨM & KHO ĐỒ 3 Ô
// ==========================================
function createItemMesh(type, color=0xffffff) {
    const group = new THREE.Group();
    if (type === 'key') {
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8), mat); s.rotation.z = Math.PI/2;
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 16), mat); h.position.x = -0.4;
        group.add(s, h); group.icon = (color===0x0088ff?'🔵':(color===0x00ff44?'🟢':'🟡'));
    } else if (type === 'pliers') {
        const rMat = new THREE.MeshBasicMaterial({color: 0xaa2222});
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p1.position.set(-0.08, 0, 0); p1.rotation.z = 0.2;
        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p2.position.set(0.08, 0, 0); p2.rotation.z = -0.2;
        group.add(p1, p2); group.icon = '✂️';
    } else if (type === 'code') {
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), new THREE.MeshBasicMaterial({color: 0xffffee}));
        paper.rotation.x = -Math.PI/2; paper.position.y = -0.4; group.add(paper);
    }
    return group;
}

function spawnItem(gX, gZ, type, name, color=0xffffff) {
    let item = createItemMesh(type, color);
    item.userData = { type: 'item', itemType: type, name: name, reqCode: (name==='blueKey'?3:(name==='greenKey'?4:(name==='yellowKey'?5:0))) };
    item.position.set(gX * UNIT, 0.5, gZ * UNIT);
    scene.add(item); interactables.push(item);
}

spawnItem(3, 11, 'key', 'blueKey', 0x0088ff);  
spawnItem(1, 3, 'key', 'greenKey', 0x00ff44);   
spawnItem(13, 11, 'key', 'yellowKey', 0xffbb00); 
spawnItem(13, 4, 'pliers', 'pliers');
spawnItem(12, 13, 'code', 'code'); // Code chỉ đọc, không nhặt vào túi
const PASSWORD = "583"; let hasCode = false;

// KHO ĐỒ LOGIC
let inventory = [null, null, null]; // Chứa max 3 items
let activeSlot = 0; // Đang chọn ô số 0

window.selectSlot = function(index) {
    activeSlot = index;
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${index}`).classList.add('active');
};
document.addEventListener('keydown', (e) => { if(e.key==='1') selectSlot(0); if(e.key==='2') selectSlot(1); if(e.key==='3') selectSlot(2); });

function updateUI() {
    for(let i=0; i<3; i++) {
        let el = document.getElementById(`slot-${i}`);
        el.innerHTML = inventory[i] ? inventory[i].icon : '';
    }
}

// ==========================================
// 4. QUÁI VẬT HOẠT HÌNH ĐÁNG SỢ
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshLambertMaterial({ color: 0x110202 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), skinMat); mBody.position.y = 3.5;
const mEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye1.position.set(-0.3, 3.6, 0.6);
const mEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye2.position.set(0.3, 3.6, 0.6);
const mTors = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2.5), skinMat); mTors.position.y = 1.8;
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legL.position.set(-0.3, 0.9, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legR.position.set(0.3, 0.9, 0);

// Thêm tay dài ngoằng
const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2), skinMat); armL.position.set(-0.8, 2.5, 0);
const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2), skinMat); armR.position.set(0.8, 2.5, 0);

monster.add(mBody, mEye1, mEye2, mTors, legL, legR, armL, armR); scene.add(monster);
let monDirX = 1, monDirZ = 0, monsterState = 'patrol'; 

// ==========================================
// 5. ĐIỀU KHIỂN & RAYCAST (CHỐNG XUYÊN TƯỜNG)
// ==========================================
let isHiding = false, isPlaying = false, lastPlayerPos = new THREE.Vector3();
let joyX = 0, joyY = 0; let keysPressed = { w: false, a: false, s: false, d: false };
let toastTimeout;
function showToast(msg, color="#fff") {
    const toast = document.getElementById('toast-msg');
    toast.innerHTML = msg; toast.style.color = color; toast.classList.remove('hidden');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function resetInputs() {
    keysPressed.w=false; keysPressed.a=false; keysPressed.s=false; keysPressed.d=false;
    joyX = 0; joyY = 0; document.getElementById('joystick-stick').style.transform = `translate(-50%, -50%)`;
}
window.addEventListener('blur', resetInputs);

function checkCollision(x, z) {
    let gX = Math.round(x / UNIT), gZ = Math.round(z / UNIT);
    if (gX<0 || gX>=mapGrid[0].length || gZ<0 || gZ>=mapGrid.length) return true;
    let b = mapGrid[gZ][gX]; return b===1 || b===2 || b===3 || b===4 || b===5 || b===6;
}

window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keysPressed.w = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keysPressed.s = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysPressed.a = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keysPressed.d = true;
    if (e.code === 'KeyE') tryInteract();
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keysPressed.w = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keysPressed.s = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysPressed.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keysPressed.d = false;
});

renderer.domElement.addEventListener('click', () => {
    if (isPlaying && !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
    }
});
document.addEventListener('mousemove', (e) => {
    if (!isPlaying || isHiding || document.pointerLockElement !== renderer.domElement) return;
    camera.rotation.y -= e.movementX * 0.003; camera.rotation.x -= e.movementY * 0.003;
    camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
});

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) { document.getElementById('joystick-base').style.display = 'block'; }

let lookTouchId = null, joyTouchId = null, tStartX = 0, tStartY = 0;
const lookZone = document.getElementById('touch-look-zone'), joyBase = document.getElementById('joystick-base'), joyStick = document.getElementById('joystick-stick');
lookZone.addEventListener('touchstart', (e) => { for(let i=0; i<e.changedTouches.length; i++) { if(lookTouchId === null) { lookTouchId = e.changedTouches[i].identifier; tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY; break; } } }, {passive:true});
lookZone.addEventListener('touchmove', (e) => { if(!isPlaying || isHiding) return; for(let i=0; i<e.changedTouches.length; i++) { if(e.changedTouches[i].identifier === lookTouchId) { let dx = e.changedTouches[i].clientX - tStartX, dy = e.changedTouches[i].clientY - tStartY; camera.rotation.y -= dx * 0.004; camera.rotation.x -= dy * 0.004; camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x)); tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY; } } }, {passive:true});
const clearLookTouch = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null; } };
lookZone.addEventListener('touchend', clearLookTouch); lookZone.addEventListener('touchcancel', clearLookTouch);

joyBase.addEventListener('touchstart', (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(joyTouchId === null) { joyTouchId = e.changedTouches[i].identifier; updateJoy(e.changedTouches[i]); break; } } }, {passive:true});
joyBase.addEventListener('touchmove', (e) => { if(!isPlaying || isHiding) return; for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId) updateJoy(e.changedTouches[i]); } }, {passive:true});
function updateJoy(touch) { let r = joyBase.getBoundingClientRect(), dx = touch.clientX - (r.left + r.width/2), dy = touch.clientY - (r.top + r.height/2); let dist = Math.sqrt(dx*dx + dy*dy), max = 40; if(dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; } joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; joyX = dx / max; joyY = dy / max; }
const resetJoy = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId){ joyTouchId = null; joyStick.style.transform = `translate(-50%, -50%)`; joyX = 0; joyY = 0; } } };
joyBase.addEventListener('touchend', resetJoy); joyBase.addEventListener('touchcancel', resetJoy);

const raycaster = new THREE.Raycaster();

function tryInteract() {
    if(!isPlaying) return;
    if (isHiding) { isHiding = false; camera.position.copy(lastPlayerPos); resetInputs(); return; }
    resetInputs();

    // Thu thập tất cả lưới (mesh) để bắn raycast chặn tường
    let checkList = [...walls];
    interactables.forEach(g => g.traverse(child => { if(child.isMesh) { child.parentGroup = g; checkList.push(child); } }));

    raycaster.setFromCamera({x: 0, y: 0}, camera);
    const intersects = raycaster.intersectObjects(checkList, false);

    if (intersects.length > 0 && intersects[0].distance < 6) {
        let hit = intersects[0].object;
        if (!hit.parentGroup) {
            // Chạm vào tường
            showToast("Bị vướng tường!", "#aaa"); return;
        }
        
        let obj = hit.parentGroup;
        let data = obj.userData;

        if (data.type === 'item') {
            if (data.name === 'code') {
                hasCode = true; showToast(`Đã đọc mật mã: ${PASSWORD}`, "#ffff00"); return;
            }
            
            // Xử lý đổi đồ / vứt đồ cũ xuống đất
            if (inventory[activeSlot] !== null) {
                let oldItemData = inventory[activeSlot];
                spawnItem(camera.position.x/UNIT, camera.position.z/UNIT, oldItemData.itemType, oldItemData.name, oldItemData.color);
            }
            
            inventory[activeSlot] = { name: data.name, itemType: data.itemType, reqCode: data.reqCode, icon: obj.icon, color: obj.children[0].material.color.getHex() };
            scene.remove(obj); interactables = interactables.filter(o => o !== obj);
            showToast(`Nhặt được vào ô ${activeSlot+1}!`, "#00ff00"); updateUI();
        } 
        else if (data.type === 'door') {
            let req = data.reqCode;
            let currentItem = inventory[activeSlot];
            if (currentItem && currentItem.reqCode === req) {
                scene.remove(obj); mapGrid[data.gridZ][data.gridX] = 0; interactables = interactables.filter(o => o !== obj);
                inventory[activeSlot] = null; // Mất chìa
                showToast("Đã mở khóa cửa!", "#00ff00"); updateUI();
            } else {
                showToast("Cửa khóa! Cầm đúng chìa vào ô đang chọn.", "#ff3333"); 
            }
        } 
        else if (data.type === 'wardrobe') {
            isHiding = true; lastPlayerPos.copy(camera.position); camera.position.copy(data.pos);
        } 
        else if (data.type === 'exit') {
            let currentItem = inventory[activeSlot];
            if (data.hasChains) {
                if (currentItem && currentItem.name === 'pliers') {
                    obj.chains.forEach(c => scene.remove(c)); data.hasChains = false;
                    inventory[activeSlot] = null; updateUI(); // Dùng xong kiềm
                    showToast("Cắt xích xong! Hãy nhập mật mã.", "#00ff00");
                } else {
                    showToast("Cửa xích! Cầm KIỀM trên tay để cắt.", "#ff3333");
                }
                return;
            }
            if (!hasCode) { showToast("Cần tìm MẬT MÃ để mở cửa!", "#ff3333"); return; }
            setTimeout(() => {
                let nhap = prompt("Nhập mật mã 3 số để thoát:");
                if (nhap === PASSWORD) endGame("BẠN ĐÃ THOÁT KHỎI NGÔI NHÀ!", "#00ff55");
                else if (nhap !== null) showToast("Mật mã sai!", "#ff3333");
            }, 100);
        }
    }
}
document.getElementById('btn-action').addEventListener('touchstart', (e)=>{ e.preventDefault(); tryInteract(); }, {passive:false});
document.getElementById('btn-action').addEventListener('click', tryInteract);

// ==========================================
// 6. VÒNG LẶP & AI
// ==========================================
const clock = new THREE.Clock(); let footstep = 0;

function animate() {
    requestAnimationFrame(animate); if (!isPlaying) return;
    let delta = clock.getDelta(), time = clock.getElapsedTime();

    if (!isHiding) {
        let moveX = 0, moveZ = 0;
        if(joyY !== 0) moveZ = joyY; if(joyX !== 0) moveX = joyX;
        if(keysPressed.w) moveZ = -1; if(keysPressed.s) moveZ = 1;
        if(keysPressed.a) moveX = -1; if(keysPressed.d) moveX = 1;
        
        if (moveX !== 0 || moveZ !== 0) {
            let vel = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(4.5 * delta);
            let dir = vel.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
            if (!checkCollision(camera.position.x + dir.x, camera.position.z)) camera.position.x += dir.x;
            if (!checkCollision(camera.position.x, camera.position.z + dir.z)) camera.position.z += dir.z;
            footstep += delta * 12; camera.position.y = 2 + Math.sin(footstep) * 0.08; 
        } else {
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2, 0.1);
        }
    }

    interactables.forEach(i => { if (i.userData.type === 'item') { i.rotation.y += delta; i.position.y = 0.5 + Math.sin(time*4)*0.1; } });

    // AI Quái vật (Thêm hiệu ứng rùng rợn)
    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 12 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
    let monSpeed = (monsterState === 'chase' ? 4.0 : 1.8) * delta;

    if (monsterState === 'chase') {
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const mD = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        if(!checkCollision(monster.position.x+mD.x*monSpeed, monster.position.z)) monster.position.x+=mD.x*monSpeed;
        if(!checkCollision(monster.position.x, monster.position.z+mD.z*monSpeed)) monster.position.z+=mD.z*monSpeed;
        
        // Hiệu ứng giật gân, vung tay khi rượt
        mBody.position.y = 3.5 + Math.sin(time * 30) * 0.15; // Giật giật
        mTors.rotation.x = 0.3; // Chồm tới trước
        armL.rotation.x = Math.sin(time * 15);
        armR.rotation.x = -Math.sin(time * 15);
        
        if (distToPlayer < 1.4) endGame("QUÁI VẬT TÓM ĐƯỢC BẠN!", "#ff3333");
    } else {
        let nX = monster.position.x + monDirX*monSpeed, nZ = monster.position.z + monDirZ*monSpeed;
        if (checkCollision(nX, nZ)) {
            let r = Math.floor(Math.random()*4), dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            monDirX=dirs[r][0]; monDirZ=dirs[r][1];
        } else {
            monster.position.x=nX; monster.position.z=nZ; monster.rotation.y = Math.atan2(monDirX, monDirZ);
        }
        mBody.position.y = 3.5; mTors.rotation.x = 0; armL.rotation.x = 0; armR.rotation.x = 0;
    }
    
    let speedMult = monsterState === 'chase' ? 18 : 8;
    legL.position.z = Math.sin(time*speedMult)*0.3; legR.position.z = -Math.sin(time*speedMult)*0.3;

    // Hiển thị nút bấm qua Raycast
    let showP = false;
    if(!isHiding) {
        let checkList = [...walls];
        interactables.forEach(g => g.traverse(child => { if(child.isMesh) { child.parentGroup = g; checkList.push(child); } }));
        raycaster.setFromCamera({x: 0, y: 0}, camera);
        let inters = raycaster.intersectObjects(checkList, false);
        if (inters.length > 0 && inters[0].distance < 6 && inters[0].object.parentGroup) showP = true;
    }
    document.getElementById('prompt').style.display = showP ? 'block' : 'none';
    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden'); 
    document.getElementById('ui').classList.remove('hidden');
    inventory = [null, null, null]; activeSlot = 0; hasCode = false; selectSlot(0); updateUI();
    resetInputs();
    camera.position.set(1*UNIT, 2, 13*UNIT); camera.rotation.set(0, 0, 0);
    monster.position.set(7*UNIT, 0, 7*UNIT); clock.start(); isPlaying = true;
}

function endGame(msg, col) {
    isPlaying = false; resetInputs();
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('ui').classList.add('hidden'); document.getElementById('game-over').classList.remove('hidden');
    const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
}

window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
