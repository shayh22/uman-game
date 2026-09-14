/**
 * בדיקת עשן למשחק. מריצה דפדפן אמיתי ובודקת את קריטריוני הקבלה
 * של הכניסה לציון, את קורא הספרים ואת טעינת התצלומים.
 *
 *   python3 -m http.server 8123 &
 *   npm install --no-save playwright && node tools/smoke-test.js
 *
 * (בסביבה ללא GPU התנועה איטית מאוד, ולכן הבדיקה משתמשת ב-__uman.goto
 *  כדי למקם את השחקן ואז הולכת ברגל את הקטע האחרון.)
 */
const { chromium } = require('playwright');
const BASE = process.env.UMAN_URL || 'http://127.0.0.1:8123/index.html';

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => {
    if (r.status() >= 400 && !/sefaria|fonts\./.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url());
  });

  const st = () => page.evaluate(() => {
    // #promptBtn שומר את הכיתוב הקודם גם כשהשלט מוסתר, ולכן בודקים
    // קודם את המכל ורק אחר כך את הכפתור.
    const shown = !document.getElementById('prompt').classList.contains('hidden');
    const btnShown = shown && !document.getElementById('promptBtn').classList.contains('hidden');
    return {
      place: document.getElementById('place').textContent,
      prompt: shown ? document.getElementById('promptText').textContent : null,
      btn: btnShown ? document.getElementById('promptBtn').textContent : null,
      area: window.__uman.state.area,
      paused: window.__uman.state.paused,
      cam: window.__uman.cam()
    };
  });
  const at = async (x, z, yaw) => {
    await page.evaluate(([x, z, y]) => window.__uman.goto(x, z, y), [x, z, yaw]);
    await page.waitForTimeout(600);
  };
  const walk = async ms => {
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(ms);
    await page.keyboard.up('ArrowUp'); await page.waitForTimeout(250);
  };

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.click('.lang[data-lang="he"]');
  await page.waitForTimeout(200);
  await page.click('#startBtn');
  await page.waitForTimeout(1200);

  console.log('\nהכניסה לציון');
  await at(0, -18, 0);
  check('שום מסך לא קופץ באמצע השביל', (await st()).prompt === null, await st());
  await at(0, -23.0, 0);
  let s = await st();
  check('ליד הסף מופיע שלט עם כפתור', /הסף/.test(s.prompt || '') && !!s.btn, s);

  await at(0, -32, 0);
  check('אי אפשר לעבור דרך קירות המבנה', (await st()).cam.z >= -28.01, (await st()).cam);

  await at(0, -23.0, 0);
  await page.click('#promptBtn');
  await page.waitForTimeout(1300);
  check('הכפתור מכניס אל פנים הציון', (await st()).area === 'tzion', await st());

  await at(0, -1.4, 0);
  s = await st();
  check('ליד הציון מופיע שלט "לעמוד כאן רגע"', /לעמוד/.test(s.btn || ''), s);
  await page.click('#promptBtn');
  await page.waitForTimeout(500);
  check('המסך מקפיא את המשחק', (await st()).paused === true);
  const before = (await st()).cam;
  await walk(2000);
  check('השחקן לא זז בזמן שהמסך פתוח', JSON.stringify(before) === JSON.stringify((await st()).cam));
  await page.click('#tzionBtn');
  await page.waitForTimeout(400);
  check('סגירת המסך מחזירה את השליטה', (await st()).paused === false);

  await at(0, 2.0, 0);
  const away = await st();
  await at(0, -1.4, 0);
  const back = await st();
  check('אפשר להתרחק, לחזור ולהפעיל שוב',
    !/לעמוד/.test(away.btn || '') && /לעמוד/.test(back.btn || ''), [away.btn, back.btn]);

  await at(0, 3.9, 0);
  await page.click('#promptBtn');
  await page.waitForTimeout(1300);
  check('היציאה מחזירה אל החצר', (await st()).area === 'outside', await st());

  console.log('\nהספרייה וקורא הספרים');
  await at(-13, -4.6, 0);
  check('שלט דלת הספרייה', /ספרייה/.test((await st()).prompt || ''), await st());
  await page.click('#promptBtn');
  await page.waitForTimeout(1300);
  check('נכנסים לספרייה', (await st()).area === 'library');

  await page.evaluate(() => window.__uman.openBook(1));
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    title: document.getElementById('bookTitle').textContent,
    len: document.getElementById('pageBody').textContent.length,
    src: document.getElementById('srcLine').textContent,
    paused: window.__uman.state.paused
  }));
  check('הספר נפתח עם טקסט אמיתי מספריא', r.len > 400 && /ספריא/.test(r.src), r);
  check('הקורא מקפיא את המשחק', r.paused === true);
  const tts = await page.evaluate(() => {
    const t = document.getElementById('pageBody').textContent;
    return window.SefariaLibrary.sentences(window.SefariaLibrary.toSpeech(t)).length;
  });
  check('הטקסט מפוצל למשפטים להקראה', tts > 3, tts);
  await page.click('#closeBook');
  await page.waitForTimeout(300);
  check('סגירת הקורא מחזירה את השליטה', (await st()).paused === false);

  console.log('\nתצלומים');
  const photos = await page.evaluate(async () => {
    const keys = Object.keys(window.UMAN_PHOTOS);
    return Promise.all(keys.map(k => new Promise(res => {
      const i = new Image();
      i.onload = () => res(true); i.onerror = () => res(k);
      i.src = 'assets/photos/' + window.UMAN_PHOTOS[k].file;
    })));
  });
  const missing = photos.filter(p => p !== true);
  check('כל התצלומים נטענים', missing.length === 0, missing);

  await page.evaluate(() => window.__uman.showPhoto('tzion_grave'));
  await page.waitForTimeout(700);
  const lb = await page.evaluate(() => ({
    cap: document.getElementById('lbCap').textContent,
    meta: document.getElementById('lbMeta').textContent,
    paused: window.__uman.state.paused
  }));
  check('התצלום נפתח עם כיתוב וקרדיט', !!lb.cap && /Wikimedia/.test(lb.meta) && lb.paused, lb);

  console.log('\nשגיאות: ' + (errors.length ? JSON.stringify([...new Set(errors)]) : 'אין'));
  if (errors.length) failures++;
  console.log(failures ? '\n' + failures + ' בדיקות נכשלו' : '\nהכל עבר');
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
