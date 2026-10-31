"""Build the standalone, offline HTML. No package manager or network needed."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'src/template.html').read_text()
for marker, path in [
    ('THREE_ENGINE', 'vendor/three.min.js'),
    ('SCENE_SCRIPT', 'src/scene3d.js'),
    ('GAME_SCRIPT', 'src/game.js'),
]:
    source = (ROOT / path).read_text().replace('</script', '<\\/script')
    if marker == 'THREE_ENGINE':
        source = '/*\n' + (ROOT / 'vendor/THREE-LICENSE.txt').read_text() + '\n*/\n' + source
    html = html.replace(f'<!--{marker}-->', f'<script>\n{source}\n</script>')
(ROOT / 'index.html').write_text(html)
print(f'Built index.html ({len(html.encode()):,} bytes), fully self-contained.')
