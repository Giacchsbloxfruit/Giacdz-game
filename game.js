document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// ==========================================
// 1. KHỞI TẠO MÔI TRƯỜNG 3D & HIỆU ỨNG ÁNH SÁNG
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050507);
scene.fog = new THREE.FogExp2(0x050507, 0.04); // Sương mù dày và tối hơn

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Bật đổ bóng cực xịn (Shadow Map)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x1a1a24, 0.8); 
scene.add(ambientLight);

// Đèn pin (Flashlight) - Dùng SpotLight thay vì PointLight để có luồng sáng như thật
const flashLight = new THREE.SpotLight(0xffeedd, 2.5, 25, Math.PI / 4.5, 0.6, 1);
flashLight.position.set(0, 0, 0);
flashLight.castShadow = true;
flashLight.shadow.mapSize.width = 1024;
flashLight.shadow.mapSize.height = 1024;
flashLight.shadow.bias = -0.001; // Giảm nhiễu bóng
camera.add(flashLight);
scene.add(camera);

// Target của đèn pin (luôn hướng về phía trước camera)
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0, 0, -1);
camera.add(flashTarget);
flashLight.target = flashTarget;

const exitGlowLight = new THREE.PointLight(0x00ff55, 0, 20); 
scene.add(exitGlowLight);

// ==========================================
// 2. TẠO VÂN BỀ MẶT (TEXTURES) SIÊU THỰC 
// ==========================================
// Hàm tạo vân gỗ
function createWoodTexture(baseColor) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 800; i++) {
        ctx.fillRect(Math.random() * 512, 0, Math.random() * 3 + 1, 512);
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

// Hàm tạo vân gạch sần sùi
function createBrickTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#050505'; ctx.lineWidth = 8;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(512, i * 64); ctx.stroke();
        for (let j = 0; j < 8; j++) {
            let offset = (i % 2) * 32;
            ctx.beginPath(); ctx.moveTo(j * 64 + offset, i * 64); ctx.lineTo(j * 64 + offset, (i + 1) * 64); ctx.stroke();
        }
    }
    // Thêm nhiễu hột (Noise) cho gạch
    for(let i=0; i<5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

const wallTex = createBrickTexture();
const woodBaseTex = createWoodTexture('#3a2415');
const floorTex = createBrickTexture(); floorTex.repeat.set(10, 10);

// Vật liệu (Materials) xóa bỏ độ bóng nhựa, tăng độ nhám (roughness)
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1.0, metalness: 0.0 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8, map: floorTex });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });

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
const walls = []; const wardrobes = []; let keyDoors = []; let exitDoor;

// Setup sàn và trần có nhận bóng (receiveShadow)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(75, 75), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(35, 0, 35); floor.receiveShadow = true; scene.add(floor);

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(75, 75), ceilMat);
ceil.rotation.x = Math.PI / 2; ceil.position.set(35, 5, 35); scene.add(ceil);

// ==========================================
// 3. THIẾT KẾ CỬA MỚI: PHÁT SÁNG & CỰC RÕ MÀU
// ==========================================
const frameMat = new THREE.MeshStandardMaterial({ map: createWoodTexture('#1a1008'), roughness: 0.9 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.4 });

function createRealisticWoodenDoor(hexColor) {
    const group = new THREE.Group();
    // Khung cửa
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT*1.05, UNIT*0.5), frameMat);
    frame.position.y = UNIT/2; frame.castShadow = true; frame.receiveShadow = true;
    
    // Thân cửa có màu vân gỗ đặc trưng
    const mainDoorMat = new THREE.MeshStandardMaterial({ map: createWoodTexture('#3a2415'), roughness: 0.8 });
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.9, UNIT*0.95, UNIT*0.3), mainDoorMat);
    doorBody.position.y = UNIT/2; doorBody.castShadow = true; doorBody.receiveShadow = true;

    // Các panel phát sáng nhẹ để nhận diện từ xa
    const glowingPanelMat = new THREE.MeshStandardMaterial({ 
        color: hexColor, roughness: 0.2, 
        emissive: hexColor, emissiveIntensity: 0.6 
    });
    const panel1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.7, UNIT*0.35, UNIT*0.32), glowingPanelMat); 
    panel1.position.set(0, UNIT*0.7, 0); panel1.castShadow = true;
    
    const panel2 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.7, UNIT*0.35, UNIT*0.32), glowingPanelMat); 
    panel2.position.set(0, UNIT*0.3, 0); panel2.castShadow = true;

    // Tay nắm kim loại
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), metalMat); 
    knob.position.set(UNIT*0.35, UNIT/2, UNIT*0.18); knob.castShadow = true;
    
    // Đèn nhỏ hắt ra từ cửa (Tạo hiệu ứng rực rỡ)
    const doorGlow = new THREE.PointLight(hexColor, 0.8, 8);
    doorGlow.position.set(0, UNIT/2, UNIT*0.5);

    group.add(frame, doorBody, panel1, panel2, knob, doorGlow);
    return group;
}

