document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// ==========================================
// 1. KHỞI TẠO MÔI TRƯỜNG 3D
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x111111, 0.05); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x444455, 0.8); scene.add(ambientLight);
const flashLight = new THREE.PointLight(0xffeedd, 1.2, 12); camera.add(flashLight);
scene.add(camera);

// Đèn tỏa sáng khi tìm thấy mật mã (Dành cho cửa thoát hiểm)
const exitGlowLight = new THREE.PointLight(0x00ff00, 0, 15); 
scene.add(exitGlowLight);

// ==========================================
// 2. TEXTURE & BẢN ĐỒ MỚI (CHIA PHÒNG THEO TIẾN TRÌNH)
// ==========================================
function createBrickTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2321'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
        for (let j = 0; j < 4; j++) {
            let offset = (i % 2) * 32;
            ctx.beginPath(); ctx.moveTo(j * 64 + offset, i * 64); ctx.lineTo(j * 64 + offset, (i + 1) * 64); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

// BẢN ĐỒ LỚN: 1: Tường, 0: Trống, 2: Thoát, 3: Cửa Biển, 4: Cửa Xanh Lá, 5: Cửa Vàng, 6: Tủ
const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,1,0,0,0,1,0,0,0,1], // Lối thoát (1,1) | Phòng Kiềm (1,4) | Phòng Mật Mã (1,8)
    [1,0,0,1,0,0,0,5,0,0,0,1], // Cửa Vàng (2,7)
    [1,1,1,1,1,0,0,1,1,1,1,1],
    [1,0,0,4,0,0,0,1,0,0,0,1], // Cửa Xanh Lá (4,3)
    [1,0,0,1,1,1,1,1,0,6,0,1],
    [1,0,0,1,0,0,0,1,0,0,0,1], // Phòng chứa chìa Xanh Lá (6,2)
    [1,1,1,1,3,0,0,1,1,0,0,1], // Cửa Biển (7,4)
    [1,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,6,0,0,0,0,1], // Phòng chứa chìa Biển (9,1)
    [1,0,0,0,0,0,0,0,0,0,0,1], // Điểm Spawn: (10,1)
    [1,1,1,1,1,1,1,1,1,1,1,1]
];

const UNIT = 5;
const walls = []; const wardrobes = []; let keyDoors = []; let exitDoor;
const wallMat = new THREE.MeshStandardMaterial({ map: createBrickTexture(), roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1a, roughness: 0.9 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 }); // Vân gỗ thực tế cho cửa

scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat).translateY(0).rotateX(-Math.PI/2).translateX(27.5).translateZ(27.5));
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60, 60), ceilMat).translateY(5).rotateX(Math.PI/2).translateX(27.5).translateZ(27.5));

// HÀM TẠO CỬA CÓ Ổ KHÓA MÀU
function createRealDoor(lockHexColor) {
    const group = new THREE.Group();
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.5), woodMat);
    doorBody.position.y = UNIT/2;
    const lockMat = new THREE.MeshStandardMaterial({ color: lockHexColor, metalness: 0.5, emissive: lockHexColor, emissiveIntensity: 0.2 });
    const lock1 = new THREE.Mesh(new THREE.SphereGeometry(0.2), lockMat); lock1.position.set(UNIT*0.3, UNIT*0.5, UNIT*0.25);
    const lock2 = new THREE.Mesh(new THREE.SphereGeometry(0.2), lockMat); lock2.position.set(-UNIT*0.3, UNIT*0.5, -UNIT*0.25);
    group.add(doorBody, lock1, lock2);
    return group;
}

// HÀM TẠO CỬA THOÁT HIỂM BỊ XÍCH
let chains = [];
function createExitDoor() {
    const group = new THREE.Group();
    const doorBody = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT*0.5), woodMat); doorBody.position.y = UNIT/2;
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1 });
    const chain1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.1), chainMat); chain1.position.y = UNIT/2; chain1.rotation.z = Math.PI/4;
    const chain2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.1), chainMat); chain2.position.y = UNIT/2; chain2.rotation.z = -Math.PI/4;
    chains.push(chain1, chain2);
    group.add(doorBody, chain1, chain2);
    return group;
}

