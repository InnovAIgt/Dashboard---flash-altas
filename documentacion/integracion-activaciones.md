# Reporte de altas — Flash

**Guía de integración para el botón de Activaciones**

Red Intelfon · Ventas · Noviembre 2026

---

## 1. Qué es

Una dirección web que, al ser llamada, **arma el reporte de altas en ese momento y lo devuelve listo en HTML**.

Lo que se recibe es directamente el cuerpo del correo: no hay que darle formato, ni procesarlo, ni armar plantillas. Se pega tal cual.

Hay **una dirección por país**. Cada una consulta los datos de ese país y devuelve su propio reporte.

---

## 2. Las direcciones

| País | Dirección |
|---|---|
| Guatemala | `https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=GT` |
| El Salvador | `https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=SV` |

---

## 3. Cómo llamarla

| | |
|---|---|
| **Método** | `GET` |
| **Encabezado obligatorio** | `x-api-key: <la llave>` |
| **Respuesta** | `text/html; charset=utf-8` |
| **Tiempo de respuesta** | Unos segundos (consulta dos sistemas en vivo) |

### La llave

La llave **se entrega por separado**, no viene en este documento.

Va siempre **en el encabezado**, nunca dentro de la dirección. Una dirección con la llave adentro queda guardada en historiales y registros de servidor, y deja de ser secreta.

También se acepta como `Authorization: Bearer <la llave>`, por si el sistema que la llama solo soporta esa forma.

### Ejemplo para probar

```bash
curl -H "x-api-key: LA_LLAVE" \
  "https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=GT"
```

En Postman: método `GET`, la dirección, y en la pestaña **Headers** una fila con `x-api-key` y el valor de la llave. La pestaña **Preview** de la respuesta muestra el reporte dibujado.

---

## 4. Qué período cubre el reporte

Esta es la parte que permite elegir qué datos trae. Hay **tres formas** de pedirlo, y se usa **una sola a la vez**.

| Forma | Qué se agrega a la dirección | Qué devuelve |
|---|---|---|
| **Mes en curso** | nada | El mes que está corriendo, hora de Guatemala |
| **Un mes completo** | `&mes=2026-09` | Todo ese mes |
| **Un rango de fechas** | `&desde=2026-10-01&hasta=2026-10-15` | Solo esas fechas |

Ejemplos completos:

```
.../reporte-flash-publico?pais=GT
.../reporte-flash-publico?pais=GT&mes=2026-09
.../reporte-flash-publico?pais=GT&desde=2026-10-01&hasta=2026-10-15
.../reporte-flash-publico?pais=SV&desde=2026-09-20&hasta=2026-10-05
```

### Reglas de las fechas

- Se escriben **año-mes-día**, con guiones: `2026-10-15`. **No** `15/10/2026` ni `15-10-2026`.
- Van **las dos o ninguna**. Mandar solo `desde` devuelve un error.
- `desde` no puede ser posterior a `hasta`.
- El rango **puede cruzar de mes y de año**: `desde=2026-09-20&hasta=2026-10-05` es válido.
- Hay datos **desde enero de 2026** en adelante. Un rango anterior devuelve el reporte vacío (no es un error, simplemente no existe esa información).

> **Importante:** si no se manda ninguna fecha, el comportamiento es exactamente el de antes. **Un botón que ya esté funcionando no se ve afectado.** Los parámetros de fecha son opcionales y se suman a lo que ya existe.

---

## 5. Cómo armar el selector de fechas

Esta sección es para quien vaya a construir la pantalla del botón.

### La idea

Hoy el botón llama a una dirección fija. Para elegir fechas, esa dirección pasa a tener **dos espacios en blanco** que se llenan con lo que la persona seleccionó:

```
.../reporte-flash-publico?pais=GT&desde=[______]&hasta=[______]
```

### Los tres pasos

**1. Dos campos de fecha en la pantalla** — "Desde" y "Hasta", junto al botón.

**2. Insertar esas fechas en la dirección.** La mayoría de los sistemas de workflow permiten armar una dirección con variables, que el sistema reemplaza al momento de llamar:

```
https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=GT&desde={{fechaDesde}}&hasta={{fechaHasta}}
```

