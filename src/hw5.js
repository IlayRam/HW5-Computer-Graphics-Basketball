/**
Noam Shildekraut
Ilay Ram
 */

import { OrbitControls } from './OrbitControls.js';

// === Scene & Renderer ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

toResize(); window.addEventListener('resize', toResize);
function toResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// === Lighting ===
function initLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 15);
  dir.castShadow = true;
  scene.add(dir);

  const point = new THREE.PointLight(0xffffff, 0.5, 50);
  point.position.set(0, 10, 0);
  scene.add(point);
}

// === Court Base ===
function constructCourt() {
  const loader = new THREE.TextureLoader();
  const wood = loader.load('src/img/court.jpg');
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.2, 15),
    new THREE.MeshPhongMaterial({ map: wood, shininess: 100 })
  );
  floor.receiveShadow = true;
  scene.add(floor);
}

// === Court Markings (fixed orientation) ===
function drawCourtLines() {
  const lineColor     = 0xffffff;
  const lineHeight    = 0.01;
  const lineY         = 0.11;
  const lineThickness = 0.08;
  const matBasic      = new THREE.MeshBasicMaterial({ color: lineColor });

  // — Center line —
  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(lineThickness, lineHeight, 15),
    matBasic
  );
  centerLine.position.set(0, lineY, 0);
  scene.add(centerLine);

  // — Center circle —
  const centerCircle = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, lineThickness / 2, 8, 100),
    matBasic
  );
  centerCircle.rotation.x = Math.PI / 2;
  centerCircle.position.set(0, lineY, 0);
  scene.add(centerCircle);

  // — Tube-arc helper —
  function makeArcMesh(radius, startA, endA, px, pz, rotZ) {
    const curve2d = new THREE.ArcCurve(0, 0, radius, startA, endA, false);
    const pts     = curve2d.getPoints(64);
    const path3d  = new THREE.CatmullRomCurve3(
      pts.map(p => new THREE.Vector3(p.x, p.y, 0))
    );
    const geo = new THREE.TubeGeometry(path3d, 64, lineThickness / 2, 8, false);
    const mesh = new THREE.Mesh(geo, matBasic);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotZ;
    mesh.position.set(px, lineY, pz);
    scene.add(mesh);
  }

  // — 3-point arcs at x = ±15 —
  makeArcMesh(6.75, Math.PI, 2 * Math.PI, -15, 0,  Math.PI / 2);
  makeArcMesh(6.75, Math.PI, 2 * Math.PI, +15, 0, -Math.PI / 2);

  // — Free-throw rectangles & semicircles on both ends —
  const rectW = 4.8, rectH = 5.8, baseZ = -2.8;
  [ +1, -1 ].forEach(sign => {
    // rectangle position (x shifts left/right)
    const xRect = 12.6 * sign;

    // Top bar
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(rectW, lineHeight, lineThickness),
      matBasic
    );
    top.position.set(xRect, lineY, baseZ + rectH);
    scene.add(top);

    // Bottom bar
    const bottom = top.clone();
    bottom.position.set(xRect, lineY, baseZ);
    scene.add(bottom);

    // Left bar
    const leftBar = new THREE.Mesh(
      new THREE.BoxGeometry(lineThickness, lineHeight, rectH),
      matBasic
    );
    leftBar.position.set(xRect - rectW / 2, lineY, baseZ + rectH / 2);
    scene.add(leftBar);

    // Right bar
    const rightBar = leftBar.clone();
    rightBar.position.set(xRect + rectW / 2, lineY, baseZ + rectH / 2);
    scene.add(rightBar);

    // semicircle at ±10.2
    makeArcMesh(
      1.8,
      0, Math.PI,
      sign * 10.2,
      0,
      sign > 0 ? Math.PI / 2 : -Math.PI / 2
    );
  });
}

