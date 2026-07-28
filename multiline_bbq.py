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

# style fill -> direct fill
raw = re.sub(r'style="fill:(#[A-Fa-f0-9]+);"', r'fill="\1"', raw)

# remove empty Layer_1
raw = re.sub(r'<g id="Layer_1">\s*</g>', '', raw)

# strip unnecessary svg attrs: keep only xmlns
raw = re.sub(r'<svg[^>]*>', '<svg xmlns="http://www.w3.org/2000/svg">', raw, count=1)

# round floats in path d
def round_d_val(m):
    d = m.group(1)
    d = re.sub(r'(\d+\.\d+)', lambda n: str(round(float(n.group(1)))), d)
    return 'd="' + d + '"'
raw = re.sub(r'd="([^"]*)"', round_d_val, raw)

# line-break between tags so each line < 2000 chars
raw = re.sub(r'/>\s*<', '/>\n<', raw)
raw = re.sub(r'>\s{2,}<', '>\n<', raw)

# compress whitespace but preserve newlines
raw = re.sub(r'[ \t]+', ' ', raw)
raw = re.sub(r'\n +', '\n', raw)
raw = re.sub(r' +\n', '\n', raw)

op = 'U("2:12", {height:360, svg:`' + raw + '`})'
with open(r'D:/Project Regolith/Code/bbq_multiline_op.txt', 'w') as f:
    f.write(op)
print('op lines:', op.count('\n')+1, 'chars:', len(op))
