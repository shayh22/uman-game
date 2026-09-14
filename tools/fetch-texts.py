#!/usr/bin/env python3
"""
מושך מספריא (Sefaria) את הטקסט של כל ref שמופיע ב-data/books.js
וכותב אותו ל-data/texts.js כגיבוי מוטמע.

    python3 tools/fetch-texts.py

בזמן ריצה המשחק מנסה קודם למשוך גרסה טרייה מה-API; הקובץ הזה הוא
מה שמוצג מיד, ומה שנשאר כשאין חיבור לרשת.
"""
import json, re, sys, time, urllib.parse, urllib.request, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://www.sefaria.org/api/v3/texts/"
UA = "UmanJourney/1.0 (offline text bundler; https://github.com/shayh22/uman-game)"
LANGS = [("he", "hebrew"), ("en", "english"), ("fr", "french")]


def refs_from_books():
    src = open(os.path.join(ROOT, "data/books.js"), encoding="utf-8").read()
    out, seen = [], set()
    for m in re.finditer(r"ref:\s*'([^']+)'", src):
        r = m.group(1)
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def flatten(node):
    if node is None:
        return []
    if isinstance(node, str):
        return [node]
    out = []
    for x in node:
        out += flatten(x)
    return out


ENTITIES = {"&nbsp;": " ", "&thinsp;": " ", "&amp;": "&", "&quot;": '"',
            "&#39;": "'", "&lt;": "<", "&gt;": ">", "&ldquo;": "“", "&rdquo;": "”"}


def clean(html):
    """מסיר תגיות, הערות שוליים וישויות — משאיר טקסט קריא להצגה ולהקראה."""
    s = html
    s = re.sub(r'<sup class="footnote-marker".*?</sup>', "", s, flags=re.S)
    s = re.sub(r'<i class="footnote".*?</i>', "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</?(p|div)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    for k, v in ENTITIES.items():
        s = s.replace(k, v)
    s = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def fetch(ref):
    q = [("version", v) for _, v in LANGS]
    url = API + urllib.parse.quote(ref) + "?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def main():
    refs = refs_from_books()
    print("refs:", len(refs))
    out = {}
    for i, ref in enumerate(refs, 1):
        d = fetch(ref)
        if "error" in d:
            print("  !! %-34s %s" % (ref, d["error"][:70]))
            continue
        entry = {"heRef": d.get("heRef", ""), "ref": d.get("ref", ref), "text": {}, "version": {}}
        for v in d.get("versions", []):
            code = {"he": "he", "en": "en", "fr": "fr"}.get(v.get("language"))
            if not code or code in entry["text"]:
                continue
            body = clean("\n".join(flatten(v.get("text"))))
            if not body:
                continue
            entry["text"][code] = body
            entry["version"][code] = v.get("versionTitle", "")
        out[ref] = entry
        got = " ".join("%s:%d" % (k, len(v)) for k, v in sorted(entry["text"].items()))
        missing = [c for c, _ in LANGS if c not in entry["text"]]
        print("  %2d/%d %-34s %s%s" % (i, len(refs), ref, got,
              "  (no " + ",".join(missing) + ")" if missing else ""))
        time.sleep(0.35)

    header = (
        "/* =========================================================\n"
        "   data/texts.js  —  נוצר אוטומטית על ידי tools/fetch-texts.py\n"
        "   אל תערכו ידנית. מקור הטקסטים: ספריא (Sefaria), www.sefaria.org\n"
        "   הטקסטים עצמם הם בנחלת הכלל או ברישיון פתוח; ראו CREDITS.md.\n"
        "   ========================================================= */\n"
        "window.UMAN_TEXTS = "
    )
    path = os.path.join(ROOT, "data/texts.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header)
        json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write(";\n")
    print("wrote", path, os.path.getsize(path), "bytes,", len(out), "refs")


if __name__ == "__main__":
    main()
