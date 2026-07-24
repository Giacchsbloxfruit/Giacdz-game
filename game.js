// Ngăn thu phóng màn hình
document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// Hàm UI menu
function showMenu(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
document.getElementById('btn-controls').addEventListener('click', () => showMenu('controls-screen'));
document.getElementById('btn-settings').addEventListener('click', () => showMenu('settings-screen'));

// ==========================================
// 1. KHỞI TẠO MÔI TRƯỜNG & TỐI ƯU ÁNH SÁNG
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050507);
scene.fog = new THREE.FogExp2(0x050507, 0.04);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; 

// Tối ưu render cho điện thoại yếu
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Giới hạn pixel chống lag
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x222230, 0.7); scene.add(ambientLight);

// Đèn pin tối ưu (độ phân giải bóng râm thấp hơn để mượt)
const flashLight = new THREE.SpotLight(0xffeedd, 2.0, 25, Math.PI / 4, 0.5, 1);
flashLight.position.set(0, 0, 0);
flashLight.castShadow = true;
flashLight.shadow.mapSize.width = 512;
flashLight.shadow.mapSize.height = 512;
camera.add(flashLight);
scene.add(camera);

const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
camera.add(flashTarget); flashLight.target = flashTarget;

// ==========================================
// 2. VẬT LIỆU SIÊU NHẸ (DÙNG LAMBERT THAY VÌ STANDARD)
// ==========================================
function createTexture(color, isFloor) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
        for (let j = 0; j < 4; j++) {
            let offset = (i % 2) * 32;
            ctx.beginPath(); ctx.moveTo(j * 64 + offset, i * 64); ctx.lineTo(j * 64 + offset, (i + 1) * 64); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

const wallMat = new THREE.MeshLambertMaterial({ map: createTexture('#1a1a1a') });
const floorTex = createTexture('#0a0a0a'); floorTex.repeat.set(15, 15);
const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
const ceilMat = new THREE.MeshLambertMaterial({ color: 0x050505 });

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

const UNIT = 5;
let interactables = []; 
let walls = [];

const floor = new THREE.Mesh(new THREE.PlaneGeometry(75, 75), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(35, 0, 35); floor.receiveShadow = true; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(75, 75), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(35, 5, 35); scene.add(ceil);

// ==========================================
// 3. THIẾT KẾ CỬA & TỦ RÕ RÀNG HƠN
// ==========================================
function createDoor(hexColor, code, gX, gZ) {
    const group = new THREE.Group();
    group.userData = { type: 'door', reqCode: code, gridX: gX, gridZ: gZ, colorHex: hexColor };

    // Khung viền cửa (lồi ra ngoài)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    frame.position.y = UNIT/2; 
    
    // Thân cửa thụt vào trong
    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT*0.9, UNIT*0.55), new THREE.MeshLambertMaterial({ color: 0x3a2415 }));
    body.position.y = UNIT/2;
    
    // Bảng phát sáng (dùng MeshBasicMaterial để sáng chói mà không tốn tài nguyên bóng râm)
    const glowingMat = new THREE.MeshBasicMaterial({ color: hexColor });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), glowingMat); p1.position.y = UNIT*0.7;
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), glowingMat); p2.position.y = UNIT*0.3;
    
    // Tay nắm kim loại
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    knob.position.set(UNIT*0.3, UNIT/2, UNIT*0.3);

    group.add(frame, body, p1, p2, knob);
    group.position.set(gX * UNIT, 0, gZ * UNIT);
    scene.add(group); interactables.push(group);
}

function createExitDoor(gX, gZ) {
    const group = new THREE.Group();
    group.userData = { type: 'exit', hasChains: true };
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })); frame.position.y = UNIT/2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT*0.9, UNIT*0.55), new THREE.MeshLambertMaterial({ color: 0x222222 })); body.position.y = UNIT/2;
    
    // Xích sắt
    const cMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c1.position.y = UNIT/2; c1.rotation.z = Math.PI/4;
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c2.position.y = UNIT/2; c2.rotation.z = -Math.PI/4;
    
    group.chains = [c1, c2]; group.add(frame, body, c1, c2);
    group.position.set(gX * UNIT, 0, gZ * UNIT); scene.add(group); interactables.push(group);
}