**3. Verificar el formato antes de darlo por bueno.** Este es el punto donde más fácil se tropieza: muchos sistemas entregan las fechas como `15/10/2026`, o con la hora pegada (`2026-10-15T00:00:00`). Si llegan en otro formato, la dirección responde con un mensaje de error en vez del reporte. **Hacer una prueba real antes de publicarlo.**

### Recomendación: opciones listas en vez de dos calendarios

Para la mayoría de los casos conviene ofrecer opciones predefinidas y dejar el rango libre solo para el caso excepcional:

| Opción en pantalla | Lo que se manda |
|---|---|
| Este mes | nada |
| Mes pasado | `&mes=2026-09` |
| Últimos 7 días | `&desde=...&hasta=...` calculados automáticamente |
| Rango personalizado | los dos calendarios |

Es más fácil de usar, reduce los errores de formato y cubre lo que se va a pedir casi siempre.

### Si el sistema no permite variables en la dirección

Hay una salida sin programar nada: **varios botones fijos**, cada uno con su propia dirección completa — uno "Este mes", otro "Mes pasado". No hay calendario, pero resuelve los casos comunes.

---

## 6. Vista previa antes de enviar

La dirección no devuelve datos sueltos: devuelve **el correo ya terminado**. Por eso mostrar una vista previa no requiere nada adicional — es simplemente pintar la respuesta en pantalla.

### El flujo

```
La persona elige las fechas en el calendario
        ↓
El sistema llama a la direccion con esas fechas
        ↓
Muestra la respuesta en pantalla   <- esta es la vista previa
        ↓
La persona revisa y confirma
        ↓
Se envia ESE MISMO HTML como cuerpo del correo
```

Lo que se ve en la vista previa es exactamente lo que va a recibir el destinatario.

### Dos cosas importantes

**1. Guardar la respuesta y reutilizarla al enviar.**

No conviene llamar dos veces (una para la vista previa y otra al confirmar). Las radicaciones en curso se consultan en vivo, así que dos llamadas separadas por unos minutos pueden devolver cifras ligeramente distintas, y se enviaría algo diferente a lo que la persona aprobó.

> Guardar el HTML de la vista previa en memoria y enviar ese mismo al confirmar.

**2. La llamada debe hacerse desde el servidor, no desde el navegador.**

Si la página llama directamente a la dirección, la llave de acceso queda visible para cualquiera que abra las herramientas de desarrollador del navegador, y deja de ser secreta.

Lo correcto:

```
Navegador  ->  servidor de Activaciones  ->  la direccion del reporte
                  (aqui vive la llave)
```

El servidor hace la llamada con la llave y le devuelve el HTML a la página para mostrarlo. La llave nunca sale del servidor.

### Recomendaciones para mostrarlo

- **Usar un `<iframe>` con `srcdoc`.** El reporte trae sus propios estilos; dentro de un iframe no se mezclan con los de la página.
- **Darle ancho.** El reporte está diseñado para unos 1480 px. En un panel angosto se ve apretado; conviene una ventana amplia o permitir desplazamiento horizontal.
- **Mostrar un indicador de carga.** La respuesta tarda unos segundos porque consulta dos sistemas en vivo.
- **Si la respuesta no es `200`, no mostrar vista previa:** mostrar el mensaje de error y deshabilitar el botón de enviar.

---

## 7. Qué hacer con la respuesta

Pegarla tal cual como **cuerpo del correo, en formato HTML**.

> Si se manda como texto plano, el destinatario vería el código en vez del reporte.

No hace falta agregarle encabezado, pie, logos ni estilos: el HTML ya viene completo y es autónomo.

---

## 8. Qué puede responder

| Código | Qué significa | Qué hacer |
|---|---|---|
| `200` | Todo bien | Mandar el correo con ese cuerpo |
| `400` | Un parámetro está mal (fecha mal escrita, falta una de las dos, rango al revés, país no indicado) | **No mandar el correo.** Corregir el parámetro |
| `401` | Falta la llave o está mal | **No mandar el correo.** Avisar a Ventas |
| `502` | Falló una de las fuentes de datos | **No mandar el correo.** Avisar a Ventas |

En todos los casos distintos de `200` la respuesta trae un mensaje en texto que explica qué pasó.

