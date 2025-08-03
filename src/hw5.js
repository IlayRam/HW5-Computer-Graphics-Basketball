/*
Noam Shildekraut
Ilay Ram
*/

import { OrbitControls } from './OrbitControls.js';

class BasketballTrailEffect {
  constructor(scene, ballGroup, opts = {}) {
    this.scene          = scene;
    this.ballGroup      = ballGroup;
    this.maxTrailPoints = opts.maxTrailPoints || 100;
    this.positions      = [];
    this.colorHex       = opts.color   || 0x00ff00;
    this.opacity        = opts.opacity || 1.0;
    this.width          = opts.width   || 8;    // now very wide
    this.isActive       = false;
    this._init();
  }

  _init() {
    // geometry with both position + color attributes
    this.geometry = new THREE.BufferGeometry();
    const posArray   = new Float32Array(this.maxTrailPoints * 3);
    const colorArray = new Float32Array(this.maxTrailPoints * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(posArray,   3));
    this.geometry.setAttribute('color',    new THREE.BufferAttribute(colorArray, 3));

    // wide, transparent, vertex‐colored line
    this.material = new THREE.LineBasicMaterial({
      vertexColors:   true,
      transparent:    true,
      opacity:        this.opacity,
      linewidth:      this.width        // note: many browsers ignore linewidth, but gives hint
    });

    this.mesh = new THREE.Line(this.geometry, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  setColor(hex) {
    this.colorHex = hex;
  }

  startTrail() {
    this.positions = [ this.ballGroup.position.clone() ];
    this.mesh.visible = true;
    this.isActive = true;
  }

  stopTrail() {
    this.isActive = false;
    this.mesh.visible = false;
    this.positions.length = 0;
    this.geometry.setDrawRange(0, 0);
  }

  update() {
    if (!this.isActive) return;

    // push new point
    this.positions.push(this.ballGroup.position.clone());
    if (this.positions.length > this.maxTrailPoints) this.positions.shift();

    // update both position & color attrs
    const posAttr   = this.geometry.getAttribute('position');
    const colAttr   = this.geometry.getAttribute('color');
    const posArray  = posAttr.array;
    const colArray  = colAttr.array;
    const len       = this.positions.length;
    const baseColor = new THREE.Color(this.colorHex);

    for (let i = 0; i < this.maxTrailPoints; i++) {
      const p = this.positions[i] || this.positions[len - 1];
      posArray[3*i]   = p.x;
      posArray[3*i+1] = p.y;
      posArray[3*i+2] = p.z;

      // fade from full color at head → black at tail
      const t = i / (len - 1 || 1);
      const c = baseColor.clone().lerp(new THREE.Color(0x000000), 1 - t);
      colArray[3*i]   = c.r;
      colArray[3*i+1] = c.g;
      colArray[3*i+2] = c.b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, len);
  }

  dispose() {
    this.stopTrail();
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
// ————————————————————————————————


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

// === Global Variables ===
let ball, ballGroup;
let groundBounceCount = 0;
const ballSpeed = 0.1;
const ballBounds = { xMin: -14, xMax: 14, zMin: -7, zMax: 7 };
const keysPressed = {};
let isOrbitEnabled = true;
let ballVelocity = new THREE.Vector3();
let isBallFlying = false;
let shotPower = 50; // initial shot power, 0–100
const ballRadius        = 0.25;        // for roll calculations
const gravity           = new THREE.Vector3(0, -9.8, 0);
const restitutionGround = 0.6;         // energy retained on ground bounce
const groundFriction    = 0.8;         // horizontal damping on ground
const restitutionRim    = 0.85;         // energy retained on rim bounce
const restitutionBoard  = 0.5;         // energy retained on backboard bounce
const rimRadius         = 0.45;        // hoop torus radius
const groundHeight      = 0.58;        // floor Y
const leftRimCenter     = new THREE.Vector3(-13.35, 3.05, 0);
const rightRimCenter    = new THREE.Vector3( 13.35, 3.05, 0);
// backboard data from your placeHoop offsets & sizes:
const boardThickness    = 0.02;
const backboardHalfW    = 1.82 / 2;
const backboardHalfH    = 1.06 / 2;
const leftBoardX        = -13.8;
const rightBoardX       =  13.8;
let hasScoredThisShot = false;
let trail; // trail instance
const rimTubeR              = 0.03;     // torus tube radius
const rimEffectiveRadius    = ballRadius + rimTubeR;
const rimSlop               = 0.001;    // small tolerance to avoid jitter
const rimPosCorrectPercent  = 0.8;      // Baumgarte-style positional correction
const rimMinBounceSpeed     = 1.6;    // minimum horizontal speed after hit (tune 1.2–2.2)
const rimTangentialDamping  = 0.90;   // keep some slide but reduce sticking
let leftStats  = { score: 0, attempts: 0, made: 0, comboCount: 0 };
let rightStats = { score: 0, attempts: 0, made: 0, comboCount: 0 };
let shotClock = 24;
let lastShotTeam = null;  // "home" or "guest"
let suppressMiss = false;
const COMBO_BONUS = 1;
const SWISH_BONUS = 1;
let mode = 'regular';         // 'regular' or 'challenge'
window.mode = mode;
window.resetGameForMode = resetGameForMode;
const modeInputs = document.querySelectorAll('input[name="mode"]');
const gameOverEl  = document.getElementById('game-over');
const goText      = document.getElementById('game-over-text');
const btnRestart  = document.getElementById('restart-challenge');
const btnToRegular= document.getElementById('switch-regular');
const FT_LINE_X = 10;
const rimHitSound = new Audio('src/sounds/rim_hit.mp3');
const groundHitSound = new Audio('src/sounds/touchtheground.mp3');
const backboardHitSound = new Audio('src/sounds/Hitting_backboard.mp3');
const scoreSound = new Audio('src/sounds/score.wav');
// — Wind (mode + physics) —
let windEnabled   = false;               // on/off = "wind mode"
let windIntensity = 0;                   // 0..100 (%)
let windDir2D     = new THREE.Vector2(1, 0); // +X (to the right) by default
const MAX_WIND_ACCEL = 5.0;              // m/s^2 at 100% intensity (tune)
let rimFireFX = { left: null, right: null };
// === Leaderboard globals ===
const LB_KEY = 'bb_leaderboard_v1';
let challengeHasEnded = false; // guard so we don't end twice


modeInputs.forEach(radio =>
  radio.addEventListener('change', e => {
    mode = e.target.value;
    resetGameForMode();
  })
);

btnRestart.addEventListener('click', () => {
  mode = 'challenge';
  document.querySelector('input[value="challenge"]').checked = true;
  resetGameForMode();
  gameOverEl.style.display = 'none';
});
btnToRegular.addEventListener('click', () => {
  mode = 'regular';
  document.querySelector('input[value="regular"]').checked = true;
  resetGameForMode();
  gameOverEl.style.display = 'none';
});

function makeFlameTexture() {
  // canvas-based radial flame sprite
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  const grad = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0.0, 'rgba(255,255,180,1)');  // hot core
  grad.addColorStop(0.4, 'rgba(255,140,0,0.9)');  // orange
  grad.addColorStop(0.7, 'rgba(255,69,0,0.5)');   // red-orange
  grad.addColorStop(1.0, 'rgba(255,0,0,0)');      // fade out
  g.fillStyle = grad;
  g.fillRect(0,0,size,size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createRimFireFX(center, scene) {
  const texture = makeFlameTexture();
  const sprites = [];

  for (let i = 0; i < 20; i++) {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 0.4);
    sprite.visible = false;
    scene.add(sprite);
    sprites.push(sprite);
  }

  return {
    active: false,
    ttl: 0,
    tAccum: 0,
    center: center.clone(),
    sprites,
    start(ms = 2000) {
      this.active = true;
      this.ttl = ms;
      this.tAccum = 0;
      for (const s of this.sprites) s.visible = true;
    },
    stop() {
      this.active = false;
      for (const s of this.sprites) s.visible = false;
    },
    update(dtSec) {
      if (!this.active) return;
      this.tAccum += dtSec;
      this.ttl -= dtSec * 1000;
      if (this.ttl <= 0) {
        this.stop();
        return;
      }

      this.sprites.forEach((s, i) => {
        const angle = (i / this.sprites.length) * Math.PI * 2;
        const r = 0.45 + 0.05 * Math.sin(this.tAccum * 6 + i);
        const x = this.center.x + Math.cos(angle) * r;
        const z = this.center.z + Math.sin(angle) * r;
        const y = this.center.y + 0.05 + 0.2 * Math.sin(this.tAccum * 5 + i);

        s.position.set(x, y, z);
        const pulse = 1.0 + 0.2 * Math.sin(this.tAccum * 10 + i);
        s.scale.setScalar(0.35 * pulse);
        s.material.opacity = 0.3 + 0.5 * Math.sin(this.tAccum * 8 + i);
      });
    }
  };
}

function resetGameForMode() {
  shotClock = (mode === 'challenge') ? 60
           : (mode === 'regular')   ? 24
           : 0; // FREE: clock stays 00:00

  leftStats = { score:0, attempts:0, made:0, comboCount:0 };
  rightStats= { score:0, attempts:0, made:0, comboCount:0 };
  resetBall();
  updateStatsDisplay();
}

function startChallengeRound() {
  mode = 'challenge';
  challengeHasEnded = false;

  // zero scores + counters
  leftStats  = { score: 0, attempts: 0, made: 0, comboCount: 0 };
  rightStats = { score: 0, attempts: 0, made: 0, comboCount: 0 };

  // reset clock + ball + UI
  shotClock = 60;
  resetBall();
  updateStatsDisplay();     // updates the big 00 / 00 and side stats
}

function resetToFTLine() {
  const isLeft = (lastShotTeam === 'home');   // left hoop
  ballGroup.position.set(isLeft ? -FT_LINE_X : FT_LINE_X, groundHeight, 0);
  ballVelocity.set(0, 0, 0);
  isBallFlying = false;
  hasScoredThisShot = false;
  if (trail?.isActive) trail.stopTrail();
  ballGroup.userData.awaitingFTReset = false; // consumed
}


function initLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 15);
  dir.castShadow = true;

  // Increase shadow map resolution
  dir.shadow.mapSize.width  = 2048;
  dir.shadow.mapSize.height = 2048;

  // Expand shadow camera bounds
  dir.shadow.camera.left   = -30;
  dir.shadow.camera.right  = 30;
  dir.shadow.camera.top    = 30;
  dir.shadow.camera.bottom = -30;
  dir.shadow.camera.near   = 1;
  dir.shadow.camera.far    = 100;

  // Optional: Visualize shadow camera (for debugging)
  // scene.add(new THREE.CameraHelper(dir.shadow.camera));

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
    const xRect = 12.6 * sign;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(rectW, lineHeight, lineThickness),
      matBasic
    );
    top.position.set(xRect, lineY, baseZ + rectH);
    scene.add(top);

    const bottom = top.clone();
    bottom.position.set(xRect, lineY, baseZ);
    scene.add(bottom);

    const leftBar = new THREE.Mesh(
      new THREE.BoxGeometry(lineThickness, lineHeight, rectH),
      matBasic
    );
    leftBar.position.set(xRect - rectW / 2, lineY, baseZ + rectH / 2);
    scene.add(leftBar);

    const rightBar = leftBar.clone();
    rightBar.position.set(xRect + rectW / 2, lineY, baseZ + rectH / 2);
    scene.add(rightBar);

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

  ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 32, 32), ballMaterial);
  ball.castShadow = true;
  ball.position.set(0, 0, 0);

  ballGroup = new THREE.Group();
  ballGroup.position.set(0, 0.58, 0);
  ballGroup.add(ball);
  scene.add(ballGroup);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 });
  function addFatLine(geo) {
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Line(geo, lineMat);
      line.position.copy(ball.position);
      line.scale.multiplyScalar(1 + i * 0.0008);
      ballGroup.add(line);
    }
  }

  // Tilted seams (45° and -45°)
  [45, -45].forEach(deg => {
    const rot = deg * (Math.PI / 180);
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(rot) * ballRadius;
      const y = Math.cos(theta) * ballRadius;
      const z = Math.sin(theta) * Math.sin(rot) * ballRadius;
      points.push(new THREE.Vector3(x, y, z));
    }
    points.push(points[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    addFatLine(geo);
  });

  // Horizontal seam (equator)
  const points1 = [];
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * Math.PI * 2;
    points1.push(new THREE.Vector3(Math.cos(theta) * ballRadius, 0, Math.sin(theta) * ballRadius));
  }
  points1.push(points1[0].clone());
  addFatLine(new THREE.BufferGeometry().setFromPoints(points1));

  // Vertical seams (longitudes)
  [Math.PI / 2, 0].forEach(offset => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI;
      const x = Math.sin(theta) * Math.cos(offset) * ballRadius;
      const y = Math.cos(theta) * ballRadius;
      const z = Math.sin(theta) * Math.sin(offset) * ballRadius;
      points.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    addFatLine(geo);
  });

  // Side seams (vertical rings)
  [0, Math.PI / 2].forEach(rot => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(rot) * ballRadius;
      const y = Math.cos(theta) * ballRadius;
      const z = Math.sin(theta) * Math.sin(rot) * ballRadius;
      points.push(new THREE.Vector3(x, y, z));
    }
    points.push(points[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    addFatLine(geo);
  });
}