// Xây bản đồ
for (let z = 0; z < mapGrid.length; z++) {
    for (let x = 0; x < mapGrid[z].length; x++) {
        let pX = x * UNIT, pZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); 
            w.position.set(pX, UNIT/2, pZ); scene.add(w); walls.push(w);
        } else if (mapGrid[z][x] === 2) {
            createExitDoor(x, z);
        } else if (mapGrid[z][x] >= 3 && mapGrid[z][x] <= 5) {
            let color = mapGrid[z][x]===3 ? 0x0088ff : (mapGrid[z][x]===4 ? 0x00ff44 : 0xffbb00);
            createDoor(color, mapGrid[z][x], x, z);
        } else if (mapGrid[z][x] === 6) {
            // Tủ gỗ bự để dễ nhận diện
            const ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.9, UNIT*1.1, UNIT*0.9), new THREE.MeshLambertMaterial({ color: 0x2b1a0f })); 
            ward.position.set(pX, UNIT*0.55, pZ); 
            ward.userData = { type: 'wardrobe', pos: new THREE.Vector3(pX, 2, pZ) };
            scene.add(ward); interactables.push(ward);
        }
    }
}

// ==========================================
// 4. VẬT PHẨM (VỊ TRÍ ĐÃ ĐƯỢC SỬA LẠI ĐỂ KHÔNG ĐÈ LÊN CỬA)
// ==========================================
function createItem(gX, gZ, type, name, color=0xffffff) {
    const group = new THREE.Group();
    group.userData = { type: 'item', name: name, colorHex: color };
    
    if (type === 'key') {
        const mat = new THREE.MeshBasicMaterial({ color: color }); // Basic để dạ quang dễ thấy
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8), mat); s.rotation.z = Math.PI/2;
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 16), mat); h.position.x = -0.4;
        group.add(s, h);
    } else if (type === 'pliers') {
        const rMat = new THREE.MeshBasicMaterial({color: 0xaa2222});
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p1.position.set(-0.08, 0, 0); p1.rotation.z = 0.2;
        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p2.position.set(0.08, 0, 0); p2.rotation.z = -0.2;
        group.add(p1, p2);
    } else if (type === 'code') {
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), new THREE.MeshBasicMaterial({color: 0xffffee}));
        paper.rotation.x = -Math.PI/2; paper.position.y = -0.4; group.add(paper);
    }
    
    group.position.set(gX * UNIT, 0.5, gZ * UNIT);
    scene.add(group); interactables.push(group);
}

// Đã dời vị trí ra chỗ an toàn trống trải
createItem(3, 11, 'key', 'blueKey', 0x0088ff);  
createItem(1, 3, 'key', 'greenKey', 0x00ff44);   
createItem(13, 11, 'key', 'yellowKey', 0xffbb00); 
createItem(13, 4, 'pliers', 'pliers');
createItem(12, 13, 'code', 'code');
const PASSWORD = "583";

// ==========================================
// 5. QUÁI VẬT
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshLambertMaterial({ color: 0x220505 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), skinMat); mBody.position.y = 3.5;
const mEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye1.position.set(-0.3, 3.6, 0.6);
const mEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye2.position.set(0.3, 3.6, 0.6);
const mTors = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2.5), skinMat); mTors.position.y = 1.8;
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legL.position.set(-0.3, 0.9, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legR.position.set(0.3, 0.9, 0);

monster.add(mBody, mEye1, mEye2, mTors, legL, legR); scene.add(monster);
let monDirX = 1, monDirZ = 0, monsterState = 'patrol'; 

// ==========================================
// 6. HỆ THỐNG ĐIỀU KHIỂN & TƯƠNG TÁC THÔNG MINH
// ==========================================
let inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false };
let isHiding = false, isPlaying = false, lastPlayerPos = new THREE.Vector3();
let joyX = 0, joyY = 0; let keysPressed = { w: false, a: false, s: false, d: false };

