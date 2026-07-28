import re

with open(r'C:/Users/Lenovo/Downloads/barbecue.svg', 'r') as f:
    raw = f.read()

# strip metadata/xml decl
raw = re.sub(r'<\?xml[^?]*\?>', '', raw)
raw = re.sub(r'<metadata>.*?</metadata>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<!--.*?-->', '', raw, flags=re.DOTALL)
raw = re.sub(r'<\?xpacket.*?\?>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<x:xmpmeta.*?</x:xmpmeta>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<rdf:RDF.*?</rdf:RDF>', '', raw, flags=re.DOTALL)

# strip svg header attrs, keep only xmlns
raw = re.sub(r'<svg[^>]*>', '<svg xmlns="http://www.w3.org/2000/svg">', raw, count=1)
# remove empty group
raw = re.sub(r'<g id="Layer_1">\s*</g>', '', raw)

# style="fill:..." -> fill="..."
raw = re.sub(r'style="fill:(#[A-Fa-f0-9]+);"', r'fill="\1"', raw)

# extract all paths
paths = re.findall(r'(<path[^/]*/>)', raw)

# for each path, extract fill and d, compress d
compressed_paths = []
for p in paths:
    fm = re.search(r'fill="([^"]*)"', p)
    dm = re.search(r'd="([^"]*)"', p)
    if not dm:
        continue
    f = fm.group(1) if fm else ''
    d = dm.group(1)
    # round floats
    d = re.sub(r'(\d+\.\d+)', lambda n: str(round(float(n.group(1)))), d)
    # remove comma+space -> space
    d = re.sub(r',\s*', ' ', d)
    # remove spaces after command letters
    d = re.sub(r'([a-zA-Z])\s+', r'\1', d)
    # collapse multiple spaces
    d = re.sub(r'\s+', ' ', d)
    if f:
        compressed_paths.append((f, d.strip()))
    else:
        compressed_paths.append((None, d.strip()))

# group by fill color to reduce attr duplication
from collections import defaultdict
groups = defaultdict(list)
for f, d in compressed_paths:
    groups[f].append(d)

svg_parts = []
for f, ds in groups.items():
    if f:
        svg_parts.append(f'<g fill="{f}">')
    for d in ds:
        svg_parts.append(f'<path d="{d}"/>')
    if f:
        svg_parts.append('</g>')

svg_inner = ''.join(svg_parts)
svg_str = f'<svg xmlns="http://www.w3.org/2000/svg">{svg_inner}</svg>'

op = 'U("2:12", {height:360, svg:`' + svg_str + '`})'
with open(r'D:/Project Regolith/Code/bbq_ultra_op.txt', 'w') as f:
    f.write(op)
print('chars:', len(op))
print('paths:', len(paths))
