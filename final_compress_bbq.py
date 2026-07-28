import re

with open(r'C:/Users/Lenovo/Downloads/barbecue.svg', 'r') as f:
    raw = f.read()
raw = re.sub(r'<\?xml[^?]*\?>', '', raw)
raw = re.sub(r'<metadata>.*?</metadata>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<!--.*?-->', '', raw, flags=re.DOTALL)
raw = re.sub(r'<\?xpacket.*?\?>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<x:xmpmeta.*?</x:xmpmeta>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<rdf:RDF.*?</rdf:RDF>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<g id="Layer_1">\s*</g>', '', raw)

# extract all paths with their fill
paths = []
for m in re.finditer(r'<(path\s[^>]*?)/>', raw, re.DOTALL):
    tag = m.group(1)
    f = re.search(r'fill="([^"]*)"', tag)
    d = re.search(r'd="([^"]*)"', tag)
    if not d:
        continue
    fill = f.group(1) if f else None
    d_str = d.group(1)
    d_str = re.sub(r'(\d+\.\d+)', lambda n: str(round(float(n.group(1)))), d_str)
    d_str = re.sub(r',\s*', ' ', d_str)
    d_str = re.sub(r'\s{2,}', ' ', d_str)
    paths.append((fill, d_str.strip()))

# also check style="fill:..." attribute
for m in re.finditer(r'<(path\s[^>]*?)/>', raw, re.DOTALL):
    tag = m.group(1)
    s = re.search(r'style="fill:(#[^;]*);?', tag)
    if s and not any(p[0] == s.group(1) for p in paths if p[0]):
        d = re.search(r'd="([^"]*)"', tag)
        if d:
            d_str = d.group(1)
            d_str = re.sub(r'(\d+\.\d+)', lambda n: str(round(float(n.group(1)))), d_str)
            d_str = re.sub(r',\s*', ' ', d_str)
            d_str = re.sub(r'\s{2,}', ' ', d_str)
            paths.append((s.group(1), d_str.strip()))

# build minimal svg string
parts = []
for fill, d in paths:
    if fill:
        parts.append(f'<path fill="{fill}" d="{d}"/>')
    else:
        parts.append(f'<path d="{d}"/>')

svg_str = '<svg>' + ''.join(parts) + '</svg>'
op = 'U("2:12", {height:360, svg:`' + svg_str + '`})'
with open(r'D:/Project Regolith/Code/bbq_final_op.txt', 'w') as f:
    f.write(op)
print('chars:', len(op), 'paths:', len(paths))
