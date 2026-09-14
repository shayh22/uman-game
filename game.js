/* =========================================================
   game.js — "מסע אומן"
   משחק תלת־ממד לדפדפן: שביל לילי אל ציון רבי נחמן באומן,
   פנים הציון עם תצלומים אמיתיים מן המקום, וספרייה שמושכת את
   הספרים מספריא (Sefaria) ומקריאה אותם.

   מבנה: תוכן → מצב → סצנות (חוץ / ציון / ספרייה) → שליטה →
          אינטראקציה → קורא והקראה → תנועה → לולאה → זרימת מסכים
   ========================================================= */
function bootUman() {
'use strict';

/* ---------------------------------------------------------
   1. תוכן
   --------------------------------------------------------- */
const T = window.UMAN_LANG;
const BOOKS = window.UMAN_BOOKS;
const PHOTOS = window.UMAN_PHOTOS;
const LIB_API = window.SefariaLibrary;
const SAVE_KEY = 'uman.progress.v1';

/* ---------------------------------------------------------
   2. מצב המשחק
   --------------------------------------------------------- */
const S = {
  lang: 'he',
  t: T.he,
  area: 'outside',          // 'outside' | 'tzion' | 'library'
  running: false,           // המשחק התחיל
  paused: false,            // מסך מודאלי פתוח — התנועה מוקפאת
  gyro: false,
  gyroBase: null,
  move: { fwd: 0, turn: 0, strafe: 0 },
  yaw: 0,                   // מבט התחלתי: במורד השביל, אל הציון
  pitch: 0,
  opened: {},               // ספרים שנפתחו
  seenPhotos: {},
  selected: null,           // ספר שנבחר במדף
  atTzion: false            // נמצאים ברדיוס הסף של הציון
};
const $ = function (id) { return document.getElementById(id); };

/* עוצרים את העולם כשמסך מודאלי פתוח — אחרת השחקן "נוסע" בלי לראות */
function setPaused(on) {
  S.paused = !!on;
  if (on) { S.move.fwd = 0; S.move.turn = 0; S.move.strafe = 0; }
  else { S.gyroBase = null; }   // כיול מחדש אחרי שובו מהמסך
}

/* ---------- שמירת התקדמות ---------- */
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      lang: S.lang, opened: S.opened, seenPhotos: S.seenPhotos
    }));
  } catch (e) { /* אחסון חסום — לא קריטי */ }
}
function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (o && o.opened) S.opened = o.opened;
    if (o && o.seenPhotos) S.seenPhotos = o.seenPhotos;
    return o;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------
   3. Renderer, מצלמה, שלוש סצנות
   --------------------------------------------------------- */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
if (THREE.ACESFilmicToneMapping) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 1.62, 34);

const sceneOut = new THREE.Scene();
const sceneLib = new THREE.Scene();
const sceneTz = new THREE.Scene();
let scene = sceneOut;

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* three r128 אינו מפענח ערכי color מ-sRGB, ולכן גוונים כהים יוצאים
   בהירים מדי לעומת הטקסטורות. col() מיישר בין השניים. */
function col(hex) {
  const c = new THREE.Color(hex);
  return c.convertSRGBToLinear ? c.convertSRGBToLinear() : c;
}

/* --- טקסטורות פרוצדורליות --- */
function tex(w, h, draw, repX, repY) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  if (repX || repY) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
  }
  return t;
}
function noise(ctx, w, h, amount, dark) {
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = 'rgba(' + (dark ? '0,0,0,' : '255,255,255,') + (Math.random() * 0.06).toFixed(3) + ')';
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
}
const texStonePath = tex(256, 256, function (c, w, h) {
  c.fillStyle = '#4A4239'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const g = 60 + Math.random() * 34;
    c.fillStyle = 'rgb(' + (g + 14) + ',' + (g + 8) + ',' + (g - 4) + ')';
    c.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
  }
  noise(c, w, h, 900, true);
}, 2, 14);
const texGrass = tex(128, 128, function (c, w, h) {
  c.fillStyle = '#20301F'; c.fillRect(0, 0, w, h);
  noise(c, w, h, 1400, false);
}, 40, 40);
const texWallStone = tex(256, 256, function (c, w, h) {
  c.fillStyle = '#6A6152'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < 6; y++) {
    const off = (y % 2) * 22;
    for (let x = -1; x < 6; x++) {
      const g = 96 + Math.random() * 30;
      c.fillStyle = 'rgb(' + g + ',' + (g - 6) + ',' + (g - 20) + ')';
      c.fillRect(x * 44 + off + 2, y * 43 + 2, 40, 39);
    }
  }
  noise(c, w, h, 700, true);
}, 3, 2);
/* טיח בהיר — כמו קירות היכל הציון של היום */
const texPlaster = tex(256, 256, function (c, w, h) {
  c.fillStyle = '#D8CFBB'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = 'rgba(' + (150 + Math.random() * 60) + ',' + (140 + Math.random() * 55) + ',' + (120 + Math.random() * 45) + ',.18)';
    c.fillRect(Math.random() * w, Math.random() * h, Math.random() * 26 + 6, Math.random() * 18 + 4);
  }
  noise(c, w, h, 600, true);
}, 3, 2);
const texWood = tex(256, 256, function (c, w, h) {
  c.fillStyle = '#3A2415'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    c.strokeStyle = 'rgba(' + (90 + Math.random() * 50) + ',' + (60 + Math.random() * 30) + ',30,.4)';
    c.lineWidth = Math.random() * 2.4;
    c.beginPath(); c.moveTo(0, Math.random() * h);
    c.bezierCurveTo(w / 3, Math.random() * h, 2 * w / 3, Math.random() * h, w, Math.random() * h);
    c.stroke();
  }
}, 4, 4);
/* מרבד כהה ודק, לפנים הציון — כדי שהרצפה לא תמשוך את העין */
const texRunner = tex(128, 128, function (c, w, h) {
  c.fillStyle = '#3A1C18'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(199,155,76,.18)'; c.lineWidth = 2;
  c.strokeRect(8, 8, w - 16, h - 16);
  noise(c, w, h, 700, true);
}, 2, 3);
const texCarpet = tex(128, 128, function (c, w, h) {
  c.fillStyle = '#5A2320'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(232,176,75,.35)'; c.lineWidth = 4;
  c.strokeRect(10, 10, w - 20, h - 20);
  c.strokeRect(26, 26, w - 52, h - 52);
  noise(c, w, h, 500, true);
}, 3, 6);

/* טקסטורת שדרת ספר עם שם הספר */
function spineTexture(title, hex) {
  return tex(160, 512, function (c, w, h) {
    const base = '#' + hex.toString(16).padStart(6, '0');
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,.45)');
    g.addColorStop(0.35, base);
    g.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(214,170,90,.85)'; c.lineWidth = 5;
    c.strokeRect(14, 22, w - 28, h - 44);
    c.fillStyle = 'rgba(214,170,90,.75)';
    c.fillRect(20, 60, w - 40, 3); c.fillRect(20, h - 63, w - 40, 3);
    c.save();
    c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2);
    c.fillStyle = '#F0D9A6';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    let size = 46;
    c.font = '500 ' + size + 'px "Frank Ruhl Libre", Georgia, serif';
    while (c.measureText(title).width > h - 120 && size > 18) {
      size -= 2;
      c.font = '500 ' + size + 'px "Frank Ruhl Libre", Georgia, serif';
    }
    c.fillText(title, 0, 2);
    c.restore();
  });
}
/* פתח מואר: אור חם שנשפך מתוך חלל כהה, עם רמז לרצפה ולקשת */
function doorwayTexture() {
  return tex(256, 384, function (c, w, h) {
    const g = c.createRadialGradient(w / 2, h * .72, 10, w / 2, h * .72, h * .8);
    g.addColorStop(0, '#FFE9BC');
    g.addColorStop(.45, '#E8B55F');
    g.addColorStop(.8, '#8A5F26');
    g.addColorStop(1, '#2A1C0E');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // קשת עליונה כהה
    c.fillStyle = '#1E140A';
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * .16);
    c.quadraticCurveTo(w / 2, h * .015, 0, h * .16);
    c.closePath(); c.fill();
    // סף ורצפה
    c.fillStyle = 'rgba(40,26,12,.55)'; c.fillRect(0, h - 26, w, 26);
    c.fillStyle = 'rgba(255,226,170,.22)';
    c.fillRect(w * .2, h * .78, w * .6, 3);
    noise(c, w, h, 500, true);
  });
}

