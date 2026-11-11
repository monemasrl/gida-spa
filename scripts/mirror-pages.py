import sys, urllib.request, concurrent.futures, os
urls=[l.strip() for l in open(sys.argv[1]) if l.strip()]
out=sys.argv[2]; os.makedirs(out,exist_ok=True)
def name(u):
    p=u.replace('https://www.gida-spa.it','').strip('/').replace('/','__')
    return p or '_index'
def get(u):
    f=os.path.join(out,name(u)+'.html')
    if os.path.exists(f) and os.path.getsize(f)>1000: return 'skip',u
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30)
        open(f,'wb').write(r.read()); return r.status,u
    except Exception as e: return str(e),u
with concurrent.futures.ThreadPoolExecutor(4) as ex:
    for s,u in ex.map(get,urls):
        if s not in (200,'skip'): print(s,u)
