#!/usr/bin/env python3
"""Pruebas de los conversores con muestras de cada formato. Ejecuta: python scripts/test_actualizar_datos.py"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import actualizar_datos as A  # noqa: E402

DGT_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<d2LogicalModel xmlns="http://datex2.eu/schema/1_0/1_0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" modelBaseVersion="1.0">
 <payloadPublication xsi:type="PredefinedLocationsPublication" lang="es">
  <publicationTime>2025-12-18T10:00:00</publicationTime>
  <predefinedLocationSet id="RADARES">
   <predefinedLocation id="GUID_RAD_120451">
    <predefinedLocationName><value lang="es">Radar fijo A-4 PK 23,4</value></predefinedLocationName>
    <predefinedLocation xsi:type="Point">
     <tpegpointLocation xsi:type="TPEGSimplePoint">
      <point xsi:type="TPEGNonJunctionPoint">
       <pointCoordinates><latitude>40.2154</latitude><longitude>-3.6512</longitude></pointCoordinates>
      </point>
     </tpegpointLocation>
     <alertCPoint><roadNumber>A-4</roadNumber><referencePointDistance>23400</referencePointDistance></alertCPoint>
    </predefinedLocation>
   </predefinedLocation>
   <predefinedLocation id="GUID_CVM_161274">
    <predefinedLocationName><value lang="es">Tramo A-42</value></predefinedLocationName>
    <predefinedLocation xsi:type="Linear">
     <tpeglinearLocation>
      <from xsi:type="TPEGNonJunctionPoint"><pointCoordinates><latitude>40.1500</latitude><longitude>-3.8000</longitude></pointCoordinates></from>
      <to xsi:type="TPEGNonJunctionPoint"><pointCoordinates><latitude>40.1200</latitude><longitude>-3.8200</longitude></pointCoordinates></to>
     </tpeglinearLocation>
    </predefinedLocation>
   </predefinedLocation>
  </predefinedLocationSet>
 </payloadPublication>
</d2LogicalModel>"""

MADRID_CSV = (
    "Nº RADAR;Tipo;Ubicacion;Velocidad límite;Latitud;Longitud;Latitud inicio tramo;Longitud inicio tramo\n"
    "1;Fijo;M-30 ENTRADA A-1;90;40,47934;-3,67433;;\n"
    "2;Radar de tramo;M-30 TÚNEL;70;40.40100;-3.71000;40.39500;-3.71800\n"
    "3;Móvil;Paseo de la Castellana;50;40.44000;-3.69100;;\n"
    "4;Fijo;Sin coordenadas;50;;;;\n"
)

SCT_TXT = (
    "RADARS FIXOS DE CATALUNYA\n"
    "Carretera PK Velocitat X Y\n"
    "-------------------------\n"
    "C-31 12,5 80 431245,3 4583120,7\n"
    "AP-7 150 120 489000 4620000\n"
    "B-20 3,2-5,1 80 428000 4585000\n"
)

TACHWIRE = {
    "schema": 1, "country": "ES", "licence": "ODbL-1.0", "generated": "2026-10-04T00:00:00Z",
    "cameras": [
        {"id": "es-dgt-000001", "source": "dgt-radars-pdf", "type": "speed", "lat": 40.3, "lon": -3.7, "road": "A-4", "pk": 12.3, "bearing": 180, "limit": 100},
        {"id": "es-dgt-000002", "source": "dgt-radars-pdf", "type": "speed", "lat": 40.31, "lon": -3.71, "road": "A-4", "pk": 13.1, "bothWays": True, "bearing": 10},
        {"id": "es-dgt-000003", "source": "dgt-radars-pdf", "type": "section_start", "section": "S1", "lat": 40.5, "lon": -3.5, "road": "A-2", "pk": 30.0, "limit": 120, "bearing": 45},
        {"id": "es-dgt-000004", "source": "dgt-radars-pdf", "type": "section_end", "section": "S1", "lat": 40.52, "lon": -3.47, "road": "A-2", "pk": 33.2},
        {"id": "es-dgt-000005", "source": "dgt-equipos-pdf", "type": "seatbelt_phone", "lat": 41.6, "lon": -0.84, "road": "Z-40", "pk": 15.7, "bearing": 7},
        {"id": "es-osm-000006", "source": "osm-camera", "type": "speed", "lat": 41.0, "lon": -1.0},
    ],
}