/* טקסטורת שלט */
function signTexture(text, sub) {
  return tex(512, 160, function (c, w, h) {
    c.fillStyle = '#2A1B10'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#C79B4C'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#F0D9A6'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let size = sub ? 52 : 62;
    c.font = '500 ' + size + 'px "Frank Ruhl Libre", Georgia, serif';
    while (c.measureText(text).width > w - 60 && size > 20) {
      size -= 2; c.font = '500 ' + size + 'px "Frank Ruhl Libre", Georgia, serif';
    }
    c.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2 + 2);
    if (sub) {
      c.font = '400 26px "Frank Ruhl Libre", Georgia, serif';
      c.fillStyle = 'rgba(240,217,166,.72)';
      c.fillText(sub, w / 2, h / 2 + 34);
    }
  });
}

/* ---------- תצלומים אמיתיים ---------- */
/* עד שהקובץ נטען מוצגת מסגרת ריקה בגוון קלף, כך שאין "חור" בסצנה */
const texPhotoPending = tex(64, 48, function (c, w, h) {
  c.fillStyle = '#1B1710'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(199,155,76,.5)'; c.lineWidth = 2;
  c.strokeRect(4, 4, w - 8, h - 8);
});
const texLoader = new THREE.TextureLoader();
const photoFrames = { outside: [], tzion: [], library: [] };

function loadPhotoInto(key, material) {
  const meta = PHOTOS[key];
  if (!meta) return;
  texLoader.load('assets/photos/' + meta.file, function (t) {
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    // התצלומים אינם בחזקות של 2 — מכבים מיפמאפים כדי להימנע מעיוות
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    material.map = t;
    material.needsUpdate = true;
  }, undefined, function () { /* אין קובץ — נשארת המסגרת הריקה */ });
}

/**
 * תצלום ממוסגר שאפשר להקיש עליו. height במטרים; הרוחב נגזר מיחס הצדדים.
 * area קובע באיזו סצנה הוא נספר לצורך raycast.
 */
function photoFrame(key, area, height, x, y, z, rotY, tint) {
  const meta = PHOTOS[key];
  if (!meta) return new THREE.Group();
  const w = height * (meta.w / meta.h);
  const g = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + .16, height + .16, .07),
    new THREE.MeshStandardMaterial({ color: col(0x8C6B31), metalness: .55, roughness: .45 })
  );
  const mat = new THREE.MeshBasicMaterial({ map: texPhotoPending, color: col(tint || 0xFFFFFF), toneMapped: false });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
  img.position.z = .045;
  img.userData.photo = key;
  loadPhotoInto(key, mat);
  photoFrames[area].push(img);

  g.add(frame, img);
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;
  return g;
}

/* --- חומרים משותפים --- */
const matStone = new THREE.MeshStandardMaterial({ map: texWallStone, roughness: .95 });
const matPlaster = new THREE.MeshStandardMaterial({ map: texPlaster, roughness: .92 });
const matWood = new THREE.MeshStandardMaterial({ map: texWood, roughness: .8 });
const matFlame = new THREE.MeshBasicMaterial({ color: col(0xFFE6AE) });
const matBrass = new THREE.MeshStandardMaterial({ color: col(0xC79B4C), metalness: .8, roughness: .3 });

/* נר קטן עם הילה */
function candle(x, y, z, intensity) {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .28, 8),
    new THREE.MeshStandardMaterial({ color: col(0xB8AC93), roughness: .85 }));
  wax.position.y = .14;
  const fl = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), matFlame);
  fl.position.y = .34; fl.scale.y = 1.7;
  g.add(wax, fl);
  if (intensity) {
    const l = new THREE.PointLight(0xFFCB73, intensity, 9, 2);
    l.position.y = .4; g.add(l);
  }
  g.position.set(x, y, z);
  return g;
}

const flickers = [];       // להבות מרצדות
const interactives = [];   // ספרים שאפשר למשוך

/* ---------------------------------------------------------
   4. סצנת החוץ — השביל, הציון, הספרייה וגלריית התצלומים
   --------------------------------------------------------- */
const OUT = {};

