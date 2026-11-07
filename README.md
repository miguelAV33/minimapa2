# Minimapa · navegador GPS con estética de videojuego

Navegador GPS personal que funciona en el navegador del móvil y se instala como una app. Usa mapas reales de OpenStreetMap con skins inspiradas en los minimapas de los juegos de mundo abierto, rutas giro a giro con voz en español y avisos de radares que se actualizan solos cada día.

## Qué hace

- **4 skins de mapa**: *Minimapa* (radar oscuro y ruta morada), *Retro 2004*, *Neón 86* y *Atlas* (mapa de papel). Se cambian al momento, incluso navegando.
- **Todos los sitios en el mapa**: gasolineras, parkings, restaurantes, farmacias, hospitales, cajeros, talleres, hoteles, puntos de carga… con iconos tipo "blip".
- **Búsqueda** de direcciones y lugares, pin con pulsación larga, favoritos, Casa y Trabajo, y recientes.
- **Rutas** con alternativas, paradas intermedias, opciones para evitar peajes o autopistas, número de radares en cada ruta y hora de llegada.
- **Navegación giro a giro** con voz, flechas de maniobra, siguiente maniobra, recálculo automático si te sales de la ruta, límite de velocidad de la vía y velocímetro que se pone en rojo si te pasas.
- **Avisos de radares**: fijos, de tramo (con tu velocidad media en directo), semáforos con cámara, cámaras de cinturón y móvil, y zonas de radar móvil conocidas. Hay aviso por voz, sirena corta y un parpadeo rojo y azul en los bordes de la pantalla. También avisa sin ruta: basta con conducir con la app abierta.
- **Actualización periódica**: GitHub Actions descarga cada día las fuentes oficiales y OpenStreetMap, las fusiona sin duplicados y publica la base. La app la comprueba cada 6 horas y además completa en directo con los radares de OSM de la zona por la que vas.
- **Reportes propios** (radar fijo, radar móvil, control, accidente, obras, peligro, atasco). Se guardan solo en tu móvil, caducan solos y te avisan como un radar más.
- **Gasolineras con precio** oficial del Ministerio, ordenadas por cercanía o por precio.
- **Simulador**: recorre la ruta sin moverte, para probar los avisos desde el sofá.
- Funciona sin conexión la app y el mapa que ya hayas visto, y mantiene la pantalla encendida.
- **Tráfico en directo (opcional)** con una clave gratuita de TomTom.

## Publicarlo gratis con GitHub Pages (10 minutos)

El GPS del navegador solo funciona con HTTPS, así que lo más fácil es GitHub Pages:

1. Crea un repositorio **público** en GitHub (por ejemplo `minimapa`). Pages gratis necesita repositorio público.
2. Sube el contenido de esta carpeta, incluida la carpeta oculta `.github`:
   ```bash
   cd minimapa
   git init && git add . && git commit -m "Minimapa"
   git branch -M main
   git remote add origin https://github.com/HookMike/minimapa.git
   git push -u origin main
   ```
3. En el repositorio, ve a **Settings → Pages → Build and deployment → Source** y elige **GitHub Actions**.
4. Ve a **Actions → "Actualizar datos y publicar" → Run workflow**. Tarda unos minutos, sobre todo la consulta de OpenStreetMap de toda España. A partir de ahí se repite solo cada día y cada vez que subes cambios.
5. Abre `https://hookmike.github.io/minimapa/` en el móvil:
   - **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
   - **iPhone (Safari)**: botón Compartir → *Añadir a pantalla de inicio*.

La primera vez acepta el permiso de ubicación (y el de brújula en iPhone).

## Uso rápido

- **Ir a un sitio**: búscalo o mantén pulsado el mapa → *Ir* → elige ruta → *Iniciar*.
- **Probar sin moverte**: en la ruta, elige *Simular: +20 %* y pulsa *Simular* para oír los avisos de exceso de velocidad.
- **Reportar**: botón del triángulo.
- **Menú** (≡): skins y capas, voz y sonidos, tipos de radar y distancia de aviso, tus lugares, copia de seguridad y créditos.
- **Brújula**: alterna entre "mapa según la marcha" y "norte arriba".

