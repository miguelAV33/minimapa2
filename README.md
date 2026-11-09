# Minimapa · navegador GPS con estética de videojuego

Navegador GPS personal que funciona en el navegador del móvil y se instala como una app. Usa mapas reales de OpenStreetMap con skins inspiradas en los minimapas de los juegos de mundo abierto, rutas giro a giro con voz en español y avisos de radares que se actualizan solos cada día.

## Qué hace

- **9 skins de mapa**: *Minimapa* (radar oscuro y ruta morada), *Retro 2004*, *Neón 86*, *Atlas* (mapa de papel), *Frontera 1899* (papel envejecido y tinta, como los mapas del lejano oeste), *Megaciudad 2077* (negro y amarillo eléctrico con líneas de pantalla), *Terminal* (escáner azul con edificios en alambre), *Circuito* (juego de carreras con autopistas de borde naranja) y *Pixel 97* (vista cenital clásica con aceras y línea amarilla). Se cambian al momento, incluso navegando.
- **Editor de skins**: Menú → Mapa → *Crear skin*. Eliges de qué skin partir, cambias 10 colores (fondo, agua, parques, edificios, autopistas, carreteras, calles, rótulos, ruta y detalles) y el estilo (brillo de neón, calles sin borde, rótulos en cursiva, línea central, grosor de calles, forma de los iconos, edificios y efecto de pantalla). El mapa cambia mientras editas. Con *Pasar* se la mandas a tu amigo por WhatsApp o lo que quieras, y él la añade con *Importar skin* pegando el mensaje. Las skins propias también se ven en Android Auto.
- **Todos los sitios en el mapa**: gasolineras, parkings, restaurantes, farmacias, hospitales, cajeros, talleres, hoteles, puntos de carga… con iconos tipo "blip".
- **Búsqueda** de direcciones y lugares, pin con pulsación larga, favoritos, Casa y Trabajo, y recientes.
- **Rutas** con alternativas, paradas intermedias, opciones para evitar peajes o autopistas, número de radares, incidencias y zonas de bajas emisiones de cada ruta, y hora de llegada.
- **Navegación giro a giro** con voz, flechas de maniobra, siguiente maniobra, **carriles** que debes coger (también en Android Auto), recálculo automático si te sales de la ruta, límite de velocidad de la vía y velocímetro que se pone en rojo si te pasas.
- **Incidencias de tráfico de la DGT** en directo: cortes, accidentes, retenciones, obras, obstáculos, vehículos detenidos y tiempo adverso. Salen en el mapa, en la vista de la ruta y con aviso por voz al acercarte, solo las de tu sentido de la marcha. El APK las descarga de la DGT cada 5 minutos navegando (unos 200 KB).
- **Zonas de bajas emisiones (ZBE)** de toda España con las reglas oficiales de la DGT. Indica la etiqueta de tu coche (Menú → Navegación) y la app te avisa al acercarte a una zona donde no puedes entrar, la marca en rojo en el mapa y busca un rodeo cuando el destino está fuera.
- **Túneles**: si se pierde el GPS navegando, la posición sigue avanzando por la ruta a tu última velocidad, así los avisos de radar y los giros siguen llegando a tiempo.
- **En ruta** (botón ⋯ al navegar): gasolineras con precio, parkings, comida, café, puntos de carga y talleres que quedan en tu camino, con el desvío que supone; al elegir uno se añade como parada. También la lista de indicaciones y **compartir la hora de llegada**.
- **Aparcamiento**: al llegar te ofrece guardar dónde has dejado el coche (con una nota, por ejemplo la planta y la plaza) y luego te lleva **a pie** hasta él.
- **Ficha de cada sitio** con horario (abierto o cerrado ahora), teléfono y web cuando OpenStreetMap los tiene.
- **Avisos de radares**: fijos, de tramo (con tu velocidad media en directo), semáforos con cámara, cámaras de cinturón y móvil, y zonas de radar móvil conocidas. Hay aviso por voz, sirena corta y un parpadeo rojo y azul en los bordes de la pantalla. También avisa sin ruta: basta con conducir con la app abierta.
- **Actualización periódica**: GitHub Actions descarga cada día las fuentes oficiales y OpenStreetMap, las fusiona sin duplicados y publica la base. La app la comprueba cada 6 horas y además completa en directo con los radares de OSM de la zona por la que vas.
- **Reportes propios** (radar fijo, radar móvil, control, accidente, obras, peligro, atasco). Se guardan solo en tu móvil, caducan solos y te avisan como un radar más.
- **Gasolineras con precio** oficial del Ministerio, ordenadas por cercanía o por precio.
- Funciona sin conexión la app y el mapa que ya hayas visto, y mantiene la pantalla encendida.
- **Tráfico en directo (opcional)** con una clave gratuita de TomTom.
- **Skin automática de día y de noche** según la salida y la puesta de sol, flechas de sentido sobre la ruta, recentrado automático y vibración en los avisos.