// Hàm Toast để hiện thông báo mượt mà thay thế alert (Chống kẹt phím)
let toastTimeout;
function showToast(msg, color="#fff") {
    const toast = document.getElementById('toast-msg');
    toast.innerHTML = msg; toast.style.color = color; toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// Hàm Reset phím triệt để khi tương tác
function resetInputs() {
    keysPressed.w=false; keysPressed.a=false; keysPressed.s=false; keysPressed.d=false;
    joyX = 0; joyY = 0; joyTouchId = null; 
    document.getElementById('joystick-stick').style.transform = `translate(-50%, -50%)`;
}
window.addEventListener('blur', resetInputs);

function checkCollision(x, z) {
    let gX = Math.round(x / UNIT), gZ = Math.round(z / UNIT);
    if (gX<0 || gX>=mapGrid[0].length || gZ<0 || gZ>=mapGrid.length) return true;
    let b = mapGrid[gZ][gX]; return b===1 || b===2 || b===3 || b===4 || b===5 || b===6;
}

function updateHUD() {
    let keys = [];
    if(inv.blueKey) keys.push("🔵 Biển"); if(inv.greenKey) keys.push("🟢 Xanh Lá"); if(inv.yellowKey) keys.push("🟡 Vàng");
    if(isHiding) {
        document.getElementById('info').innerHTML = "👀 ĐANG TRỐN TRONG TỦ<br><span style='color:#ccc'>Bấm [E] hoặc [LẤY] để chui ra</span>";
    } else {
        document.getElementById('info').innerHTML = `🎒 Khóa: ${keys.length > 0 ? keys.join(" | ") : "Chưa có"} <br>🛠 Dụng cụ: ${inv.pliers ? "✂️ Kiềm" : "Trống"} <br>📜 Mật mã: ${inv.code ? PASSWORD : "???"}`;
    }
}

// Bàn phím
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

// PC Chuột
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

// Mobile Cảm ứng
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';

let lookTouchId = null, joyTouchId = null, tStartX = 0, tStartY = 0;
const lookZone = document.getElementById('touch-look-zone'), joyBase = document.getElementById('joystick-base'), joyStick = document.getElementById('joystick-stick');

lookZone.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++) {
        if(lookTouchId === null) {
            lookTouchId = e.changedTouches[i].identifier; tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY; break;
        }
    }
}, {passive:true});
lookZone.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === lookTouchId) {
            let dx = e.changedTouches[i].clientX - tStartX, dy = e.changedTouches[i].clientY - tStartY;
            camera.rotation.y -= dx * 0.004; camera.rotation.x -= dy * 0.004;
            camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
            tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY;
        }
    }
}, {passive:true});
const clearLookTouch = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null; } };
lookZone.addEventListener('touchend', clearLookTouch); lookZone.addEventListener('touchcancel', clearLookTouch);

joyBase.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++){ if(joyTouchId === null) { joyTouchId = e.changedTouches[i].identifier; updateJoy(e.changedTouches[i]); break; } }
}, {passive:true});
joyBase.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId) updateJoy(e.changedTouches[i]); }
}, {passive:true});

function updateJoy(touch) {
    let r = joyBase.getBoundingClientRect(), dx = touch.clientX - (r.left + r.width/2), dy = touch.clientY - (r.top + r.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy), max = 40;
    if(dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyX = dx / max; joyY = dy / max;
}
const resetJoy = (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === joyTouchId){ joyTouchId = null; joyStick.style.transform = `translate(-50%, -50%)`; joyX = 0; joyY = 0; }
    }
};
joyBase.addEventListener('touchend', resetJoy); joyBase.addEventListener('touchcancel', resetJoy);