## Radares: de dónde salen

| Fuente | Qué aporta | Licencia |
|---|---|---|
| Ayuntamiento de Madrid | Radares fijos, de tramo y móviles de la capital, con límite | CC BY 4.0 |
| Servei Català de Trànsit | Radares fijos de Cataluña, con límite | Reutilización con atribución |
| DGT 2026 (listado oficial georreferenciado por Tachwire/IGN) | Radares fijos, tramos, cámaras de cinturón y móvil, con sentido | ODbL 1.0 |
| DGT · Punto de Acceso Nacional (XML DATEX II) | Radares fijos y tramos con coordenadas oficiales | Datos abiertos DGT |
| OpenStreetMap (Overpass) | `highway=speed_camera` y relaciones `type=enforcement` | ODbL 1.0 |

El script `scripts/actualizar_datos.py` las descarga, las convierte y las fusiona por prioridad. Si dos fuentes marcan el mismo radar, se queda uno y se completan el sentido y el límite que le falten. Si una fuente falla o llega con muchos menos radares de lo normal, se conserva su última copia buena (`data/fuentes/`). El paquete incluye una base inicial de 1.298 radares para que funcione desde el primer minuto.

**Cobertura**: la DGT no publica Cataluña ni País Vasco; Cataluña la cubre el SCT y el País Vasco depende de OpenStreetMap. Ninguna base es perfecta, así que respeta siempre la señalización.

## Probar en el ordenador

```bash
cd minimapa
python -m http.server 8000      # o copia la carpeta a htdocs de XAMPP
# abre http://localhost:8000 (en localhost el navegador sí permite la ubicación)
```

Pruebas automáticas:

```bash
node tests/motor.test.mjs                 # navegación, avisos de radar, tramos
python scripts/test_actualizar_datos.py   # conversores de cada fuente de datos
python scripts/actualizar_datos.py        # actualizar los datos a mano
```

## Personalizar

- **Skins**: `js/skins.js`. Cada skin es un objeto de colores (fondo, agua, parques, cada tipo de vía, ruta, iconos…). Copia una, cambia los colores y aparecerá en el menú.
- **Iconos del mapa**: `js/blips.js` (se dibujan con canvas).
- **Servicios** (mapa, rutas, búsqueda): `js/config.js`.
- **Distancias de aviso y voz**: `js/nav.js` y `js/radars.js`.

## Limitaciones (para que no haya sorpresas)

- Es una app web: si apagas la pantalla o cambias de app, el navegador pausa el GPS. Por eso mantiene la pantalla encendida mientras está abierta.
- No funciona dentro de Android Auto ni de CarPlay.
- Rutas, búsqueda y mapa usan servidores públicos y gratuitos de la comunidad OpenStreetMap (FOSSGIS Valhalla, Photon, OpenFreeMap, Overpass). Para uso personal van sobrados; si alguno cae, la app usa el de respaldo (OSRM, Nominatim).
- Sin clave de TomTom no hay tráfico en directo: la hora de llegada se calcula sin atascos.
- Las voces dependen del móvil. En Android viene la de Google en español; en iPhone, Mónica o Jorge.

## Aviso legal

En España es legal usar avisadores que informan de la ubicación pública de radares; los **detectores** de radar están prohibidos. La DGT ha planteado limitar los avisos en tiempo real de radares móviles y controles. Los reportes de esta app son solo para tu propio uso y no se comparten. Proyecto de uso personal, sin relación con ningún videojuego ni con sus editores: las paletas e iconos son propios.

## Créditos

Mapa © colaboradores de OpenStreetMap, OpenMapTiles y OpenFreeMap · Rutas: Valhalla (FOSSGIS) y OSRM · Búsqueda: Photon (Komoot) y Nominatim · Radares: DGT, Ayuntamiento de Madrid, Servei Català de Trànsit, Tachwire (ODbL) y OSM (ODbL) · Carburantes: Ministerio para la Transición Ecológica · Motor de mapa: MapLibre GL JS (BSD-3) · Tipografías: Oswald y Bebas Neue (SIL OFL).