## App Android (APK) y Android Auto

Cada vez que se sube un cambio a `main`, GitHub Actions compila el APK y lo publica en *Releases*. El enlace de descarga es siempre el mismo y sirve para pasárselo a quien quieras:

**https://github.com/miguelAV33/minimapa2/releases/latest/download/minimapa.apk**

Para instalarla:

1. Abre el enlace en el móvil Android, descarga el APK y ábrelo. Si te lo pide, permite *Instalar apps de origen desconocido*.
2. Abre Minimapa. La primera vez sale el asistente **Ponlo a punto**: ubicación, notificación, batería sin restricciones (clave en Xiaomi, Samsung, Huawei u Oppo para que no la cierren a mitad de ruta) y Android Auto. La notificación "Minimapa activo" es la que mantiene el GPS y los avisos con la pantalla apagada.
3. Cuando haya una versión nueva, la app te avisa (Menú → Info → Descargar).

Para que salga en **Android Auto** (al no venir de Play Store hay que activarlo una vez):

1. En el móvil abre la app **Android Auto** → *Ajustes*.
2. Baja hasta *Versión* y tócala 10 veces. Acepta el aviso de modo desarrollador.
3. Menú ⋮ (arriba a la derecha) → *Ajustes de desarrollador* → marca **Fuentes desconocidas**.
4. Abre Minimapa en el móvil una vez y conecta el coche. Minimapa aparece en el lanzador de Android Auto.

En el coche se ve el mapa con tu skin, la tarjeta de maniobra con distancia y hora de llegada, los radares con el parpadeo rojo y azul, el velocímetro con el límite y la velocidad media en los tramos. El botón **Destinos** permite ir a Casa, Trabajo, favoritos, recientes, la gasolinera más barata o el parking más cercano sin tocar el móvil. La voz suena por los altavoces del coche.

Las rutas y los avisos se calculan en la app del móvil, así que tiene que estar abierta (puede quedarse en segundo plano). Si conectas el coche sin abrirla, Minimapa intenta abrirse sola y, si Android no lo permite, te deja una notificación para abrirla con un toque. De noche, la pantalla del coche cambia la skin clara por una oscura.

**Opiniones de quien la pruebe**: Menú → Info → *Enviar opinión* manda un mensaje por WhatsApp (u otra app) con el comentario, la versión, el modelo de móvil y los últimos errores. *Compartir la app* envía el enlace de descarga con las instrucciones.

**CarPlay**: no es posible sin un Mac, una cuenta de desarrollador de Apple de pago y que Apple conceda a mano el permiso de navegación CarPlay. En iPhone se puede usar la versión web.

## Versión web (GitHub Pages)

La misma app funciona en el navegador en **https://miguelav33.github.io/minimapa2/** (en iPhone: Safari → Compartir → *Añadir a pantalla de inicio*). Para que se publique, en el repositorio: **Settings → Pages → Source: GitHub Actions**. El flujo *Actualizar datos y publicar* descarga los radares y los precios cada día y publica la web; el APK descarga de ahí los datos nuevos.

## Uso rápido

- **Ir a un sitio**: búscalo o mantén pulsado el mapa → *Ir* → elige ruta → *Iniciar*.
- **Durante la ruta**: botón ⋯ para buscar en el camino, ver las indicaciones o compartir tu llegada.
- **Volver al coche**: Menú → Lugares → Aparcamiento → *Ver* → *Ir a pie*.
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

El script `scripts/actualizar_datos.py` las descarga, las convierte y las fusiona por prioridad. Si dos fuentes marcan el mismo radar, se queda uno y se completan el sentido y el límite que le falten. Si una fuente falla o llega con muchos menos radares de lo normal, se conserva su última copia buena (`data/fuentes/`). La app trae dentro la última base (unos 3.000 radares) para funcionar desde el primer minuto, también sin conexión.