// Logic Tương Tác chuẩn góc nhìn (Không nhặt xuyên tường)
function tryInteract() {
    if(!isPlaying) return;
    
    // Thoát khỏi tủ
    if (isHiding) { 
        isHiding = false; camera.position.copy(lastPlayerPos); resetInputs(); updateHUD(); 
        return; 
    }
    
    resetInputs(); // Bắt buộc xóa lệnh chạy khi bấm nút tương tác

    // Quét vật thể ngay trước mặt (Góc nhìn Dot Product + Khoảng cách)
    let dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    let bestObj = null, minDiff = Infinity;

    interactables.forEach(obj => {
        let dist = camera.position.distanceTo(obj.position);
        if (dist < 6) { // Phải đứng đủ gần
            let toObj = new THREE.Vector3().subVectors(obj.position, camera.position).normalize();
            let dot = dir.dot(toObj);
            if (dot > 0.6) { // Phải nhìn thẳng vào vật thể (Góc 50 độ)
                if(dist < minDiff) { minDiff = dist; bestObj = obj; }
            }
        }
    });

    if (!bestObj) return;

    const type = bestObj.userData.type;
    
    if (type === 'item') {
        let name = bestObj.userData.name;
        if(name === "blueKey") { inv.blueKey = true; showToast("Đã nhặt: Chìa Biển", "#0088ff"); }
        if(name === "greenKey") { inv.greenKey = true; showToast("Đã nhặt: Chìa Xanh Lá", "#00ff44"); }
        if(name === "yellowKey") { inv.yellowKey = true; showToast("Đã nhặt: Chìa Vàng", "#ffbb00"); }
        if(name === "pliers") { inv.pliers = true; showToast("Đã nhặt: Kiềm cắt xích", "#ff5555"); }
        if(name === "code") { inv.code = true; showToast(`Mật mã thoát hiểm là: ${PASSWORD}`, "#ffff00"); }
        
        scene.remove(bestObj);
        interactables = interactables.filter(o => o !== bestObj);
        updateHUD();
    } 
    else if (type === 'door') {
        let req = bestObj.userData.reqCode;
        if ((req===3 && inv.blueKey) || (req===4 && inv.greenKey) || (req===5 && inv.yellowKey)) {
            scene.remove(bestObj); mapGrid[bestObj.userData.gridZ][bestObj.userData.gridX] = 0;
            interactables = interactables.filter(o => o !== bestObj);
            if(req===3) inv.blueKey = false; if(req===4) inv.greenKey = false; if(req===5) inv.yellowKey = false;
            showToast("Đã mở khóa cửa!", "#00ff00"); updateHUD();
        } else {
            let cName = req===3 ? "Xanh Biển" : (req===4 ? "Xanh Lá" : "Vàng");
            let cHex = req===3 ? "#0088ff" : (req===4 ? "#00ff44" : "#ffbb00");
            showToast(`Cửa khóa! Cần chìa ${cName}`, cHex); 
        }
    } 
    else if (type === 'wardrobe') {
        isHiding = true; lastPlayerPos.copy(camera.position); 
        camera.position.copy(bestObj.userData.pos); updateHUD();
    } 
    else if (type === 'exit') {
        if (!inv.pliers) { showToast("Cửa xích! Cần KIỀM cắt xích.", "#ff3333"); return; }
        if (bestObj.userData.hasChains) {
            bestObj.chains.forEach(c => scene.remove(c)); bestObj.userData.hasChains = false;
            showToast("Cắt xích xong! Hãy nhập mật mã.", "#00ff00"); return;
        }
        if (!inv.code) { showToast("Cần tìm MẬT MÃ để mở cửa!", "#ff3333"); return; }
        
        // Mở Prompt nhập pass, xóa input tránh lỗi kẹt trước khi mở hộp thoại
        resetInputs();
        setTimeout(() => {
            let nhap = prompt("Nhập mật mã 3 số để thoát:");
            if (nhap === PASSWORD) endGame("BẠN ĐÃ THOÁT KHỎI NGÔI NHÀ!", "#00ff55");
            else if (nhap !== null) showToast("Mật mã sai!", "#ff3333");
        }, 100); // Đợi 1 nhịp để JS dọn dẹp touch event
    }
}
document.getElementById('btn-action').addEventListener('touchstart', (e)=>{ e.preventDefault(); tryInteract(); }, {passive:false});
document.getElementById('btn-action').addEventListener('click', () => { tryInteract(); });

