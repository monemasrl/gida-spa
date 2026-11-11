import sys, urllib.request, urllib.parse, concurrent.futures, os
paths=[l.strip() for l in open(sys.argv[1]) if l.strip()]
out=sys.argv[2]
def get(p):
    local=os.path.join(out, urllib.parse.unquote(p.split('?')[0]).lstrip('/'))
    if os.path.exists(local): return 'skip',p
    os.makedirs(os.path.dirname(local),exist_ok=True)
    try:
        url='https://www.gida-spa.it'+urllib.parse.quote(urllib.parse.unquote(p),safe='/?=&%:')
        r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60)
        open(local,'wb').write(r.read()); return 200,p
    except Exception as e: return str(e),p
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    for s,p in ex.map(get,paths):
        if s not in (200,'skip'): print(s,p)
