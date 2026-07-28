import re

with open(r'D:/Project Regolith/Code/bbq_core.txt', 'r') as f:
    raw = f.read()
# core content already has metadata stripped
raw = '<svg xmlns="http://www.w3.org/2000/svg">' + raw + '</svg>'
raw = re.sub(r'<g id="Layer_1">\s*</g>', '', raw)

paths_data = []
for m in re.finditer(r'<(path\s[^>]*?)/>', raw, re.DOTALL):
    tag = m.group(1)
    if 'style=' in tag:
        f = re.search(r'style="fill:(#[^;]+)', tag)
        fill = f.group(1) if f else None
    else:
        f = re.search(r'fill="([^"]*)"', tag)
        fill = f.group(1) if f else None
    d = re.search(r'd="([^"]*)"', tag)
    if not d:
        continue
    d_str = d.group(1)
    d_str = re.sub(r'(\d+\.\d+)', lambda n: str(round(float(n.group(1)))), d_str)
    d_str = re.sub(r',\s*', ' ', d_str)
    d_str = re.sub(r'\s+', ' ', d_str).strip()
    paths_data.append((fill, d_str))

# sort by d-string length descending then greedy balance into two batches
paths_data.sort(key=lambda x: len(x[1]), reverse=True)

batches = [[], []]
lens = [0, 0]
for i, (fill, d) in enumerate(paths_data):
    fill_attr = f' fill="{fill}"' if fill else ''
    svg = f"<svg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'><path{fill_attr} d='{d}'/></svg>"
    op = f'p{i}=I("2:11", {{type:"frame", name:"BBQ路径{i}", layout:"none", width:360, height:360, fills:[], layoutPositioning:"ABSOLUTE", x:0, y:0, svg:"{svg}"}})'
    # assign to shorter batch
    b = 0 if lens[0] <= lens[1] else 1
    batches[b].append(op)
    lens[b] += len(svg)

# Add delete old + first batch intro
batch1 = 'D("2:12")\n' + '\n'.join(batches[0])
batch2 = '\n'.join(batches[1])

with open(r'D:/Project Regolith/Code/bbq_batch1.txt', 'w') as f:
    f.write(batch1)
with open(r'D:/Project Regolith/Code/bbq_batch2.txt', 'w') as f:
    f.write(batch2)
print('batch1:', len(batch1), 'batch2:', len(batch2), 'paths:', len(paths_data))