OVERPASS = {
    "elements": [
        {"type": "node", "id": 1, "lat": 40.0, "lon": -3.0, "tags": {"highway": "speed_camera", "maxspeed": "80", "direction": "NE"}},
        {"type": "node", "id": 2, "lat": 40.1, "lon": -3.1, "tags": {"highway": "speed_camera"}},
        {"type": "node", "id": 3, "lat": 40.0995, "lon": -3.1010},
        {"type": "node", "id": 4, "lat": 40.1005, "lon": -3.0990},
        {"type": "relation", "id": 10, "tags": {"type": "enforcement", "enforcement": "maxspeed", "maxspeed": "100"},
         "members": [{"type": "node", "ref": 2, "role": "device"}, {"type": "node", "ref": 3, "role": "from"}, {"type": "node", "ref": 4, "role": "to"}]},
        {"type": "node", "id": 5, "lat": 40.2, "lon": -3.2},
        {"type": "node", "id": 6, "lat": 40.23, "lon": -3.2},
        {"type": "node", "id": 7, "lat": 40.2, "lon": -3.2, "tags": {"highway": "speed_camera"}},
        {"type": "relation", "id": 11, "tags": {"type": "enforcement", "enforcement": "average_speed", "maxspeed": "120"},
         "members": [{"type": "node", "ref": 5, "role": "from"}, {"type": "node", "ref": 6, "role": "to"}, {"type": "node", "ref": 7, "role": "device"}]},
        {"type": "node", "id": 8, "lat": 51.5, "lon": -0.1, "tags": {"highway": "speed_camera"}},
    ]
}

MINETUR = {
    "Fecha": "07/11/2026 8:30:00",
    "ListaEESSPrecio": [
        {"IDEESS": "1234", "Latitud": "40,234567", "Longitud (WGS84)": "-3,765432", "Rótulo": "REPSOL", "Dirección": "AVENIDA JUAN CARLOS I, 10",
         "Municipio": "PARLA", "Horario": "L-D: 24H", "Precio Gasolina 95 E5": "1,529", "Precio Gasolina 98 E5": "1,689",
         "Precio Gasoleo A": "1,449", "Precio Gasoleo Premium": "1,559", "Precio Gases licuados del petróleo": ""},
        {"IDEESS": "9999", "Latitud": "", "Longitud (WGS84)": "", "Rótulo": "SIN COORDS"},
    ],
    "ResultadoConsulta": "OK",
}