// === Hoops & Supports ===
function placeHoop(offsetX) {
  const rimY = 3.05;
  const backH = 1.06;
  const backY = rimY + backH / 2 - 0.1;

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

  // Outer frame
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

  // Inner square
  const frameW = 0.69, frameH = 0.48, frameZ = 0.011, barThickness = 0.05;
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bars = [
    new THREE.Mesh(new THREE.BoxGeometry(frameW, barThickness, 0.01), frameMat),
    new THREE.Mesh(new THREE.BoxGeometry(frameW, barThickness, 0.01), frameMat),
    new THREE.Mesh(new THREE.BoxGeometry(barThickness, frameH, 0.01), frameMat),
    new THREE.Mesh(new THREE.BoxGeometry(barThickness, frameH, 0.01), frameMat)
  ];
  bars[0].position.set(0, frameH - barThickness/2, frameZ);
  bars[1].position.set(0, barThickness/2, frameZ);
  bars[2].position.set(-frameW/2 + barThickness/2, frameH/2, frameZ);
  bars[3].position.set(frameW/2 - barThickness/2, frameH/2, frameZ);
  const frameGroup = new THREE.Group();
  bars.forEach(b=>frameGroup.add(b));
  frameGroup.position.set(offsetX, rimY+0.1, 0);
  frameGroup.rotation.y = offsetX>0?Math.PI/2:-Math.PI/2;
  scene.add(frameGroup);

  // rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 16, 100),
    new THREE.MeshPhongMaterial({ color: 0xE35335 })
  );
  rim.rotation.x = Math.PI/2;
  rim.position.set(offsetX + (offsetX>0?-0.45:0.45), rimY, 0);
  rim.castShadow = true;
  scene.add(rim);

  // net
  const netSegments=16, netLength=0.9, curveDepth=0.3;
  const rmX = offsetX + (offsetX>0?-0.45:0.45), rmZ=0;
  for (let i=0; i<netSegments; i++){
    const angle = (i/netSegments)*2*Math.PI;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const top = new THREE.Vector3(rmX + rimRadius*cos, rimY, rmZ + rimRadius*sin);
    const bottom = new THREE.Vector3(rmX + (rimRadius-curveDepth)*cos, rimY-netLength, rmZ + (rimRadius-curveDepth)*sin);
    const thread = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, top.distanceTo(bottom), 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    thread.position.copy(top.clone().add(bottom).multiplyScalar(0.5));
    thread.lookAt(bottom);
    thread.rotateX(Math.PI/2);
    scene.add(thread);
  }

  // support pole & arm
  const poleHeight = backY + 0.7;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1,0.1,poleHeight,16),
    new THREE.MeshPhongMaterial({ color: 0x333333 })
  );
  pole.position.set(offsetX + (offsetX>0?0.7:-0.7), poleHeight/2, 0);
  pole.castShadow = true;
  scene.add(pole);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05,0.05,0.68,12),
    new THREE.MeshPhongMaterial({ color: 0x333333 })
  );
  arm.rotation.z = Math.PI/2;
  arm.position.set(offsetX + (offsetX>0?0.35:-0.35), backY+0.25, 0);
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
        if (side === 1) {
          const r = row - startRowSide - 1;
          const c = col - startColSide;
          if (r>=0 && r<letterH && c>=0 && c<wordCols) {
            const letterIdx = Math.floor(c/(letterW+letterSpace));
            const letterCol = c%(letterW+letterSpace);
            if (letterIdx < word.length && letterCol < letterW) {
              const L = word[word.length-1-letterIdx];
              if (patterns[L][letterH-1-r][letterW-1-letterCol] === '1') {
                mat = yellowMat;
              }
            }
          }
        }
        const seat = new THREE.Mesh(seatGeometry, mat);
        const back = new THREE.Mesh(backGeometry, mat);
        const x = -15 + col * spacingX;
        const y = 0.25 + (row - 1) * rowHeight;
        const z = side * (baseZ + (row - 1) * rowZOffset);
        seat.position.set(x, y, z);
        back.position.set(x, y+0.25, z + side*0.3);
        back.rotation.x = -side*0.1;
        seat.castShadow = seat.receiveShadow = true;
        back.castShadow = back.receiveShadow = true;
        scene.add(seat, back);
      }
    }
  }

  // End bleachers
  const chairsPerRowEnd = Math.floor((courtHalfW*2)/spacingX);
  const baseXEnd        = 15 + seatDepth*0.1;
  const rowXOffsetEnd   = seatDepth*0.8;
  for (let endSide of [-1,1]) {
    for (let row=1; row<rows; row++){
      for (let col=0; col<chairsPerRowEnd; col++){
        const mat = blueMat;
        const seat = new THREE.Mesh(seatGeometry, mat);
        const back = new THREE.Mesh(backGeometry, mat);
        const x = endSide*(baseXEnd + (row-1)*rowXOffsetEnd);
        const y = 0.25 + (row-1)*rowHeight;
        const z = -courtHalfW + col*spacingX;
        seat.rotation.y = endSide*Math.PI/2;
        back.rotation.y = endSide*Math.PI/2;
        back.rotation.x = -0.1;
        seat.position.set(x, y, z);
        back.position.set(x + endSide*0.3, y+0.25, z);
        seat.castShadow = seat.receiveShadow = true;
        back.castShadow = back.receiveShadow = true;
        scene.add(seat, back);
      }
    }
  }
}

