#!/usr/bin/env python3
"""
בונה את גרסת ה-Artifact של הדף.

שירות ה-Artifact עוטף את הקובץ בשלד <html><head><body> משלו, ולכן הדף
שמפרסמים חייב להיות גוף בלבד — בלי doctype, html, head או body. הסקריפט
לוקח את index.html, מסיר את העטיפה, מטמיע את ה-CSS ומשאיר את שאר הקבצים
כקבצים נלווים (three.js, data/*.js, sefaria.js, game.js, assets/photos/*).

    python3 tools/build-artifact.py [יעד]

ברירת המחדל: build/artifact-index.html
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build", "artifact-index.html")

FONTS = ('<link rel="stylesheet" '
         'href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700'
         '&family=Spectral:ital,wght@0,300;0,400;0,600;1,400&display=swap">')


def main():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(ROOT, "style.css"), encoding="utf-8").read()
    body = html.split('<body data-lang="he">', 1)[1].rsplit("</body>", 1)[0].strip()

    page = (
        "<title>מסע אומן</title>\n" + FONTS + "\n<style>\n" + css +
        "\n/* הדף מוגש בתוך שלד של שירות ה-Artifact, ולכן מוודאים את הרקע כאן */\n"
        "html,body{background:var(--night-deep);color:var(--parchment)}\n</style>\n\n" + body + "\n"
    )
    # applyLang קובע כיוון ושפה, אבל מסך השער מוצג עוד לפניו
    page = page.replace('<section class="layer" id="gate">',
                        '<section class="layer" id="gate" dir="rtl">')
    page = page.replace('<script src="vendor/three.min.js"></script>',
                        '<script>document.documentElement.lang="he";'
                        'document.documentElement.dir="rtl";'
                        'document.body.dataset.lang="he";</script>\n'
                        '<script src="vendor/three.min.js"></script>')

    bad = re.findall(r"</?(?:html|head|body)\b|<!DOCTYPE", page, re.I)
    if bad:
        sys.exit("נשארו תגיות עטיפה בדף: " + ", ".join(sorted(set(bad))))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(page)
    print("wrote", OUT, os.path.getsize(OUT), "bytes")
    print("קבצים נלווים לפרסום:", ", ".join(
        ["vendor/three.min.js", "sefaria.js", "game.js"] +
        ["data/" + f for f in sorted(os.listdir(os.path.join(ROOT, "data")))] +
        ["assets/photos/*.jpg"]))


if __name__ == "__main__":
    main()