// === Sphere ===
function spawnBall() {
  const loader = new THREE.TextureLoader();
  const ballTex = loader.load('src/img/ball.jpeg');

  const ballMaterial = new THREE.MeshPhongMaterial({ map: ballTex, shininess: 100 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.49, 32, 32), ballMaterial);
  ball.castShadow = true;
  ball.position.set(0, 0.58, 0);
  scene.add(ball);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 });

  function addFatLine(geo) {
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Line(geo, lineMat);
      line.position.copy(ball.position);
      line.scale.multiplyScalar(1 + i * 0.0008);
      scene.add(line);
    }
  }

  // Tilted seams (45° and -45°)
  [45, -45].forEach(deg => {
    const rot = deg * (Math.PI / 180);
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(rot) * 0.49;
      const y = Math.cos(theta) * 0.49;
      const z = Math.sin(theta) * Math.sin(rot) * 0.49;
      points.push(new THREE.Vector3(x, y, z));
    }
    points.push(points[0].clone()); // Close loop
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    addFatLine(geo);
  });

  // Horizontal seam (equator)
  const points1 = [];
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * Math.PI * 2;
    points1.push(new THREE.Vector3(Math.cos(theta) * 0.49, 0, Math.sin(theta) * 0.49));
  }
  points1.push(points1[0].clone());
  addFatLine(new THREE.BufferGeometry().setFromPoints(points1));

  // Vertical seams (longitudes)
  [Math.PI / 2, 0].forEach(offset => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI;
      const x = Math.sin(theta) * Math.cos(offset) * 0.49;
      const y = Math.cos(theta) * 0.49;
      const z = Math.sin(theta) * Math.sin(offset) * 0.49;
      points.push(new THREE.Vector3(x, y, z));
    }
    addFatLine(new THREE.BufferGeometry().setFromPoints(points));
  });

  // Side seams (vertical rings)
  [0, Math.PI / 2].forEach(rot => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(rot) * 0.49;
      const y = Math.cos(theta) * 0.49;
      const z = Math.sin(theta) * Math.sin(rot) * 0.49;
      points.push(new THREE.Vector3(x, y, z));
    }
    points.push(points[0].clone());
    addFatLine(new THREE.BufferGeometry().setFromPoints(points));
  });
}

// === Hoops & Supports ===
function placeHoop(offsetX) {
  const rimY = 3.05;
  const backH = 1.06;
  const backY = rimY + backH / 2 - 0.1;

  // backboard
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, backH, 0.02),
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    })
  );
  back.position.set(offsetX, backY, 0);
  back.rotation.y = offsetX > 0 ? Math.PI / 2 : -Math.PI / 2;
  back.castShadow = true;
  scene.add(back);

  // === Outer full rectangle frame ===
  const outerFrameW = 1.82;
  const outerFrameH = backH;
  const outerFrameZ = 0.011;

  const outerFramePoints = [
    new THREE.Vector3(-outerFrameW / 2, -outerFrameH / 2, outerFrameZ),
    new THREE.Vector3(-outerFrameW / 2, outerFrameH / 2, outerFrameZ),
    new THREE.Vector3(outerFrameW / 2, outerFrameH / 2, outerFrameZ),
    new THREE.Vector3(outerFrameW / 2, -outerFrameH / 2, outerFrameZ),
    new THREE.Vector3(-outerFrameW / 2, -outerFrameH / 2, outerFrameZ)
  ];
  const outerFrameGeo = new THREE.BufferGeometry().setFromPoints(outerFramePoints);
  const outerFrame = new THREE.Line(outerFrameGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  outerFrame.position.set(offsetX, backY, 0);
  outerFrame.rotation.y = offsetX > 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(outerFrame);

  // === Inner shooter's square ===
  const frameW = 0.69;
  const frameH = 0.48;
  const frameZ = 0.011;
  const barThickness = 0.05;

  const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bars = [];

  // Top
  bars.push(new THREE.Mesh(
    new THREE.BoxGeometry(frameW, barThickness, 0.01),
    frameMat
  ));

  // Bottom
  bars.push(new THREE.Mesh(
    new THREE.BoxGeometry(frameW, barThickness, 0.01),
    frameMat
  ));

  // Left
  bars.push(new THREE.Mesh(
    new THREE.BoxGeometry(barThickness, frameH, 0.01),
    frameMat
  ));

  // Right
  bars.push(new THREE.Mesh(
    new THREE.BoxGeometry(barThickness, frameH, 0.01),
    frameMat
  ));

  // Position bars relative to center
  bars[0].position.set(0, frameH - barThickness / 2, frameZ); // top
  bars[1].position.set(0, barThickness / 2, frameZ); // bottom
  bars[2].position.set(-frameW / 2 + barThickness / 2, frameH / 2, frameZ); // left
  bars[3].position.set( frameW / 2 - barThickness / 2, frameH / 2, frameZ); // right

  // Wrap all bars into a group
  const frameGroup = new THREE.Group();
  bars.forEach(b => frameGroup.add(b));

  frameGroup.position.set(offsetX, rimY + 0.1, 0);
  frameGroup.rotation.y = offsetX > 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(frameGroup);


  // rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 16, 100),
    new THREE.MeshPhongMaterial({ color: 0xE35335 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(offsetX + (offsetX > 0 ? -0.45 : 0.45), rimY, 0);
  rim.castShadow = true;
  scene.add(rim);

  // net
  const netSegments = 16;
  const rimRadius = 0.45;
  const netLength = 0.9;
  const curveDepth = 0.3;
  const rimX = offsetX + (offsetX > 0 ? -0.45 : 0.45);
  const rimZ = 0;

  for (let i = 0; i < netSegments; i++) {
    const angle = (i / netSegments) * 2 * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const top = new THREE.Vector3(rimX + rimRadius * cos, rimY, rimZ + rimRadius * sin);
    const bottom = new THREE.Vector3(
      rimX + (rimRadius - curveDepth) * cos,
      rimY - netLength,
      rimZ + (rimRadius - curveDepth) * sin
    );

    const thread = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, top.distanceTo(bottom), 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    thread.position.copy(top.clone().add(bottom).multiplyScalar(0.5));
    thread.lookAt(bottom);
    thread.rotateX(Math.PI / 2);
    scene.add(thread);
  }

  // support pole
  const poleHeight = backY + 0.7; // slightly above the new backboard center
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 16),
    new THREE.MeshPhongMaterial({ color: 0x333333 })
  );
  pole.position.set(offsetX + (offsetX > 0 ? 0.7 : -0.7), poleHeight / 2, 0);
  pole.castShadow = true;
  scene.add(pole);

  // arm
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.7, 12),
    new THREE.MeshPhongMaterial({ color: 0x333333 })
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set(offsetX + (offsetX > 0 ? 0.35 : -0.35), backY + 0.25, 0);
  arm.castShadow = true;
  scene.add(arm);
}

