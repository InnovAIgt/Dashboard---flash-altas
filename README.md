# Dashboard Flash de Altas

Proyecto que alimenta el **dashboard de Flash de Altas** y el **reporte por correo** de RED Intelfon (Ventas).

Muestra las altas registradas por país y ejecutivo, y las solicitudes que siguen en proceso sin resolverse.

---

## Qué hay en este repositorio

| Archivo o carpeta | Para qué sirve |
|---|---|
| `actualizar.js` | El robot. Le pide las altas a SAN y las guarda en `docs/datos.json` |
| `.github/workflows/` | Hace correr al robot solo, cada cierto tiempo |
| `actualizar-y-subir.bat` | Corre el robot a mano desde una computadora con Windows |
| `docs/datos.json` | Las altas ya guardadas. Es lo que leen el dashboard y el reporte |
| `docs/index.html` | Copia antigua del dashboard. **Ya no se mantiene** (ver más abajo) |
| `docs/.nojekyll` | Le dice a GitHub Pages que publique los archivos tal cual |
| `supabase/functions/reporte-flash-publico/` | El código del reporte por correo, con su propio README |
| `.env.example` | Ejemplo de las variables que necesita el robot |

> La carpeta `docs/` es la que GitHub Pages publica en internet. Todo lo que esté ahí queda accesible en `https://innovaigt.github.io/Dashboard---flash-altas/<archivo>`.

## Lo que NO está acá

**La pantalla del dashboard** vive en el repositorio del centralizado, en `dashboards/ventas/flash-altas.html`. Este repositorio se encarga de los datos; aquel, de cómo se ven.

---

## A qué le pregunta este proyecto

| Fuente | Quién la consulta | Qué trae | Llave |
|---|---|---|---|
| **SAN** · `http://san.red.com.gt/flashApi/altas` | El robot | Las altas, mes por mes y país por país | `FLASH_API_KEY` |
| **Workflow** · `https://workflow.red.com.gt/api/integraciones/dashboard/preofertas` | El dashboard y el reporte | Las radicaciones que siguen en proceso | La llave de Workflow |

SAN solo lo consulta el robot. El dashboard y el reporte nunca hablan con SAN: leen el archivo que el robot dejó.

---

## Cómo se mueve todo

### 1. Cada ciertas horas, solo

```
GitHub arranca el robot (actualizar.js)
   → le pide las altas a SAN, mes por mes desde enero, con FLASH_API_KEY
   → junta todo y lo escribe en docs/datos.json
   → de paso llama a la función de Supabase, para que no se duerma
```

El robot tiene dos protecciones: si un solo mes falla, cancela todo y deja el archivo anterior; y si de pronto llegan muchas menos altas que antes, tampoco lo pisa. Es preferible mostrar datos de ayer que datos incompletos.

### 2. Cuando alguien abre el dashboard

```
El navegador baja flash-altas.html desde el centralizado
   → lee docs/datos.json ............. las altas
   → le pregunta a Workflow .......... las radicaciones en proceso
   → hace las cuentas y pinta todo
```

Las altas son de la última vuelta del robot; las radicaciones, del momento exacto. El dashboard muestra en una pastilla a qué hora se actualizaron los datos.

### 3. Cuando se dispara el reporte por correo

```
El workflow de Activaciones llama a la función con su llave
   → la función lee docs/datos.json y le pregunta a Workflow
   → arma el reporte en HTML y lo devuelve
   → Activaciones lo manda por correo
```

Activaciones puede pedir **el mes en curso, un mes completo o un rango de
fechas**, y muestra una vista previa antes de enviar. El detalle está en el
README de la función y en la guía de integración que se les entregó.

---

## Cómo correr el robot en tu computadora

Sirve para probar un cambio antes de subirlo, o para actualizar los datos a mano si el robot automático falló.

**Hace falta:** Node 18 o superior (trae `fetch` incorporado, que el robot usa).