function buildOutside() {
  sceneOut.fog = new THREE.Fog(0x0A1020, 18, 120);
  sceneOut.background = new THREE.Color(0x050915);

  // שמיים בגרדיאנט
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0x050915) }, bot: { value: new THREE.Color(0x1B2C49) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ gl_FragColor = vec4(mix(bot, top, clamp(h*1.3+0.1,0.0,1.0)), 1.0); }'
    })
  );
  sceneOut.add(sky);

  // כוכבים
  const starGeo = new THREE.BufferGeometry();
  const pos = [];
  for (let i = 0; i < 900; i++) {
    const r = 150, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * .48;
    pos.push(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * .9, Math.sin(ph) * Math.sin(th) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sceneOut.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: col(0xCBD8F0), size: .9, sizeAttenuation: true })));

  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 16),
    new THREE.MeshBasicMaterial({ color: col(0xE9EEFB) }));
  moon.position.set(-60, 62, -110);
  sceneOut.add(moon);

  sceneOut.add(new THREE.HemisphereLight(0x5A76B0, 0x141A16, .55));
  const moonLight = new THREE.DirectionalLight(0x9FB6E6, .45);
  moonLight.position.set(-40, 50, -60);
  sceneOut.add(moonLight);

  // קרקע ושבילים
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: texGrass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  sceneOut.add(ground);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 78),
    new THREE.MeshStandardMaterial({ map: texStonePath, roughness: .9 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, .02, 0);
  sceneOut.add(path);

  const path2 = new THREE.Mesh(new THREE.PlaneGeometry(20, 4.5),
    new THREE.MeshStandardMaterial({ map: texStonePath, roughness: .9 }));
  path2.rotation.x = -Math.PI / 2;
  path2.position.set(-13, .02, -4);
  sceneOut.add(path2);

  // גדרות אבן לאורך השביל
  for (let z = 30; z > -26; z -= 6) {
    [-4.6, 4.6].forEach(function (x) {
      if (x < 0 && z < 0 && z > -9) return;   // פתח אל הספרייה
      const w = new THREE.Mesh(new THREE.BoxGeometry(.4, .85, 5.4), matStone);
      w.position.set(x, .42, z);
      sceneOut.add(w);
    });
  }

  // פנסים לאורך הדרך
  [26, 14, 2, -10, -22].forEach(function (z, i) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 3, 8),
      new THREE.MeshStandardMaterial({ color: col(0x2A2A2E), roughness: .6, metalness: .5 }));
    pole.position.y = 1.5;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .42),
      new THREE.MeshBasicMaterial({ color: col(0xFFD68C) }));
    lamp.position.y = 3.2;
    g.add(pole, lamp);
    if (i < 3) {
      const pl = new THREE.PointLight(0xFFC470, 1.5, 16, 2);
      pl.position.y = 3.2; g.add(pl);
    }
    g.position.set(5.6, 0, z);
    sceneOut.add(g);
    flickers.push(lamp);
  });

  // עצים
  const trunkMat = new THREE.MeshStandardMaterial({ color: col(0x2A1E14), roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: col(0x1D3320), roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const side = Math.random() < .5 ? -1 : 1;
    const x = side * (9 + Math.random() * 30);
    const z = -44 + Math.random() * 84;
    const h = 3.4 + Math.random() * 3.2;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, h, 6), trunkMat);
    tr.position.set(x, h / 2, z);
    const cr = new THREE.Mesh(new THREE.ConeGeometry(1.5 + Math.random(), h * 1.1, 7), leafMat);
    cr.position.set(x, h + h * .42, z);
    sceneOut.add(tr, cr);
  }

  // --- גלריית הדרך: האוהל שעל הקבר לאורך הדורות ---
  // לוחות מוארים לאורך צד השביל; הקשה עליהם פותחת את התצלום במלואו.
  const gallery = [
    ['ohel_1890', 26], ['ohel_color', 18], ['ohel_crowd', 10], ['ohel_selichot', 2]
  ];
  gallery.forEach(function (item) {
    const key = item[0], z = item[1];
    sceneOut.add(photoFrame(key, 'outside', 1.5, -6.5, 1.75, z, Math.PI / 2, 0xC8C0AE));
    const post = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.0, .16),
      new THREE.MeshStandardMaterial({ color: col(0x2B2620), roughness: .85 }));
    post.position.set(-6.5, .5, z);
    sceneOut.add(post);
    const lamp = new THREE.PointLight(0xFFD9A0, .95, 6, 2);
    lamp.position.set(-5.6, 2.7, z);
    sceneOut.add(lamp);
  });

  // --- מבנה הציון ---
  // חזית ב-z = -28.5; הקירות חוסמים, והכניסה היא דרך השלט שליד הדלת.
  const tz = new THREE.Group();
  // טיח מוצלל: בלילה הקיר כמעט שחור, ורק הפתח והחלונות זורחים
  const matPlasterNight = new THREE.MeshStandardMaterial({ map: texPlaster, color: col(0x6B6252), roughness: .95 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 11), matPlasterNight);
  base.position.y = 2.75;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: col(0x1F4A5E), roughness: .45, metalness: .35 }));
  dome.position.y = 5.4;
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(.06, .12, 1.2, 6), matBrass);
  finial.position.y = 10.2;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4),
    new THREE.MeshBasicMaterial({ map: doorwayTexture() }));
  door.position.set(0, 2, 5.56);
  // מזוזות ומשקוף כהים, כדי שהפתח ייקרא כפתח ולא ככתם אור
  [[-1.45, 2, .42, 4.3], [1.45, 2, .42, 4.3], [0, 4.2, 3.3, .3]].forEach(function (d) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(d[2], d[3], .3),
      new THREE.MeshStandardMaterial({ color: col(0x3B3229), roughness: .9 }));
    j.position.set(d[0], d[1], 5.62);
    tz.add(j);
  });
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: signTexture('היכל הציון', 'רבי נחמן מברסלב') }));
  lintel.position.set(0, 4.5, 5.57);
  [-4.4, 4.4].forEach(function (x) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2),
      new THREE.MeshBasicMaterial({ color: col(0xD99A34) }));
    win.position.set(x, 3.1, 5.56);
    tz.add(win);
  });
  const glow = new THREE.PointLight(0xFFC777, 1.5, 15, 2);
  glow.position.set(0, 2.4, 7.5);
  tz.add(base, dome, finial, door, lintel, glow);
  tz.position.set(0, 0, -34);
  sceneOut.add(tz);

  // נרות בסף
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const c = candle(i * 1.1, .1, -27.4, i === -1 ? .7 : 0);
    sceneOut.add(c);
    flickers.push(c.children[1]);
  }

  // לוחות המתחם משני צדי הגישה — כך נראה המקום במציאות
  sceneOut.add(photoFrame('tzion_heichal', 'outside', 1.8, -5.4, 2.0, -25.5, Math.PI / 2 + .35, 0xD2CBBB));
  sceneOut.add(photoFrame('tzion_gate', 'outside', 1.8, 5.4, 2.0, -25.5, -Math.PI / 2 - .35, 0xD2CBBB));
  sceneOut.add(photoFrame('tzion_entrance', 'outside', 1.5, 6.6, 1.8, -18, -Math.PI / 2, 0xC8C0AE));
  sceneOut.add(photoFrame('tzion_shaar', 'outside', 1.5, 6.6, 1.8, -8, -Math.PI / 2, 0xC8C0AE));

  // --- מבנה הספרייה ---
  const lib = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 13), matStone);
  body.position.y = 3.25;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12.4, 3.4, 4),
    new THREE.MeshStandardMaterial({ color: col(0x3B2418), roughness: .9 }));
  roof.position.y = 8.2; roof.rotation.y = Math.PI / 4;
  const ldoor = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.2),
    new THREE.MeshBasicMaterial({ map: doorwayTexture() }));
  ldoor.position.set(0, 2.1, 6.56);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75),
    new THREE.MeshBasicMaterial({ map: signTexture(T[S.lang].placeLib) }));
  sign.position.set(0, 5.1, 6.58);
  [-4.6, 4.6].forEach(function (x) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.4),
      new THREE.MeshBasicMaterial({ color: col(0xD99A34) }));
    win.position.set(x, 3, 6.56);
    lib.add(win);
  });
  const lglow = new THREE.PointLight(0xFFC777, 1.4, 15, 2);
  lglow.position.set(0, 2.6, 8.5);
  lib.add(body, roof, ldoor, sign, lglow);
  lib.position.set(-13, 0, -12);
  sceneOut.add(lib);

  // הקלויז של רבי נתן — תצלום ליד דלת הספרייה
  sceneOut.add(photoFrame('kloiz_out', 'outside', 1.4, -9.6, 1.8, -5.3, 0, 0xCFC7B4));

  // נקודות הסף
  OUT.libDoor = new THREE.Vector3(-13, 0, -4.6);
  OUT.tzionDoor = new THREE.Vector3(0, 0, -27.4);
}

/* ---------------------------------------------------------
   5. סצנת הציון — פנים המבנה, עם התצלומים האמיתיים
   --------------------------------------------------------- */
const TZ = {
  minX: -6.2, maxX: 6.2, minZ: -3.6, maxZ: 4.2,
  exit: new THREE.Vector3(0, 0, 4.4),
  grave: new THREE.Vector3(0, 0, -3.4)
};