function setupUI() {
  // === SHOT POWER UI ===
  const powerWrapper = document.createElement('div');
  powerWrapper.id = 'power-indicator-wrapper';
  powerWrapper.style.cssText = `
    position: absolute;
    top: 60px; right: 20px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    width: 160px;
  `;
  powerWrapper.innerHTML = `
    <div style="margin-bottom:6px;font-size:14px;font-weight:bold;">Shot Power</div>
    <div style="width:100%;height:20px;background:#444;border-radius:4px;overflow:hidden;">
      <div id="power-bar" style="
        width: ${shotPower}%;
        height: 100%;
        background: linear-gradient(to right, #00ffff, #0077ff);
        transition: width 0.2s;
      "></div>
    </div>
    <div id="power-text" style="margin-top:4px;text-align:right;font-size:14px;">
      ${shotPower}%
    </div>
  `;
  document.body.appendChild(powerWrapper);

  // === WIND UI ===
  const windWrapper = document.createElement('div');
  windWrapper.id = 'wind-indicator-wrapper';
  windWrapper.style.cssText = `
    position: absolute;
    right: 20px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    width: 160px;
  `;
  windWrapper.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:14px;font-weight:bold;">
      <span>Wind</span>
      <button id="wind-toggle" style="
        padding:2px 8px;border:none;border-radius:4px;background:#444;color:#fff;cursor:pointer;
      ">${windEnabled ? 'ON' : 'OFF'}</button>
    </div>
    <div style="width:100%;height:20px;background:#444;border-radius:4px;overflow:hidden;">
      <div id="wind-bar" style="
        width: ${windIntensity}%;
        height: 100%;
        background: linear-gradient(to right, #7fffd4, #00c896);
        transition: width 0.2s;
      "></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;">
      <div id="wind-text">${windIntensity}%</div>
      <div id="wind-dir">→</div>
    </div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:6px;">
      <button class="wind-btn" data-d="up"    title="North (I)"  style="padding:2px 6px;">↑</button>
      <button class="wind-btn" data-d="left"  title="West (J)"   style="padding:2px 6px;">←</button>
      <button class="wind-btn" data-d="down"  title="South (K)"  style="padding:2px 6px;">↓</button>
      <button class="wind-btn" data-d="right" title="East (L)"   style="padding:2px 6px;">→</button>
    </div>
  `;
  document.body.appendChild(windWrapper);

  // === Auto-place wind box below power box ===
  const gap = 12;
  function positionWindBox() {
    const y = powerWrapper.offsetTop + powerWrapper.offsetHeight + gap;
    windWrapper.style.top = `${y}px`;
  }
  positionWindBox();
  window.addEventListener('resize', positionWindBox);

  // === Event Listeners for wind ===
  document.getElementById('wind-toggle').addEventListener('click', () => {
    windEnabled = !windEnabled;
    updateWindIndicator();
  });
  document.querySelectorAll('.wind-btn').forEach(btn => {
    btn.addEventListener('click', () => setWindDirection(btn.dataset.d));
  });

  // === SHOT FEEDBACK MESSAGE ===
  const shotMsg = document.createElement('div');
  shotMsg.id = 'shot-message';
  shotMsg.style.cssText = `
    position: absolute;
    top: 140px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: #00ff00;
    padding: 8px 16px;
    font-size: 20px;
    font-weight: bold;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    opacity: 0;
    transition: opacity 0.4s;
  `;
  document.body.appendChild(shotMsg);

  // === CONTROLS PANEL ===
  const controlsDiv = document.createElement('div');
  controlsDiv.id = 'controls-panel';
  controlsDiv.style.cssText = `
    position: absolute;
    bottom: 20px; left: 20px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    line-height: 1.4;
  `;
  controlsDiv.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Controls:</h3>
    <ul style="margin:0;padding-left:1.2em;">
      <li><strong>O</strong>: Toggle orbit camera</li>
      <li><strong>Z</strong>: Aerial view</li>
      <li><strong>X</strong>: VIP seating team 1</li>
      <li><strong>C</strong>: VIP seating team 2</li>
      <li><strong>V</strong>: Behind basket team 1</li>
      <li><strong>B</strong>: Behind basket team 2</li>
      <li><strong>W / S</strong>: Adjust shot power</li>
      <li><strong>J / K</strong>: Wind intensity +/-</li>
      <li><strong>Space</strong>: Shoot ball</li>
      <li><strong>R</strong>: Reset ball</li>
      <li id="mode-li"><strong>M</strong>: Change game mode</li>
    </ul>
  `;
  document.body.appendChild(controlsDiv);

  // === Global Listeners ===
  document.addEventListener('keydown', e => {
    if (uiIsOpen()) return;
    keysPressed[e.key.toLowerCase()] = true;
    handleKeyDown(e);
  });
  document.addEventListener('keyup', e => {
    keysPressed[e.key.toLowerCase()] = false;
  });
  shotMsg.addEventListener('animationend', () => {
    shotMsg.classList.remove('show');
  });

  document.getElementById('mode-li').addEventListener('click', openModal);
  window.addEventListener('keydown', e => {
    if (uiIsOpen()) return;
    if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      openModal();
    }
  });

  // Initial updates
  updatePowerIndicator();
  updateWindIndicator();
}