```bash
# 1. Traer el proyecto
git clone https://github.com/InnovAIgt/Dashboard---flash-altas.git
cd Dashboard---flash-altas

# 2. Crear el archivo de llaves, copiando el ejemplo
cp .env.example .env
#    y adentro poner la llave real:  FLASH_API_KEY=...

# 3. Correrlo
node actualizar.js
```

No hace falta instalar dependencias: el robot usa solo lo que Node trae de fábrica.

**Qué va a imprimir:**

```
✔ API encontrada en http://san.red.com.gt/flashApi/altas
✔ datos.json guardado: 4270 altas { SV: 2735, GT: 1535 }
✔ Supabase despierto
```

Si en vez de eso dice `SAN respondió "No autorizado"`, la llave está mal o venció.
Si dice `No se pudo llegar a la API de Flash`, esa computadora no alcanza a SAN.

Después de correrlo, `docs/datos.json` queda modificado. Si querés publicar esos datos, hay que hacer commit y push; si solo estabas probando, descartá el cambio con `git checkout docs/datos.json`.

En Windows también está `actualizar-y-subir.bat`, que hace lo mismo y además sube el resultado.

## Cómo corre solo

Lo arranca **GitHub Actions**, con el horario definido en el archivo de `.github/workflows/`. La llave la toma de los **Secrets** del repositorio, no del `.env`.

- Para ver si corrió: pestaña **Actions** de este repositorio
- Los commits de datos aparecen a nombre de **robot-flash**
- Para dispararlo a mano sin esperar al horario: entrar al flujo en **Actions** y usar **Run workflow**

## Cómo levantar el dashboard para probarlo

El dashboard **no está en este repositorio**, sino en el del centralizado. Desde la carpeta de ese proyecto:

```bash
python -m http.server 5500
```

Y en el navegador:

```
http://localhost:5500/dashboards/ventas/flash-altas.html
```

Abrilo siempre con **Ctrl + Shift + R**. Si no, el navegador te muestra la versión guardada y vas a creer que tu cambio no funcionó.

Aunque lo abras desde tu computadora, el dashboard lee el `datos.json` **publicado**, no el de tu carpeta. Para probar con datos locales hay que cambiarle la dirección a mano en `CONFIG.API_URL`.

**No lo abras con doble clic.** Si en la barra del navegador aparece `file:///C:/...`, el navegador trata la página como un archivo suelto sin dirección propia y bloquea las llamadas a las APIs. Tiene que entrar por `http://localhost:5500/`.

## Cómo probar la función del reporte

Con Postman: método `GET`, la dirección del reporte, y en **Headers** una fila con `x-api-key` y la llave. La pestaña **Preview** de la respuesta lo muestra dibujado.

Desde el navegador no se ve bien: Supabase no deja que sus funciones se muestren como página. Hay que guardarlo con **Ctrl + S** y abrir el archivo guardado.

---

## Las llaves

| Llave | Quién la usa | Dónde vive |
|---|---|---|
| `FLASH_API_KEY` | El robot, para entrar a SAN | Secretos de GitHub, o `.env` local |
| La de Workflow | El dashboard y la función del reporte | Dentro del HTML del dashboard y en los secretos de Supabase |
| `REPORTE_API_KEY` | Quien llame a la función del reporte | Secretos de Supabase |

**Ninguna llave va escrita en este repositorio.** El `.env` está excluido y `actualizar.js` las lee de las variables de entorno.

---

## Dónde vive cada cosa

| Pieza | Lugar |
|---|---|
| Robot, datos, logos y código del reporte | Este repositorio |
| Pantalla del dashboard | Repositorio del centralizado, `dashboards/ventas/flash-altas.html` |
| La función del reporte, corriendo | Supabase, proyecto `Flash_ventas` (`scypmmaaatqsbtukuwwl`) |
| El dashboard publicado | Render, dentro del tablero centralizado, módulo Ventas |

