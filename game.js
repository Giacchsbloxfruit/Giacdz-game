document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// ==========================================
// 1. KHỞI TẠO MÔI TRƯỜNG 3D
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0c0e);
scene.fog = new THREE.FogExp2(0x0c0c0e, 0.04); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x333344, 1.0); scene.add(ambientLight);
const flashLight = new THREE.PointLight(0xffeedd, 1.5, 14); camera.add(flashLight);
scene.add(camera);

// Đèn tỏa sáng khi tìm thấy mật mã (Dành cho cửa thoát hiểm)
const exitGlowLight = new THREE.PointLight(0x00ff55, 0, 20); 
scene.add(exitGlowLight);

// ==========================================
// 2. TEXTURE & BẢN ĐỒ MỚI (14x14 ZIC ZẮC)
// ==========================================
function createBrickTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1b18'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#0a0908'; ctx.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
        for (let j = 0; j < 4; j++) {
            let offset = (i % 2) * 32;
            ctx.beginPath(); ctx.moveTo(j * 64 + offset, i * 64); ctx.lineTo(j * 64 + offset, (i + 1) * 64); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

// 1: Tường, 0: Trống, 2: Thoát hiểm, 3: Cửa Biển, 4: Cửa Xanh Lá, 5: Cửa Vàng, 6: Tủ trốn
const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,1,0,0,0,1,6,0,0,1],
    [1,1,1,1,0,1,0,5,0,1,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,1,1,0,1,0,1],
    [1,0,1,6,0,0,0,0,0,1,0,1,0,1],
    [1,0,1,1,1,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,4,0,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,3,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,0,0,6,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const UNIT = 5;
const walls = []; const wardrobes = []; let keyDoors = []; let exitDoor;
const wallMat = new THREE.MeshStandardMaterial({ map: createBrickTexture(), roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x151312, roughness: 0.9 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x020202 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.7 });

scene.add(new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat).translateY(0).rotateX(-Math.PI/2).translateX(32.5).translateZ(30));
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(70, 70), ceilMat).translateY(5).rotateX(Math.PI/2).translateX(32.5).translateZ(30));

function createRealDoor(lockHexColor) {
    const group = new THREE.Group();
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.4), woodMat);
    doorBody.position.y = UNIT/2;
    const lockMat = new THREE.MeshStandardMaterial({ color: lockHexColor, metalness: 0.6, emissive: lockHexColor, emissiveIntensity: 0.4 });
    const lock1 = new THREE.Mesh(new THREE.SphereGeometry(0.25), lockMat); lock1.position.set(UNIT*0.3, UNIT*0.5, UNIT*0.22);
    const lock2 = new THREE.Mesh(new THREE.SphereGeometry(0.25), lockMat); lock2.position.set(-UNIT*0.3, UNIT*0.5, -UNIT*0.22);
    group.add(doorBody, lock1, lock2);
    return group;
}

let chains = [];
function createExitDoor() {
    const group = new THREE.Group();
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.4), woodMat); doorBody.position.y = UNIT/2;
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.2 });
    const chain1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, UNIT*1.2), chainMat); chain1.position.y = UNIT/2; chain1.rotation.z = Math.PI/4;
    const chain2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, UNIT*1.2), chainMat); chain2.position.y = UNIT/2; chain2.rotation.z = -Math.PI/4;
    chains.push(chain1, chain2);
    group.add(doorBody, chain1, chain2);
    return group;
}