// ==========================================
// 7. VÒNG LẶP & AI QUÁI VẬT
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
            let velocity = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(4.5 * delta);
            let direction = velocity.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
            if (!checkCollision(camera.position.x + direction.x, camera.position.z)) camera.position.x += direction.x;
            if (!checkCollision(camera.position.x, camera.position.z + direction.z)) camera.position.z += direction.z;
            
            footstep += delta * 12; camera.position.y = 2 + Math.sin(footstep) * 0.08; // Head bob mượt hơn
        } else {
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2, 0.1);
        }
    }

    // Hiệu ứng lơ lửng Item
    interactables.forEach(i => { if (i.userData.type === 'item') { i.rotation.y += delta; i.position.y = 0.5 + Math.sin(time*4)*0.1; } });

    // AI Quái vật
    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 12 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
    let monSpeed = (monsterState === 'chase' ? 3.8 : 1.8) * delta;

    if (monsterState === 'chase') {
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const mD = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        if(!checkCollision(monster.position.x+mD.x*monSpeed, monster.position.z)) monster.position.x+=mD.x*monSpeed;
        if(!checkCollision(monster.position.x, monster.position.z+mD.z*monSpeed)) monster.position.z+=mD.z*monSpeed;
        if (distToPlayer < 1.4) endGame("QUÁI VẬT TÓM ĐƯỢC BẠN!", "#ff3333");
    } else {
        let nX = monster.position.x + monDirX*monSpeed, nZ = monster.position.z + monDirZ*monSpeed;
        if (checkCollision(nX, nZ)) {
            let r = Math.floor(Math.random()*4), dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            monDirX=dirs[r][0]; monDirZ=dirs[r][1];
        } else {
            monster.position.x=nX; monster.position.z=nZ; monster.rotation.y = Math.atan2(monDirX, monDirZ);
        }
    }
    let speedMult = monsterState === 'chase' ? 15 : 8;
    legL.position.z = Math.sin(time*speedMult)*0.3; legR.position.z = -Math.sin(time*speedMult)*0.3;
    mTors.rotation.z = Math.sin(time*speedMult)*0.05;

    // Show prompt khi nhìn thẳng vào vật thể (Raycast logic)
    let showP = false;
    if(!isHiding) {
        let dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        for(let i=0; i<interactables.length; i++) {
            let obj = interactables[i];
            let dist = camera.position.distanceTo(obj.position);
            if (dist < 6) {
                let toObj = new THREE.Vector3().subVectors(obj.position, camera.position).normalize();
                if (dir.dot(toObj) > 0.6) { showP = true; break; }
            }
        }
    }
    document.getElementById('prompt').style.display = showP ? 'block' : 'none';
    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden'); 
    document.getElementById('ui').classList.remove('hidden');
    inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false }; 
    resetInputs(); updateHUD(); document.getElementById('toast-msg').classList.add('hidden');
    camera.position.set(1*UNIT, 2, 13*UNIT); camera.rotation.set(0, 0, 0);
    monster.position.set(7*UNIT, 0, 7*UNIT); 
    clock.start(); isPlaying = true;
}

function endGame(msg, col) {
    isPlaying = false; resetInputs();
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('ui').classList.add('hidden'); document.getElementById('game-over').classList.remove('hidden');
    const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
}

document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
