/* =========================================================
   sefaria.js — לקוח הספרייה
   מושך את תוכן הספרים מ־Sefaria (ספריא), מנקה את ה-HTML,
   שומר עותק ב-localStorage, ומכין את הטקסט להקראה.
   API docs: https://developers.sefaria.org
   ========================================================= */
window.SefariaLibrary = (function () {
  'use strict';

  var API = 'https://www.sefaria.org/api/v3/texts/';
  var WEB = 'https://www.sefaria.org/';
  var CACHE_KEY = 'uman.sefaria.v1.';
  var CACHE_TTL = 1000 * 60 * 60 * 24 * 30;   // חודש
  var VERSION_OF = { he: 'hebrew', en: 'english', fr: 'french' };

  /* ---------- ניקוי הטקסט ---------- */
  var ENTITIES = {
    '&nbsp;': ' ', '&thinsp;': ' ', '&amp;': '&', '&quot;': '"',
    '&#39;': "'", '&lt;': '<', '&gt;': '>', '&ldquo;': '“', '&rdquo;': '”'
  };

  /* ספריא מחזירה HTML עם הערות שוליים; מסירים אותן ומשאירים טקסט קריא */
  function clean(html) {
    var s = String(html == null ? '' : html);
    s = s.replace(/<sup class="footnote-marker"[\s\S]*?<\/sup>/g, '');
    s = s.replace(/<i class="footnote"[\s\S]*?<\/i>/g, '');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<\/?(p|div)[^>]*>/gi, '\n');
    s = s.replace(/<[^>]+>/g, '');
    for (var k in ENTITIES) s = s.split(k).join(ENTITIES[k]);
    s = s.replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }

  /* ספריא מחזירה מערכים מקוננים לפי עומק הספר */
  function flatten(node, out) {
    out = out || [];
    if (node == null) return out;
    if (typeof node === 'string') { out.push(node); return out; }
    for (var i = 0; i < node.length; i++) flatten(node[i], out);
    return out;
  }

  /* ---------- עותק שמור ---------- */
  function cacheGet(ref) {
    try {
      var raw = localStorage.getItem(CACHE_KEY + ref);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.at || Date.now() - o.at > CACHE_TTL) return null;
      return o.data;
    } catch (e) { return null; }
  }
  function cacheSet(ref, data) {
    try { localStorage.setItem(CACHE_KEY + ref, JSON.stringify({ at: Date.now(), data: data })); }
    catch (e) { /* מכסת אחסון מלאה — לא קריטי */ }
  }

  /* ---------- הטקסט המוטמע (data/texts.js) ---------- */
  function bundled(ref) {
    var all = window.UMAN_TEXTS;
    return (all && all[ref]) || null;
  }

  /* ---------- משיכה מה-API ---------- */
  var inflight = {};

  function fetchRef(ref) {
    if (inflight[ref]) return inflight[ref];
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));

    var qs = ['he', 'en', 'fr'].map(function (l) {
      return 'version=' + encodeURIComponent(VERSION_OF[l]);
    }).join('&');

    var p = fetch(API + encodeURIComponent(ref) + '?' + qs, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        var entry = { ref: d.ref || ref, heRef: d.heRef || '', text: {}, version: {} };
        var vs = d.versions || [];
        for (var i = 0; i < vs.length; i++) {
          var code = vs[i].language;
          if (!VERSION_OF[code] || entry.text[code]) continue;
          var body = clean(flatten(vs[i].text).join('\n'));
          if (!body) continue;
          entry.text[code] = body;
          entry.version[code] = vs[i].versionTitle || '';
        }
        if (!Object.keys(entry.text).length) throw new Error('empty');
        cacheSet(ref, entry);
        return entry;
      })
      .then(function (v) { delete inflight[ref]; return v; },
            function (e) { delete inflight[ref]; throw e; });

    inflight[ref] = p;
    return p;
  }

  /* ---------- ממשק ציבורי ---------- */

  /* בוחר את השפה הראשונה מבין המבוקשות שיש לה טקסט */
  function pickLang(entry, langs) {
    for (var i = 0; i < langs.length; i++) {
      if (entry.text[langs[i]]) return langs[i];
    }
    return null;
  }

  /**
   * מחזיר מיד את מה שיש (עותק שמור / טקסט מוטמע), ובמקביל מנסה למשוך
   * גרסה טרייה מספריא. onUpdate נקרא רק אם הגיע משהו חדש.
   *
   * langs הוא סדר העדפה: ['fr','en','he'] יחזיר צרפתית אם קיימת,
   * ואחרת אנגלית, ואחרת עברית — כדי שלא יוצג עמוד ריק לעולם.
   *
   *   var now = SefariaLibrary.read(ref, ['he'], function (fresh) { ... });
   *   // now = { text, lang, origin: 'live'|'cache'|'bundled', ref, heRef, url }
   */
  function read(ref, langs, onUpdate) {
    if (!ref) return null;
    if (typeof langs === 'string') langs = [langs];

    var immediate = null;
    var c = cacheGet(ref);
    var l = c && pickLang(c, langs);
    if (l) immediate = shape(c, l, 'cache');
    if (!immediate) {
      var b = bundled(ref);
      var lb = b && pickLang(b, langs);
      if (lb) immediate = shape(b, lb, 'bundled');
    }

    fetchRef(ref).then(function (fresh) {
      var lf = pickLang(fresh, langs);
      if (!lf) return;
      if (onUpdate) onUpdate(shape(fresh, lf, 'live'));
    }, function () { /* אין רשת — נשארים עם מה שיש */ });

    return immediate;
  }

  function shape(entry, lang, origin) {
    return {
      ref: entry.ref,
      heRef: entry.heRef,
      text: entry.text[lang],
      version: entry.version ? entry.version[lang] : '',
      lang: lang,
      origin: origin,
      url: WEB + encodeURIComponent(String(entry.ref).replace(/ /g, '_'))
    };
  }

  /* שם המקור כפי שמציגים אותו למשתמש */
  function refLabel(entry, lang) {
    if (!entry) return '';
    return (lang === 'he' && entry.heRef) ? entry.heRef : entry.ref;
  }

  /**
   * מכין טקסט להקראה: מסיר טעמי מקרא וסוגריים ביבליוגרפיים שמבלבלים
   * את מנוע ההקראה, ומפצל למשפטים כדי שאפשר יהיה לדלג ולסמן.
   */
  function toSpeech(text) {
    var s = String(text || '');
    // טעמי מקרא, סוף פסוק ופסק — כתובים כ-\u כדי שהקובץ ייקרא נכון גם אם
    // הדף המארח לא הכריז על UTF-8; אחרת ה-regex נשבר וכל הקובץ נופל בפרסור.
    s = s.replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3\u05C6]/g, '');  // טעמים ופיסוק מקראי
    s = s.replace(/\u05BE/g, ' ');                                    // מקף
    s = s.replace(/\([^()]{0,40}\)/g, ' ');                          // הפניות בסוגריים
    s = s.replace(/\[[^\[\]]{0,40}\]/g, ' ');
    s = s.replace(/\{[^{}]{0,8}\}/g, ' ');                         // סימני פרשה {פ} {ס}
    s = s.replace(/[ \t]+/g, ' ');
    return s.trim();
  }

  /* פיצול למשפטים להקראה רציפה */
  function sentences(text) {
    var parts = [], buf = '';
    var src = String(text || '');
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      buf += ch;
      if ('.!?\u05C3\n'.indexOf(ch) >= 0 && buf.trim().length > 12) {
        parts.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts.length ? parts : [src.trim()].filter(Boolean);
  }

  return {
    read: read,
    refLabel: refLabel,
    toSpeech: toSpeech,
    sentences: sentences,
    clean: clean,
    WEB: WEB
  };
})();