for (let z = 0; z < mapGrid.length; z++) {
    for (let x = 0; x < mapGrid[z].length; x++) {
        let pX = x * UNIT, pZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); w.position.set(pX, UNIT/2, pZ); scene.add(w); walls.push(w);
        } else if (mapGrid[z][x] === 2) {
            exitDoor = createExitDoor(); exitDoor.position.set(pX, 0, pZ); scene.add(exitDoor);
            exitGlowLight.position.set(pX, UNIT/2, pZ + 2);
        } else if (mapGrid[z][x] >= 3 && mapGrid[z][x] <= 5) {
            let color = mapGrid[z][x]===3 ? 0x0066ff : (mapGrid[z][x]===4 ? 0x00ff44 : 0xffcc00);
            let d = createRealDoor(color); d.position.set(pX, 0, pZ); d.reqCode = mapGrid[z][x]; d.gridX = x; d.gridZ = z;
            scene.add(d); keyDoors.push(d);
        } else if (mapGrid[z][x] === 6) {
            let ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT, UNIT*0.8), woodMat); ward.position.set(pX, UNIT/2, pZ);
            scene.add(ward); wardrobes.push(ward);
        }
    }
}

// ==========================================
// 3. VẬT PHẨM (CHÌA, KIỀM, MẬT MÃ)
// ==========================================
const items = [];
function createKeyItem(hexColor, name, gridX, gridZ) {
    const kG = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hexColor, metalness: 0.8, emissive: hexColor, emissiveIntensity: 0.4 });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), mat); s.rotation.z = Math.PI/2;
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16), mat); h.position.x = -0.35;
    kG.add(s, h); kG.position.set(gridX * UNIT, 0.5, gridZ * UNIT);
    kG.itemName = name; scene.add(kG); items.push(kG);
}

const plierGroup = new THREE.Group();
const mMat = new THREE.MeshStandardMaterial({color: 0x999999, metalness: 0.9});
const rMat = new THREE.MeshStandardMaterial({color: 0xdd2222});
const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), rMat); p1.position.set(-0.06, -0.2, 0); p1.rotation.z = 0.2;
const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), rMat); p2.position.set(0.06, -0.2, 0); p2.rotation.z = -0.2;
const hl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35), mMat); hl1.position.set(0.06, 0.18, 0); hl1.rotation.z = 0.2;
const hl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35), mMat); hl2.position.set(-0.06, 0.18, 0); hl2.rotation.z = -0.2;
plierGroup.add(p1, p2, hl1, hl2);
plierGroup.position.set(7 * UNIT, 0.5, 2 * UNIT);
plierGroup.itemName = "pliers"; scene.add(plierGroup); items.push(plierGroup);

const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({color: 0xffffee}));
paper.rotation.x = -Math.PI/2; paper.position.set(12 * UNIT, 0.1, 2 * UNIT);
paper.itemName = "code"; scene.add(paper); items.push(paper);

createKeyItem(0x0066ff, "blueKey", 3, 11);
createKeyItem(0x00ff44, "greenKey", 1, 3);
createKeyItem(0xffcc00, "yellowKey", 1, 7);

const PASSWORD = "583";

// ==========================================
// 4. QUÁI VẬT AI
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 1 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
monster.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat).translateY(3.5));
monster.add(new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat).translateY(3.6).translateX(-0.2).translateZ(0.4));
monster.add(new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat).translateY(3.6).translateX(0.2).translateZ(0.4));
monster.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 2), skinMat).translateY(2));
const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat); legL.position.set(-0.2, 0.75, 0);
const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5), skinMat); legR.position.set(0.2, 0.75, 0);
monster.add(legL, legR); scene.add(monster);
let monDirX = 1; let monDirZ = 0; let monsterState = 'patrol'; 

// ==========================================
// 5. ĐIỀU KHIỂN & KHO ĐỒ (ĐÃ KHẮC PHỤC KẸT NÚT)
// ==========================================
let inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false };
let isHiding = false; let lastPlayerPos = new THREE.Vector3(); let isPlaying = false;
let joyX = 0, joyY = 0;

function checkCollision(x, z) {
    let gX = Math.round(x / UNIT), gZ = Math.round(z / UNIT);
    if (gX<0 || gX>=mapGrid[0].length || gZ<0 || gZ>=mapGrid.length) return true;
    let b = mapGrid[gZ][gX]; return b===1 || b===2 || b===3 || b===4 || b===5 || b===6;
}