let chains = [];
function createExitDoor() {
    const group = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT*1.05, UNIT*0.5), frameMat); 
    frame.position.y = UNIT/2; frame.castShadow = true; frame.receiveShadow = true;
    
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.9, UNIT*0.95, UNIT*0.3), new THREE.MeshStandardMaterial({ map: createWoodTexture('#222'), roughness: 0.9 })); 
    doorBody.position.y = UNIT/2; doorBody.castShadow = true; doorBody.receiveShadow = true;
    
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 1.0, roughness: 0.3 });
    const chain1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, UNIT*1.3), chainMat); 
    chain1.position.y = UNIT/2; chain1.rotation.z = Math.PI/4; chain1.castShadow = true;
    
    const chain2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, UNIT*1.3), chainMat); 
    chain2.position.y = UNIT/2; chain2.rotation.z = -Math.PI/4; chain2.castShadow = true;
    
    chains.push(chain1, chain2);
    group.add(frame, doorBody, chain1, chain2);
    return group;
}

for (let z = 0; z < mapGrid.length; z++) {
    for (let x = 0; x < mapGrid[z].length; x++) {
        let pX = x * UNIT, pZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); 
            w.position.set(pX, UNIT/2, pZ); 
            w.castShadow = true; w.receiveShadow = true; 
            scene.add(w); walls.push(w);
        } else if (mapGrid[z][x] === 2) {
            exitDoor = createExitDoor(); exitDoor.position.set(pX, 0, pZ); scene.add(exitDoor);
            exitGlowLight.position.set(pX, UNIT/2, pZ + 2);
        } else if (mapGrid[z][x] >= 3 && mapGrid[z][x] <= 5) {
            let color = mapGrid[z][x]===3 ? 0x0088ff : (mapGrid[z][x]===4 ? 0x00ff44 : 0xffbb00);
            let d = createRealisticWoodenDoor(color); d.position.set(pX, 0, pZ); d.reqCode = mapGrid[z][x]; d.gridX = x; d.gridZ = z;
            scene.add(d); keyDoors.push(d);
        } else if (mapGrid[z][x] === 6) {
            let ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT*0.9, UNIT*0.8), new THREE.MeshStandardMaterial({ map: createWoodTexture('#2b1a0f'), roughness: 0.9 })); 
            ward.position.set(pX, UNIT/2 - 0.2, pZ); ward.castShadow = true; ward.receiveShadow = true;
            scene.add(ward); wardrobes.push(ward);
        }
    }
}

// ==========================================
// 4. VẬT PHẨM (Được thêm viền sáng tự nhiên)
// ==========================================
const items = [];
function createKeyItem(hexColor, name, gridX, gridZ) {
    const kG = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hexColor, metalness: 0.9, roughness: 0.1, emissive: hexColor, emissiveIntensity: 0.5 });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8), mat); s.rotation.z = Math.PI/2; s.castShadow = true;
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 16), mat); h.position.x = -0.4; h.castShadow = true;
    
    // Đèn nhỏ hắt ra từ chìa khóa
    const light = new THREE.PointLight(hexColor, 1.5, 3); light.position.y = 0.5;
    
    kG.add(s, h, light); kG.position.set(gridX * UNIT, 0.5, gridZ * UNIT);
    kG.itemName = name; scene.add(kG); items.push(kG);
}