function buildTzion() {
  sceneTz.fog = new THREE.Fog(0x120E08, 7, 34);
  sceneTz.background = new THREE.Color(0x120E08);
  // תאורה מאופקת בכוונה: האור היחיד הוא הנרות והנברשת, כדי שהתצלום
  // של הציון — שאינו מושפע מתאורה — יהיה הדבר הבהיר היחיד בחדר.
  sceneTz.add(new THREE.HemisphereLight(0xC9A268, 0x120C06, .16));
  sceneTz.add(new THREE.AmbientLight(0xFFCB87, .10));

  const W = 15, D = 11, H = 5.2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: texStonePath, color: col(0x9A9186), roughness: .95 }));
  floor.rotation.x = -Math.PI / 2;
  sceneTz.add(floor);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 8),
    new THREE.MeshStandardMaterial({ map: texRunner, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, .01, 0);
  sceneTz.add(rug);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: col(0x120D08), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  sceneTz.add(ceil);

  const wallTz = new THREE.MeshStandardMaterial({ map: texPlaster, color: col(0x5E5547), roughness: .96 });
  [[0, H / 2, -D / 2, W, H, .3], [0, H / 2, D / 2, W, H, .3],
   [-W / 2, H / 2, 0, .3, H, D], [W / 2, H / 2, 0, .3, H, D]].forEach(function (w) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), wallTz);
    m.position.set(w[0], w[1], w[2]);
    sceneTz.add(m);
  });

  // --- הציון עצמו: התצלום האמיתי, בגודל מלא, מאחורי מעקה ונרות ---
  sceneTz.add(photoFrame('tzion_grave', 'tzion', 2.9, 0, 2.0, -D / 2 + .2, 0));

  const arch = new THREE.Mesh(new THREE.BoxGeometry(4.6, .18, .3), matBrass);
  arch.position.set(0, 3.62, -D / 2 + .22);
  sceneTz.add(arch);

  // מעקה עץ לפני הציון
  const rail = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(5.2, .1, .1), matWood);
  bar.position.y = .95;
  rail.add(bar);
  for (let i = -2; i <= 2; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .95, 6), matWood);
    p.position.set(i * 1.25, .47, 0);
    rail.add(p);
  }
  rail.position.set(0, 0, -2.5);
  sceneTz.add(rail);

  // נרות לאורך הסף
  for (let i = -4; i <= 4; i++) {
    const c = candle(i * .62, .06, -D / 2 + .75, Math.abs(i) === 2 ? .9 : 0);
    sceneTz.add(c);
    flickers.push(c.children[1]);
  }
  // הילה רכה שמלטפת את הציון מלמטה, כמו נרות הזיכרון שלפניו
  const graveGlow = new THREE.PointLight(0xFFB765, 1.5, 9, 2);
  graveGlow.position.set(0, 1.1, -4.1);
  sceneTz.add(graveGlow);

  // --- תצלומי הפנים על קירות הצד ---
  sceneTz.add(photoFrame('tzion_hall', 'tzion', 1.9, -W / 2 + .2, 2.05, -1.4, Math.PI / 2));
  sceneTz.add(photoFrame('tzion_prayer', 'tzion', 1.9, -W / 2 + .2, 2.05, 1.9, Math.PI / 2));
  sceneTz.add(photoFrame('tzion_tefila', 'tzion', 1.9, W / 2 - .2, 2.05, -1.4, -Math.PI / 2));
  sceneTz.add(photoFrame('ohel_crowd', 'tzion', 1.9, W / 2 - .2, 2.05, 1.9, -Math.PI / 2));

  // נברשת
  const ch = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .05, 8, 24), matBrass);
  ring.rotation.x = Math.PI / 2;
  ch.add(ring);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 8), matFlame);
    fl.position.set(Math.cos(a) * .95, .18, Math.sin(a) * .95);
    fl.scale.y = 1.6;
    ch.add(fl); flickers.push(fl);
  }
  ch.add(new THREE.PointLight(0xFFC777, 1.15, 13, 2));
  ch.position.set(0, 4.2, .6);
  sceneTz.add(ch);

  // דלת היציאה
  const ex = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8),
    new THREE.MeshBasicMaterial({ color: col(0x2F4A68) }));
  ex.position.set(0, 1.9, D / 2 - .18); ex.rotation.y = Math.PI;
  sceneTz.add(ex);
}

/* ---------------------------------------------------------
   6. סצנת הספרייה — פנים המבנה והמדפים
   --------------------------------------------------------- */
const LIB = { minX: -10.2, maxX: 10.2, minZ: -6.2, maxZ: 7.4, exit: new THREE.Vector3(0, 0, 7.4) };

function bookcase(px, pz, rotY, picks) {
  const g = new THREE.Group();
  const caseMat = matWood;
  const W = 6.4, H = 3.4, D = .62;

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, .1), caseMat);
  back.position.set(0, H / 2, -D / 2);
  g.add(back);
  [-W / 2, W / 2].forEach(function (x) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.16, H, D), caseMat);
    s.position.set(x, H / 2, 0); g.add(s);
  });
  const rows = [.55, 1.5, 2.45];
  rows.forEach(function (y) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(W, .09, D), caseMat);
    sh.position.set(0, y - .3, 0); g.add(sh);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + .2, .14, D + .12), caseMat);
  top.position.set(0, H, 0); g.add(top);

  let pick = 0;
  rows.forEach(function (y, ri) {
    let x = -W / 2 + .4;
    while (x < W / 2 - .5) {
      const bw = .1 + Math.random() * .1;
      const bh = .52 + Math.random() * .2;
      const special = picks[pick] && ri === picks[pick].row && x > picks[pick].x;
      const data = special ? BOOKS[picks[pick].book] : null;
      const width = special ? .2 : bw;
      const height = special ? .78 : bh;
      const color = special ? data.color : [0x3A271D, 0x243043, 0x30392A, 0x412536, 0x53401D][Math.floor(Math.random() * 5)];
      const mat = special
        ? [new THREE.MeshStandardMaterial({ color: col(0x1A120C), roughness: .8 }),
           new THREE.MeshStandardMaterial({ color: col(0x1A120C), roughness: .8 }),
           new THREE.MeshStandardMaterial({ color: col(0x201810), roughness: .8 }),
           new THREE.MeshStandardMaterial({ color: col(0x201810), roughness: .8 }),
           new THREE.MeshStandardMaterial({ map: spineTexture(data.title[S.lang], data.color), roughness: .65 }),
           new THREE.MeshStandardMaterial({ color: col(0x120C08), roughness: .9 })]
        : new THREE.MeshStandardMaterial({ color: col(color), roughness: .85 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, D * .78), mat);
      m.position.set(x + width / 2, y - .25 + height / 2, .02);
      m.rotation.z = special ? 0 : (Math.random() - .5) * .04;
      g.add(m);
      if (special) {
        m.userData.book = data;
        m.userData.home = m.position.clone();
        m.userData.homeQuat = m.quaternion.clone();
        m.userData.group = g;
        interactives.push(m);
        pick++;
      }
      x += width + .035;
    }
  });

  g.position.set(px, 0, pz);
  g.rotation.y = rotY;
  return g;
}

