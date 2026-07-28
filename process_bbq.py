import re, json

with open(r'C:/Users/Lenovo/Downloads/barbecue.svg', 'r') as f:
    raw = f.read()

# strip xml decl + metadata
raw = re.sub(r'<\?xml[^?]*\?>', '', raw)
raw = re.sub(r'<metadata>.*?</metadata>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<!--.*?-->', '', raw, flags=re.DOTALL)
raw = re.sub(r'<\?xpacket.*?\?>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<x:xmpmeta.*?</x:xmpmeta>', '', raw, flags=re.DOTALL)
raw = re.sub(r'<rdf:RDF.*?</rdf:RDF>', '', raw, flags=re.DOTALL)

# style fill -> direct fill attr
raw = re.sub(r'style="fill:(#[A-Fa-f0-9]+);"', r'fill="\1"', raw)

# remove empty Layer_1
raw = re.sub(r'<g id="Layer_1">\s*</g>', '', raw)

# compress whitespace
raw = re.sub(r'\s+', ' ', raw).strip()

# build op with template literal
op = 'U("2:12", {height:360, svg:`' + raw + '`})'
with open(r'D:/Project Regolith/Code/bbq_backtick_op.txt', 'w') as f:
    f.write(op)
print('OK', len(op))