function updateHUD() {
    let keys = [];
    if(inv.blueKey) keys.push("🔵 Biển"); if(inv.greenKey) keys.push("🟢 Xanh Lá"); if(inv.yellowKey) keys.push("🟡 Vàng");
    
    if(isHiding) {
        document.getElementById('info').innerHTML = "👀 ĐANG TRỐN TRONG TỦ<br><span style='color:#ccc'>Bấm LẤY để chui ra</span>";
    } else {
        document.getElementById('info').innerHTML = `🎒 Khóa: ${keys.length > 0 ? keys.join(" | ") : "Chưa có"} <br>🛠 Dụng cụ: ${inv.pliers ? "✂️ Kiềm" : "Trống"} <br>📜 Mật mã: ${inv.code ? PASSWORD : "???"}`;
    }
}

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';

let lookTouchId = null, joyTouchId = null;
let touchLookStartX = 0, touchLookStartY = 0;
const lookZone = document.getElementById('touch-look-zone'); 
const joyBase = document.getElementById('joystick-base'); 
const joyStick = document.getElementById('joystick-stick');

lookZone.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(lookTouchId === null) {
            lookTouchId = e.changedTouches[i].identifier;
            touchLookStartX = e.changedTouches[i].clientX;
            touchLookStartY = e.changedTouches[i].clientY;
            break;
        }
    }
}, {passive:true});

lookZone.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === lookTouchId){
            let dx = e.changedTouches[i].clientX - touchLookStartX;
            let dy = e.changedTouches[i].clientY - touchLookStartY;
            camera.rotation.y -= dx * 0.004;
            camera.rotation.x -= dy * 0.004;
            camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
            touchLookStartX = e.changedTouches[i].clientX;
            touchLookStartY = e.changedTouches[i].clientY;
        }
    }
}, {passive:true});

const clearLookTouch = (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null;
    }
};
lookZone.addEventListener('touchend', clearLookTouch, {passive:true});
lookZone.addEventListener('touchcancel', clearLookTouch, {passive:true});

joyBase.addEventListener('touchstart', (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(joyTouchId === null) {
            joyTouchId = e.changedTouches[i].identifier;
            updateJoystickPos(e.changedTouches[i]);
            break;
        }
    }
}, {passive:true});

joyBase.addEventListener('touchmove', (e) => {
    if(!isPlaying || isHiding) return;
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === joyTouchId){
            updateJoystickPos(e.changedTouches[i]);
        }
    }
}, {passive:true});

