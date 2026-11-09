import json, urllib.request, time
d = json.load(open('data/zbe.json'))
Z = {z['id']: z for z in d['zones']}
def ruta(nombre, polys, a=(40.2366, -3.7676), b=(40.5475, -3.6420)):
    body = {"locations": [{"lat": a[0], "lon": a[1]}, {"lat": b[0], "lon": b[1]}], "costing": "auto", "turn_lanes": True}
    if polys: body["exclude_polygons"] = polys
    data = json.dumps(body).encode()
    req = urllib.request.Request("https://valhalla1.openstreetmap.de/route", data=data, headers={"Content-Type": "application/json", "User-Agent": "Minimapa-probe"})
    t = time.time()
    try:
        r = json.load(urllib.request.urlopen(req, timeout=60))
        s = r['trip']['summary']
        print(f"{nombre}: OK {s['length']:.1f} km {s['time']/60:.0f} min ({len(data)//1024} KB, {time.time()-t:.1f}s)")
    except urllib.error.HTTPError as e:
        print(f"{nombre}: HTTP {e.code} {e.read()[:200]} ({len(data)//1024} KB)")
    except Exception as e:
        print(f"{nombre}: {e}")
ruta("sin excluir", None)
ruta("Distrito Centro", Z['zbe-madrid-2']['parts'], b=(40.4500, -3.6900))
ruta("ZBE Madrid entera", Z['zbe-madrid-0']['parts'])
ruta("ZBE Madrid solo partes grandes", [p for p in Z['zbe-madrid-0']['parts'] if len(p) > 60])
ruta("Fuenlabrada (Parla->Mostoles)", Z['zbe-fuenlabrada-0']['parts'], b=(40.3223, -3.8650))