function addHoops(){ placeHoop(-13.8); placeHoop(13.8); }

function buildBleachers() {
  const seatDepth    = 0.5;
  const seatGeometry = new THREE.BoxGeometry(0.5, 0.1, seatDepth);
  const backGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.1);
  const yellowMat    = new THREE.MeshStandardMaterial({ color: 0xf6d900 });
  const blueMat      = new THREE.MeshStandardMaterial({ color: 0x0046ad });

  const rows       = 10;
  const spacingX   = 0.6;
  const rowHeight  = 0.5;
  const courtHalfW = 7.5;

  const word       = 'MACCABI';
  const letterW    = 5, letterH = 7, letterSpace = 1;
  const patterns   = {
    M:['10001','11011','10101','10101','10001','10001','10001'],
    A:['01110','10001','10001','11111','10001','10001','10001'],
    C:['01110','10001','10000','10000','10000','10001','01110'],
    B:['11110','10001','10001','11110','10001','10001','11110'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
  };
  const wordCols     = word.length * letterW + (word.length - 1) * letterSpace;
  const startColSide = Math.floor((50 - wordCols) / 2);
  const startRowSide = Math.floor((rows - letterH) / 2); 

  const chairsPerRow = 50;
  const baseZ        = courtHalfW + seatDepth * 0.1;
  const rowZOffset   = seatDepth * 0.8;

  for (let side of [-1, 1]) {
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < chairsPerRow; col++) {
        let mat = blueMat;

        // apply "MACCABI" on side === 1:
        if (side === 1) {
          const r = row - startRowSide - 1;  // shift pattern into rows 2–8
          const c = col - startColSide;
          if (r >= 0 && r < letterH && c >= 0 && c < wordCols) {
            const letterIdx = Math.floor(c / (letterW + letterSpace));
            const letterCol = c % (letterW + letterSpace);
            if (letterIdx < word.length && letterCol < letterW) {
              const L = word[word.length - 1 - letterIdx];
              if (patterns[L][letterH - 1 - r][letterW - 1 - letterCol] === '1') {
                mat = yellowMat;
              }
            }
          }
        }

        const seat = new THREE.Mesh(seatGeometry, mat);
        const back = new THREE.Mesh(backGeometry, mat);

        // Position: row 1 → y=0.25; row 2 → y=0.75; etc.
        const x = -15 + col * spacingX;
        const y = 0.25 + (row - 1) * rowHeight;
        const z = side * (baseZ + (row - 1) * rowZOffset);

        seat.position.set(x, y, z);
        back.position .set(x, y + 0.25, z + side * 0.3);
        back.rotation.x = -side * 0.1;

        seat.castShadow = seat.receiveShadow = true;
        back.castShadow = back.receiveShadow = true;
        scene.add(seat, back);
      }
    }
  }

  // — End bleachers (behind hoops), also skip row 0 —
  const chairsPerRowEnd = Math.floor((courtHalfW * 2) / spacingX);
  const baseXEnd        = 15 + seatDepth * 0.1;
  const rowXOffsetEnd   = seatDepth * 0.8;

  for (let endSide of [-1, 1]) {
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < chairsPerRowEnd; col++) {
        const mat  = blueMat;
        const seat = new THREE.Mesh(seatGeometry, mat);
        const back = new THREE.Mesh(backGeometry, mat);

        const x = endSide * (baseXEnd + (row - 1) * rowXOffsetEnd);
        const y = 0.25 + (row - 1) * rowHeight;
        const z = -courtHalfW + col * spacingX;

        seat.rotation.y = endSide * Math.PI / 2;
        back.rotation.y = endSide * Math.PI / 2;
        back.rotation.x = -0.1;

        seat.position.set(x, y, z);
        back.position .set(x + endSide * 0.3, y + 0.25, z);

        seat.castShadow = seat.receiveShadow = true;
        back.castShadow = back.receiveShadow = true;
        scene.add(seat, back);
      }
    }
  }
}

