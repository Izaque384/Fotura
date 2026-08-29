from pathlib import Path

p = Path('app/app/dashboard/clientes/page.tsx')
s = p.read_text()
old = '<button className="btn" type="button" onClick={()=>router.push(`/upload?cliente=${encodeURIComponent(c.id)}`)}>+ Nova galeria</button>'
if old not in s:
    raise SystemExit('new gallery button not found')
s = s.replace(old, '', 1)
p.write_text(s)