for (let z = 0; z < 12; z++) {
    for (let x = 0; x < 12; x++) {
        let pX = x * UNIT, pZ = z * UNIT;
        if (mapGrid[z][x] === 1) {
            let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); w.position.set(pX, UNIT/2, pZ); scene.add(w); walls.push(w);
        } else if (mapGrid[z][x] === 2) {
            exitDoor = createExitDoor(); exitDoor.position.set(pX, 0, pZ); scene.add(exitDoor);
            exitGlowLight.position.set(pX, UNIT/2, pZ + 2); // Đặt đèn trước cửa thoát hiểm
        } else if (mapGrid[z][x] >= 3 && mapGrid[z][x] <= 5) {
            let color = mapGrid[z][x]===3 ? 0x0055ff : (mapGrid[z][x]===4 ? 0x00ff00 : 0xffff00);
            let d = createRealDoor(color); d.position.set(pX, 0, pZ); d.reqCode = mapGrid[z][x]; d.gridX = x; d.gridZ = z;
            scene.add(d); keyDoors.push(d);
        } else if (mapGrid[z][x] === 6) {
            let ward = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.8, UNIT, UNIT*0.8), woodMat); ward.position.set(pX, UNIT/2, pZ);
            scene.add(ward); wardrobes.push(ward);
        }
    }
}

// ==========================================
// 3. VẬT PHẨM (CHÌA, KIỀM, GIẤY)
// ==========================================
const items = [];
function createKeyItem(hexColor, name, gridX, gridZ) {
    const kG = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hexColor, metalness: 0.8, emissive: hexColor, emissiveIntensity: 0.3 });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), mat); s.rotation.z = Math.PI/2;
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), mat); h.position.x = -0.3;
    kG.add(s, h); kG.position.set(gridX * UNIT, 0.5, gridZ * UNIT);
    kG.itemName = name; scene.add(kG); items.push(kG);
}

// Tạo cái kiềm (Pliers)
const plierGroup = new THREE.Group();
const mMat = new THREE.MeshStandardMaterial({color: 0x888888, metalness: 0.9});
const rMat = new THREE.MeshStandardMaterial({color: 0xcc0000});
const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), rMat); p1.position.set(-0.05, -0.2, 0); p1.rotation.z = 0.2;
const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), rMat); p2.position.set(0.05, -0.2, 0); p2.rotation.z = -0.2;
const hl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), mMat); hl1.position.set(0.05, 0.15, 0); hl1.rotation.z = 0.2;
const hl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), mMat); hl2.position.set(-0.05, 0.15, 0); hl2.rotation.z = -0.2;
plierGroup.add(p1, p2, hl1, hl2);
plierGroup.position.set(4 * UNIT, 0.5, 1 * UNIT); // Đặt trong phòng kiềm
plierGroup.itemName = "pliers"; scene.add(plierGroup); items.push(plierGroup);

// Tạo mật mã
const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({color: 0xffffff}));
paper.rotation.x = -Math.PI/2; paper.position.set(8 * UNIT, 0.1, 1 * UNIT); // Phòng cuối
paper.itemName = "code"; scene.add(paper); items.push(paper);

// Đặt chìa khóa theo tiến trình
createKeyItem(0x0055ff, "blueKey", 1, 9); // Gần điểm spawn
createKeyItem(0x00ff00, "greenKey", 2, 6); // Sau cửa biển
createKeyItem(0xffff00, "yellowKey", 5, 1); // Cùng phòng với kiềm

const PASSWORD = "924";

// ==========================================
// 4. QUÁI VẬT AI
// ==========================================
const monster = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x220505, roughness: 1 });
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
// 5. ĐIỀU KHIỂN & HỆ THỐNG KHO ĐỒ
// ==========================================
let inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false };
let isHiding = false; let lastPlayerPos = new THREE.Vector3(); let isPlaying = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3(), direction = new THREE.Vector3();

function checkCollision(x, z) {
    let gX = Math.round(x / UNIT), gZ = Math.round(z / UNIT);
    if (gX<0 || gX>11 || gZ<0 || gZ>11) return true;
    let b = mapGrid[gZ][gX]; return b===1 || b===2 || b===3 || b===4 || b===5 || b===6;
}