function buildLibrary() {
  sceneLib.fog = new THREE.Fog(0x14100A, 6, 40);
  sceneLib.background = new THREE.Color(0x14100A);
  sceneLib.add(new THREE.HemisphereLight(0xE0B678, 0x1A120A, .28));
  sceneLib.add(new THREE.AmbientLight(0xFFCB87, .16));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 17),
    new THREE.MeshStandardMaterial({ map: texWood, roughness: .75 }));
  floor.rotation.x = -Math.PI / 2;
  sceneLib.add(floor);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, 10),
    new THREE.MeshStandardMaterial({ map: texCarpet, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = .01;
  sceneLib.add(rug);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 17),
    new THREE.MeshStandardMaterial({ color: col(0x2A1F16), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 5;
  sceneLib.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ map: texWallStone, roughness: .95 });
  [[0, 2.5, -8.5, 24, 5, .3], [0, 2.5, 8.5, 24, 5, .3],
   [-12, 2.5, 0, .3, 5, 17], [12, 2.5, 0, .3, 5, 17]].forEach(function (w) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), wallMat);
    m.position.set(w[0], w[1], w[2]);
    sceneLib.add(m);
  });

  // נברשת
  const ch = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .06, 8, 28), matBrass);
  ring.rotation.x = Math.PI / 2;
  ch.add(ring);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), matFlame);
    fl.position.set(Math.cos(a) * 1.15, .2, Math.sin(a) * 1.15);
    fl.scale.y = 1.6;
    ch.add(fl); flickers.push(fl);
  }
  ch.add(new THREE.PointLight(0xFFC777, 1.9, 20, 2));
  ch.position.set(0, 4.1, 0);
  sceneLib.add(ch);

  const warm1 = new THREE.PointLight(0xFFB765, 1.2, 14, 2); warm1.position.set(-7, 2.6, -4); sceneLib.add(warm1);
  const warm2 = new THREE.PointLight(0xFFB765, 1.0, 14, 2); warm2.position.set(7, 2.6, 2); sceneLib.add(warm2);

  sceneLib.add(bookcase(-3.4, -8.1, 0, [{ row: 1, x: -1.2, book: 0 }, { row: 2, x: .6, book: 1 }]));
  sceneLib.add(bookcase(3.4, -8.1, 0, [{ row: 1, x: -.4, book: 2 }]));
  sceneLib.add(bookcase(-11.5, -1.5, Math.PI / 2, [{ row: 1, x: -.8, book: 3 }]));
  sceneLib.add(bookcase(11.5, 1.5, -Math.PI / 2, [{ row: 2, x: -.6, book: 4 }]));

  // תצלומים על הקירות הפנויים
  sceneLib.add(photoFrame('lib_interior', 'library', 1.9, -11.8, 2.6, 4.6, Math.PI / 2));
  sceneLib.add(photoFrame('kloiz_in', 'library', 1.9, 11.8, 2.6, -4.4, -Math.PI / 2));

  // שולחן לימוד + נרות
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, .16, 1.5),
    new THREE.MeshStandardMaterial({ color: col(0x4A3220), roughness: .7 }));
  table.position.set(0, .82, -2.4);
  sceneLib.add(table);
  [-1.2, 1.2].forEach(function (x) {
    [-.5, .5].forEach(function (z) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .82, 6),
        new THREE.MeshStandardMaterial({ color: col(0x3A2718), roughness: .8 }));
      leg.position.set(x, .41, -2.4 + z);
      sceneLib.add(leg);
    });
  });
  const c1 = candle(-.9, .9, -2.4, 1.1), c2 = candle(.9, .9, -2.4, 0);
  sceneLib.add(c1, c2);
  flickers.push(c1.children[1], c2.children[1]);

  const ex = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8),
    new THREE.MeshBasicMaterial({ color: col(0x3D5A7A) }));
  ex.position.set(0, 1.9, 8.33); ex.rotation.y = Math.PI;
  sceneLib.add(ex);
}

/* ---------------------------------------------------------
   7. שליטה: ג'ירוסקופ, ג'ויסטיק, מקלדת
   --------------------------------------------------------- */
function onOrientation(e) {
  if (!S.gyro || S.paused || e.beta === null) return;
  if (S.gyroBase === null) S.gyroBase = e.beta;
  const dB = e.beta - S.gyroBase;
  const dG = e.gamma;
  const dead = function (v, d) { return Math.abs(v) < d ? 0 : v - Math.sign(v) * d; };
  S.move.fwd = Math.max(-1, Math.min(1, dead(dB, 4) / 22));
  S.move.turn = Math.max(-1, Math.min(1, dead(dG, 5) / 28));
}
window.addEventListener('deviceorientation', onOrientation, true);

function enableGyro() {
  const D = window.DeviceOrientationEvent;
  if (!D) return Promise.resolve(false);
  if (typeof D.requestPermission === 'function') {
    return D.requestPermission().then(function (r) {
      S.gyro = (r === 'granted'); S.gyroBase = null; return S.gyro;
    }).catch(function () { return false; });
  }
  S.gyro = true; S.gyroBase = null;
  return Promise.resolve(true);
}
function syncGyroBtn() {
  const b = $('gyroBtn');
  b.textContent = S.gyro ? S.t.gyroOn : S.t.gyroOff;
  b.dataset.on = S.gyro ? '1' : '0';
}
$('gyroBtn').addEventListener('click', function () {
  if (S.gyro) { S.gyro = false; S.move.fwd = 0; S.move.turn = 0; syncGyroBtn(); return; }
  enableGyro().then(syncGyroBtn);
});

/* ג'ויסטיק וירטואלי */
(function () {
  const stick = $('stick'), knob = stick.querySelector('i');
  let id = null, cx = 0, cy = 0, R = 44;
  function set(dx, dy) {
    const d = Math.min(Math.hypot(dx, dy), R), a = Math.atan2(dy, dx);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    knob.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    S.move.fwd = -y / R;
    S.move.strafe = x / R;
  }
  stick.addEventListener('pointerdown', function (e) {
    if (S.paused) return;
    id = e.pointerId; stick.setPointerCapture(id);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2 - 14;
    set(e.clientX - cx, e.clientY - cy); e.preventDefault();
  });
  stick.addEventListener('pointermove', function (e) {
    if (e.pointerId !== id) return;
    set(e.clientX - cx, e.clientY - cy);
  });
  function end(e) {
    if (e.pointerId !== id) return;
    id = null; knob.style.transform = '';
    if (!S.gyro) S.move.fwd = 0;
    S.move.strafe = 0;
  }
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
})();

/* מקלדת (לבדיקה בדסקטופ) */
const keys = {};
window.addEventListener('keydown', function (e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape') closeTopLayer();
});
window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

/* ---------------------------------------------------------
   8. בחירת ספר, תצלומים ומחוות המשיכה
   --------------------------------------------------------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tweens = [];

function tweenTo(obj, pos, quat, scl, dur, cb) {
  tweens.push({
    o: obj, t: 0, dur: dur,
    p0: obj.position.clone(), p1: pos,
    q0: obj.quaternion.clone(), q1: quat,
    s0: obj.scale.clone(), s1: scl, cb: cb
  });
}
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i];
    w.t += dt;
    let k = Math.min(1, w.t / w.dur);
    k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
    w.o.position.lerpVectors(w.p0, w.p1, k);
    if (w.q1) w.o.quaternion.copy(w.q0).slerp(w.q1, k);
    if (w.s1) w.o.scale.lerpVectors(w.s0, w.s1, k);
    if (w.t >= w.dur) { tweens.splice(i, 1); if (w.cb) w.cb(); }
  }
}
function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

/* raycast משותף: קודם ספרים (רק בספרייה), אחר כך תצלומים */
function pickAt(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);

  if (S.area === 'library') {
    const hits = ray.intersectObjects(interactives, false);
    if (hits.length && hits[0].distance < 7) return { kind: 'book', obj: hits[0].object };
  }
  const ph = ray.intersectObjects(photoFrames[S.area], false);
  if (ph.length && ph[0].distance < 9) return { kind: 'photo', obj: ph[0].object };
  return null;
}

function selectBook(m) {
  if (S.selected === m) return;
  releaseBook();
  S.selected = m;
  const out = m.userData.home.clone(); out.z += .26;
  tweenTo(m, out, null, null, .28);
  buzz(12);
  showHint(S.t.pull);
}
function releaseBook() {
  const m = S.selected;
  S.selected = null;
  hideHint();
  if (m && !m.userData.pulled) tweenTo(m, m.userData.home.clone(), m.userData.homeQuat.clone(), null, .28);
}
function pullBook(m) {
  if (!m || m.userData.pulled) return;
  m.userData.pulled = true;
  hideHint();
  buzz([18, 40, 26]);
  const local = m.userData.group.worldToLocal(
    camera.localToWorld(new THREE.Vector3(0, -.16, -.85))
  );
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -m.userData.group.rotation.y + S.yaw, .12));
  tweenTo(m, local, q, new THREE.Vector3(1.6, 1.25, 1.6), .62, function () {
    openReader(m.userData.book);
    setTimeout(function () {
      m.userData.pulled = false;
      tweenTo(m, m.userData.home.clone(), m.userData.homeQuat.clone(), new THREE.Vector3(1, 1, 1), .5);
    }, 500);
  });
}