(function installLeaderboardUI(){
  const css = document.createElement('style');
  css.textContent = `
    .bb-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: flex-start;        /* was center */
      justify-content: center;
      background: rgba(0,0,0,.7);
      z-index: 9999;
      font-family: Arial, sans-serif;
      padding-top: 40px;              /* NEW: pushes card down slightly */
    }

    .bb-card {
      background: #111;
      color: #fff;
      width: min(90vw, 420px);
      max-height: 80vh; 
      overflow-y: auto; 
      padding: 18px 20px;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,.35);
}

    .bb-card h2 { margin: 0 0 10px; font-size: 20px; }
    .bb-card p { margin: 6px 0 14px; color: #bbb; }
    .bb-row { display: flex; gap: 8px; }
    .bb-input {
      flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #333;
      background: #161616; color: #fff; outline: none; font-size: 14px;
    }
    .bb-btn {
      padding: 10px 14px; border-radius: 8px; border: 0; cursor: pointer;
    }
    .bb-btn-primary { background: #27ae60; color: white; }
    .bb-btn-ghost { background: #222; color: #ddd; }
    .bb-list {
      margin: 10px 0 0;
      padding-left: 20px;
      max-height: 300px;       /* fixed height instead of 50vh */
      overflow-y: auto;        /* only vertical scroll */
      list-style-position: inside;
    }

    .bb-list li {
      margin: 6px 0;
      padding: 2px 0;
      font-size: 14px;
      color: #ddd;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bb-small { font-size: 12px; color: #888; }
  `;
  document.head.appendChild(css);

  const nameOverlay = document.createElement('div');
  nameOverlay.id = 'bb-name-overlay';
  nameOverlay.className = 'bb-overlay';
  nameOverlay.innerHTML = `
    <div class="bb-card">
      <h2>Time’s up!</h2>
      <p>Your score: <strong id="bb-final-score">0</strong></p>
      <div class="bb-row">
        <input id="bb-player-name" class="bb-input" placeholder="Your name" maxlength="20" />
        <button id="bb-submit-score" class="bb-btn bb-btn-primary">Save</button>
      </div>
      <div class="bb-small" style="margin-top:8px;">Press Enter to submit</div>
    </div>`;
  document.body.appendChild(nameOverlay);

  const boardOverlay = document.createElement('div');
  boardOverlay.id = 'bb-leaderboard-overlay';
  boardOverlay.className = 'bb-overlay';
  boardOverlay.innerHTML = `
    <div class="bb-card">
      <h2>Leaderboard</h2>
      <ol id="bb-leaderboard" class="bb-list"></ol>
      <div class="bb-row" style="margin-top:12px; justify-content:flex-end">
        <button id="bb-close-leaderboard" class="bb-btn bb-btn-ghost">Close</button>
      </div>
      <div class="bb-small" style="margin-top:6px;">Top 20 saved locally on this device</div>
    </div>`;
  document.body.appendChild(boardOverlay);

  // Wire up actions
  const input = document.getElementById('bb-player-name');
  ['keydown', 'keyup', 'keypress'].forEach(type => {
    input.addEventListener(type, e => {
      e.stopPropagation();
    }, { capture: true });
  });
  const submit = document.getElementById('bb-submit-score');

  const submitHandler = () => {
    const name = (input.value || '').trim() || 'Anonymous';
    const scoreText = document.getElementById('bb-final-score').textContent || '0';
    const score = parseInt(scoreText, 10) || 0;
    const list = saveScore(name, score);
    input.value = '';
    nameOverlay.style.display = 'none';
    renderLeaderboard(list);
    document.getElementById('bb-leaderboard-overlay').style.display = 'flex';
  };
  submit.addEventListener('click', submitHandler);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitHandler(); });

  document.getElementById('bb-close-leaderboard').addEventListener('click', () => {
    document.getElementById('bb-leaderboard-overlay').style.display = 'none';
    startChallengeRound(); 
  });  
})();