**Cobertura**: la DGT no publica Cataluña ni País Vasco; Cataluña la cubre el SCT y el País Vasco depende de OpenStreetMap. Ninguna base es perfecta, así que respeta siempre la señalización.

## Probar en el ordenador

```bash
cd minimapa
python -m http.server 8000      # o copia la carpeta a htdocs de XAMPP
# abre http://localhost:8000 (en localhost el navegador sí permite la ubicación)
```

Compilar el APK en tu PC (necesitas Android Studio o el SDK de Android y Java 21):

```bash
npm install
npm run android          # prepara www/ y sincroniza el proyecto Android
cd android && ./gradlew assembleRelease
```

Para probar Android Auto sin coche: instala el *Desktop Head Unit* (DHU) desde el SDK Manager de Android Studio.

Pruebas automáticas:

```bash
node tests/motor.test.mjs                 # navegación, avisos de radar, tramos
python scripts/test_actualizar_datos.py   # conversores de cada fuente de datos
python scripts/actualizar_datos.py        # actualizar los datos a mano
```

## Personalizar

- **Skins**: `js/skins.js`. Cada skin es un objeto de colores (fondo, agua, parques, cada tipo de vía, ruta, iconos…) más opciones de estilo (`blipShape`, `buildingMode`, `fx`, `centerLine`, `casingOff`, `labelItalic`, `roadWidthMult`). Copia una, cambia los colores y aparecerá en el menú. Las skins del editor se guardan en el móvil y se generan con `deriveSkin()`.
- **Sobre los juegos**: las skins están inspiradas en estilos de mapa habituales en los videojuegos, pero no usan mapas, iconos, tipografías ni nombres de ningún juego.
- **Iconos del mapa**: `js/blips.js` (se dibujan con canvas).
- **Servicios** (mapa, rutas, búsqueda): `js/config.js`.
- **Android Auto**: `android/app/src/main/java/io/github/miguelav33/minimapa/car/` (plantillas del coche y puente con la app) y `js/car.js` (mapa del coche).
- **Distancias de aviso y voz**: `js/nav.js` y `js/radars.js`.

## Limitaciones (para que no haya sorpresas)

- En la **versión web**, si apagas la pantalla el navegador pausa el GPS; la **app Android** sigue funcionando en segundo plano gracias a su notificación.
- Android Auto funciona como app instalada fuera de Play Store (con "Fuentes desconocidas" activado). Google podría cambiar ese requisito en el futuro.
- Rutas, búsqueda y mapa usan servidores públicos y gratuitos de la comunidad OpenStreetMap (FOSSGIS Valhalla, Photon, OpenFreeMap, Overpass). Para uso personal van sobrados; si alguno cae, la app usa el de respaldo (OSRM, Nominatim).
- Sin clave de TomTom no hay tráfico en directo: la hora de llegada se calcula sin atascos. Las incidencias de la DGT sí funcionan sin clave, pero no cubren el País Vasco ni Cataluña, que publican las suyas aparte.
- El servidor de rutas solo deja excluir zonas de hasta 10 km de perímetro: las ZBE grandes (como la de Madrid) se rodean cerrando una a una las entradas que usaría la ruta. Si no hay forma, la vista de la ruta lo dice. Los horarios de cada ZBE no se tienen en cuenta: si tiene horario, la app avisa siempre.
- Las voces dependen del móvil. En Android viene la de Google en español; en iPhone, Mónica o Jorge.

## Aviso legal

En España es legal usar avisadores que informan de la ubicación pública de radares; los **detectores** de radar están prohibidos. La DGT ha planteado limitar los avisos en tiempo real de radares móviles y controles. Los reportes de esta app son solo para tu propio uso y no se comparten. Proyecto de uso personal, sin relación con ningún videojuego ni con sus editores: las paletas e iconos son propios.

## Créditos

Mapa © colaboradores de OpenStreetMap, OpenMapTiles y OpenFreeMap · Rutas: Valhalla (FOSSGIS) y OSRM · Búsqueda: Photon (Komoot) y Nominatim · Radares: DGT, Ayuntamiento de Madrid, Servei Català de Trànsit, Tachwire (ODbL) y OSM (ODbL) · Carburantes: Ministerio para la Transición Ecológica · Incidencias y zonas de bajas emisiones: DGT (Punto de Acceso Nacional, CC BY) · Motor de mapa: MapLibre GL JS (BSD-3) · Tipografías: Oswald y Bebas Neue (SIL OFL).