**Es preferible no enviar nada a enviar un correo incompleto.** Si el reporte sale con cifras a medias, alguien puede tomar una decisión sobre datos equivocados.

---

## 9. Qué tan actualizados están los datos

| Dato | Frescura |
|---|---|
| Radicaciones en curso | Del momento exacto del clic |
| Altas | De la última actualización del día |

El reporte muestra en su encabezado **la hora en que se generó** y **la hora de la última actualización de las altas**, así que quien lo lea siempre sabe de cuándo son las cifras.

> Si el correo se va a enviar todos los días, conviene que Activaciones le avise a Ventas **a qué hora** queda programado, para verificar que la actualización de las altas haya ocurrido antes de esa hora.

---

## 10. De dónde salen los datos

La dirección no consulta el dashboard de Flash. Consulta **las mismas dos fuentes** que consulta el dashboard, por su cuenta:

```
                    datos.json (altas)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
      Dashboard de Flash        Esta dirección
      (cuando se abre)          (cuando se llama)
              ▲                         ▲
              └────────────┬────────────┘
                           │
                  API de Workflow
                 (radicaciones en curso)
```

Por eso **el reporte funciona aunque nadie tenga el dashboard abierto**, y por eso las cifras de los dos siempre coinciden.

---

## 11. Qué trae el reporte

**Tres cifras principales:**

- **Altas** — las registradas dentro del período consultado, separadas en nuevas y adiciones
- **En proceso** — las solicitudes **radicadas dentro del mismo período** que siguen avanzando en Workflow y todavía no se resuelven
- **Radicadas** — la suma de las dos, es decir todo lo que entró en el período

**Dos gráficas:** anexos por ejecutivo y unidades por ejecutivo.

**Tres tablas:**

- Resumen por ejecutivo (nuevas, adiciones, clientes, unidades, SIM, valor de servicios)
- Detalle de altas, agrupado por ejecutivo y por cliente
- Radicaciones en curso, agrupadas por ejecutivo, con su preoferta, fecha, cliente, tipo de negocio y cantidad

### Las solicitudes de fuera del período

Si hay solicitudes radicadas **fuera** del período que siguen sin cerrarse, el reporte:

- **no las suma** a los indicadores (el número corresponde exactamente al período pedido),
- pero **sí las lista** en la tabla, marcadas con la etiqueta **FUERA DEL PERÍODO**,
- y avisa cuántas son debajo del indicador de «En proceso».

Así el número cuadra con lo que se pidió, y al mismo tiempo las solicitudes que llevan más tiempo atoradas no se pierden de vista.

---

## 12. Quién hace qué

| Tarea | Responsable |
|---|---|
| Poner el botón y dispararlo | Activaciones |
| El selector de fechas en la pantalla | Activaciones |
| La vista previa y la confirmación antes de enviar | Activaciones |
| Definir quién recibe el correo | Activaciones |
| Enviar el correo | Activaciones |
| Consultar los datos y calcular las cifras | Ventas |
| Diseño y contenido del reporte | Ventas |

Si cambia el diseño o se agrega un dato al reporte, **Activaciones no tiene que tocar nada**: el correo siguiente sale con el formato nuevo automáticamente.

---

## 13. Preguntas frecuentes

**¿Puedo llamarla más de una vez?**
Sí, no hay límite. Cada llamada arma el reporte de nuevo con los datos de ese momento.

**¿Qué pasa si la llamo fuera del día programado?**
Nada especial: devuelve el reporte con los datos de ese momento. La dirección no sabe ni le importa qué día es.

**¿Puedo pedir un solo día?**
Sí, poniendo la misma fecha en `desde` y en `hasta`.

**¿Hay un límite de tamaño para el rango?**
No hay un límite técnico, pero mientras más largo el rango, más pesa el correo. Arriba de unos seis meses el reporte **avisa dentro de sí mismo** que Gmail podría recortarlo, porque Gmail corta los correos que pasan de unos 100 KB.

**¿La dirección es pública?**
Está en internet, pero sin la llave no devuelve nada. Por eso la llave no debe circular en correos reenviables ni quedar escrita en la dirección.

---

**Dudas sobre el contenido o las cifras:** con Ventas.
**Dudas sobre el envío, los destinatarios y el selector de fechas:** con Activaciones.