function updateHUD() {
    let keys = [];
    if(inv.blueKey) keys.push("🔵 Biển"); if(inv.greenKey) keys.push("🟢 Xanh Lá"); if(inv.yellowKey) keys.push("🟡 Vàng");
    document.getElementById('inv-keys').innerText = keys.length > 0 ? keys.join(" | ") : "Chưa có";
    document.getElementById('inv-tools').innerText = inv.pliers ? "✂️ Kiềm cắt xích" : "Trống";
    document.getElementById('inv-code').innerText = inv.code ? PASSWORD : "???";
    
    if(isHiding) {
        document.getElementById('info').innerHTML = "👀 ĐANG TRỐN TRONG TỦ<br><span style='color:#ccc'>Bấm LẤY để chui ra</span>";
    } else {
        // Reset HTML
        document.getElementById('info').innerHTML = `🎒 Khóa: <span id="inv-keys">${keys.length > 0 ? keys.join(" | ") : "Chưa có"}</span> <br>🛠 Dụng cụ: <span id="inv-tools">${inv.pliers ? "✂️ Kiềm" : "Trống"}</span> <br>📜 Mật mã: <span id="inv-code">${inv.code ? PASSWORD : "???"}</span>`;
    }
}

// -- TOUCH CONTROL (GIỮ NGUYÊN BẢN CHUẨN) --
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) document.getElementById('joystick-base').style.display = 'block';
let lookTouchId = null, joyTouchId = null, touchLookStartX = 0, touchLookStartY = 0, joyX = 0, joyY = 0;
const lookZone = document.getElementById('touch-look-zone'); const joyBase = document.getElementById('joystick-base'); const joyStick = document.getElementById('joystick-stick');

lookZone.addEventListener('touchstart', (e) => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(lookTouchId===null){ lookTouchId=e.changedTouches[i].identifier; touchLookStartX=e.changedTouches[i].clientX; touchLookStartY=e.changedTouches[i].clientY; break; } } }, {passive:false});
lookZone.addEventListener('touchmove', (e) => { e.preventDefault(); if(!isPlaying||isHiding) return; for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===lookTouchId){ let dx=e.changedTouches[i].clientX-touchLookStartX; let dy=e.changedTouches[i].clientY-touchLookStartY; camera.rotation.y-=dx*0.004; camera.rotation.x-=dy*0.004; camera.rotation.x=Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x)); touchLookStartX=e.changedTouches[i].clientX; touchLookStartY=e.changedTouches[i].clientY; } } }, {passive:false});
lookZone.addEventListener('touchend', (e) => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===lookTouchId) lookTouchId=null; } }, {passive:false});

joyBase.addEventListener('touchstart', (e) => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(joyTouchId===null){ joyTouchId=e.changedTouches[i].identifier; break; } } }, {passive:false});
joyBase.addEventListener('touchmove', (e) => { e.preventDefault(); if(!isPlaying||isHiding) return; for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===joyTouchId){ let r=joyBase.getBoundingClientRect(); let dx=e.changedTouches[i].clientX-(r.left+r.width/2); let dy=e.changedTouches[i].clientY-(r.top+r.height/2); let dist=Math.sqrt(dx*dx+dy*dy); if(dist>35){dx=(dx/dist)*35;dy=(dy/dist)*35;} joyStick.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; joyX=dx/35; joyY=dy/35; } } }, {passive:false});
const resetJoy = (e) => { e.preventDefault(); for(let i=0;i<e.changedTouches.length;i++){ if(e.changedTouches[i].identifier===joyTouchId){ joyTouchId=null; joyStick.style.transform=`translate(-50%, -50%)`; joyX=0; joyY=0; } } };
joyBase.addEventListener('touchend', resetJoy, {passive:false}); joyBase.addEventListener('touchcancel', resetJoy, {passive:false});