class Conversores(unittest.TestCase):
    def test_dgt(self):
        r = A.convertir_dgt(DGT_XML)
        self.assertEqual(len(r), 2)
        fijo = next(x for x in r if x["tipo"] == "fijo")
        self.assertEqual(fijo["id"], "dgt-120451")
        self.assertAlmostEqual(fijo["lat"], 40.2154)
        self.assertIn("A-4", fijo["nombre"])
        tramo = next(x for x in r if x["tipo"] == "tramo")
        self.assertEqual(tramo["fin"], [40.12, -3.82])
        self.assertGreater(tramo["longitud"], 3000)

    def test_madrid(self):
        r = A.convertir_madrid(MADRID_CSV)
        tipos = {x["id"]: x for x in r}
        self.assertEqual(len(r), 3)
        self.assertEqual(tipos["madrid-1"]["limite"], 90)
        self.assertAlmostEqual(tipos["madrid-1"]["lat"], 40.47934)
        self.assertEqual(tipos["madrid-2"]["tipo"], "tramo")
        self.assertEqual(tipos["madrid-2"]["lat"], 40.395)  # el inicio es el punto "inicio tramo"
        self.assertEqual(tipos["madrid-2"]["fin"], [40.401, -3.71])
        self.assertEqual(tipos["madrid-3"]["tipo"], "movil")

    def test_sct_y_utm(self):
        r = A.convertir_sct(SCT_TXT)
        self.assertEqual(len(r), 2)  # el rango de PK se descarta
        c31 = r[0]
        self.assertEqual(c31["limite"], 80)
        lat, lon = A.utm_a_geo(431245.3, 4583120.7, 31)
        try:
            from pyproj import Transformer
            lon2, lat2 = Transformer.from_crs("EPSG:25831", "EPSG:4326", always_xy=True).transform(431245.3, 4583120.7)
            self.assertLess(A.distancia_m(lat, lon, lat2, lon2), 0.05, "la fórmula propia debe coincidir con PROJ")
        except ImportError:
            pass
        self.assertAlmostEqual(lat, 41.3970, places=2)
        self.assertAlmostEqual(lon, 2.1798, places=2)

    def test_tachwire(self):
        r = A.convertir_tachwire(json.dumps(TACHWIRE))
        ids = {x["id"]: x for x in r}
        self.assertEqual(len(r), 4)  # 2 fijos, 1 tramo, 1 cámara de cinturón; el de OSM se ignora
        self.assertEqual(ids["tachwire-es-dgt-000001"]["rumbo"], 180)
        self.assertNotIn("rumbo", ids["tachwire-es-dgt-000002"])  # ambos sentidos
        self.assertEqual(ids["tachwire-S1"]["tipo"], "tramo")
        self.assertEqual(ids["tachwire-S1"]["longitud"], 3200)
        self.assertEqual(ids["tachwire-es-dgt-000005"]["tipo"], "cinturon")

    def test_osm(self):
        r = A.convertir_osm(json.dumps(OVERPASS))
        ids = {x["id"]: x for x in r}
        self.assertEqual(ids["osm-n1"]["rumbo"], 45)
        self.assertEqual(ids["osm-n1"]["limite"], 80)
        self.assertEqual(ids["osm-n2"]["limite"], 100)  # límite de la relación
        self.assertIsNotNone(ids["osm-n2"].get("rumbo"))  # sentido from -> to
        self.assertEqual(ids["osm-r11"]["tipo"], "tramo")
        self.assertNotIn("osm-n7", ids)  # dispositivo del tramo, no se duplica como fijo
        self.assertNotIn("osm-n8", ids)  # fuera de España

    def test_carburantes(self):
        d = A.convertir_carburantes(json.dumps(MINETUR))
        self.assertEqual(len(d["estaciones"]), 1)
        e = d["estaciones"][0]
        self.assertEqual(e[3], "REPSOL")
        self.assertEqual(e[7], 1.529)
        self.assertEqual(e[9], 1.449)
        self.assertIsNone(e[11])

    def test_fusion(self):
        a = [A.radar("madrid-1", "fijo", 40.0, -3.0, "madrid", limite_=50)]
        b = [A.radar("dgt-1", "fijo", 40.0004, -3.0003, "dgt", rumbo_=90),  # ~50 m: duplicado
             A.radar("dgt-2", "fijo", 40.01, -3.0, "dgt")]
        c = [A.radar("osm-n1", "fijo", 40.0001, -3.0001, "osm", rumbo_=270, limite_=60)]  # sentido contrario: se queda
        f = A.fusionar({"madrid": a, "dgt": b, "osm": c})
        ids = {x["id"]: x for x in f}
        self.assertEqual(set(ids), {"madrid-1", "dgt-2", "osm-n1"})
        self.assertEqual(ids["madrid-1"]["rumbo"], 90)  # completado desde la DGT
        self.assertEqual(ids["madrid-1"]["limite"], 50)

    def test_conservar_enriquecido(self):
        prev = [A.radar("sct-1", "fijo", 41.0, 2.0, "sct", rumbo_=120)]
        nuevo = [A.radar("sct-C31125", "fijo", 41.00005, 2.00004, "sct")]
        self.assertEqual(A.conservar_enriquecido(nuevo, prev), 1)
        self.assertEqual(nuevo[0]["rumbo"], 120)


    def _zbe_xml(self, etiquetas, nombre="Ciudad (ZBEDPE  Distrito Centro)", horas=("00:00:00Z", "23:59:59Z")):
        coords = "".join(f"<loc:openlrCoordinates><loc:latitude>{la}</loc:latitude><loc:longitude>{lo}</loc:longitude></loc:openlrCoordinates>"
                         for la, lo in [(40.0, -3.0), (40.0, -2.99), (40.01, -2.99), (40.01, -3.0)])
        conds = "".join(f'<tra:conditions xsi:type="conz:NonCodableCondition"><tra:active>true</tra:active><tra:condition><com:values>'
                        f'<com:value>{e}</com:value></com:values></tra:condition><tra:type>stickerCondition</tra:type></tra:conditions>' for e in etiquetas)
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<payload xmlns:com="c" xmlns:loc="l" xmlns:tra="t" xmlns:conz="z" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<conz:controlledZoneTable><conz:controlledZone id="1"><conz:name><com:values><com:value lang="ES">{nombre}</com:value></com:values></conz:name>
<conz:status>active</conz:status><conz:trafficRegulationOrder><tra:trafficRegulation><tra:condition xsi:type="tra:ConditionSet">
<tra:conditions xsi:type="tra:LocationCondition"><tra:implementedLocation><loc:locationContainedInGroup><loc:openlrAreaLocationReference>
<loc:openlrPolygonCorners>{coords}</loc:openlrPolygonCorners></loc:openlrAreaLocationReference></loc:locationContainedInGroup></tra:implementedLocation></tra:conditions>
<tra:conditions xsi:type="tra:ConditionSet"><tra:negate>true</tra:negate>{conds}</tra:conditions>
<tra:conditions xsi:type="tra:ValidityCondition"><tra:validPeriod><tra:recurringTimePeriodOfDay><tra:startTimeOfPeriod>{horas[0]}</tra:startTimeOfPeriod>
<tra:endTimeOfPeriod>{horas[1]}</tra:endTimeOfPeriod></tra:recurringTimePeriodOfDay></tra:validPeriod></tra:conditions>
</tra:condition></tra:trafficRegulation></conz:trafficRegulationOrder></conz:controlledZone></conz:controlledZoneTable></payload>""".encode()

    def test_zbe_lista_de_prohibidas(self):
        z = A.convertir_zbe(self._zbe_xml(["C", "B", "Sin distintivo"]), "Ciudad")
        self.assertEqual(len(z), 1)
        self.assertEqual(z[0]["name"], "Distrito Centro")
        self.assertEqual(z[0]["city"], "Ciudad")
        self.assertEqual(z[0]["deny"], 2)  # C, B y sin etiqueta no entran
        self.assertTrue(z[0]["h24"])
        self.assertEqual(z[0]["parts"][0][0], z[0]["parts"][0][-1])  # anillo cerrado

    def test_zbe_lista_de_permitidas(self):
        z = A.convertir_zbe(self._zbe_xml(["0", "ECO", "B"], nombre="Barcelona", horas=("07:00:00Z", "20:00:00Z")), "Barcelona")
        self.assertEqual(z[0]["deny"], 4)  # solo los coches sin etiqueta
        self.assertEqual(z[0]["name"], "Barcelona")
        self.assertFalse(z[0]["h24"])

    def test_zbe_solo_sin_etiqueta(self):
        z = A.convertir_zbe(self._zbe_xml(["Sin distintivo"], nombre="Madrid (Madrid ZBE)"), "Madrid")
        self.assertEqual(z[0]["deny"], 4)
        self.assertEqual(z[0]["name"], "Madrid")

    def test_simplificar_anillo(self):
        anillo = [(-3.0, 40.0), (-2.995, 40.00001), (-2.99, 40.0), (-2.99, 40.01), (-3.0, 40.01), (-3.0, 40.0)]
        s = A._simplificar(anillo)
        self.assertEqual(s[0], s[-1])
        self.assertEqual(len(s), 5)  # el punto casi alineado desaparece


if __name__ == "__main__":
    unittest.main(verbosity=2)