const plierGroup = new THREE.Group();
const mMat = new THREE.MeshStandardMaterial({color: 0x999999, metalness: 0.9, roughness: 0.2});
const rMat = new THREE.MeshStandardMaterial({color: 0xaa2222, roughness: 0.8});
const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p1.position.set(-0.08, -0.2, 0); p1.rotation.z = 0.2; p1.castShadow = true;
const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p2.position.set(0.08, -0.2, 0); p2.rotation.z = -0.2; p2.castShadow = true;
const pL = new THREE.PointLight(0xffffff, 0.5, 2); // Đèn nhẹ rọi vào kìm
plierGroup.add(p1, p2, pL); plierGroup.position.set(13 * UNIT, 0.5, 3 * UNIT);
plierGroup.itemName = "pliers"; scene.add(plierGroup); items.push(plierGroup);

const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({color: 0xffffee, roughness: 1.0}));
paper.rotation.x = -Math.PI/2; paper.position.set(13 * UNIT, 0.05, 13 * UNIT); paper.receiveShadow = true;
const paperLight = new THREE.PointLight(0xffffff, 0.5, 2); paperLight.position.set(13 * UNIT, 0.5, 13 * UNIT);
scene.add(paperLight);
paper.itemName = "code"; scene.add(paper); items.push(paper);

createKeyItem(0x0088ff, "blueKey", 2, 11);  
createKeyItem(0x00ff44, "greenKey", 1, 5);   
createKeyItem(0xffbb00, "yellowKey", 13, 7); 

const PASSWORD = "583";

// ==========================================
// 5. QUÁI VẬT (Thêm bóng và mắt phát sáng đáng sợ)
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x110202, roughness: 0.9, bumpMap: wallTex, bumpScale: 0.05 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }); 

const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), skinMat); mBody.position.y = 3.5; mBody.castShadow = true;
const mEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye1.position.set(-0.3, 3.6, 0.6);
const mEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye2.position.set(0.3, 3.6, 0.6);
const mEyeLight = new THREE.PointLight(0xff0000, 2, 8); mEyeLight.position.set(0, 3.6, 1);

const mTors = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2.5), skinMat); mTors.position.y = 1.8; mTors.castShadow = true;
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legL.position.set(-0.3, 0.9, 0); legL.castShadow = true;
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legR.position.set(0.3, 0.9, 0); legR.castShadow = true;

monster.add(mBody, mEye1, mEye2, mEyeLight, mTors, legL, legR); scene.add(monster);
let monDirX = 1; let monDirZ = 0; let monsterState = 'patrol'; 

// ==========================================
// 6. LOGIC TRÒ CHƠI & ĐIỀU KHIỂN (Giữ nguyên tối ưu cũ)
// ==========================================
let inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false };
let isHiding = false; let lastPlayerPos = new THREE.Vector3(); let isPlaying = false;
let joyX = 0, joyY = 0; let keysPressed = { w: false, a: false, s: false, d: false };

function resetKeys() { keysPressed.w=false; keysPressed.a=false; keysPressed.s=false; keysPressed.d=false; }
window.addEventListener('blur', () => { resetKeys(); });

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
    if (!isPlaying || isHiding) return;
    if (document.pointerLockElement === renderer.domElement) {
        camera.rotation.y -= e.movementX * 0.003; camera.rotation.x -= e.movementY * 0.003;
        camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
    }
});

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';

let lookTouchId = null, joyTouchId = null; let touchLookStartX = 0, touchLookStartY = 0;
const lookZone = document.getElementById('touch-look-zone'); const joyBase = document.getElementById('joystick-base'); const joyStick = document.getElementById('joystick-stick');

lookZone.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(lookTouchId === null) {
            lookTouchId = e.changedTouches[i].identifier; touchLookStartX = e.changedTouches[i].clientX; touchLookStartY = e.changedTouches[i].clientY; break;
        }
    }
}, {passive:true});

lookZone.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === lookTouchId){
            let dx = e.changedTouches[i].clientX - touchLookStartX; let dy = e.changedTouches[i].clientY - touchLookStartY;
            camera.rotation.y -= dx * 0.004; camera.rotation.x -= dy * 0.004;
            camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
            touchLookStartX = e.changedTouches[i].clientX; touchLookStartY = e.changedTouches[i].clientY;
        }
    }
}, {passive:true});