function showShotMessage(text, team, color = '#00ff00') {
  const msg = document.getElementById('shot-message');
  msg.innerText = text;
  // Reset style to normal
  msg.style.color    = color;
  msg.style.fontSize = '20px';
  msg.style.left     = '';
  msg.style.top      = '';
  msg.style.transform= '';
  msg.style.animationDuration = '0.4s';

  // find the block and position the message under it
  const block = document.getElementById(team==='home' ? 'home-block' : 'guest-block');
  const rect  = block.getBoundingClientRect();
  msg.style.left = `${rect.left + rect.width/2}px`;
  msg.style.top  = `${rect.bottom + 15}px`; // tweak the vertical offset

  // restart the CSS animation
  msg.classList.remove('show');
  void msg.offsetWidth;
  msg.classList.add('show');
}



function handleKeyDown(e) {
  switch (e.key.toLowerCase()) {
    case 'o':
      isOrbitEnabled = !isOrbitEnabled;
      break;
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
    case 'w':
      shotPower = Math.min(100, shotPower + 1);
      updatePowerIndicator();
      break;
    case 's':
      shotPower = Math.max(0, shotPower - 1);
      updatePowerIndicator();
      break;
    case ' ':
      shootBall();
      break;
    case 'r':
      resetBall();
      break;
    case 'j': // wind ++
      windIntensity = Math.min(100, windIntensity + 1);
      updateWindIndicator();
      break;
    case 'k': // wind --
      windIntensity = Math.max(0, windIntensity - 1);
      updateWindIndicator();
      break;
  }
}

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

// Initialize everything
initLights();
constructCourt();
drawCourtLines();
spawnBall();
addHoops();
rimFireFX.left  = createRimFireFX(leftRimCenter, scene);
rimFireFX.right = createRimFireFX(rightRimCenter, scene);
buildBleachers();

// Create trail after ballGroup exists
trail = new BasketballTrailEffect(scene, ballGroup, {
  maxTrailPoints: 80,
  opacity:        0.8,
  width:          2
});

setCam('top');
setupUI();
const controls = new OrbitControls(camera, renderer.domElement);
isOrbitEnabled = true;

function updatePowerIndicator() {
  const bar = document.getElementById('power-bar');
  const text = document.getElementById('power-text');
  if (bar)  bar.style.width = `${shotPower}%`;
  if (text) text.innerText = `${shotPower}%`;
}

function setWindDirection(dir) {
  switch (dir) {
    case 'up':    windDir2D.set( 0,-1); break; // toward -Z
    case 'down':  windDir2D.set( 0, 1); break; // toward +Z
    case 'left':  windDir2D.set(-1, 0); break; // toward -X
    case 'right': windDir2D.set( 1, 0); break; // toward +X
  }
  updateWindIndicator();
}

function updateWindIndicator() {
  const bar   = document.getElementById('wind-bar');
  const text  = document.getElementById('wind-text');
  const dirEl = document.getElementById('wind-dir');
  const tog   = document.getElementById('wind-toggle');

  if (bar)  bar.style.width = `${windIntensity}%`;
  if (text) text.innerText  = `${windIntensity}%${windEnabled ? '' : ' (off)'}`;
  if (tog)  tog.innerText   = windEnabled ? 'ON' : 'OFF';

  // arrow that matches windDir2D
  if (dirEl) {
    let arrow = '•';
    if (Math.abs(windDir2D.x) > Math.abs(windDir2D.y)) {
      arrow = windDir2D.x > 0 ? '→' : '←';
    } else if (Math.abs(windDir2D.y) > 0) {
      arrow = windDir2D.y > 0 ? '↓' : '↑';
    }
    dirEl.innerText = arrow;
  }
}