/* מגע על הקנבס: בחירה/משיכה/תצלום, ואחרת — סיבוב מבט */
(function () {
  let mode = null, sx = 0, sy = 0, lastX = 0, lastY = 0, target = null, pid = null;
  canvas.addEventListener('pointerdown', function (e) {
    if (!S.running || S.paused) return;
    pid = e.pointerId; sx = lastX = e.clientX; sy = lastY = e.clientY;
    const hit = pickAt(e.clientX, e.clientY);
    if (hit && hit.kind === 'book') { mode = 'book'; target = hit.obj; selectBook(target); }
    else if (hit && hit.kind === 'photo') { mode = 'photo'; target = hit.obj; }
    else { mode = 'look'; target = null; }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== pid || !S.running || S.paused) return;
    if (mode === 'look') {
      S.yaw -= (e.clientX - lastX) * .0045;
      S.pitch = Math.max(-.6, Math.min(.6, S.pitch - (e.clientY - lastY) * .003));
      lastX = e.clientX; lastY = e.clientY;
    } else if (mode === 'book' && target) {
      const dy = e.clientY - sy, dx = Math.abs(e.clientX - sx);
      if (dy > 62 && dx < 130) { pullBook(target); mode = null; target = null; }
    } else if (mode === 'photo' && Math.hypot(e.clientX - sx, e.clientY - sy) > 18) {
      mode = 'look'; target = null; lastX = e.clientX; lastY = e.clientY;
    }
  });
  function up(e) {
    if (e.pointerId !== pid) return;
    const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    if (mode === 'photo' && target && moved < 18) {
      openLightbox(target.userData.photo);
    } else if (mode === 'book' && target && moved < 12 && target.userData.tapped) {
      pullBook(target);
    } else if (mode === 'book' && target) {
      target.userData.tapped = true;
    }
    mode = null; pid = null; target = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
})();

function showHint(txt) { const h = $('pullHint'); h.textContent = txt; h.classList.remove('hidden'); }
function hideHint() { $('pullHint').classList.add('hidden'); }

/* ---------------------------------------------------------
   9. מציג התצלומים
   --------------------------------------------------------- */
function openLightbox(key) {
  const meta = PHOTOS[key];
  if (!meta) return;
  S.seenPhotos[key] = true; saveProgress();
  $('lbImg').src = 'assets/photos/' + meta.file;
  $('lbImg').alt = meta.caption[S.lang] || '';
  $('lbCap').textContent = meta.caption[S.lang] || '';

  const bits = [];
  bits.push(esc(S.t.photoCredit) + ': ' + esc(meta.author));
  bits.push(esc(S.t.photoLicense) + ': ' +
    (meta.licenseUrl
      ? '<a href="' + esc(meta.licenseUrl) + '" target="_blank" rel="noopener">' + esc(meta.license) + '</a>'
      : esc(meta.license)));
  bits.push('<a href="' + esc(meta.page) + '" target="_blank" rel="noopener">' +
    esc(S.t.photoSource) + ': Wikimedia Commons</a>');
  $('lbMeta').innerHTML = bits.map(function (b) { return '<span>' + b + '</span>'; }).join('');

  $('lightbox').classList.remove('hidden');
  $('hud').classList.add('hidden');
  clearPrompt();
  setPaused(true);
  buzz(10);
}
function closeLightbox() {
  $('lightbox').classList.add('hidden');
  $('lbImg').removeAttribute('src');
  if (S.running) $('hud').classList.remove('hidden');
  setPaused(false);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
$('lbClose').addEventListener('click', closeLightbox);

/* Escape / כפתור אחורה — סוגר את השכבה העליונה שפתוחה */
function closeTopLayer() {
  if (!$('lightbox').classList.contains('hidden')) { closeLightbox(); return true; }
  if (!$('reader').classList.contains('hidden')) { closeReader(); return true; }
  if (!$('tzion').classList.contains('hidden')) { closeTzionScreen(); return true; }
  return false;
}

/* ---------------------------------------------------------
   10. שלטי אינטראקציה ומעבר בין אזורים
   --------------------------------------------------------- */
let promptAction = null;
let lastPromptKey = '';
function setPrompt(text, btn, action) {
  const key = text + '|' + (btn || '');
  if (key !== lastPromptKey) {          // כותבים ל-DOM רק כשהטקסט משתנה
    $('promptText').textContent = text;
    const b = $('promptBtn');
    if (btn) { b.textContent = btn; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
    lastPromptKey = key;
  }
  promptAction = action || null;
  $('prompt').classList.remove('hidden');
}
function clearPrompt() {
  $('prompt').classList.add('hidden');
  promptAction = null;
  lastPromptKey = '';
}
$('promptBtn').addEventListener('click', function () { if (promptAction) promptAction(); });

let lastPlace = '';
function setPlace(txt) {
  if (txt === lastPlace) return;
  lastPlace = txt;
  $('place').textContent = txt;
}

function fade(cb) {
  const f = $('flash');
  f.classList.add('on');
  setTimeout(function () { cb(); f.classList.remove('on'); }, 460);
}
function goLibrary() {
  fade(function () {
    scene = sceneLib; S.area = 'library';
    camera.position.set(0, 1.62, 6.2);
    S.yaw = 0; S.pitch = 0;                 // מבט אל המדפים
    S.gyroBase = null;
    setPlace(S.t.placeLib);
    clearPrompt();
  });
}
function goTzion() {
  fade(function () {
    scene = sceneTz; S.area = 'tzion';
    camera.position.set(0, 1.62, 2.9);
    S.yaw = 0; S.pitch = 0;                 // מבט אל הציון
    S.gyroBase = null;
    setPlace(S.t.placeTzion);
    clearPrompt();
  });
}
function goOutsideFromLib() {
  fade(function () {
    scene = sceneOut; S.area = 'outside';
    camera.position.set(-13, 1.62, -3.6);
    S.yaw = Math.PI * 1.5; S.pitch = 0;     // מבט אל השביל
    S.gyroBase = null;
    setPlace(S.t.placePath);
    clearPrompt();
  });
}
function goOutsideFromTzion() {
  fade(function () {
    scene = sceneOut; S.area = 'outside';
    camera.position.set(0, 1.62, -26.4);
    S.yaw = Math.PI; S.pitch = 0;           // מבט חזרה במעלה השביל
    S.gyroBase = null;
    S.atTzion = false;
    setPlace(S.t.placePath);
    clearPrompt();
  });
}

function updateCounter() {
  $('counter').textContent = S.t.counter(Object.keys(S.opened).length, BOOKS.length);
}

/* מסך העמידה על הציון — נפתח מהשלט, ניתן לפתוח שוב ושוב */
function openTzionScreen() {
  $('tzion').classList.remove('hidden');
  $('hud').classList.add('hidden');
  clearPrompt();
  setPaused(true);
  buzz(30);
}
function closeTzionScreen() {
  $('tzion').classList.add('hidden');
  if (S.running) $('hud').classList.remove('hidden');
  setPaused(false);
}
$('tzionBtn').addEventListener('click', closeTzionScreen);

/* ---------------------------------------------------------
   11. קורא הספרים + נגן ההקראה
   --------------------------------------------------------- */
const TTS = {
  parts: [], idx: 0, playing: false, rate: 1, voice: null, current: null, textLang: null,
  pickVoice: function () {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const want = this.textLang || S.lang;
    this.voice = vs.filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf(want) === 0;
    })[0] || null;
    return this.voice;
  },
  load: function (text, lang) {
    this.stop();
    this.parts = LIB_API.sentences(LIB_API.toSpeech(text));
    this.idx = 0;
    this.textLang = lang || S.lang;
    this.voice = null;            // הקול נבחר מחדש לפי שפת הטקסט המוצג
  },
  speakCurrent: function () {
    if (!window.speechSynthesis || this.idx >= this.parts.length) { this.stop(); return; }
    const u = new SpeechSynthesisUtterance(this.parts[this.idx]);
    u.lang = (T[this.textLang] || S.t).code;
    u.rate = this.rate;
    u.pitch = 1;
    if (!this.voice) this.pickVoice();
    if (this.voice) u.voice = this.voice;
    const self = this;
    u.onend = function () {
      if (!self.playing) return;
      self.idx++;
      if (self.idx < self.parts.length) self.speakCurrent(); else self.stop();
    };
    u.onerror = function () { self.stop(); };
    this.current = u;
    speechSynthesis.speak(u);
  },
  play: function () {
    if (!window.speechSynthesis || !this.parts.length) return;
    this.playing = true; syncPlayBtn();
    if (speechSynthesis.paused) { speechSynthesis.resume(); return; }
    this.speakCurrent();
  },
  pause: function () {
    if (!window.speechSynthesis) return;
    this.playing = false; syncPlayBtn();
    try { speechSynthesis.pause(); } catch (e) { speechSynthesis.cancel(); }
  },
  forward: function () {
    if (this.idx < this.parts.length - 1) {
      this.idx++;
      if (window.speechSynthesis) speechSynthesis.cancel();
      if (this.playing) this.speakCurrent();
    }
  },
  stop: function () {
    this.playing = false;
    if (window.speechSynthesis) speechSynthesis.cancel();
    syncPlayBtn();
  }
};
/* הקולות לא תמיד טעונים בפתיחה, ו-onvoiceschanged לא תמיד נורה */
(function primeVoices() {
  if (!window.speechSynthesis) return;
  let tries = 0;
  const tick = function () {
    if (TTS.pickVoice() || ++tries > 12) return;
    setTimeout(tick, 350);
  };
  speechSynthesis.onvoiceschanged = function () { TTS.pickVoice(); };
  tick();
})();

