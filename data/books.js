/* =========================================================
   data/books.js
   הספרים שבספרייה. כל עמוד מצביע על מקור אמיתי בספריא (Sefaria)
   דרך השדה ref. הטקסט המלא נשמר מראש ב-data/texts.js כגיבוי,
   והמשחק מנסה למשוך גרסה טרייה מה-API בכל פתיחה.
   ========================================================= */
window.UMAN_BOOKS = [
  {
    id: 'tikkun', color: 0x6E2F2A,
    title: { he: 'תיקון הכללי', en: 'Tikkun HaKlali', fr: 'Tikkoun HaKlali' },
    blurb: {
      he: 'עשרת מזמורי התהילים שגילה רבי נחמן כתיקון הכללי.',
      en: 'The ten psalms Rebbe Nachman revealed as the general remedy.',
      fr: 'Les dix psaumes révélés par Rabbi Nahman comme remède général.'
    },
    pages: [
      { ref: null, title: { he: 'עשרת מזמורי התיקון', en: 'The ten psalms', fr: 'Les dix psaumes' },
        offline: {
          he: 'רבי נחמן גילה עשרה מזמורי תהילים כתיקון הכללי:\nט״ז, ל״ב, מ״א, מ״ב, נ״ט, ע״ז, צ׳, ק״ה, קל״ז, ק״נ.\nאמירתם בסדר הזה היא התיקון השלם.',
          en: 'Rebbe Nachman revealed ten psalms as the general remedy:\n16, 32, 41, 42, 59, 77, 90, 105, 137, 150.\nSaid in this order, they form the complete Tikkun.',
          fr: 'Rabbi Nahman a révélé dix psaumes comme remède général :\n16, 32, 41, 42, 59, 77, 90, 105, 137, 150.\nRécités dans cet ordre, ils forment le Tikkoun complet.'
        } },
      { ref: 'Psalms 16',  title: { he: 'מזמור ט״ז',  en: 'Psalm 16',  fr: 'Psaume 16' } },
      { ref: 'Psalms 32',  title: { he: 'מזמור ל״ב',  en: 'Psalm 32',  fr: 'Psaume 32' } },
      { ref: 'Psalms 41',  title: { he: 'מזמור מ״א',  en: 'Psalm 41',  fr: 'Psaume 41' } },
      { ref: 'Psalms 42',  title: { he: 'מזמור מ״ב',  en: 'Psalm 42',  fr: 'Psaume 42' } },
      { ref: 'Psalms 59',  title: { he: 'מזמור נ״ט',  en: 'Psalm 59',  fr: 'Psaume 59' } },
      { ref: 'Psalms 77',  title: { he: 'מזמור ע״ז',  en: 'Psalm 77',  fr: 'Psaume 77' } },
      { ref: 'Psalms 90',  title: { he: 'מזמור צ׳',   en: 'Psalm 90',  fr: 'Psaume 90' } },
      { ref: 'Psalms 105', title: { he: 'מזמור ק״ה',  en: 'Psalm 105', fr: 'Psaume 105' } },
      { ref: 'Psalms 137', title: { he: 'מזמור קל״ז', en: 'Psalm 137', fr: 'Psaume 137' } },
      { ref: 'Psalms 150', title: { he: 'מזמור ק״נ',  en: 'Psalm 150', fr: 'Psaume 150' } }
    ]
  },
  {
    id: 'likutei', color: 0x2C4A6B,
    title: { he: 'ליקוטי מוהר״ן', en: 'Likutei Moharan', fr: 'Likoutey Moharan' },
    blurb: {
      he: 'תורותיו של רבי נחמן, כפי שנכתבו בידי רבי נתן.',
      en: 'The teachings of Rebbe Nachman, written down by Rebbe Nathan.',
      fr: 'Les enseignements de Rabbi Nahman, transcrits par Rabbi Nathan.'
    },
    pages: [
      { ref: 'Likutei Moharan, Part II 48:2',
        title: { he: 'הגשר הצר', en: 'The narrow bridge', fr: 'Le pont étroit' },
        offline: {
          he: 'וְדַע, שֶׁהָאָדָם צָרִיךְ לַעֲבֹר עַל גֶּשֶׁר צַר מְאֹד מְאֹד,\nוְהַכְּלָל וְהָעִקָּר — שֶׁלֹּא יִתְפַּחֵד כְּלָל.',
          en: 'Know that a person must cross a very, very narrow bridge,\nand the main thing is not to be afraid at all.',
          fr: 'Sache que l’homme doit traverser un pont très, très étroit,\net l’essentiel est de n’avoir aucune peur.'
        } },
      { ref: 'Likutei Moharan 282',
        title: { he: 'אֲזַמְּרָה — נקודה טובה', en: 'Azamra — one good point', fr: 'Azamra — un bon point' },
        offline: {
          he: 'צָרִיךְ הָאָדָם לְחַפֵּשׂ וְלִמְצֹא בְּעַצְמוֹ נְקֻדָּה טוֹבָה אַחַת,\nוְעַל יָדָהּ הוּא מַחֲזִיר אֶת עַצְמוֹ לְכַף זְכוּת.',
          en: 'A person must search within and find one good point in himself,\nand through it he tips his own scale toward merit.',
          fr: 'L’homme doit chercher en lui-même un seul bon point,\net par lui il fait pencher sa propre balance du bon côté.'
        } },
      { ref: 'Likutei Moharan, Part II 24',
        title: { he: 'מצווה גדולה להיות בשמחה', en: 'A great mitzvah to be joyful', fr: 'Une grande mitsva : la joie' },
        offline: {
          he: 'מִצְוָה גְּדוֹלָה לִהְיוֹת בְּשִׂמְחָה תָּמִיד,\nוּלְהִתְגַּבֵּר לְהַרְחִיק אֶת הָעַצְבוּת בְּכָל כֹּחוֹ.',
          en: 'It is a great mitzvah to be joyful always,\nand to push sadness away with all one’s strength.',
          fr: 'C’est une grande mitsva d’être toujours dans la joie,\net d’écarter la tristesse de toutes ses forces.'
        } },
      { ref: 'Likutei Moharan, Part II 48:1',
        title: { he: 'ההתרחקות שבהתחלה', en: 'The rejection at the start', fr: 'Le rejet du début' } }
    ]
  },
  {
    id: 'sichot', color: 0x4A5B33,
    title: { he: 'שיחות הר״ן', en: 'Sichot HaRan', fr: 'Sihot HaRan' },
    blurb: {
      he: 'שיחות ואמרות ששמעו התלמידים מפי רבי נחמן.',
      en: 'Conversations and sayings the students heard from Rebbe Nachman.',
      fr: 'Conversations et paroles entendues de Rabbi Nahman.'
    },
    pages: [
      { ref: 'Sichot HaRan 2',
        title: { he: 'להשליך עצמו על השם', en: 'Relying on God', fr: 'S’en remettre à Dieu' } },
      { ref: 'Sichot HaRan 20',
        title: { he: 'שמחה והתבודדות', en: 'Joy and solitude', fr: 'Joie et solitude' },
        offline: {
          he: 'כְּשֶׁהָאָדָם כָּל הַיּוֹם בְּשִׂמְחָה, אֲזַי בְּנָקֵל לוֹ לְיַחֵד לוֹ שָׁעָה בַּיּוֹם\nלְשַׁבֵּר אֶת לִבּוֹ וּלְהָשִׂיחַ אֶת אֲשֶׁר עִם לְבָבוֹ לִפְנֵי הַשֵּׁם יִתְבָּרַךְ.',
          en: 'When you are always happy, it is easy to set aside some time each day\nto express your thoughts before God with a broken heart.',
          fr: 'Quand on est joyeux toute la journée, il est facile de se réserver une heure par jour\npour ouvrir son cœur devant Dieu.'
        } },
      { ref: 'Sichot HaRan 154',
        title: { he: 'פשיטות', en: 'Simplicity', fr: 'La simplicité' } }
    ]
  },
  {
    id: 'tefilot', color: 0x5E3A6B,
    title: { he: 'ליקוטי תפילות — רבי נתן', en: 'Likutei Tefilot — Rebbe Nathan', fr: 'Likoutey Tefilot — Rabbi Nathan' },
    blurb: {
      he: 'תפילות שחיבר רבי נתן על פי תורות רבו.',
      en: 'Prayers Rebbe Nathan composed on his master’s teachings.',
      fr: 'Prières composées par Rabbi Nathan d’après les enseignements de son maître.'
    },
    pages: [
      { ref: 'Likutei Tefilot, Volume I 1',
        title: { he: 'תפילה א׳ — אשרי תמימי דרך', en: 'Prayer 1 — Ashrei Temimei Darech', fr: 'Prière 1 — Ashrei Temimei Dérekh' },
        offline: {
          he: 'רִבּוֹנוֹ שֶׁל עוֹלָם, זַכֵּנִי לְהַתְחִיל מֵחָדָשׁ בְּכָל פַּעַם,\nוְאַל אֶפֹּל בְּדַעְתִּי מִשּׁוּם דָּבָר שֶׁבָּעוֹלָם.',
          en: 'Master of the world, let me begin again every single time,\nand never let my spirit fall over anything in this world.',
          fr: 'Maître du monde, accorde-moi de recommencer chaque fois,\net que mon esprit ne s’effondre pour rien au monde.'
        } },
      { ref: 'Likutei Tefilot, Volume I 2',
        title: { he: 'תפילה ב׳ — אמור אל הכהנים', en: 'Prayer 2 — Emor el HaKohanim', fr: 'Prière 2 — Emor el HaKohanim' },
        offline: {
          he: 'תֵּן בְּלִבִּי אֱמוּנָה שְׁלֵמָה וּבְרוּרָה,\nשֶׁאֵין שׁוּם דָּבָר בָּעוֹלָם שֶׁאֵין בּוֹ טוֹב הַנִּסְתָּר.',
          en: 'Place in my heart a whole and clear faith\nthat nothing in this world is without a hidden good inside it.',
          fr: 'Mets dans mon cœur une foi entière et claire :\nrien en ce monde n’est dépourvu d’un bien caché.'
        } }
    ]
  },
  {
    id: 'chayei', color: 0x8A5A22,
    title: { he: 'חיי מוהר״ן', en: 'Chayei Moharan', fr: 'Hayei Moharan' },
    blurb: {
      he: 'קורות חייו של רבי נחמן, ובתוכם ראש השנה שלו באומן.',
      en: 'The life of Rebbe Nachman — including his Rosh Hashanah in Uman.',
      fr: 'La vie de Rabbi Nahman — dont son Roch Hachana à Ouman.'
    },
    pages: [
      { ref: 'Chayei Moharan 403',
        title: { he: 'ראש השנה שלי עולה על הכל', en: 'My Rosh Hashanah is above everything', fr: 'Mon Roch Hachana dépasse tout' },
        offline: {
          he: 'אָמַר: הָרֹאשׁ הַשָּׁנָה שֶׁלִּי עוֹלֶה עַל הַכֹּל.\nהקיבוץ באומן בראש השנה הוא מנהג ברסלב עתיק.',
          en: 'He said: “My Rosh Hashanah is above everything.”\nThe gathering in Uman for Rosh Hashanah is an old Breslov custom.',
          fr: 'Il disait : « Mon Roch Hachana dépasse tout. »\nLe rassemblement à Ouman pour Roch Hachana est une vieille coutume de Breslev.'
        } },
      { ref: 'Chayei Moharan 404',
        title: { he: 'הקיבוץ של ראש השנה', en: 'The Rosh Hashanah gathering', fr: 'Le rassemblement de Roch Hachana' } },
      { ref: null, title: { he: 'הדרך לכאן', en: 'The road here', fr: 'Le chemin jusqu’ici' },
        offline: {
          he: 'מכל פינה בעולם באים לכאן, בכל שפה,\nומוצאים את אותה נקודה פשוטה: להתחיל שוב.',
          en: 'They come here from every corner of the world, in every language,\nand find the same simple point: begin again.',
          fr: 'On vient ici des quatre coins du monde, dans toutes les langues,\net l’on retrouve le même point simple : recommencer.'
        } }
    ]
  }
];
