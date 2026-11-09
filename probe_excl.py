import json, urllib.request, time, math
d = json.load(open('data/zbe.json'))
Z = {z['id']: z for z in d['zones']}
def dec(s, p=6):
    idx=lat=lng=0; out=[]
    while idx < len(s):
        for k in (0,1):
            sh=r=0
            while True:
                b=ord(s[idx])-63; idx+=1; r|=(b&0x1f)<<sh; sh+=5
                if b<0x20: break
            v=~(r>>1) if r&1 else r>>1
            if k==0: lat+=v
            else: lng+=v
        out.append((lng/10**p, lat/10**p))
    return out
def hav(a,b):
    R=6371000; la1,la2=math.radians(a[1]),math.radians(b[1]); dla=la2-la1; dlo=math.radians(b[0]-a[0])
    return 2*R*math.asin(math.sqrt(math.sin(dla/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2))
def inring(x,y,ring):
    c=False; j=len(ring)-1
    for i in range(len(ring)):
        xi,yi=ring[i]; xj,yj=ring[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi: c=not c
        j=i
    return c
def call(a,b,polys):
    body={"locations":[{"lat":a[0],"lon":a[1]},{"lat":b[0],"lon":b[1]}],"costing":"auto"}
    if polys: body["exclude_polygons"]=polys
    req=urllib.request.Request("https://valhalla1.openstreetmap.de/route",data=json.dumps(body).encode(),headers={"Content-Type":"application/json","User-Agent":"Minimapa-probe"})
    r=json.load(urllib.request.urlopen(req,timeout=60))['trip']
    coords=[]
    for leg in r['legs']: coords+=dec(leg['shape'])
    return r['summary'], coords
def entry(coords, zone):
    acc=0; last=-1e9
    for i,c in enumerate(coords):
        if i: acc+=hav(coords[i-1],c)
        if acc-last<60: continue
        last=acc
        if any(inring(c[0],c[1],p) for p in zone['parts']): return acc, i
    return None
def sq(lon,lat,h=45):
    dla=h/111320; dlo=h/(111320*math.cos(math.radians(lat)))
    return [[lon-dlo,lat-dla],[lon+dlo,lat-dla],[lon+dlo,lat+dla],[lon-dlo,lat+dla],[lon-dlo,lat-dla]]
def prueba(nombre, a, b, zid, tries=6):
    z=Z[zid]; polys=[]; used=0
    for k in range(tries):
        try: s,c=call(a,b,polys)
        except urllib.error.HTTPError as e: print(nombre,'iter',k,'HTTP',e.code,e.read()[:120]); return
        e=entry(c,z)
        print(f"{nombre} iter {k}: {s['length']:.1f} km {s['time']/60:.0f} min, entra en ZBE: {'no' if not e else f'sí a {e[0]/1000:.1f} km'}")
        if not e: return
        # punto 40 m más adelante
        acc=0; target=e[0]+40; pt=c[e[1]]
        for i in range(1,len(c)):
            acc+=hav(c[i-1],c[i])
            if acc>=target: pt=c[i]; break
        q=sq(pt[0],pt[1]); polys.append(q); used+=360
        if used>9800: break
    print(nombre,'no se pudo rodear')
prueba("Parla->Alcobendas sin etiqueta (ZBE Madrid)", (40.2366,-3.7676), (40.5475,-3.6420), 'zbe-madrid-0')
prueba("Parla->Getafe norte sin etiqueta", (40.2366,-3.7676), (40.3290,-3.7210), 'zbe-madrid-0')
prueba("Atocha->Moncloa con etiqueta C (Distrito Centro)", (40.4065,-3.6895), (40.4350,-3.7190), 'zbe-madrid-2')
prueba("Fuenlabrada: Parla->Mostoles", (40.2366,-3.7676), (40.3223,-3.8650), 'zbe-fuenlabrada-0')