---

## Cómo hacer los cambios más comunes

**Cambiar desde qué mes trae datos el robot** → la variable `FLASH_DESDE` (por defecto `2026-01`).

**Agregar o quitar un campo de los que se publican** → la lista `CAMPOS` en `actualizar.js`. Ojo: todo lo que se agregue queda publicado en internet, porque `docs/` es público.

**Cambiar el nombre que se muestra de un ejecutivo** → la lista `NOMBRES_EJECUTIVOS`, que está en **dos lugares**: en el HTML del dashboard y en el código de la función. Hay que cambiarla en los dos.

**Cambiar el diseño o el contenido del correo** → solo la función del reporte. Activaciones no tiene que tocar nada: el correo siguiente sale con el formato nuevo.

**Cambiar una regla de conteo** (qué cuenta como alta, qué cuenta como en proceso, qué se excluye) → hay que tocar **los dos lados**: la función del reporte y el HTML del dashboard. Las reglas completas están escritas en el README de la función, en la sección «Las reglas de conteo». Conviene partir de ahí y no de leer el código.

---

## Cosas que conviene saber antes de tocar

**Las cuentas están escritas dos veces.** La pantalla y el reporte calculan lo mismo, pero cada uno con su propia copia del código, en repositorios distintos y en lenguajes distintos. **Si cambiás una regla en uno, cambiala en el otro**, o el correo y la pantalla van a decir cosas distintas sin que nadie lo note.

Las reglas vigentes están escritas en un solo lugar: el README de la función, sección **«Las reglas de conteo»**. Ahí está qué cuenta como alta, qué cuenta como en proceso, por qué se excluyen los equipos BACKUP y cómo funciona el checklist B800.

Ha pasado que las dos copias se desalinearan sin que se notara. Antes de dar por buena una cifra, conviene consultar el mismo período en la pantalla y en el correo y verificar que coincidan.

**`docs/datos.json` es público** porque el navegador lo lee directo, y un navegador solo puede leer archivos públicos. Para que deje de serlo habría que poner un servidor en medio que le sirva los datos al dashboard.

**SAN responde por `http`, no `https`.** La llave viaja sin cifrar cada vez que el robot consulta. Conviene pedirle a sistemas que lo pasen a `https`.

**`docs/index.html` quedó desactualizada.** Es una copia del dashboard de hace semanas, de cuando Flash se publicaba por separado. El dashboard bueno es el del centralizado. No se mantiene esta copia.

**Las renovaciones no están.** La API de Flash solo devuelve `NUEVA` y `ADICION`. Las renovaciones en proceso sí aparecen, porque vienen de Workflow, pero las ya completadas no se ven en ningún lado de este proyecto.

**Los equipos BACKUP no cuentan como alta.** Son equipos de respaldo: no son una venta y su valor de servicios viene en cero. Se descartan tanto en las altas como en las preofertas de Workflow. El detalle está en el README de la función.

**Una venta tiene dos fechas.** La de radicación de la preoferta, en Workflow, y la de registro del alta en SAN. No son la misma: una venta radicada en octubre a la que le marcan el B800 en noviembre se registra como alta **con fecha de noviembre**. Es la causa más común de la pregunta «¿por qué aparece ahora si es de octubre?».

---

## Si algo falla

| Síntoma | Dónde mirar |
|---|---|
| El dashboard muestra datos viejos | La pestaña **Actions** de este repositorio: ver si el robot corrió |
| El dashboard no muestra las radicaciones | La API de Workflow, o la llave que está en el HTML |
| El correo no llega | Que el proyecto de Supabase no esté pausado, y los secretos de la función |
| La pantalla y el correo dan cifras distintas | Las reglas de conteo están escritas dos veces: revisar que las dos copias tengan la misma versión de la regla |
| Un alta aparece en un mes que no corresponde | Las dos fechas de una venta: ver «Cosas que conviene saber antes de tocar» |