function updateStatsDisplay() {
  const leftPct  = leftStats.attempts > 0
    ? ((leftStats.made / leftStats.attempts) * 100).toFixed(1)
    : "0.0";
  const rightPct = rightStats.attempts > 0
    ? ((rightStats.made / rightStats.attempts) * 100).toFixed(1)
    : "0.0";

  // Scores
  document.getElementById('home-score').innerText  =
    leftStats.score.toString().padStart(2, '0');
  document.getElementById('guest-score').innerText =
    rightStats.score.toString().padStart(2, '0');

  // Raw values only — HTML provides the “Shot Attempts:” label
  document.getElementById('home-attempts').innerText = leftStats.attempts;
  document.getElementById('home-made').innerText     = leftStats.made;
  document.getElementById('home-pct').innerText      = `${leftPct}%`;

  document.getElementById('guest-attempts').innerText = rightStats.attempts;
  document.getElementById('guest-made').innerText     = rightStats.made;
  document.getElementById('guest-pct').innerText      = `${rightPct}%`;
  document.getElementById('home-combo').innerText  = leftStats.comboCount;
  document.getElementById('guest-combo').innerText = rightStats.comboCount;
}



function resetBall() {
  if (!ballGroup) return;

  // reset position & velocity
  if (mode === 'free') {
    const isLeft = lastShotTeam === 'home';
    ballGroup.position.set(isLeft ? -FT_LINE_X : FT_LINE_X, groundHeight, 0);
  } else {
    ballGroup.position.set(0, 0.58, 0);
  }
  ballVelocity.set(0, 0, 0);

  // reset power & UI
  shotPower = 50;
  updatePowerIndicator();

  // reset scoring/physics flags
  hasScoredThisShot = false;
  if (trail.isActive) trail.stopTrail();

  // re-init our per-shot data
  ballGroup.userData = {
    rimHits:    0,
    backboardHit:  false,
    forceDrop:  false,
    lastY:      ballGroup.position.y
  };
  ballGroup.userData.rimHits = 0;
  suppressMiss = true;

  windEnabled = false;
  windIntensity = 0;
  updateWindIndicator();
}


function shootBall() {
  if (!ballGroup || isBallFlying) return;
  hasScoredThisShot = false;

  ballGroup.userData = ballGroup.userData || {};
  ballGroup.userData.rimHits        = 0;              // (keeps your swish logic sane)
  ballGroup.userData.backboardHit   = false;          // if you added the backboard swish fix
  ballGroup.userData.awaitingFTReset = (mode === 'free'); // FREE: arm FT reset

  ballGroup.userData = ballGroup.userData || {};
  ballGroup.userData.rimHits      = 0;
  ballGroup.userData.backboardHit = false;

  // choose hoop for direction & trail color
  const pos   = ballGroup.position.clone();
  const distL = pos.distanceTo(leftRimCenter);
  const distR = pos.distanceTo(rightRimCenter);
  const isLeftHoop = distL < distR;

  // remember who shot (for positioning the feedback)
  lastShotTeam = isLeftHoop ? 'home' : 'guest';

  // start the trail
  trail.setColor(isLeftHoop ? 0x0000ff : 0xffff00);
  trail.startTrail();

  // compute shot velocity
  const leftHoopPos  = new THREE.Vector3(-13.8, 3.05, 0);
  const rightHoopPos = new THREE.Vector3( 13.8, 3.05, 0);
  const target       = isLeftHoop ? leftHoopPos : rightHoopPos;
  const dir          = target.clone().sub(pos).normalize();
  const powerScale   = shotPower / 100;
  const speed        = 12 * powerScale;

  ballVelocity.copy(dir.multiplyScalar(speed));
  ballVelocity.y = 6 + 4 * powerScale;
  isBallFlying   = true;

  // increment attempts on the correct side
  if (isLeftHoop)  leftStats.attempts++;
  else             rightStats.attempts++;

  updateStatsDisplay();
}

function handleNetCollision(ballGroup, ballVelocity, rimCenters, rimRadius) {
  const netY = 0.15;

  rimCenters.forEach(rimCenter => {
    const horiz = ballGroup.position.clone().setY(0).sub(rimCenter.clone().setY(0));
    const distXZ = horiz.length();

    if (
      ballGroup.position.y < netY &&
      distXZ < rimRadius + 0.15
    ) {
      ballVelocity.multiplyScalar(0.96);
      ballVelocity.y -= 0.2;
    }
  });
}

function handleRimCollision(ballGroup, ballVelocity, rimCenters, majorRadius) {
  const p = ballGroup.position;

  rimCenters.forEach((rimCenter) => {
    const rVecXZ = new THREE.Vector3(p.x - rimCenter.x, 0, p.z - rimCenter.z);
    let rLen = rVecXZ.length();
    if (rLen < 1e-6) rLen = 1e-6;
    const rDir = rVecXZ.clone().multiplyScalar(1 / rLen);

    const circlePoint = new THREE.Vector3(
      rimCenter.x + rDir.x * majorRadius,
      rimCenter.y,
      rimCenter.z + rDir.z * majorRadius
    );

    const d    = p.clone().sub(circlePoint);
    const dist = d.length();
    const penetration = (ballRadius + rimTubeR) - dist;

    if (penetration > 0) {
      ballGroup.userData.rimHits = (ballGroup.userData.rimHits || 0) + 1;

      const n = dist > 1e-6
        ? d.clone().multiplyScalar(1 / dist)
        : new THREE.Vector3(0, 1, 0);

      const vDotN = ballVelocity.dot(n);
      if (vDotN < 0) {
        // 🔊 Play rim hit sound
        if (!ballGroup.userData.playedRimSound) {
          rimHitSound.currentTime = 0;
          rimHitSound.play();
          ballGroup.userData.playedRimSound = true;
        }

        // velocity bounce logic
        const vN = n.clone().multiplyScalar(vDotN);
        const vT = ballVelocity.clone().sub(vN);
        let newVNmag = -restitutionRim * vDotN;
        if (newVNmag < rimMinBounceSpeed) newVNmag = rimMinBounceSpeed;
        const newVN = n.clone().multiplyScalar(newVNmag);
        const newVT = vT.multiplyScalar(rimTangentialDamping);

        ballVelocity.copy(newVN.add(newVT));

        if (mode === 'regular') {
          shotClock = 24;
        }
      }

      // position correction
      const corr = Math.max(penetration - rimSlop, 0) * rimPosCorrectPercent;
      if (corr > 0) {
        p.add(n.clone().multiplyScalar(corr));
      }
    }
  });

  ballGroup.userData.playedRimSound = false;
}