function syncPlayBtn() { $('playBtn').textContent = TTS.playing ? S.t.pause : S.t.play; }

let openBook = null, pageIdx = 0, readToken = 0;

function openReader(book) {
  openBook = book; pageIdx = 0;
  if (!S.opened[book.id]) { S.opened[book.id] = true; saveProgress(); }
  updateCounter();
  $('bookTitle').textContent = book.title[S.lang];
  renderPage();
  $('reader').classList.remove('hidden');
  $('hud').classList.add('hidden');
  clearPrompt();
  setPaused(true);
}
function closeReader() {
  TTS.stop();
  $('reader').classList.add('hidden');
  if (S.running) $('hud').classList.remove('hidden');
  releaseBook();
  openBook = null;
  setPaused(false);
}
$('closeBook').addEventListener('click', closeReader);

/* מציג את מה שיש מיד, ומחליף כשמגיעה גרסה טרייה מהספרייה */
function renderPage() {
  const p = openBook.pages[pageIdx];
  const lang = S.lang;
  const token = ++readToken;

  $('pageTitle').textContent = p.title[lang];
  $('pageNum').textContent = S.t.pageOf(pageIdx + 1, openBook.pages.length);
  $('prevPage').disabled = pageIdx === 0;
  $('nextPage').disabled = pageIdx === openBook.pages.length - 1;
  $('pages').scrollTop = 0;

  // סדר העדפה: שפת המשחק, ואם אין תרגום — אנגלית ואז עברית,
  // כדי שלא יוצג עמוד ריק כשספריא לא מחזיקה תרגום בשפה הזו.
  const chain = [lang, 'en', 'he'].filter(function (l, i, a) { return a.indexOf(l) === i; });
  const fallback = (p.offline && p.offline[lang]) || '';
  let shown = null;

  if (p.ref) {
    shown = LIB_API.read(p.ref, chain, function (fresh) {
      if (token !== readToken) return;              // המשתמש כבר דפדף הלאה
      // טקסט חי בשפת המשחק גובר תמיד; בשפה חלופית — רק אם אין מה להציג
      if (fresh.lang === lang || !$('pageBody').textContent) showText(fresh.text, fresh, false);
    });
  }

  if (shown && shown.text && (shown.lang === lang || !fallback)) {
    showText(shown.text, shown, !!p.ref);
  } else if (fallback) {
    showText(fallback, null, !!p.ref);
  } else if (p.ref) {
    showText('', null, true);                        // ממתינים לרשת
  } else {
    showText('', null, false);
  }
}

function showText(body, entry, pending) {
  const wasPlaying = TTS.playing;
  const el = $('pageBody');
  el.textContent = body || '';
  el.classList.toggle('loading', !body && pending);

  // שורת המקור
  const src = $('srcLine');
  const p = openBook ? openBook.pages[pageIdx] : null;
  let html = '';
  if (!body && pending) {
    html = '<span><span id="pageSpin"></span>' + esc(S.t.loading) + '</span>';
  } else if (entry) {
    const label = LIB_API.refLabel(entry, S.lang);
    const line = entry.lang !== S.lang
      ? S.t.srcOther(label, S.t.langName[entry.lang] || entry.lang)
      : (entry.origin === 'live' ? S.t.srcLive(label) : S.t.srcCache(label));
    html = '<span class="dot" data-origin="' + esc(entry.origin) + '"></span>' +
           '<span>' + esc(line) + '</span>' +
           '<a href="' + esc(entry.url) + '" target="_blank" rel="noopener">' + esc(S.t.openInSefaria) + '</a>';
  } else if (p && p.ref && body) {
    // יש טקסט מוטמע אבל לא בשפה הזו מהספרייה
    html = '<span class="dot"></span><span>' + esc(S.t.srcLocal) + '</span>' +
           '<a href="' + esc(LIB_API.WEB + encodeURIComponent(p.ref.replace(/ /g, '_'))) +
           '" target="_blank" rel="noopener">' + esc(S.t.openInSefaria) + '</a>';
  } else if (body) {
    html = '<span class="dot"></span><span>' + esc(S.t.srcLocal) + '</span>';
  }
  src.innerHTML = html;

  if (body) {
    TTS.load(body, entry && entry.lang ? entry.lang : S.lang);
    if (wasPlaying) TTS.play(); else syncPlayBtn();
  } else {
    TTS.parts = []; TTS.idx = 0; syncPlayBtn();
  }
}

$('prevPage').addEventListener('click', function () { if (pageIdx > 0) { pageIdx--; renderPage(); } });
$('nextPage').addEventListener('click', function () {
  if (pageIdx < openBook.pages.length - 1) { pageIdx++; renderPage(); }
});
$('playBtn').addEventListener('click', function () { TTS.playing ? TTS.pause() : TTS.play(); });
$('fwdBtn').addEventListener('click', function () { TTS.forward(); });
$('rate').addEventListener('input', function (e) {
  TTS.rate = parseFloat(e.target.value);
  $('rateLbl').textContent = TTS.rate.toFixed(1) + '×';
  if (TTS.playing) { speechSynthesis.cancel(); TTS.speakCurrent(); }
});
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && TTS.playing && window.speechSynthesis && speechSynthesis.paused) speechSynthesis.resume();
});

/* ---------------------------------------------------------
   12. תנועה, התנגשויות וקרבה לנקודות עניין
   --------------------------------------------------------- */
const SPEED = 3.3, TURN = 1.7;
const tmp = new THREE.Vector3();