const clearLookTouch = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null; } };
lookZone.addEventListener('touchend', clearLookTouch, {passive:true}); lookZone.addEventListener('touchcancel', clearLookTouch, {passive:true});

joyBase.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(joyTouchId === null) { joyTouchId = e.changedTouches[i].identifier; updateJoystickPos(e.changedTouches[i]); break; }
    }
}, {passive:true});

joyBase.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId) updateJoystickPos(e.changedTouches[i]); }
}, {passive:true});

function updateJoystickPos(touch) {
    let r = joyBase.getBoundingClientRect();
    let dx = touch.clientX - (r.left + r.width/2), dy = touch.clientY - (r.top + r.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy), maxDist = 40;
    if(dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyX = dx / maxDist; joyY = dy / maxDist;
}

const resetJoystick = (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === joyTouchId){
            joyTouchId = null; joyStick.style.transform = `translate(-50%, -50%)`; joyX = 0; joyY = 0;
        }
    }
};
joyBase.addEventListener('touchend', resetJoystick, {passive:true}); joyBase.addEventListener('touchcancel', resetJoystick, {passive:true});

function tryInteract() {
    if(!isPlaying) return;
    resetKeys();
    if (isHiding) { isHiding = false; camera.position.copy(lastPlayerPos); updateHUD(); return; }
    for(let w of wardrobes) { if (camera.position.distanceTo(w.position) < 5) { isHiding = true; lastPlayerPos.copy(camera.position); camera.position.set(w.position.x, 2, w.position.z); updateHUD(); return; } }

    for (let i=items.length-1; i>=0; i--) {
        if (camera.position.distanceTo(items[i].position) < 4) {
            let name = items[i].itemName;
            if(name === "blueKey") { inv.blueKey = true; alert("Đã nhặt: Chìa khóa Xanh Biển"); }
            if(name === "greenKey") { inv.greenKey = true; alert("Đã nhặt: Chìa khóa Xanh Lá"); }
            if(name === "yellowKey") { inv.yellowKey = true; alert("Đã nhặt: Chìa khóa Vàng"); }
            if(name === "pliers") { inv.pliers = true; alert("Đã nhặt: Kiềm cắt xích"); }
            if(name === "code") { inv.code = true; alert(`Bạn đọc được mật mã trên giấy:\n"Mật mã cửa chính là ${PASSWORD}"`); exitGlowLight.intensity = 2.5; scene.remove(paperLight); }
            scene.remove(items[i]); items.splice(i, 1); updateHUD(); return;
        }
    }

    for (let i = keyDoors.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(keyDoors[i].position) < 5) {
            let req = keyDoors[i].reqCode;
            if ((req===3 && inv.blueKey) || (req===4 && inv.greenKey) || (req===5 && inv.yellowKey)) {
                scene.remove(keyDoors[i]); mapGrid[keyDoors[i].gridZ][keyDoors[i].gridX] = 0; keyDoors.splice(i, 1);
                if(req===3) inv.blueKey = false; if(req===4) inv.greenKey = false; if(req===5) inv.yellowKey = false;
                updateHUD();
            } else { 
                let cName = req===3 ? "Xanh Biển" : (req===4 ? "Xanh Lá" : "Vàng");
                alert(`Cửa khóa! Cần tìm Chìa khóa màu ${cName}.`); 
            }
            return;
        }
    }

    if (camera.position.distanceTo(exitDoor.position) < 5) {
        if (!inv.pliers) { alert("Cửa bị quấn xích! Bạn cần tìm KIỀM cắt xích trước."); return; }
        if (!inv.code) { alert("Đã cắt xích xong, nhưng cần biết Mật Mã để mở cửa thoát!"); return; }
        chains.forEach(c => scene.remove(c)); chains = [];
        let nhap = prompt("Nhập mật mã 3 số để mở khóa thoát:");
        if (nhap === PASSWORD) endGame("BẠN ĐÃ THOÁT KHỎI NGÔI NHÀ THÀNH CÔNG!", "#00ff55");
        else if (nhap !== null) alert("Mật mã sai rồi!");
    }
}
document.getElementById('btn-action').addEventListener('touchstart', (e)=>{ e.preventDefault(); tryInteract(); }, {passive:false});
document.getElementById('btn-action').addEventListener('click', () => { tryInteract(); });

