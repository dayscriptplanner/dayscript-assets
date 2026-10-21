#!/usr/bin/env python3
"""Build the single-file demo (app/dayscript-demo.html) from planner.html + planner.js.

The demo is what gets published as the shareable Claude artifact / sent to friends:
one file, no sync, no config. planner.html + planner.js stay the real app.
Run:  python3 app/make-demo.py
"""
import pathlib, re
app = pathlib.Path(__file__).parent
html = (app / "planner.html").read_text()
js = (app / "planner.js").read_text()
html = html.replace('<script src="./planner.js"></script>', "<script>\n" + js + "</script>")
# the demo has no backend: drop the sync loaders and the strict CSP meta (the host sets its own)
html = re.sub(r'\n<script type="module" src="\./config\.js"></script>\n<script src="\./sync-ui\.js"></script>\n<script src="\./sync\.iife\.js"></script>', "", html)
html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n', "", html)
html = html.replace("<title>DayScript</title>", "<title>DayScript Prototype</title>")
(app / "dayscript-demo.html").write_text(html)
print("wrote", app / "dayscript-demo.html", len(html), "bytes")