function updatePlayer(dt) {
  let fwd = S.move.fwd, turn = S.move.turn, strafe = S.move.strafe;
  if (keys['w'] || keys['arrowup']) fwd = 1;
  if (keys['s'] || keys['arrowdown']) fwd = -1;
  if (keys['a'] || keys['arrowleft']) turn = -1;
  if (keys['d'] || keys['arrowright']) turn = 1;

  S.yaw -= turn * TURN * dt;

  const sin = Math.sin(S.yaw), cos = Math.cos(S.yaw);
  const nx = camera.position.x - (sin * fwd + cos * -strafe) * SPEED * dt;
  const nz = camera.position.z - (cos * fwd + sin * strafe) * SPEED * dt;

  if (S.area === 'outside') {
    // גבול העולם רחוק מאחורי המבנים; החסימה בפועל היא blockBox
    camera.position.x = Math.max(-45, Math.min(45, nx));
    camera.position.z = Math.max(-55, Math.min(40, nz));
    blockBox(0, -34, 7.4, 6.0);     // מבנה הציון — החזית ב-z=-28
    blockBox(-13, -12, 8.4, 6.9);   // מבנה הספרייה — החזית ב-z=-5.1
  } else if (S.area === 'tzion') {
    camera.position.x = Math.max(TZ.minX, Math.min(TZ.maxX, nx));
    camera.position.z = Math.max(TZ.minZ, Math.min(TZ.maxZ, nz));
  } else {
    camera.position.x = Math.max(LIB.minX, Math.min(LIB.maxX, nx));
    camera.position.z = Math.max(LIB.minZ, Math.min(LIB.maxZ, nz));
  }

  camera.rotation.set(0, 0, 0);
  camera.rotateY(S.yaw);
  camera.rotateX(S.pitch);
}

function blockBox(cx, cz, hw, hd) {
  const p = camera.position;
  if (p.x > cx - hw && p.x < cx + hw && p.z > cz - hd && p.z < cz + hd) {
    const dl = Math.abs(p.x - (cx - hw)), dr = Math.abs((cx + hw) - p.x);
    const db = Math.abs(p.z - (cz - hd)), df = Math.abs((cz + hd) - p.z);
    const m = Math.min(dl, dr, db, df);
    if (m === dl) p.x = cx - hw; else if (m === dr) p.x = cx + hw;
    else if (m === db) p.z = cz - hd; else p.z = cz + hd;
  }
}

function nearestPhoto(maxDist) {
  const list = photoFrames[S.area];
  let best = null, bestD = maxDist;
  for (let i = 0; i < list.length; i++) {
    list[i].getWorldPosition(tmp);
    const d = tmp.distanceTo(camera.position);
    if (d < bestD) { bestD = d; best = list[i]; }
  }
  return best;
}

function updateProximity() {
  if (openBook) return;
  const p = camera.position;

  if (S.area === 'outside') {
    const dLib = Math.hypot(p.x - OUT.libDoor.x, p.z - OUT.libDoor.z);
    const dTz = Math.hypot(p.x - OUT.tzionDoor.x, p.z - OUT.tzionDoor.z);

    if (dTz < 4.4) {
      // הגענו אל הסף — שלט עם כפתור, בדיוק כמו בספרייה
      S.atTzion = true;
      setPlace(S.t.placeTzion);
      setPrompt(S.t.enterTzion, S.t.enterTzionBtn, goTzion);
      return;
    }
    S.atTzion = false;
    setPlace(S.t.placePath);

    if (dLib < 3.6) { setPrompt(S.t.enterLib, S.t.enterBtn, goLibrary); return; }
    const ph = nearestPhoto(3.4);
    if (ph) setPrompt(S.t.tapPhoto, null, null); else clearPrompt();
    return;
  }

  if (S.area === 'tzion') {
    setPlace(S.t.placeTzion);
    if (p.z > 3.5) { setPrompt(S.t.exitTzion, S.t.exitBtn, goOutsideFromTzion); return; }
    const dGrave = Math.hypot(p.x - TZ.grave.x, p.z - TZ.grave.z);
    if (dGrave < 2.4) { setPrompt(S.t.atTzion, S.t.standHere, openTzionScreen); return; }
    const ph = nearestPhoto(3.2);
    if (ph) setPrompt(S.t.tapPhoto, null, null); else clearPrompt();
    return;
  }

  // ספרייה
  setPlace(S.t.placeLib);
  const dEx = Math.hypot(p.x - LIB.exit.x, p.z - LIB.exit.z);
  if (dEx < 2.6) { setPrompt(S.t.exitLib, S.t.exitBtn, goOutsideFromLib); return; }
  if (S.selected) { clearPrompt(); return; }
  for (let i = 0; i < interactives.length; i++) {
    interactives[i].getWorldPosition(tmp);
    if (tmp.distanceTo(p) < 3.4) { setPrompt(S.t.tapBook, null, null); return; }
  }
  const ph = nearestPhoto(3.4);
  if (ph) setPrompt(S.t.tapPhoto, null, null); else clearPrompt();
}

/* ידית לפיתוח ולבדיקות אוטומטיות — קריאה בלבד, לא בשימוש המשחק עצמו */
window.__uman = {
  state: S,
  cam: function () {
    return { x: +camera.position.x.toFixed(2), z: +camera.position.z.toFixed(2), yaw: +S.yaw.toFixed(2) };
  },
  goto: function (x, z, yaw) {
    camera.position.set(x, 1.62, z);
    if (yaw != null) S.yaw = yaw;
  },
  photos: photoFrames,
  books: BOOKS,
  interactives: interactives,
  openBook: function (i) { openReader(BOOKS[i]); },
  page: function (i) { pageIdx = i; renderPage(); },
  showPhoto: openLightbox
};

/* ---------------------------------------------------------
   13. לולאת האנימציה
   --------------------------------------------------------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (S.running && !S.paused) {
    updatePlayer(dt);
    updateProximity();
  }
  stepTweens(dt);
  const f = .85 + Math.sin(now * .012) * .08 + Math.random() * .09;
  for (let i = 0; i < flickers.length; i++) {
    flickers[i].scale.set(f, 1.6 * f, f);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

/* ---------------------------------------------------------
   14. זרימת המסכים: שפה → הוראות → משחק
   --------------------------------------------------------- */
function applyLang(code) {
  S.lang = code; S.t = T[code];
  document.documentElement.lang = code;
  document.documentElement.dir = S.t.dir;
  document.body.dir = S.t.dir;
  document.body.dataset.lang = code;

  $('introTitle').textContent = S.t.introTitle;
  $('introList').innerHTML = S.t.rows.map(function (r) {
    return '<li><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></li>';
  }).join('');
  $('startBtn').textContent = S.t.start;
  $('langBtn').textContent = S.t.langBtn;
  $('tzionTitle').textContent = S.t.tzionTitle;
  $('tzionText').textContent = S.t.tzionText;
  $('tzionBtn').textContent = S.t.tzionOk;
  $('ttsNote').textContent = S.t.ttsNote;
  lastPlace = '';
  setPlace(S.t.placePath);
  syncPlayBtn(); syncGyroBtn(); updateCounter();
  saveProgress();
}

const saved = loadProgress();
applyLang(saved && T[saved.lang] ? saved.lang : 'he');
updateCounter();

document.querySelectorAll('.lang').forEach(function (b) {
  b.addEventListener('click', function () {
    applyLang(b.dataset.lang);
    $('gate').classList.add('hidden');
    $('intro').classList.remove('hidden');
  });
});

let built = false;
$('startBtn').addEventListener('click', function () {
  // הסצנות נבנות אחרי בחירת השפה — כותרות הספרים והשלטים נצרבות לטקסטורות
  if (!built) { buildOutside(); buildTzion(); buildLibrary(); built = true; }
  enableGyro().then(syncGyroBtn);
  if (window.speechSynthesis) TTS.pickVoice();
  $('intro').classList.add('hidden');
  $('hud').classList.remove('hidden');
  S.running = true;
  setPaused(false);
});

// החלפת שפה תוך כדי משחק — טעינה מחדש, כי הכיתוב צרוב בטקסטורות
$('langBtn').addEventListener('click', function () {
  TTS.stop();
  S.running = false;
  location.reload();
});

}