// === UI & Controls ===
function setupUI(){
  // — Score display —
  const scoreDiv = document.createElement('div');
  scoreDiv.id = 'scoreboard';
  scoreDiv.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0,0,0,0.6);
    color: #FFD700;
    padding: 8px 16px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 20px;
    font-weight: bold;
    text-shadow: 1px 1px 2px #000;
  `;
  scoreDiv.innerText = 'Score: 0';
  document.body.appendChild(scoreDiv);

  // — Controls panel —
  const controlsDiv = document.createElement('div');
  controlsDiv.id = 'controls-panel';
  controlsDiv.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(0,0,0,0.6);
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    line-height: 1.4;
  `;
  controlsDiv.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Controls:</h3>
    <ul style="margin:0; padding-left:1.2em;">
      <li><strong>O</strong>: Toggle orbit camera</li>
      <li><strong>Z</strong>: Aerial view</li>
      <li><strong>X</strong>: VIP seating team 1</li>
      <li><strong>C</strong>: VIP seating team 2</li>
      <li><strong>V</strong>: Behind basket team 1</li>
      <li><strong>B</strong>: Behind basket team 2</li>
      <li><strong>W / S</strong>: Adjust shot power</li>
      <li><strong>Space</strong>: Shoot ball</li>
      <li><strong>R</strong>: Reset ball</li>
    </ul>
  `;
  document.body.appendChild(controlsDiv);

  // — Key handling —
  document.addEventListener('keydown', handleKeyDown);
}

// Handle key events + updated camera presets & game controls
function handleKeyDown(e) {
  switch (e.key.toLowerCase()) {
    case 'o':
      isOrbitEnabled = !isOrbitEnabled;
      break;
    // camera presets
    case 'z':
      setCam('top');
      break;
    case 'x':
      setCam('vip1');
      break;
    case 'c':
      setCam('vip2');
      break;
    case 'v':
      setCam('back1');
      break;
    case 'b':
      setCam('back2');
      break;
    // future game controls (HW06)
    case 'w':
      // TODO: increaseShotPower();
      console.log('Increase power');
      break;
    case 's':
      // TODO: decreaseShotPower();
      console.log('Decrease power');
      break;
    case ' ':
      // TODO: shootBall();
      console.log('Shoot ball');
      break;
    case 'r':
      // TODO: resetBall();
      console.log('Reset ball');
      break;
  }
}

// === Camera Presets ===
const cams = {
  top:  new THREE.Vector3( 0, 15,  0),
  vip1: new THREE.Vector3( 0,  5, 10),
  vip2: new THREE.Vector3( 0,  5,-10),
  back1:new THREE.Vector3(18,  5,  0),
  back2:new THREE.Vector3(-18, 5,  0)
};
function setCam(name){
  camera.position.copy(cams[name]);
  camera.lookAt(0, 0, 0);
}

// === Initialize & Animate ===
initLights();
constructCourt();
drawCourtLines();
spawnBall();
addHoops();
buildBleachers();

// start at aerial view
setCam('top');

// setup controls & UI
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;
setupUI();

function animate(){
  requestAnimationFrame(animate);
  controls.enabled = isOrbitEnabled;
  controls.update();
  renderer.render(scene, camera);
}
animate();