function updateJoystickPos(touch) {
    let r = joyBase.getBoundingClientRect();
    let dx = touch.clientX - (r.left + r.width/2);
    let dy = touch.clientY - (r.top + r.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy);
    let maxDist = 40;
    if(dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyX = dx / maxDist;
    joyY = dy / maxDist;
}

const resetJoystick = (e) => {
    for(let i=0; i<e.changedTouches.length; i++){
        if(e.changedTouches[i].identifier === joyTouchId){
            joyTouchId = null;
            joyStick.style.transform = `translate(-50%, -50%)`;
            joyX = 0; joyY = 0;
        }
    }
};
joyBase.addEventListener('touchend', resetJoystick, {passive:true});
joyBase.addEventListener('touchcancel', resetJoystick, {passive:true});

// Chống kẹt nút di chuyển toàn cục
window.addEventListener('touchend', (e) => {
    let activeIds = Array.from(e.touches).map(t => t.identifier);
    if(joyTouchId !== null && !activeIds.includes(joyTouchId)) {
        joyTouchId = null;
        joyStick.style.transform = `translate(-50%, -50%)`;
        joyX = 0; joyY = 0;
    }
    if(lookTouchId !== null && !activeIds.includes(lookTouchId)) {
        lookTouchId = null;
    }
}, {passive:true});

// ==========================================
// 6. TƯƠNG TÁC THÔNG MINH
// ==========================================
function tryInteract() {
    if(!isPlaying) return;

    if (isHiding) { isHiding = false; camera.position.copy(lastPlayerPos); updateHUD(); return; }
    for(let w of wardrobes) { if (camera.position.distanceTo(w.position) < 5) { isHiding = true; lastPlayerPos.copy(camera.position); camera.position.set(w.position.x, 2, w.position.z); updateHUD(); return; } }

    for (let i=items.length-1; i>=0; i--) {
        if (camera.position.distanceTo(items[i].position) < 4) {
            let name = items[i].itemName;
            if(name === "blueKey") { inv.blueKey = true; alert("Đã nhặt: Chìa khóa Xanh Biển"); }
            if(name === "greenKey") { inv.greenKey = true; alert("Đã nhặt: Chìa khóa Xanh Lá"); }
            if(name === "yellowKey") { inv.yellowKey = true; alert("Đã nhặt: Chìa khóa Vàng"); }
            if(name === "pliers") { inv.pliers = true; alert("Đã nhặt: Kiềm cắt xích"); }
            if(name === "code") { 
                inv.code = true; alert(`Bạn đọc mảnh giấy:\n"Mật mã cửa chính là ${PASSWORD}"`); 
                exitGlowLight.intensity = 2.5; 
            }
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
        if (!inv.code) { alert("Đã cắt xích xong, nhưng cần thêm Mật Mã để mở cửa thoát!"); return; }
        
        chains.forEach(c => scene.remove(c)); chains = [];
        
        let nhap = prompt("Nhập mật mã 3 số để mở khóa thoát:");
        if (nhap === PASSWORD) endGame("BẠN ĐÃ THOÁT KHỎI NGÔI NHÀ THÀNH CÔNG!", "#00ff55");
        else if (nhap !== null) alert("Mật mã sai rồi!");
    }
}
document.getElementById('btn-action').addEventListener('touchstart', (e)=>{ e.preventDefault(); tryInteract(); }, {passive:false});
document.getElementById('btn-action').addEventListener('click', (e)=>{ tryInteract(); });
document.addEventListener('keydown', (e) => { if(e.code==='KeyE') tryInteract(); });

// ==========================================
// 7. VÒNG LẶP & AI QUÁI VẬT
// ==========================================
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate); if (!isPlaying) return;
    let delta = clock.getDelta(), time = clock.getElapsedTime();

    if (!isHiding) {
        let moveX = 0, moveZ = 0;
        if(joyY !== 0) moveZ = joyY; 
        if(joyX !== 0) moveX = joyX;
        
        if (moveX !== 0 || moveZ !== 0) {
            let velocity = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(4.5 * delta);
            let direction = velocity.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
            if (!checkCollision(camera.position.x + direction.x, camera.position.z)) camera.position.x += direction.x;
            if (!checkCollision(camera.position.x, camera.position.z + direction.z)) camera.position.z += direction.z;
        }
    }

    items.forEach(i => { i.rotation.y += delta; i.position.y = 0.5 + Math.sin(time*3)*0.08; });

    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 10 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
    let monSpeed = (monsterState === 'chase' ? 2.8 : 1.4) * delta;

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
    legL.position.z = Math.sin(time*8)*0.25; legR.position.z = -Math.sin(time*8)*0.25;

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
    updateHUD();
    camera.position.set(1*UNIT, 2, 11*UNIT);
    camera.rotation.set(0, 0, 0);
    monster.position.set(6*UNIT, 0, 5*UNIT); 
    exitGlowLight.intensity = 0;
    clock.start(); isPlaying = true;
}

function endGame(msg, col) {
    isPlaying = false; 
    document.getElementById('ui').classList.add('hidden'); 
    document.getElementById('game-over').classList.remove('hidden');
    const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
