#!/usr/bin/env python3
"""Descarga, convierte y fusiona las fuentes de radares y de precios de carburantes.

Lo ejecuta GitHub Actions cada día (ver .github/workflows/actualizar.yml). También se puede lanzar a mano:

    python scripts/actualizar_datos.py              # todas las fuentes
    python scripts/actualizar_datos.py --solo dgt   # una fuente concreta
    python scripts/actualizar_datos.py --sin-red    # solo vuelve a fusionar lo que ya hay en data/fuentes

Salida:
    data/fuentes/<fuente>.json   última copia buena de cada fuente (si una falla, se conserva la anterior)
    data/radares.json            base fusionada que descarga la app
    data/gasolineras.json        precios de carburantes en formato compacto

Fuentes de radares:
    madrid    Ayuntamiento de Madrid, radares fijos, de tramo y móviles (CC BY 4.0)
    sct       Servei Català de Trànsit, radares fijos de Cataluña (reutilización con atribución)
    tachwire  Listado oficial de la DGT (PDF 2026) georreferenciado por Tachwire (ODbL 1.0)
    dgt       DGT, Punto de Acceso Nacional, XML DATEX II de radares fijos y tramos
    osm       OpenStreetMap vía Overpass: highway=speed_camera y relaciones type=enforcement (ODbL 1.0)

Solo usa la biblioteca estándar de Python (pyproj es opcional para Cataluña).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "data"
FUENTES_DIR = DATOS / "fuentes"
UA = "Minimapa-datos/1.0 (navegador personal; GitHub Actions)"

TIPOS = {"fijo", "tramo", "semaforo", "cinturon", "linea", "movil"}
ESPANA = (27.0, -19.0, 44.5, 5.5)  # sur, oeste, norte, este (incluye Canarias)

FUENTES = {
    "madrid": {
        "nombre": "Ayuntamiento de Madrid",
        "licencia": "CC BY 4.0",
        "urls": ["https://datos.madrid.es/dataset/300049-0-radares-fijos-moviles/resource/300049-1-radares-fijos-moviles-csv/download/300049-1-radares-fijos-moviles-csv.csv"],
    },
    "sct": {
        "nombre": "Servei Català de Trànsit",
        "licencia": "Reutilización con atribución (Generalitat de Catalunya)",
        "urls": ["https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars.txt"],
    },
    "tachwire": {
        "nombre": "DGT 2026 (Tachwire/IGN)",
        "licencia": "ODbL 1.0",
        "urls": ["https://tachwire.app/data/cameras/es.json"],
    },
    "dgt": {
        "nombre": "DGT (Punto de Acceso Nacional)",
        "licencia": "Datos abiertos DGT",
        "urls": [
            "https://nap.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml",
            "https://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml",
        ],
    },
    "osm": {
        "nombre": "OpenStreetMap",
        "licencia": "ODbL 1.0",
        "urls": [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.private.coffee/api/interpreter",
        ],
    },
}
# Orden de prioridad al fusionar: las fuentes oficiales con límite y sentido van primero.
PRIORIDAD = ["madrid", "sct", "tachwire", "dgt", "osm"]

CARBURANTES_URL = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"


# ---------------------------------------------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------------------------------------------

def log(*a):
    print(*a, file=sys.stderr, flush=True)


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _ssl_tolerante():
    """Contexto TLS para servidores públicos antiguos (p. ej. el del Ministerio), que cierran la
    conexión sin el aviso que exige OpenSSL 3 o necesitan renegociación heredada."""
    import ssl  # noqa: PLC0415
    ctx = ssl.create_default_context()
    ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
    ctx.options |= getattr(ssl, "OP_IGNORE_UNEXPECTED_EOF", 0x80)
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
    except ssl.SSLError:
        pass
    return ctx


def _curl(url: str, timeout: int) -> bytes:
    import subprocess  # noqa: PLC0415
    r = subprocess.run(["curl", "-sS", "-L", "--fail", "--max-time", str(timeout), "-A", UA, "-H", "Accept: application/json", url],
                       capture_output=True, timeout=timeout + 10, check=False)
    if r.returncode != 0 or len(r.stdout) < 50:
        raise RuntimeError(f"curl {r.returncode}: {r.stderr.decode(errors='replace')[:200]}")
    return r.stdout


def descargar(url: str, datos: bytes | None = None, timeout: int = 120, intentos: int = 3, tolerante: bool = False) -> bytes:
    ultimo = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, data=datos, headers={"User-Agent": UA, "Accept": "*/*"})
            if datos is not None:
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
            if tolerante and i == intentos - 1 and datos is None:
                return _curl(url, timeout)
            with urllib.request.urlopen(req, timeout=timeout, context=_ssl_tolerante() if tolerante else None) as r:
                cuerpo = r.read(80 * 1024 * 1024)
            if len(cuerpo) < 50:
                raise ValueError("respuesta demasiado corta")
            return cuerpo
        except Exception as e:  # noqa: BLE001
            ultimo = e
            log(f"  intento {i + 1} fallido para {url}: {e}")
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"no se pudo descargar {url}: {ultimo}")


def distancia_m(a_lat, a_lon, b_lat, b_lon) -> float:
    dy = math.radians(b_lat - a_lat) * 6371000.0
    dx = math.radians(b_lon - a_lon) * 6371000.0 * math.cos(math.radians((a_lat + b_lat) / 2))
    return math.hypot(dx, dy)


def rumbo(a_lat, a_lon, b_lat, b_lon) -> int:
    la1, lo1, la2, lo2 = (math.radians(v) for v in (a_lat, a_lon, b_lat, b_lon))
    y = math.sin(lo2 - lo1) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return round((math.degrees(math.atan2(y, x)) + 360.0) % 360.0) % 360


def dif_angular(a, b) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def en_espana(lat, lon) -> bool:
    return ESPANA[0] <= lat <= ESPANA[2] and ESPANA[1] <= lon <= ESPANA[3]


def num(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def limite(v):
    n = num(v)
    if n is None or not n.is_integer():
        return None
    n = int(n)
    return n if 5 <= n <= 200 else None


def radar(id_, tipo, lat, lon, fuente, fin=None, rumbo_=None, limite_=None, nombre=None, longitud=None) -> dict:
    r = {"id": id_, "tipo": tipo, "lat": round(lat, 6), "lon": round(lon, 6)}
    if fin:
        r["fin"] = [round(fin[0], 6), round(fin[1], 6)]
    if rumbo_ is not None:
        r["rumbo"] = round(float(rumbo_)) % 360
    if limite_:
        r["limite"] = int(limite_)
    if nombre:
        r["nombre"] = str(nombre).strip()[:120]
    if longitud:
        r["longitud"] = int(longitud)
    r["fuente"] = fuente
    return r


def sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower().strip()


# ---------------------------------------------------------------------------------------------------------------
# UTM (ETRS89 / GRS80) -> geográficas, serie de Krüger. Se usa pyproj si está instalado.
# ---------------------------------------------------------------------------------------------------------------

def utm_a_geo(x: float, y: float, huso: int = 31) -> tuple[float, float]:
    a = 6378137.0
    f = 1 / 298.257222101
    k0 = 0.9996
    n = f / (2 - f)
    A = a / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    beta = [n / 2 - 2 * n ** 2 / 3 + 37 * n ** 3 / 96, n ** 2 / 48 + n ** 3 / 15, 17 * n ** 3 / 480]
    delta = [2 * n - 2 * n ** 2 / 3 - 2 * n ** 3, 7 * n ** 2 / 3 - 8 * n ** 3 / 5, 56 * n ** 3 / 15]
    xi = y / (k0 * A)
    eta = (x - 500000.0) / (k0 * A)
    xi_p, eta_p = xi, eta
    for j, b in enumerate(beta, 1):
        xi_p -= b * math.sin(2 * j * xi) * math.cosh(2 * j * eta)
        eta_p -= b * math.cos(2 * j * xi) * math.sinh(2 * j * eta)
    chi = math.asin(math.sin(xi_p) / math.cosh(eta_p))
    phi = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(delta, 1))
    lam0 = math.radians(huso * 6 - 183)
    lam = lam0 + math.atan2(math.sinh(eta_p), math.cos(xi_p))
    return math.degrees(phi), math.degrees(lam)


def utm31_a_geo_lote(puntos):
    try:
        from pyproj import Transformer  # noqa: PLC0415
        t = Transformer.from_crs("EPSG:25831", "EPSG:4326", always_xy=True)
        return [(lat, lon) for lon, lat in (t.transform(x, y) for x, y in puntos)]
    except Exception:  # noqa: BLE001
        return [utm_a_geo(x, y, 31) for x, y in puntos]


# ---------------------------------------------------------------------------------------------------------------
# Conversores
# ---------------------------------------------------------------------------------------------------------------

def convertir_madrid(texto: str) -> list[dict]:
    lector = csv.DictReader(io.StringIO(texto), delimiter=";")
    claves = {sin_acentos(k): k for k in (lector.fieldnames or [])}

    def campo(fila, *nombres):
        for n in nombres:
            k = claves.get(sin_acentos(n))
            if k is not None and fila.get(k) not in (None, ""):
                return fila[k]
        return None

    salida = []
    vistos = set()
    for fila in lector:
        ident = (campo(fila, "Nº RADAR", "N RADAR", "NUM RADAR", "ID") or "").strip()
        tipo_txt = sin_acentos(campo(fila, "Tipo") or "")
        lat, lon = num(campo(fila, "Latitud")), num(campo(fila, "Longitud"))
        if not ident or ident in vistos or lat is None or lon is None or not en_espana(lat, lon):
            continue
        vistos.add(ident)
        lim = limite(campo(fila, "Velocidad límite", "Velocidad limite"))
        nombre = campo(fila, "Ubicacion", "Ubicación")
        if "tramo" in tipo_txt:
            lat0, lon0 = num(campo(fila, "Latitud inicio tramo")), num(campo(fila, "Longitud inicio tramo"))
            if lat0 is None or lon0 is None or distancia_m(lat0, lon0, lat, lon) < 40:
                continue
            salida.append(radar(f"madrid-{ident}", "tramo", lat0, lon0, "madrid", fin=(lat, lon),
                                rumbo_=rumbo(lat0, lon0, lat, lon), limite_=lim, nombre=nombre,
                                longitud=distancia_m(lat0, lon0, lat, lon)))
        elif "movil" in tipo_txt:
            salida.append(radar(f"madrid-{ident}", "movil", lat, lon, "madrid", limite_=lim, nombre=nombre))
        elif "semaforo" in tipo_txt or "foto" in tipo_txt:
            salida.append(radar(f"madrid-{ident}", "semaforo", lat, lon, "madrid", nombre=nombre))
        else:
            salida.append(radar(f"madrid-{ident}", "fijo", lat, lon, "madrid", limite_=lim, nombre=nombre))
    return salida


def convertir_sct(texto: str) -> list[dict]:
    filas = []
    for linea in texto.splitlines():
        partes = linea.split()
        if len(partes) < 5:
            continue
        pk, vel, x, y = partes[-4], partes[-3], num(partes[-2]), num(partes[-1])
        carretera = " ".join(partes[:-4])
        if x is None or y is None or not (100000 <= x <= 900000 and 4400000 <= y <= 4800000):
            continue  # cabecera o coordenadas no válidas
        if not re.fullmatch(r"\d+(?:[.,]\d+)?", pk):
            continue  # rangos de PK = tramos sin coordenadas de entrada y salida
        lim = limite(vel)
        if not carretera:
            continue
        filas.append((carretera, pk.replace(".", ","), lim, x, y))
    geo = utm31_a_geo_lote([(x, y) for _, _, _, x, y in filas])
    salida = []
    for (carretera, pk, lim, _, _), (lat, lon) in zip(filas, geo):
        if not (40.4 <= lat <= 42.95 and 0.1 <= lon <= 3.4):
            continue
        ident = re.sub(r"[^A-Za-z0-9]+", "", f"{carretera}{pk}")
        salida.append(radar(f"sct-{ident}", "fijo", lat, lon, "sct", limite_=lim, nombre=f"{carretera} PK {pk}"))
    # ids únicos aunque se repita carretera y PK (cabinas por sentido)
    vistos: dict[str, int] = {}
    for r in salida:
        n = vistos.get(r["id"], 0)
        vistos[r["id"]] = n + 1
        if n:
            r["id"] = f"{r['id']}-{n + 1}"
    return salida


TACHWIRE_TIPOS = {
    "speed": "fijo", "seatbelt_phone": "cinturon", "phone": "cinturon", "seatbelt": "cinturon",
    "red_light": "semaforo", "redlight": "semaforo", "redLight": "semaforo", "other": "linea", "line_stop": "linea",
}


def convertir_tachwire(texto: str) -> list[dict]:
    datos = json.loads(texto)
    camaras = [c for c in datos.get("cameras", []) if c.get("source") in ("dgt-radars-pdf", "dgt-equipos-pdf")]
    salida, tramos = [], {}

    def nombre(c):
        via = c.get("road") or ""
        return f"{via} PK {c['pk']}" if c.get("pk") is not None else via

    def sentido(c):
        b = c.get("bearing")
        return None if c.get("bothWays") or b is None or not (0 <= b < 360) else b

    for c in camaras:
        lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None or not en_espana(lat, lon):
            continue
        t = c.get("type")
        if t in ("section_start", "section_end"):
            if c.get("section"):
                tramos.setdefault(c["section"], {})[t] = c
            continue
        tipo = TACHWIRE_TIPOS.get(t)
        if not tipo:
            continue
        lim = limite(c.get("limit")) if tipo == "fijo" else None
        salida.append(radar(f"tachwire-{c['id']}", tipo, lat, lon, "tachwire", rumbo_=sentido(c), limite_=lim, nombre=nombre(c)))
    for sid, par in tramos.items():
        a, b = par.get("section_start"), par.get("section_end")
        if not a or not b or distancia_m(a["lat"], a["lon"], b["lat"], b["lon"]) < 40:
            continue
        longitud = None
        if a.get("pk") is not None and b.get("pk") is not None:
            longitud = round(abs(float(b["pk"]) - float(a["pk"])) * 1000)
            if not 50 <= longitud <= 200000:
                longitud = None
        salida.append(radar(f"tachwire-{sid}", "tramo", a["lat"], a["lon"], "tachwire", fin=(b["lat"], b["lon"]),
                            rumbo_=sentido(a), limite_=limite(a.get("limit")), nombre=nombre(a), longitud=longitud))
    return salida


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _hijos(elem, nombre):
    return [c for c in elem if _local(c.tag) == nombre]


def _desc(elem, nombre):
    for e in elem.iter():
        if _local(e.tag) == nombre:
            return e
    return None


def _coords(elem):
    if elem is None:
        return None
    lat = _desc(elem, "latitude")
    lon = _desc(elem, "longitude")
    if lat is None or lon is None:
        return None
    la, lo = num(lat.text), num(lon.text)
    return (la, lo) if la is not None and lo is not None else None


def convertir_dgt(contenido: bytes) -> list[dict]:
    raiz = ET.fromstring(contenido)
    salida = []
    for loc in raiz.iter():
        if _local(loc.tag) != "predefinedLocation" or not loc.get("id"):
            continue
        interiores = _hijos(loc, "predefinedLocation")
        if not interiores:
            continue
        interior = interiores[0]
        xtipo = next((v for k, v in interior.attrib.items() if _local(k) == "type"), "")
        ident = loc.get("id").rsplit("_", 1)[-1]
        nombre_el = _desc(loc, "value")
        via = _desc(interior, "roadNumber")
        pk = _desc(interior, "referencePointDistance")
        nombre = (via.text.strip() if via is not None and via.text else "")
        if pk is not None and num(pk.text) is not None:
            nombre = f"{nombre} PK {num(pk.text) / 1000:.1f}".replace(".", ",").strip()
        if not nombre and nombre_el is not None and nombre_el.text:
            nombre = nombre_el.text
        if xtipo.endswith("Linear"):
            desde = next((e for e in interior.iter() if _local(e.tag) == "from"), None)
            hasta = next((e for e in interior.iter() if _local(e.tag) == "to"), None)
            a, b = _coords(desde), _coords(hasta)
            if not a or not b or not en_espana(*a) or distancia_m(*a, *b) < 40:
                continue
            salida.append(radar(f"dgt-t{ident}", "tramo", a[0], a[1], "dgt", fin=b, rumbo_=rumbo(*a, *b), nombre=nombre,
                                longitud=distancia_m(*a, *b)))
        else:
            p = _coords(interior)
            if not p or not en_espana(*p):
                continue
            salida.append(radar(f"dgt-{ident}", "fijo", p[0], p[1], "dgt", nombre=nombre))
    return salida


OVERPASS_Q = """[out:json][timeout:900];
area["ISO3166-1"="ES"][admin_level=2]->.es;
(
  node["highway"="speed_camera"](area.es);
  relation["type"="enforcement"]["enforcement"~"^(maxspeed|average_speed|traffic_signals)$"](area.es);
);
out body;
>;
out skel qt;"""

CARDINALES = {"N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5, "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5, "S": 180,
              "SSW": 202.5, "SW": 225, "WSW": 247.5, "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5}


def _direccion_osm(v):
    if not v:
        return None
    p = str(v).split(";")[0].strip().upper()
    if p in CARDINALES:
        return CARDINALES[p]
    n = num(p)
    return n % 360 if n is not None and 0 <= n <= 360 else None


def convertir_osm(texto: str) -> list[dict]:
    datos = json.loads(texto)
    nodos, vias, rels = {}, {}, []
    for el in datos.get("elements", []):
        if el["type"] == "node":
            nodos[el["id"]] = el
        elif el["type"] == "way":
            vias[el["id"]] = el
        elif el["type"] == "relation":
            rels.append(el)

    def pos(m):
        if m["type"] == "node":
            n = nodos.get(m["ref"])
            return (n["lat"], n["lon"]) if n and "lat" in n else None
        if m["type"] == "way":
            w = vias.get(m["ref"])
            if not w or not w.get("nodes"):
                return None
            n = nodos.get(w["nodes"][len(w["nodes"]) // 2])
            return (n["lat"], n["lon"]) if n and "lat" in n else None
        return None

    salida, consumidos, por_disp = [], set(), {}
    for r in rels:
        t = r.get("tags", {})
        miembros = r.get("members", [])
        desde = next((pos(m) for m in miembros if m.get("role") == "from"), None)
        hasta = next((pos(m) for m in miembros if m.get("role") == "to"), None)
        disp = [m["ref"] for m in miembros if m.get("role") == "device" and m["type"] == "node"]
        enf = t.get("enforcement")
        if enf == "average_speed":
            pts = [pos({"type": "node", "ref": d}) for d in disp]
            pts = [p for p in pts if p]
            a = desde or (pts[0] if pts else None)
            b = hasta or (pts[-1] if pts else None)
            if not a or not b or distancia_m(*a, *b) < 40:
                continue
            consumidos.update(disp)
            salida.append(radar(f"osm-r{r['id']}", "tramo", a[0], a[1], "osm", fin=b, rumbo_=rumbo(*a, *b),
                                limite_=limite(t.get("maxspeed")), longitud=distancia_m(*a, *b)))
        elif enf in ("maxspeed", "traffic_signals"):
            dir_ = rumbo(*desde, *hasta) if desde and hasta and distancia_m(*desde, *hasta) > 40 else None
            for d in disp:
                por_disp[d] = {"rumbo": dir_, "limite": limite(t.get("maxspeed")),
                               "tipo": "semaforo" if enf == "traffic_signals" else "fijo"}
    for nid, n in nodos.items():
        t = n.get("tags", {})
        rel = por_disp.get(nid)
        if (t.get("highway") != "speed_camera" and not rel) or nid in consumidos or "lat" not in n:
            continue
        if not en_espana(n["lat"], n["lon"]):
            continue
        dir_ = _direccion_osm(t.get("direction"))
        if dir_ is None and rel:
            dir_ = rel["rumbo"]
        salida.append(radar(f"osm-n{nid}", rel["tipo"] if rel else "fijo", n["lat"], n["lon"], "osm",
                            rumbo_=dir_, limite_=limite(t.get("maxspeed")) or (rel or {}).get("limite")))
    return salida


def convertir_carburantes(texto: str) -> dict:
    datos = json.loads(texto)
    lista = datos.get("ListaEESSPrecio") or []

    def clave(e, patron):
        for k in e:
            if re.search(patron, k):
                return e[k]
        return None

    def precio(v):
        n = num(v)
        return round(n, 3) if n and 0.3 < n < 5 else None

    estaciones = []
    for e in lista:
        lat, lon = num(e.get("Latitud")), num(clave(e, r"^Longitud"))
        if lat is None or lon is None or not en_espana(lat, lon):
            continue
        fila = [
            e.get("IDEESS"), round(lat, 5), round(lon, 5), (e.get("Rótulo") or "").strip()[:40],
            (e.get("Dirección") or "").strip().title()[:60], (e.get("Municipio") or "").strip().title()[:40],
            (e.get("Horario") or "").strip()[:60],
            precio(clave(e, r"Gasolina 95 E5$")), precio(clave(e, r"Gasolina 98 E5$")), precio(clave(e, r"Gasoleo A$")),
            precio(clave(e, r"Gasoleo Premium$")), precio(clave(e, r"Gases licuados")),
        ]
        if any(p is not None for p in fila[7:]):
            estaciones.append(fila)
    return {
        "generado": ahora_iso(),
        "fecha": datos.get("Fecha", ""),
        "campos": ["id", "lat", "lon", "rotulo", "direccion", "municipio", "horario", "g95", "g98", "diesel", "dieselPlus", "glp"],
        "estaciones": estaciones,
    }


CONVERSORES = {
    "madrid": lambda b: convertir_madrid(b.decode("utf-8-sig", errors="replace")),
    "sct": lambda b: convertir_sct(_texto(b)),
    "tachwire": lambda b: convertir_tachwire(b.decode("utf-8")),
    "dgt": convertir_dgt,
    "osm": lambda b: convertir_osm(b.decode("utf-8")),
}


def _texto(b: bytes) -> str:
    try:
        return b.decode("utf-8-sig")
    except UnicodeDecodeError:
        return b.decode("latin-1")


# ---------------------------------------------------------------------------------------------------------------
# Actualización de cada fuente con copia de seguridad
# ---------------------------------------------------------------------------------------------------------------

def leer_cache(fid: str) -> dict | None:
    p = FUENTES_DIR / f"{fid}.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
    return None


def conservar_enriquecido(nuevos: list[dict], previos: list[dict]) -> int:
    """Si un radar nuevo no trae sentido o límite y la copia anterior (mismo id, misma posición) sí, se conserva."""
    por_id = {r["id"]: r for r in previos}
    rejilla: dict[tuple, list[dict]] = {}
    for p in previos:
        rejilla.setdefault(_celda(p["lat"], p["lon"]), []).append(p)

    def por_posicion(r):
        cy, cx = _celda(r["lat"], r["lon"])
        cands = [p for dy in (-1, 0, 1) for dx in (-1, 0, 1) for p in rejilla.get((cy + dy, cx + dx), [])
                 if p["tipo"] == r["tipo"] and distancia_m(r["lat"], r["lon"], p["lat"], p["lon"]) <= 15]
        return cands[0] if len(cands) == 1 else None

    n = 0
    for r in nuevos:
        p = por_id.get(r["id"])
        if not p or distancia_m(r["lat"], r["lon"], p["lat"], p["lon"]) > 30:
            p = por_posicion(r)
        if not p:
            continue
        for k in ("rumbo", "limite", "nombre"):
            if k not in r and k in p:
                r[k] = p[k]
                n += 1
    return n


def actualizar_fuente(fid: str) -> dict:
    meta = FUENTES[fid]
    previa = leer_cache(fid)
    n_prev = len(previa["radares"]) if previa else 0
    log(f"→ {fid}: descargando…")
    contenido = None
    errores = []
    for url in meta["urls"]:
        try:
            if fid == "osm":
                contenido = descargar(url, datos=urllib.parse.urlencode({"data": OVERPASS_Q}).encode(), timeout=1000, intentos=2)
            else:
                contenido = descargar(url)
            break
        except Exception as e:  # noqa: BLE001
            errores.append(str(e))
    if contenido is None:
        log(f"  ✗ {fid}: sin descarga, se mantiene la copia anterior ({n_prev})")
        return {"id": fid, "ok": False, "error": "; ".join(errores)[:300]}
    try:
        radares = [r for r in CONVERSORES[fid](contenido) if r["tipo"] in TIPOS]
    except Exception as e:  # noqa: BLE001
        log(f"  ✗ {fid}: formato inesperado ({e}), se mantiene la copia anterior")
        return {"id": fid, "ok": False, "error": f"formato: {e}"[:300]}
    if n_prev and len(radares) < n_prev * 0.6:
        log(f"  ✗ {fid}: {len(radares)} radares frente a {n_prev} antes: sospechoso, se mantiene la copia anterior")
        return {"id": fid, "ok": False, "error": f"recuento sospechoso {len(radares)}/{n_prev}"}
    if not radares:
        log(f"  ✗ {fid}: 0 radares")
        return {"id": fid, "ok": False, "error": "0 radares"}
    ids = set()
    for r in radares:
        base, k = r["id"], 2
        while r["id"] in ids:
            r["id"] = f"{base}-{k}"
            k += 1
        ids.add(r["id"])
    enr = conservar_enriquecido(radares, previa["radares"]) if previa else 0
    salida = {"fuente": fid, "nombre": meta["nombre"], "licencia": meta["licencia"], "actualizado": ahora_iso(), "radares": radares}
    FUENTES_DIR.mkdir(parents=True, exist_ok=True)
    (FUENTES_DIR / f"{fid}.json").write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"  ✓ {fid}: {len(radares)} radares (antes {n_prev}, {enr} datos conservados)")
    return {"id": fid, "ok": True}


# ---------------------------------------------------------------------------------------------------------------
# Fusión
# ---------------------------------------------------------------------------------------------------------------

CELDA = 0.01


def _celda(lat, lon):
    return (math.floor(lat / CELDA), math.floor(lon / CELDA))


def fusionar(listas: dict[str, list[dict]]) -> list[dict]:
    """Une las fuentes por prioridad. Un radar de una fuente de menor prioridad se descarta si ya hay uno
    del mismo tipo de otra fuente a menos de 60 m (100 m si viene de DGT/OSM) con sentido compatible;
    antes, completa el sentido y el límite que le falten al que se queda. Los tramos se comparan por inicio y fin."""
    final: list[dict] = []
    rejilla: dict[tuple, list[dict]] = {}

    def vecinos(lat, lon):
        cy, cx = _celda(lat, lon)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yield from rejilla.get((cy + dy, cx + dx), [])

    for fid in PRIORIDAD:
        for r in listas.get(fid, []):
            umbral = 100 if fid in ("dgt", "osm") else 60
            duplicado = None
            for k in vecinos(r["lat"], r["lon"]):
                if k["fuente"] == r["fuente"]:
                    continue
                if (k["tipo"] == "tramo") != (r["tipo"] == "tramo"):
                    continue
                if r["tipo"] != "tramo" and k["tipo"] != r["tipo"] and {k["tipo"], r["tipo"]} != {"fijo", "movil"}:
                    continue
                if r.get("rumbo") is not None and k.get("rumbo") is not None and dif_angular(r["rumbo"], k["rumbo"]) >= 90:
                    continue
                if r["tipo"] == "tramo":
                    if distancia_m(k["lat"], k["lon"], r["lat"], r["lon"]) > 200:
                        continue
                    if not k.get("fin") or not r.get("fin") or distancia_m(*k["fin"], *r["fin"]) > 200:
                        continue
                elif distancia_m(k["lat"], k["lon"], r["lat"], r["lon"]) > umbral:
                    continue
                duplicado = k
                break
            if duplicado:
                for campo in ("rumbo", "limite", "nombre", "longitud"):
                    if campo not in duplicado and campo in r:
                        duplicado[campo] = r[campo]
                continue
            nuevo = dict(r)
            final.append(nuevo)
            rejilla.setdefault(_celda(r["lat"], r["lon"]), []).append(nuevo)
    return final


def escribir_base(estado: dict[str, dict]) -> dict:
    listas, fuentes = {}, []
    for fid in PRIORIDAD:
        cache = leer_cache(fid)
        if not cache:
            fuentes.append({"id": fid, "nombre": FUENTES[fid]["nombre"], "licencia": FUENTES[fid]["licencia"], "total": 0, "ok": False})
            continue
        listas[fid] = cache["radares"]
        e = estado.get(fid, {})
        fuentes.append({
            "id": fid, "nombre": cache.get("nombre", FUENTES[fid]["nombre"]), "licencia": cache.get("licencia", FUENTES[fid]["licencia"]),
            "total": len(cache["radares"]), "actualizado": cache.get("actualizado"), "ok": e.get("ok", True),
        })
    radares = fusionar(listas)
    radares.sort(key=lambda r: (r["lat"], r["lon"]))
    for f in fuentes:
        f["tras_fusion"] = sum(1 for r in radares if r["fuente"] == f["id"])
    base = {
        "schema": 1,
        "generado": ahora_iso(),
        "aviso": "Ubicaciones públicas de radares. Pueden faltar o haber cambiado: respeta siempre la señalización.",
        "fuentes": fuentes,
        "radares": radares,
    }
    (DATOS / "radares.json").write_text(json.dumps(base, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return base


def actualizar_carburantes() -> bool:
    log("→ carburantes: descargando…")
    try:
        contenido = descargar(CARBURANTES_URL, timeout=180, tolerante=True)
        datos = convertir_carburantes(contenido.decode("utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        log(f"  ✗ carburantes: {e}")
        return False
    if len(datos["estaciones"]) < 3000:
        log(f"  ✗ carburantes: solo {len(datos['estaciones'])} estaciones, no se sobrescribe")
        return False
    (DATOS / "gasolineras.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"  ✓ carburantes: {len(datos['estaciones'])} estaciones ({datos['fecha']})")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo", choices=[*FUENTES, "carburantes"], help="actualizar solo esta fuente")
    ap.add_argument("--sin-red", action="store_true", help="no descargar: solo volver a fusionar las copias locales")
    args = ap.parse_args()
    estado = {}
    if not args.sin_red:
        objetivo = [args.solo] if args.solo else [*FUENTES, "carburantes"]
        for fid in objetivo:
            if fid == "carburantes":
                actualizar_carburantes()
            else:
                estado[fid] = actualizar_fuente(fid)
    base = escribir_base(estado)
    resumen = ", ".join(f"{f['id']}={f['tras_fusion']}/{f['total']}" for f in base["fuentes"])
    log(f"Base fusionada: {len(base['radares'])} radares ({resumen})")
    if len(base["radares"]) < 100:
        log("✗ La base fusionada tiene muy pocos radares: revisa las fuentes")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
