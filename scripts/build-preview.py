#!/usr/bin/env python3
"""Arma la vista previa de solo lectura que se publica dentro de Claude.

Toma el código actual del sitio (index.html, css/, js/) y una foto de los datos
(la rama "snapshot" que genera el workflow "Foto para la vista previa") y produce
una sola página con todo incrustado: datos, escudos y logo. No se conecta a nada:
las páginas publicadas en Claude no pueden usar internet.

Uso: python3 scripts/build-preview.py <carpeta-snapshot> <salida.html>
"""
import base64, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP, OUT = sys.argv[1], sys.argv[2]

def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def data_uri(path, mime='image/webp'):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

day = open(os.path.join(SNAP, 'ULTIMO.txt')).read().strip()
hora = open(os.path.join(SNAP, 'HORA.txt')).read().strip() if os.path.exists(os.path.join(SNAP, 'HORA.txt')) else day
data = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(SNAP, 'datos', day, '*.json'))}
for t in ['temporadas', 'teams', 'players', 'matches', 'cup_players', 'cup_matches']:
    assert t in data and (t not in ('teams', 'players', 'matches') or data[t]), f'falta la tabla {t} en la foto'

logos = {os.path.basename(p)[:-5]: data_uri(p) for p in glob.glob(os.path.join(SNAP, 'escudos', '*.webp'))}
for t in data['teams']:
    t['logo_url'] = logos.get(t['id'])  # sin escudo → iniciales, igual que en el sitio

y, m, d = day.split('-')
hhmm = hora.split(' ')[1] if ' ' in hora else ''
fecha_txt = f'{d}-{m}-{y}' + (f' {hhmm}' if hhmm else '')

client = """
/* Cliente de solo lectura: sirve la foto de datos con la misma forma que Supabase. */
window.supabase={createClient(){const D=window.__SNAP;return{
 from(t){let w=false;const b={select(){return b},in(){return b},eq(){return b},
  upsert(){w=true;return b},delete(){w=true;return b},
  then(ok,ko){return Promise.resolve(w?{error:{message:'La vista previa es solo lectura.'}}:{data:JSON.parse(JSON.stringify(D[t]||[])),error:null}).then(ok,ko)}};return b},
 auth:{async getSession(){return{data:{session:null}}},
  async signInWithPassword(){return{error:{message:'La vista previa es solo lectura. Para editar, abrí el sitio publicado.'}}},
  async signOut(){return{error:null}},onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}}
}}};
"""

html = read('index.html')
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = body.replace('assets/logo-superliga.webp', data_uri(os.path.join(ROOT, 'assets/logo-superliga.webp')))
body = body.replace('</header>', f'</header>\n<div class="pvbar"><span><b>Vista previa</b> · datos del {fecha_txt} · solo lectura</span>'
                    '<a href="https://superligathc.netlify.app" target="_blank" rel="noopener">Abrir el sitio ↗</a></div>')
body = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/[^"]+"></script>',
              lambda _: '<script>window.__SNAP=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';' + client + '</script>', body)
for f in ['data', 'logic', 'ui', 'views', 'app']:
    js = read(f'js/{f}.js')
    if f == 'logic':
        js += '\n' + ''.join(f"DLOGO.{k}={json.dumps(logos[f'div-{k}'])};" for k in ['thc', 'sl2'] if f'div-{k}' in logos)
    body = body.replace(f'<script src="js/{f}.js"></script>', f'<script>\n{js}\n</script>')
assert 'src="js/' not in body and 'supabase-js@' not in body

css = read('css/styles.css') + """
/* Vista previa */
#eb,#savest{display:none!important}
.pvbar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;width:min(916px,calc(100% - 24px));margin:10px auto 0;padding:7px 12px;
 font-size:12px;color:var(--mu);background:var(--pn);border:1px dashed var(--ln);border-radius:6px}
.pvbar b{color:var(--tx)}
.pvbar a{color:var(--bl);font-weight:600}
main{padding-top:10px}
"""
page = f'<title>SuperLiga THC</title>\n<style>\n{css}</style>\n{body.strip()}\n'
open(OUT, 'w', encoding='utf-8').write(page)
print(f'{OUT}: {len(page)/1024:.0f} KB · datos del {fecha_txt} · {len(logos)} imágenes')
