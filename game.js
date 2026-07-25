window.onload = function() {

    const screens = document.querySelectorAll('.screen');
    function showMenu(id) {
        screens.forEach(el => el.classList.add('hidden'));
        if (id) document.getElementById(id).classList.remove('hidden');
    }

    document.getElementById('btn-play').addEventListener('click', startGame);
    document.getElementById('btn-controls').addEventListener('click', () => showMenu('controls-screen'));
    document.getElementById('btn-settings').addEventListener('click', () => showMenu('settings-screen'));
    document.getElementById('btn-back-controls').addEventListener('click', () => showMenu('start-screen'));
    document.getElementById('btn-back-settings').addEventListener('click', () => showMenu('start-screen'));
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
        document.getElementById('joystick-base').style.display = 'block';
        document.getElementById('touch-look-zone').style.display = 'block';
        document.getElementById('btn-action').style.display = 'flex';
        document.getElementById('btn-flashlight').style.display = 'flex';
    }

    let toastTimeout;
    function showToast(msg, color="#fff") {
        const toast = document.getElementById('toast-msg');
        toast.innerHTML = msg; toast.style.color = color; toast.classList.remove('hidden');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x050508, 0.04); 

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.rotation.order = "YXZ"; 

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x2a2a35, 1.5); 
    scene.add(ambientLight);

    const flashLight = new THREE.SpotLight(0xfff5e6, 3.0, 45, Math.PI / 2.8, 0.5, 1);
    flashLight.position.set(0, 0, 0); 
    flashLight.castShadow = true;
    flashLight.shadow.mapSize.width = 512; 
    flashLight.shadow.mapSize.height = 512;
    camera.add(flashLight); 
    scene.add(camera);
    const flashTarget = new THREE.Object3D(); 
    flashTarget.position.set(0, 0, -1);
    camera.add(flashTarget); 
    flashLight.target = flashTarget;

    let isFlashlightOn = true;
    function toggleFlashlight() {
        if (!isPlaying) return;
        isFlashlightOn = !isFlashlightOn;
        flashLight.visible = isFlashlightOn;
        const btn = document.getElementById('btn-flashlight');
        if(isFlashlightOn) { btn.classList.add('on'); showToast("BẬT Đèn pin", "#ffff00"); }
        else { btn.classList.remove('on'); showToast("TẮT Đèn pin", "#aaaaaa"); }
    }
    document.getElementById('btn-flashlight').addEventListener('touchstart', (e)=>{ e.preventDefault(); toggleFlashlight(); }, {passive:false});
    document.getElementById('btn-flashlight').addEventListener('click', toggleFlashlight);

    function createTexture(baseColor, type='brick') {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = baseColor; ctx.fillRect(0, 0, 256, 256);
        if(type==='brick') {
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 3;
            for (let i=0; i<4; i++) {
                ctx.beginPath(); ctx.moveTo(0, i*64); ctx.lineTo(256, i*64); ctx.stroke();
                for (let j=0; j<4; j++) {
                    let offset = (i%2)*32;
                    ctx.beginPath(); ctx.moveTo(j*64+offset, i*64); ctx.lineTo(j*64+offset, (i+1)*64); ctx.stroke();
                }
            }
        } else if(type==='wood') {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for (let i = 0; i < 250; i++) { ctx.fillRect(Math.random()*256, 0, Math.random()*3+1, 256); }
        }
        const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
    }

    const wallMat = new THREE.MeshLambertMaterial({ map: createTexture('#252525', 'brick') });
    const floorMat = new THREE.MeshLambertMaterial({ map: createTexture('#111111', 'brick') }); 
    floorMat.map.repeat.set(20, 20);
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
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

    const UNIT = 5; 
    let raycastTargets = []; 

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI/2; floor.position.set(35, 0, 35); floor.receiveShadow = true; scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), ceilMat);
    ceil.rotation.x = Math.PI/2; ceil.position.set(35, UNIT, 35); scene.add(ceil);

    function getRotationBasedOnWalls(x, z) {
        if(mapGrid[z] && mapGrid[z][x-1]===1 && mapGrid[z][x+1]===1) return 0; 
        if(mapGrid[z-1] && mapGrid[z-1][x]===1 && mapGrid[z+1] && mapGrid[z+1][x]===1) return Math.PI/2; 
        return 0; 
    }

    for (let z = 0; z < mapGrid.length; z++) {
        for (let x = 0; x < mapGrid[z].length; x++) {
            let pX = x * UNIT, pZ = z * UNIT;
            let val = mapGrid[z][x];
            
            if (val === 1) { 
                let w = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), wallMat); 
                w.position.set(pX, UNIT/2, pZ); w.castShadow = true; w.receiveShadow = true;
                w.userData = { isWall: true }; 
                scene.add(w); raycastTargets.push(w);
            } 
            else if (val >= 2 && val <= 6) { 
                const group = new THREE.Group();
                group.position.set(pX, 0, pZ);
                group.rotation.y = getRotationBasedOnWalls(x, z);

                if (val === 6) { 
                    group.userData = { type: 'wardrobe', pos: new THREE.Vector3(pX, 2, pZ), isItem: true };
                    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.9, UNIT*1.2, UNIT*0.8), woodMat);
                    body.position.y = UNIT*0.6; body.castShadow = true;
                    const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, UNIT*1.15, UNIT*0.85), new THREE.MeshBasicMaterial({ color: 0x050505 })); 
                    line.position.y = UNIT*0.6; 
                    const hMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
                    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), hMat); h1.position.set(-0.2, UNIT*0.6, UNIT*0.4);
                    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), hMat); h2.position.set(0.2, UNIT*0.6, UNIT*0.4);
                    group.add(body, line, h1, h2);
                } 
                else if (val === 2) { 
                    group.userData = { type: 'exit', hasChains: true, isItem: true };
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })); frame.position.y = UNIT/2;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.85, UNIT*0.9, UNIT*0.55), new THREE.MeshLambertMaterial({ color: 0x222222 })); body.position.y = UNIT/2;
                    const cMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
                    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c1.position.set(0, UNIT/2, UNIT*0.3); c1.rotation.z = Math.PI/4;
                    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, UNIT*1.2), cMat); c2.position.set(0, UNIT/2, UNIT*0.3); c2.rotation.z = -Math.PI/4;
                    group.chains = [c1, c2]; group.add(frame, body, c1, c2);
                }
                else { 
                    let hexColor = val===3 ? 0x0088ff : (val===4 ? 0x00ff44 : 0xffbb00);
                    group.userData = { type: 'door', reqCode: val, gridX: x, gridZ: z, isItem: true };
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(UNIT*1.05, UNIT, UNIT*0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })); frame.position.y = UNIT/2; 
                    const body = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.85, UNIT*0.9, UNIT*0.55), woodMat); body.position.y = UNIT/2;
                    const pMat = new THREE.MeshBasicMaterial({ color: hexColor });
                    const p1 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), pMat); p1.position.y = UNIT*0.7;
                    const p2 = new THREE.Mesh(new THREE.BoxGeometry(UNIT*0.6, UNIT*0.3, UNIT*0.6), pMat); p2.position.y = UNIT*0.3;
                    group.add(frame, body, p1, p2);
                }

                const hitBox = new THREE.Mesh(new THREE.BoxGeometry(UNIT, UNIT, UNIT), new THREE.MeshBasicMaterial({visible:false}));
                hitBox.position.y = UNIT/2; hitBox.parentObj = group; group.add(hitBox);
                scene.add(group); raycastTargets.push(hitBox);
            }
        }
    }

    // TẢI ẢNH KEY.PNG ĐỂ BIẾN THÀNH 3D VÀ ĐỔI MÀU
    const textureLoader = new THREE.TextureLoader();

    function spawnItem(gX, gZ, type, name, color=0xffffff) {
        const group = new THREE.Group();
        group.userData = { type: 'item', itemType: type, name: name, reqCode: (name==='blueKey'?3:(name==='greenKey'?4:(name==='yellowKey'?5:0))), isItem: true };
        
        if (type === 'key') {
            group.icon = (color===0x0088ff?'🔵':(color===0x00ff44?'🟢':'🟡'));
            group.savedColor = color;

            const keyGeo = new THREE.PlaneGeometry(1.5, 1.5);
            
            // Load key.png và tự động đổi màu theo chỉ định (Xanh dương, Xanh lá, Vàng)
            textureLoader.load('key.png', (texture) => {
                const keyMat = new THREE.MeshLambertMaterial({ 
                    map: texture, 
                    transparent: true, 
                    alphaTest: 0.2, 
                    side: THREE.DoubleSide,
                    color: color // Tự động đổi màu chìa khóa 3D
                });
                const keyMesh = new THREE.Mesh(keyGeo, keyMat);
                keyMesh.castShadow = true;
                group.add(keyMesh);
            }, undefined, () => {
                // Fallback nếu chưa có file key.png
                const fallbackMat = new THREE.MeshBasicMaterial({ color: color });
                const fallbackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), fallbackMat);
                group.add(fallbackMesh);
            });

        } else if (type === 'pliers') {
            const rMat = new THREE.MeshBasicMaterial({color: 0xcc2222});
            const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p1.position.set(-0.08, 0, 0); p1.rotation.z = 0.2; p1.castShadow = true;
            const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), rMat); p2.position.set(0.08, 0, 0); p2.rotation.z = -0.2; p2.castShadow = true;
            group.add(p1, p2); group.icon = '✂️';
        } else if (type === 'code') {
            const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), new THREE.MeshBasicMaterial({color: 0xffffee}));
            paper.rotation.x = -Math.PI/2; paper.position.y = -0.4; group.add(paper); group.icon = '📝';
        }
        
        group.position.set(gX * UNIT, 0.5, gZ * UNIT);
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.parentObj = group; group.add(hitBox);
        scene.add(group); raycastTargets.push(hitBox);
    }

    spawnItem(3, 11, 'key', 'blueKey', 0x0088ff);  
    spawnItem(1, 3, 'key', 'greenKey', 0x00ff44);   
    spawnItem(13, 11, 'key', 'yellowKey', 0xffbb00); 
    spawnItem(13, 4, 'pliers', 'pliers');
    spawnItem(12, 13, 'code', 'code'); 
    const PASSWORD = "583"; let hasCode = false;

    let inventory = [null, null, null]; let activeSlot = 0; 
    function selectSlot(index) {
        activeSlot = index;
        document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('active'));
        document.getElementById(`slot-${index}`).classList.add('active');
    }
    document.getElementById('slot-0').addEventListener('click', () => selectSlot(0));
    document.getElementById('slot-1').addEventListener('click', () => selectSlot(1));
    document.getElementById('slot-2').addEventListener('click', () => selectSlot(2));

    function updateUI() {
        for(let i=0; i<3; i++) {
            let el = document.getElementById(`slot-${i}`);
            el.innerHTML = inventory[i] ? inventory[i].icon : '';
        }
    }

    const monster = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x150303 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), skinMat); mBody.position.y = 3.5; mBody.castShadow = true;
    const mEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye1.position.set(-0.3, 3.6, 0.6);
    const mEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), eyeMat); mEye2.position.set(0.3, 3.6, 0.6);
    const mTors = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 2.5), skinMat); mTors.position.y = 1.8; mTors.castShadow = true;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legL.position.set(-0.3, 0.9, 0); legL.castShadow = true;
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8), skinMat); legR.position.set(0.3, 0.9, 0); legR.castShadow = true;
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2), skinMat); armL.position.set(-0.8, 2.5, 0); armL.castShadow = true;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2), skinMat); armR.position.set(0.8, 2.5, 0); armR.castShadow = true;
    monster.add(mBody, mEye1, mEye2, mTors, legL, legR, armL, armR); 
    scene.add(monster);
    let monDirX = 1, monDirZ = 0, monsterState = 'patrol'; 

    let isHiding = false, isPlaying = false, lastPlayerPos = new THREE.Vector3();
    let joyX = 0, joyY = 0; let keysPressed = { w: false, a: false, s: false, d: false };
    
    function resetInputs() {
        keysPressed.w=false; keysPressed.a=false; keysPressed.s=false; keysPressed.d=false;
        joyX = 0; joyY = 0; document.getElementById('joystick-stick').style.transform = `translate(-50%, -50%)`;
    }
    window.addEventListener('blur', resetInputs);

    window.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') keysPressed.w = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keysPressed.s = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysPressed.a = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keysPressed.d = true;
        if (e.code === 'KeyE') tryInteract();
        if (e.code === 'KeyF') toggleFlashlight();
        if (e.code === 'Digit1') selectSlot(0);
        if (e.code === 'Digit2') selectSlot(1);
        if (e.code === 'Digit3') selectSlot(2);
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') keysPressed.w = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keysPressed.s = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keysPressed.a = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keysPressed.d = false;
    });

    renderer.domElement.addEventListener('click', () => {
        if (isPlaying && !isMobile && document.pointerLockElement !== renderer.domElement) {
            renderer.domElement.requestPointerLock();
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (!isPlaying || isHiding || document.pointerLockElement !== renderer.domElement) return;
        camera.rotation.y -= e.movementX * 0.003; 
        camera.rotation.x -= e.movementY * 0.003;
        camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
    });

    let lookTouchId = null, joyTouchId = null, tStartX = 0, tStartY = 0;
    const lookZone = document.getElementById('touch-look-zone'), joyBase = document.getElementById('joystick-base'), joyStick = document.getElementById('joystick-stick');
    
    lookZone.addEventListener('touchstart', (e) => { for(let i=0; i<e.changedTouches.length; i++) { if(lookTouchId === null) { lookTouchId = e.changedTouches[i].identifier; tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY; break; } } }, {passive:true});
    lookZone.addEventListener('touchmove', (e) => { if(!isPlaying || isHiding) return; for(let i=0; i<e.changedTouches.length; i++) { if(e.changedTouches[i].identifier === lookTouchId) { let dx = e.changedTouches[i].clientX - tStartX, dy = e.changedTouches[i].clientY - tStartY; camera.rotation.y -= dx * 0.006; camera.rotation.x -= dy * 0.006; camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x)); tStartX = e.changedTouches[i].clientX; tStartY = e.changedTouches[i].clientY; } } }, {passive:true});
    const clearLookTouch = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === lookTouchId) lookTouchId = null; } };
    lookZone.addEventListener('touchend', clearLookTouch); lookZone.addEventListener('touchcancel', clearLookTouch);

    joyBase.addEventListener('touchstart', (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(joyTouchId === null) { joyTouchId = e.changedTouches[i].identifier; updateJoy(e.changedTouches[i]); break; } } }, {passive:true});
    joyBase.addEventListener('touchmove', (e) => { if(!isPlaying || isHiding) return; for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId) updateJoy(e.changedTouches[i]); } }, {passive:true});
    function updateJoy(touch) { let r = joyBase.getBoundingClientRect(), dx = touch.clientX - (r.left + r.width/2), dy = touch.clientY - (r.top + r.height/2); let dist = Math.sqrt(dx*dx + dy*dy), max = 40; if(dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; } joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; joyX = dx / max; joyY = dy / max; }
    const clearJoyTouch = (e) => { for(let i=0; i<e.changedTouches.length; i++){ if(e.changedTouches[i].identifier === joyTouchId){ joyTouchId = null; joyStick.style.transform = `translate(-50%, -50%)`; joyX = 0; joyY = 0; } } };
    joyBase.addEventListener('touchend', clearJoyTouch); joyBase.addEventListener('touchcancel', clearJoyTouch);

    const raycaster = new THREE.Raycaster();

    function tryInteract() {
        if(!isPlaying) return;
        if (isHiding) { isHiding = false; camera.position.copy(lastPlayerPos); resetInputs(); return; }
        resetInputs();

        raycaster.setFromCamera({x: 0, y: 0}, camera);
        const intersects = raycaster.intersectObjects(raycastTargets, false);

        if (intersects.length > 0 && intersects[0].distance < 6) {
            let hitObj = intersects[0].object;
            if (hitObj.userData && hitObj.userData.isWall) { showToast("Bị vướng tường!", "#aaa"); return; }
            if (!hitObj.parentObj) return; 
            
            let mainGroup = hitObj.parentObj; let data = mainGroup.userData;

            if (data.type === 'item') {
                if (data.name === 'code') { hasCode = true; showToast(`Đã đọc mật mã: ${PASSWORD}`, "#ffff00"); return; }
                if (inventory[activeSlot] !== null) { let old = inventory[activeSlot]; spawnItem(camera.position.x/UNIT, camera.position.z/UNIT, old.itemType, old.name, old.savedColor); }
                inventory[activeSlot] = { name: data.name, itemType: data.itemType, reqCode: data.reqCode, icon: mainGroup.icon, savedColor: mainGroup.savedColor };
                scene.remove(mainGroup); raycastTargets = raycastTargets.filter(o => o.parentObj !== mainGroup);
                showToast(`Nhặt được vào ô ${activeSlot+1}!`, "#00ff00"); updateUI();
            } 
            else if (data.type === 'door') {
                let req = data.reqCode, currentItem = inventory[activeSlot];
                if (currentItem && currentItem.reqCode === req) {
                    scene.remove(mainGroup); mapGrid[data.gridZ][data.gridX] = 0; raycastTargets = raycastTargets.filter(o => o.parentObj !== mainGroup);
                    inventory[activeSlot] = null; showToast("Đã mở khóa cửa!", "#00ff00"); updateUI();
                } else { showToast("Cửa khóa! Cầm đúng chìa vào ô đang chọn.", "#ff3333"); }
            } 
            else if (data.type === 'wardrobe') {
                isHiding = true; lastPlayerPos.copy(camera.position); camera.position.copy(data.pos);
            } 
            else if (data.type === 'exit') {
                let currentItem = inventory[activeSlot];
                if (data.hasChains) {
                    if (currentItem && currentItem.name === 'pliers') {
                        mainGroup.chains.forEach(c => scene.remove(c)); data.hasChains = false; inventory[activeSlot] = null; updateUI(); showToast("Cắt xích xong! Hãy nhập mật mã.", "#00ff00");
                    } else { showToast("Cửa xích! Cầm KIỀM trên tay để cắt.", "#ff3333"); }
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

    function checkCollision(x, z) {
        let gX = Math.round(x / UNIT), gZ = Math.round(z / UNIT);
        if (gX<0 || gX>=mapGrid[0].length || gZ<0 || gZ>=mapGrid.length) return true;
        let b = mapGrid[gZ][gX]; return b===1 || b===2 || b===3 || b===4 || b===5 || b===6;
    }

    const clock = new THREE.Clock(); let footstep = 0;

    function animate() {
        requestAnimationFrame(animate); 
        if (!isPlaying) return;
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
                
                footstep += delta * 12; camera.position.y = 2 + Math.sin(footstep) * 0.1; 
                flashLight.position.x = Math.cos(footstep) * 0.1; 
            } else {
                camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2, 0.1);
                flashLight.position.x = THREE.MathUtils.lerp(flashLight.position.x, 0, 0.1);
            }
        }

        // Hiệu ứng vật phẩm 3D xoay tròn và bay lơ lửng
        raycastTargets.forEach(hitBox => {
            if (hitBox.parentObj && hitBox.parentObj.userData.type === 'item') {
                hitBox.parentObj.rotation.y += delta * 1.5; 
                hitBox.parentObj.position.y = 0.5 + Math.sin(time*4)*0.1;
            }
        });

        const distToPlayer = monster.position.distanceTo(camera.position);
        if (distToPlayer < 12 && !isHiding) monsterState = 'chase'; else monsterState = 'patrol';
        let monSpeed = (monsterState === 'chase' ? 4.2 : 1.8) * delta; 

        if (monsterState === 'chase') {
            monster.lookAt(camera.position.x, 0, camera.position.z);
            const mD = new THREE.Vector3().subVectors(camera.position, monster.position).normalize();
            if(!checkCollision(monster.position.x+mD.x*monSpeed, monster.position.z)) monster.position.x+=mD.x*monSpeed;
            if(!checkCollision(monster.position.x, monster.position.z+mD.z*monSpeed)) monster.position.z+=mD.z*monSpeed;
            
            mBody.position.y = 3.5 + Math.sin(time * 30) * 0.15; mTors.rotation.x = 0.3; armL.rotation.x = Math.sin(time * 15); armR.rotation.x = -Math.sin(time * 15);
            mEye1.material.color.setHex(0xff0000); mEye2.material.color.setHex(0xff0000); 
            if (distToPlayer < 1.4) endGame("QUÁI VẬT ĐÃ TÓM ĐƯỢC BẠN!", "#ff0000");
        } else {
            let nX = monster.position.x + monDirX*monSpeed, nZ = monster.position.z + monDirZ*monSpeed;
            if (checkCollision(nX, nZ)) {
                let r = Math.floor(Math.random()*4), dirs = [[1,0],[-1,0],[0,1],[0,-1]]; monDirX=dirs[r][0]; monDirZ=dirs[r][1];
            } else {
                monster.position.x=nX; monster.position.z=nZ; monster.rotation.y = Math.atan2(monDirX, monDirZ);
            }
            mBody.position.y = 3.5; mTors.rotation.x = 0; armL.rotation.x = 0; armR.rotation.x = 0;
            mEye1.material.color.setHex(0xaa0000); mEye2.material.color.setHex(0xaa0000); 
        }
        
        let speedMult = monsterState === 'chase' ? 18 : 8;
        legL.position.z = Math.sin(time*speedMult)*0.3; legR.position.z = -Math.sin(time*speedMult)*0.3;

        let showP = false;
        if(!isHiding) {
            raycaster.setFromCamera({x: 0, y: 0}, camera);
            let inters = raycaster.intersectObjects(raycastTargets, false);
            if (inters.length > 0 && inters[0].distance < 6 && !inters[0].object.userData.isWall) showP = true;
        }
        document.getElementById('prompt').style.display = showP ? 'block' : 'none';
        
        renderer.render(scene, camera);
    }

    function startGame() {
        showMenu(null); document.getElementById('ui').classList.remove('hidden');
        inventory = [null, null, null]; activeSlot = 0; hasCode = false; selectSlot(0); updateUI(); resetInputs();
        
        isFlashlightOn = true;
        flashLight.visible = true;
        document.getElementById('btn-flashlight').classList.add('on');
        
        camera.position.set(1*UNIT, 2, 13*UNIT); camera.rotation.set(0, 0, 0);
        monster.position.set(7*UNIT, 0, 7*UNIT); 
        clock.start(); isPlaying = true;
    }

    function endGame(msg, col) {
        isPlaying = false; resetInputs(); if (document.pointerLockElement) document.exitPointerLock();
        document.getElementById('ui').classList.add('hidden'); showMenu('game-over');
        const t = document.getElementById('end-title'); t.innerText = msg; t.style.color = col;
    }

    window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    animate();
};
