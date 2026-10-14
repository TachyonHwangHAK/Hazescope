#!/usr/bin/env python3
"""Build a single self-contained HTML file (dist/hazescope-sg.html).

Requires esbuild on PATH (npm i -g esbuild) and Python 3.
Usage:  python3 tools/build_single.py
"""
import base64, os, subprocess, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)
esbuild = os.environ.get('ESBUILD', 'esbuild')
bundle = os.path.join(DIST, '_bundle.js')
subprocess.run([esbuild, os.path.join(ROOT, 'assets/js/main.js'), '--bundle', '--format=iife',
                '--target=es2020,safari15', '--minify', '--legal-comments=none', f'--outfile={bundle}'], check=True)

read = lambda p, mode='r': open(os.path.join(ROOT, p), mode).read()
html, css, js = read('index.html'), read('assets/css/app.css'), open(bundle).read()
lcss, ljs, bdata = read('vendor/leaflet/leaflet.css'), read('vendor/leaflet/leaflet.js'), read('assets/map/basemap-data.js')
if any('</script' in x.lower() for x in (js, ljs, bdata)) or any('</style' in x.lower() for x in (css, lcss)):
    sys.exit('Inlined code contains a closing tag; aborting.')
svg = read('assets/icons/icon.svg').strip()
png = base64.b64encode(read('assets/icons/apple-touch-icon.png', 'rb')).decode()

def rep(old, new):
    global html
    if old not in html:
        sys.exit(f'Expected markup not found: {old[:60]}')
    html = html.replace(old, new, 1)

rep('<link rel="manifest" href="manifest.webmanifest">\n', '')
rep('<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">',
    '<link rel="icon" href="data:image/svg+xml,' + urllib.parse.quote(svg) + '" type="image/svg+xml">')
rep('<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">',
    '<link rel="apple-touch-icon" href="data:image/png;base64,' + png + '">')
rep('<link rel="stylesheet" href="vendor/leaflet/leaflet.css">', '<style>\n' + lcss + '\n</style>')
rep('<link rel="stylesheet" href="assets/css/app.css">', '<style>\n' + css + '\n</style>')
rep('<script src="vendor/leaflet/leaflet.js" defer></script>\n', '')
rep('<script src="assets/map/basemap-data.js" defer></script>\n', '')
rep('<script type="module" src="assets/js/main.js"></script>\n', '')
rep('</body>', '<script>\n' + ljs + '\n</script>\n<script>\n' + bdata + '\n</script>\n<script>\n' + js + '\n</script>\n</body>')

out = os.path.join(DIST, 'hazescope-sg.html')
open(out, 'w').write(html)
os.remove(bundle)
print(f'Wrote {out} ({len(html) // 1024} KB)')