// ==========================================
// 6. TƯƠNG TÁC THÔNG MINH
// ==========================================
function tryInteract() {
    if(!isPlaying) return;

    if (isHiding) { isHiding = false; camera.position.copy(lastPlayerPos); updateHUD(); return; }
    for(let w of wardrobes) { if (camera.position.distanceTo(w.position) < 5) { isHiding = true; lastPlayerPos.copy(camera.position); camera.position.set(w.position.x, 2, w.position.z); updateHUD(); return; } }

    // Nhặt đồ
    for (let i=items.length-1; i>=0; i--) {
        if (camera.position.distanceTo(items[i].position) < 4) {
            let name = items[i].itemName;
            if(name === "blueKey") { inv.blueKey = true; alert("Đã nhặt: Chìa khóa Xanh Biển"); }
            if(name === "greenKey") { inv.greenKey = true; alert("Đã nhặt: Chìa khóa Xanh Lá"); }
            if(name === "yellowKey") { inv.yellowKey = true; alert("Đã nhặt: Chìa khóa Vàng"); }
            if(name === "pliers") { inv.pliers = true; alert("Đã nhặt: Kiềm cắt xích"); }
            if(name === "code") { 
                inv.code = true; alert(`Bạn đọc mảnh giấy:\n"Mật mã cửa chính là ${PASSWORD}"`); 
                exitGlowLight.intensity = 2; // Bật đèn sáng cửa ra
            }
            scene.remove(items[i]); items.splice(i, 1); updateHUD(); return;
        }
    }

    // Mở Cửa Màu
    for (let i = keyDoors.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(keyDoors[i].position) < 5) {
            let req = keyDoors[i].reqCode;
            if ((req===3 && inv.blueKey) || (req===4 && inv.greenKey) || (req===5 && inv.yellowKey)) {
                scene.remove(keyDoors[i]); mapGrid[keyDoors[i].gridZ][keyDoors[i].gridX] = 0; keyDoors.splice(i, 1);
                // Dùng xong thì làm mất khóa (Tùy chọn)
                if(req===3) inv.blueKey = false; if(req===4) inv.greenKey = false; if(req===5) inv.yellowKey = false;
                updateHUD();
            } else { 
                let cName = req===3 ? "Xanh Biển" : (req===4 ? "Xanh Lá" : "Vàng");
                alert(`Cửa bị khóa! Cần tìm đúng Chìa khóa màu ${cName}.`); 
            }
            return;
        }
    }

    // Cửa thoát hiểm (Cần Kiềm + Mật Mã)
    if (camera.position.distanceTo(exitDoor.position) < 5) {
        if (!inv.pliers) { alert("Cửa bị quấn xích dày đặc! Bạn cần tìm một cái KIỀM để cắt nó."); return; }
        if (!inv.code) { alert("Bạn đã cắt được xích, nhưng cần thêm Mật Mã để mở cửa thoát!"); return; }
        
        // Nếu đủ cả kiềm và mật mã: Gỡ xích
        chains.forEach(c => scene.remove(c)); chains = [];
        
        let nhap = prompt("Cửa đã gỡ xích. Nhập mật mã 3 số:");
        if (nhap === PASSWORD) endGame("BẠN ĐÃ THOÁT KHỎI NGÔI NHÀ!", "#00ff00");
        else if (nhap !== null) alert("Mật mã sai, cửa không mở!");
    }
}
document.getElementById('btn-action').addEventListener('touchstart', (e)=>{e.preventDefault();tryInteract();}, {passive:false});
document.addEventListener('keydown', (e) => { if(e.code==='KeyE') tryInteract(); });


// ==========================================
// 7. VÒNG LẶP & AI QUÁI VẬT
// ==========================================
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate); if (!isPlaying) return;
    let delta = clock.getDelta(), time = clock.getElapsedTime();

    if (!isHiding) {
        velocity.set(0,0,0);
        if(joyY!==0) velocity.z=joyY; if(joyX!==0) velocity.x=joyX;
        velocity.normalize().multiplyScalar(4.5 * delta);
        direction.copy(velocity).applyEuler(new THREE.Euler(0, camera.rotation.y, 0));
        if (!checkCollision(camera.position.x+direction.x, camera.position.z)) camera.position.x += direction.x;
        if (!checkCollision(camera.position.x, camera.position.z+direction.z)) camera.position.z += direction.z;
    }

    items.forEach(i => { i.rotation.y += delta; i.position.y = 0.5 + Math.sin(time*3)*0.1; }); // Lắc lư đồ vật

    const distToPlayer = monster.position.distanceTo(camera.position);
    if (distToPlayer < 10 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
    let monSpeed = (monsterState === 'chase' ? 3.0 : 1.5) * delta;

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
    document.getElementById('start-screen').classList.add('hidden'); document.getElementById('game-over').classList.add('hidden'); document.getElementById('ui').classList.remove('hidden');
    inv = { blueKey: false, greenKey: false, yellowKey: false, pliers: false, code: false }; updateHUD();
    camera.position.set(1*UNIT, 2, 10*UNIT); camera.rotation.set(0, 0, 0); // Spawn dưới cùng
    monster.position.set(8*UNIT, 0, 5*UNIT); exitGlowLight.intensity = 0;
    clock.start(); isPlaying = true;
}
function endGame(msg, col) {
    isPlaying = false; document.getElementById('ui').classList.add('hidden'); document.getElementById('game-over').classList.remove('hidden');
    const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
}
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