const clock = new THREE.Clock();
// Biến lưu độ dốc bước chân (Head bobbing)
let footstep = 0;

function animate() {
    requestAnimationFrame(animate); if (!isPlaying) return;
    let delta = clock.getDelta(), time = clock.getElapsedTime();

    if (!isHiding) {
        let moveX = 0, moveZ = 0;
        if(joyY !== 0) moveZ = joyY; if(joyX !== 0) moveX = joyX;
        if(keysPressed.w) moveZ = -1; if(keysPressed.s) moveZ = 1;
        if(keysPressed.a) moveX = -1; if(keysPressed.d) moveX = 1;
        
        let isMoving = (moveX !== 0 || moveZ !== 0);
        
        if (isMoving) {
            let velocity = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(4.5 * delta);
            let direction = velocity.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
            if (!checkCollision(camera.position.x + direction.x, camera.position.z)) camera.position.x += direction.x;
            if (!checkCollision(camera.position.x, camera.position.z + direction.z)) camera.position.z += direction.z;
            
            // Hiệu ứng bước chân (Head Bobbing) chân thật
            footstep += delta * 10;
            camera.position.y = 2 + Math.sin(footstep) * 0.1;
        } else {
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2, 0.1);
        }
    }

    // Làm vật phẩm nổi lơ lửng cho ngầu
    items.forEach(i => { i.rotation.y += delta; i.position.y = 0.5 + Math.sin(time*3)*0.05; });

    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 11 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
    let monSpeed = (monsterState === 'chase' ? 3.5 : 1.5) * delta; // Quái chạy nhanh hơn lúc săn

    if (monsterState === 'chase') {
        monster.lookAt(camera.position.x, 0, camera.position.z);
        const mD = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
        if(!checkCollision(monster.position.x+mD.x*monSpeed, monster.position.z)) monster.position.x+=mD.x*monSpeed;
        if(!checkCollision(monster.position.x, monster.position.z+mD.z*monSpeed)) monster.position.z+=mD.z*monSpeed;
        if (distToPlayer < 1.4) endGame("QUÁI VẬT ĐÃ TÓM ĐƯỢC BẠN!", "#ff3333");
    } else {
        let nX = monster.position.x + monDirX*monSpeed, nZ = monster.position.z + monDirZ*monSpeed;
        if (checkCollision(nX, nZ)) {
            let r = Math.floor(Math.random()*4), dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            monDirX=dirs[r][0]; monDirZ=dirs[r][1];
        } else {
            monster.position.x=nX; monster.position.z=nZ; monster.rotation.y = Math.atan2(monDirX, monDirZ);
        }
    }
    // Animation chân quái vật
    let speedMult = monsterState === 'chase' ? 15 : 8;
    legL.position.z = Math.sin(time*speedMult)*0.3; legR.position.z = -Math.sin(time*speedMult)*0.3;
    mTors.rotation.z = Math.sin(time*speedMult)*0.05;

    let showP = false;
    if(!isHiding) {
        items.forEach(i=>{if(camera.position.distanceTo(i.position)<4) showP=true;});
        keyDoors.forEach(d=>{if(camera.position.distanceTo(d.position)<5) showP=true;});
        wardrobes.forEach(w=>{if(camera.position.distanceTo(w.position)<5) showP=true;});
        if(camera.position.distanceTo(exitDoor.position)<5) showP=true;
    }
    document.getElementById('prompt').style.display = showP ? 'block' : 'none';
    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden'); 
    document.getElementById('game-over').classList.add('hidden'); 
    document.getElementById('ui').classList.remove('hidden');
    inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false }; 
    resetKeys(); updateHUD();
    camera.position.set(1*UNIT, 2, 13*UNIT); camera.rotation.set(0, 0, 0);
    monster.position.set(7*UNIT, 0, 7*UNIT); 
    exitGlowLight.intensity = 0; clock.start(); isPlaying = true;
}

function endGame(msg, col) {
    isPlaying = false; resetKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('ui').classList.add('hidden'); document.getElementById('game-over').classList.remove('hidden');
    const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