function handlePoleCollision(ballGroup, ballVelocity, ballRadius, restitution) {
  const poleRadius = 0.7;
  const polePositions = [
    new THREE.Vector3(-45, 0.58, -2),
    new THREE.Vector3(45, 0.58, -2)
  ];

  polePositions.forEach(pole => {
    const poleXZ = pole.clone().setY(ballGroup.position.y);
    const toBall = ballGroup.position.clone().sub(poleXZ);
    const dist = toBall.length();

    if (dist <= ballRadius + poleRadius) {
      const normal = toBall.normalize();
      const vDotN = ballVelocity.dot(normal);
      ballVelocity.addScaledVector(normal, - (1 + restitution) * vDotN);
      ballGroup.position.add(normal.multiplyScalar(ballRadius + poleRadius - dist));
    }
  });
}

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); }
  catch { return []; }
}

function saveScore(name, score) {
  const list = getLeaderboard();
  list.push({ name, score, ts: Date.now() });
  // Sort by score desc, then earlier timestamp first
  list.sort((a, b) => (b.score - a.score) || (a.ts - b.ts));
  const trimmed = list.slice(0, 20);
  localStorage.setItem(LB_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function renderLeaderboard(list = getLeaderboard()) {
  const ol = document.getElementById('bb-leaderboard');
  if (!ol) return;
  ol.innerHTML = '';
  list.forEach((row, i) => {
    const li = document.createElement('li');
    const date = new Date(row.ts);
    li.textContent = `${row.name} — ${row.score}  (${date.toLocaleDateString()} ${date.toLocaleTimeString()})`;
    ol.appendChild(li);
  });
}

function showNamePrompt(finalScore) {
  const overlay = document.getElementById('bb-name-overlay');
  const scoreEl = document.getElementById('bb-final-score');
  const input = document.getElementById('bb-player-name');
  if (!overlay || !scoreEl) return;

  for (const key in keysPressed) keysPressed[key] = false;

  scoreEl.textContent = String(finalScore);
  overlay.style.display = 'flex';
  setTimeout(() => input && input.focus(), 0);
}

// Call when the 60s challenge ends
function endChallenge(finalScore) {
  shotClock = 0;            // clamp for display/UI
  challengeHasEnded = true; // guard is already set before call; OK to set again
  showNamePrompt(finalScore);
  leftStats.score = 0; rightStats.score = 0;
  resetBall();
}

function uiIsOpen() {
  const n = document.getElementById('bb-name-overlay');
  const b = document.getElementById('bb-leaderboard-overlay');
  return (n && n.style.display === 'flex') || (b && b.style.display === 'flex');
}

suppressMiss = false;

function animate() {
  requestAnimationFrame(animate);
  controls.enabled = isOrbitEnabled;
  controls.update();

  const lastY = (ballGroup.userData && ballGroup.userData.lastY) != null
    ? ballGroup.userData.lastY
    : ballGroup.position.y;

  const frameDt = 0.016;

  if (mode === 'challenge') {
    // Only tick while the round is active
    if (!challengeHasEnded) {
      shotClock = Math.max(0, shotClock - frameDt);
      if (shotClock === 0) {
        // finalize once
        const home  = leftStats?.score  || 0;
        const guest = rightStats?.score || 0;
        const finalScore = home + guest;
  
        challengeHasEnded = true; // guard immediately
        endChallenge(finalScore); // shows name entry + leaderboard
        return;                   // stop this frame’s post-end logic
      }
    }
  } else if (mode !== 'free') {
    // your regular 24s shot clock logic
    shotClock -= frameDt;
    if (shotClock <= 0) {
      resetBall();
      shotClock = 24;
  
      const msg = document.getElementById('shot-message');
      msg.innerText = 'SHOT CLOCK VIOLATION IS CALLED!';
      msg.style.color = '#ff4444';
      msg.style.fontSize = '48px';
      msg.style.left = '50%';
      msg.style.top = '50%';
      msg.style.transform = 'translate(-50%, -50%)';
      msg.style.animationDuration = '4s';
      msg.classList.remove('show');
      void msg.offsetWidth;
      msg.classList.add('show');
      return;
    }
  }  
  

  const secs = Math.ceil(shotClock);
  document.getElementById('game-clock').innerText =
    (mode === 'free') ? '00:00' : (secs < 10 ? '00:0' + secs : '00:' + secs);

  const physicsSubsteps = 3;
  const dt = frameDt / physicsSubsteps;

  if (ballGroup) {
    if (!isBallFlying) {
      const moveVector = new THREE.Vector3();
      if (mode !== 'free') {
        if (keysPressed['arrowleft'])  { ballGroup.position.x -= ballSpeed; moveVector.x -= ballSpeed; }
        if (keysPressed['arrowright']) { ballGroup.position.x += ballSpeed; moveVector.x += ballSpeed; }
        if (keysPressed['arrowup'])    { ballGroup.position.z -= ballSpeed; moveVector.z -= ballSpeed; }
        if (keysPressed['arrowdown'])  { ballGroup.position.z += ballSpeed; moveVector.z += ballSpeed; }
      }

      ballGroup.position.x = Math.max(ballBounds.xMin, Math.min(ballGroup.position.x, ballBounds.xMax));
      ballGroup.position.z = Math.max(ballBounds.zMin, Math.min(ballGroup.position.z, ballBounds.zMax));

      if (moveVector.lengthSq() > 0) {
        const axis = moveVector.clone().normalize().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const angle = moveVector.length() / ballRadius;
        ballGroup.rotateOnAxis(axis, angle);
      }

    } else {
      for (let i = 0; i < physicsSubsteps; i++) {
        ballVelocity.add(gravity.clone().multiplyScalar(dt));

        if (windEnabled) {
          const windAccel = new THREE.Vector3(windDir2D.x, 0, windDir2D.y)
            .multiplyScalar(MAX_WIND_ACCEL * (windIntensity / 100));
          ballVelocity.add(windAccel.multiplyScalar(dt));
        }

        ballGroup.position.add(ballVelocity.clone().multiplyScalar(dt));

        handleRimCollision(ballGroup, ballVelocity, [leftRimCenter, rightRimCenter], rimRadius);
        handleNetCollision(ballGroup, ballVelocity, [leftRimCenter, rightRimCenter], rimRadius);

        [[leftBoardX, 1], [rightBoardX, -1]].forEach(([bx, dir]) => {
          const frontX = bx + dir * (boardThickness / 2);
          const x = ballGroup.position.x;
          const insideX = (dir === 1 && x - ballRadius <= frontX) || (dir === -1 && x + ballRadius >= frontX);
          const yDiff = Math.abs(ballGroup.position.y - leftRimCenter.y);
          const zDiff = Math.abs(ballGroup.position.z);
          const withinBounds = yDiff <= backboardHalfH + ballRadius && zDiff <= backboardHalfW + ballRadius;

          if (insideX && withinBounds) {
            const normal = new THREE.Vector3(dir, 0, 0);
            const vDotN = ballVelocity.dot(normal);
            if (vDotN < 0) {
              // Backboard hit sound
              const impact = Math.abs(vDotN);
              const maxExpected = 8.0;
              const norm = Math.min(impact / maxExpected, 1);
              const volume = Math.pow(norm, 0.75);
              const rate = 0.95 + 0.25 * norm;
              const now = performance.now();
              const last = ballGroup.userData.lastBackboardSoundTime || 0;
              if (now - last > 80) {
                try {
                  backboardHitSound.pause();
                  backboardHitSound.currentTime = 0;
                  backboardHitSound.volume = volume;
                  backboardHitSound.playbackRate = rate;
                  backboardHitSound.play();
                } catch (_) {}
                ballGroup.userData.lastBackboardSoundTime = now;
              }

              ballGroup.userData.backboardHit = true;
              ballVelocity.addScaledVector(normal, -(1 + restitutionBoard) * vDotN);
              ballVelocity.y *= restitutionBoard;
              ballVelocity.z *= restitutionBoard;
              ballGroup.position.x = frontX + dir * ballRadius;
              if (mode === 'regular') shotClock = 24;
            }
          }
        });

        handlePoleCollision(ballGroup, ballVelocity, ballRadius, restitutionBoard);

        if (ballGroup.position.y <= groundHeight) {
          if (mode === 'free' && ballGroup.userData?.awaitingFTReset) {
            resetToFTLine();
            break;
          }

          ballGroup.position.y = groundHeight;
          if (ballVelocity.y < 0) {
            ballVelocity.y *= -restitutionGround;
            ballVelocity.x *= groundFriction;
            ballVelocity.z *= groundFriction;

            groundBounceCount++;
            const hitSpeed = Math.abs(ballVelocity.y);
            const maxExpectedSpeed = 3.0;

            const normalized = hitSpeed / maxExpectedSpeed;
            const volume = Math.pow(Math.min(normalized, 1), 0.7);
            const rate = 1.0 + 0.3 * normalized + 0.2 * (1 - Math.exp(-groundBounceCount / 5));

            groundHitSound.volume = volume;
            groundHitSound.playbackRate = rate;
            groundHitSound.currentTime = 0;
            groundHitSound.play();

            if (ballVelocity.length() < 0.2) {
              ballVelocity.set(0, 0, 0);
              isBallFlying = false;

              if (!hasScoredThisShot && !suppressMiss) {
                if (lastShotTeam === 'home') leftStats.comboCount = 0;
                else                         rightStats.comboCount = 0;
                showShotMessage("MISSED SHOT", lastShotTeam, '#ff4444');
              }
            }
          }
        }
      }

      if (!hasScoredThisShot) {
        [leftRimCenter, rightRimCenter].forEach((rimCenter, idx) => {
          const dx = ballGroup.position.x - rimCenter.x;
          const dz = ballGroup.position.z - rimCenter.z;
          const horizDist = Math.hypot(dx, dz);

          if (horizDist <= rimRadius &&
              lastY > rimCenter.y &&
              ballGroup.position.y < rimCenter.y &&
              ballVelocity.y < 0) {

            hasScoredThisShot = true;
            const isLeft = idx === 0;
            const stats = isLeft ? leftStats : rightStats;
            const teamKey = isLeft ? 'home' : 'guest';

            const rimHits = ballGroup.userData?.rimHits || 0;
            const hitBoard = !!ballGroup.userData?.backboardHit;
            const isSwish = (rimHits === 0) && !hitBoard;

            stats.comboCount++;
            let pts = 2;
            if (isSwish)           pts += SWISH_BONUS;
            if (stats.comboCount > 1) pts += (stats.comboCount - 1) * COMBO_BONUS;
            stats.score += pts;
            stats.made++;
            scoreSound.volume = 1.0;
            scoreSound.currentTime = 0;
            scoreSound.play();

            showShotMessage(`SHOT MADE! (+${pts})`, teamKey, '#00ff00');
            if (rimFireFX) {
              if (isLeft && rimFireFX.left) rimFireFX.left.start(2000);
              if (!isLeft && rimFireFX.right) rimFireFX.right.start(2000);
            }
            updateStatsDisplay();
          }
        });
      }

      trail.update();
      const speed = ballVelocity.length();
      if (speed > 0.001) {
        const spinAxis = new THREE.Vector3()
          .crossVectors(ballVelocity.clone().normalize(), new THREE.Vector3(0, 1, 0)).normalize();
        const spinAngle = (speed * frameDt) / ballRadius;
        ballGroup.rotateOnAxis(spinAxis, spinAngle);
      }

      ballGroup.position.x = Math.max(ballBounds.xMin + ballRadius,
        Math.min(ballGroup.position.x, ballBounds.xMax - ballRadius));
      ballGroup.position.z = Math.max(ballBounds.zMin + ballRadius,
        Math.min(ballGroup.position.z, ballBounds.zMax - ballRadius));

      if (!isBallFlying && trail.isActive) trail.stopTrail();
    }
  }

  if (ballGroup.userData) ballGroup.userData.lastY = ballGroup.position.y;
  suppressMiss = false;
  if (rimFireFX.left)  rimFireFX.left.update(frameDt);
  if (rimFireFX.right) rimFireFX.right.update(frameDt);
  renderer.render(scene, camera);
}

animate();