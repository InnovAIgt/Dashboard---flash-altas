# reporte-flash-publico

Función de Supabase que arma el **reporte de altas** y lo devuelve en HTML, listo para mandar por correo.

El workflow de Activaciones la llama, recibe el HTML y lo manda como cuerpo del correo. No hay que darle formato ni procesarlo.

---

## Dónde está desplegada

| | |
|---|---|
| Proyecto de Supabase | `Flash_ventas` |
| Referencia | `scypmmaaatqsbtukuwwl` |
| Cuenta | `keilyday2019@gmail.com` (no es la cuenta principal) |
| Nombre de la función | `reporte-flash-publico` |
| Verify JWT | **Apagado** (la función hace su propia autenticación con llave) |

## Cómo se llama

```
GET https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=GT
GET https://scypmmaaatqsbtukuwwl.supabase.co/functions/v1/reporte-flash-publico?pais=SV
```

| Parámetro | Obligatorio | Qué hace |
|---|---|---|
| `pais` | Sí | `GT` o `SV` |
| `mes` | No | `AAAA-MM`, un mes completo |
| `desde` y `hasta` | No | `AAAA-MM-DD`, un rango de fechas. Van los dos o ninguno |

Sin `mes` ni `desde`/`hasta`, devuelve el **mes en curso**, hora de Guatemala.

`mes` y el rango son excluyentes: si llegan los dos, manda el rango.

> **Por dentro solo existe el rango.** Pedir un mes es un atajo: `mes=2026-10` se traduce a «del 2026-10-01 al 2026-10-31». Por eso el mes y el rango no pueden dar números distintos — hay una sola forma de contar.

El rango puede cruzar de mes y de año. Hay datos desde enero de 2026; un rango anterior devuelve el reporte vacío.

**Encabezado obligatorio:** `x-api-key: <la llave>`

También acepta `Authorization: Bearer <llave>` y, solo para pruebas en el navegador, `&clave=<llave>` en la dirección.

**Respuestas:** `200` con el reporte · `400` si un parámetro está mal escrito · `401` si falta la llave o no coincide · `502` si falló una fuente de datos.

## Secretos que necesita

Se configuran en Supabase → Edge Functions → Secrets. **No van escritos en el código.**

| Secreto | Para qué |
|---|---|
| `WORKFLOW_API_KEY` | Consultar la API de preofertas de Workflow |
| `REPORTE_API_KEY` | La llave que debe traer quien llame a esta función |

Si falta `REPORTE_API_KEY`, la función no le responde a nadie: es preferible que no funcione a que quede abierta con los datos de ventas adentro.

## De dónde saca los datos

```
                   docs/datos.json  (este mismo repo)
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   Dashboard de Flash          reporte-flash-publico
   (en el centralizado)        (esta función)
            ▲                           ▲
            └─────────────┬─────────────┘
                          │
              API de preofertas de Workflow
```

Las **altas** salen de `docs/datos.json`, el archivo que llena `actualizar.js` desde SAN.
Las **radicaciones en proceso** salen de la API de preofertas de Workflow, consultadas en vivo.

Son exactamente las mismas dos fuentes que usa el dashboard. Por eso los números coinciden.

---

# Las reglas de conteo

Esta es la parte más importante del documento. **Estas reglas están escritas dos veces**: acá y en `dashboards/ventas/flash-altas.html`, en el repositorio del centralizado. Si cambiás una regla en un lado y no en el otro, el correo y la pantalla empiezan a decir cosas distintas y nadie se da cuenta hasta que alguien compara.

## Qué cuenta como ALTA

Una fila del archivo de altas cuenta si:

1. su **país** es el pedido, y
2. su **fecha de alta** cae dentro del período consultado, y
3. su **TIPO EQUIPO no es BACKUP**.

### Por qué se excluye BACKUP

Un anexo con TIPO EQUIPO `BACKUP` es un equipo de respaldo. No es una venta y no le genera ingresos a la empresa: su VALOR TOTAL SERVICIOS viene en cero.

Los demás valores de ese campo (`COMODATO`, `ARRIENDO`, `FINANCIADO`, `CONTADO` y vacío) son altas normales.

El descarte se hace **al traer los datos**, antes de cualquier cálculo. Así esos registros quedan fuera de todo —altas, unidades, SIM, clientes, valor y las tres gráficas— sin tener que acordarse de excluirlos en cada indicador.

## Qué cuenta como EN PROCESO

Una preoferta de Workflow cuenta si cumple **las seis**:

1. su **país** es el pedido, y
2. su **estado** es `en_proceso`, y
3. **no tiene el B800 marcado**, y
4. **no es BACKUP**, y
5. **no es una RENOVACIÓN**, y
6. su **fecha de radicación** cae dentro del período consultado.

### Por qué se excluyen las renovaciones

En una renovación no entra ningún equipo nuevo: se renueva el contrato de los que el cliente ya tiene. Contarlas inflaba «en proceso» con unidades que ya se habían contado antes, en el período en que se vendieron — la misma unidad aparecía dos veces.

Las altas nunca las incluyeron, porque la API de Flash solo devuelve `NUEVA` y `ADICION`. Así que este filtro solo toca el lado de Workflow y deja el reporte con una sola lectura: **lo que entra nuevo**.

Las renovaciones **no se listan tampoco en la tabla** de radicaciones en curso. Si alguna vez hace falta verlas, se consultan directamente en Workflow.

La palabra puede venir en `negocio` o en `tipoContratacion`; basta con que uno de los dos lo diga. Se compara ignorando acentos, mayúsculas, espacios y signos, y tiene que ser el valor completo: `RENOVACION Y ADICION` **no** se descarta, porque ahí sí entran equipos.

### En qué unidad se cuenta

El indicador «En proceso» **no cuenta solicitudes, cuenta anexos**: suma la columna `cantidad` de cada preoferta que pasó el filtro de arriba.

Es la misma unidad de las altas — una alta es un anexo. Contar solicitudes mezclaba dos medidas distintas en la misma suma y dejaba «Radicadas» por debajo de lo real: una preoferta de 12 equipos pesaba lo mismo que una de 1.

Ejemplo real de Guatemala, noviembre de 2026: 10 solicitudes abiertas que suman 72 anexos se muestran como **72**, y la tarjeta lo aclara debajo: «anexos en 10 solicitudes abiertas».

La cuenta de solicitudes sigue existiendo, en la variable `nRad`, y se usa en dos lugares: el título de la tabla de radicaciones («10 actuales») y la gráfica de anexos por ejecutivo.

### El checklist B800

Activaciones lo marca cuando la preoferta ya quedó registrada como **alta en SAN**.

Ojo con esto, que es lo que más confunde: **en el workflow la preoferta sigue diciendo `en_proceso` aunque el B800 esté marcado**, porque todavía le faltan etapas. El workflow no se equivoca; simplemente responde otra pregunta. Somos nosotros los que, al ver el checklist marcado, dejamos de contarla.

Sin esta regla, una misma venta se contaba dos veces: como alta (desde SAN) y como pendiente (desde Workflow).

El campo se lee de forma tolerante: cuenta como marcado cualquier valor con contenido —`true`, una fecha, un texto—, y se busca tanto al primer nivel del registro como dentro de las etapas. Vacío, `false`, `0` y `null` no cuentan.

> Se le pidió a Activaciones que el campo guarde la **fecha** en que se marca, no solo un sí/no. Con la fecha se podría reconstruir la cifra al cierre de un mes ya concluido; con un sí/no eso es imposible. Al momento de escribir esto todavía llega como `true`/`false`, pero el código ya acepta las dos formas.

### BACKUP en las preofertas

Mismo criterio que en las altas. La diferencia es que acá la palabra puede venir en **cualquiera de dos campos** —`negocio` o `tipoContratacion`— y no siempre en los dos a la vez. Hay preofertas que dicen `BACKUP` en `negocio` y `COMODATO` en `tipoContratacion`. Basta con que uno lo diga.

### Cómo se reconoce la palabra BACKUP

Ignorando mayúsculas, espacios y signos: `BACKUP`, `Backup`, `backup`, `" BACKUP "` y `back-up` se descartan todos por igual.

Pero tiene que ser el **valor completo**. Un valor como `BACKUP COMODATO` **no** se descarta, porque ahí el equipo sí se vendió.

## Qué cuenta como RADICADAS

```
Radicadas = altas del período + anexos en proceso del período
```

Todo en anexos, que es lo que hace que la suma signifique algo: 17 + 72 = 89.

### La gráfica de anexos por ejecutivo cuenta distinto, a propósito

En esa gráfica el tramo ámbar de cada persona es **cuántas solicitudes** tiene abiertas, no cuántos anexos suman. Por eso su total no coincide con la tarjeta de «Radicadas», y por eso lleva una línea debajo que lo advierte.

Se dejó así por pedido del área: ahí interesa ver cuántos trámites lleva cada ejecutivo, no el volumen. Si alguna vez se decide unificarlo, el cambio va en `radPorVendCnt`, que hoy cuenta y tendría que sumar `cantidad`.

## Qué pasa con las radicaciones de fuera del período

No se muestran ni se cuentan. Existe una bandera en el servidor, `MOSTRAR_FUERA_DEL_PERIODO`, que si se pone en `true` las lista en la tabla con una etiqueta, sin sumarlas a los indicadores. Hoy está apagada.

> Esta decisión tiene una consecuencia que conviene conocer: una preoferta radicada en octubre que siga abierta hoy **no aparece** en el reporte de noviembre. Se verá cuando se consulte octubre.

## Las dos fechas de una misma venta

Esto genera consultas seguido, así que conviene tenerlo claro:

- La **preoferta** tiene su fecha de radicación, en Workflow.
- El **alta** tiene su fecha de registro en SAN.

No son la misma. Una venta radicada en octubre, a la que le marcan el B800 un 6 de noviembre, se registra como alta en SAN **con fecha de noviembre**. Entonces desaparece de «en proceso» y aparece en las altas de noviembre. Las dos cosas son correctas.

---

## Cómo desplegar un cambio

1. Editar el archivo de la función.
2. Entrar al proyecto en Supabase → Edge Functions → `reporte-flash-publico` → pestaña **Code**.
3. Pegar el contenido completo y darle **Deploy**.
4. Probar las dos direcciones antes de dar por bueno el cambio.

**Hacelo a principio de semana, no un viernes por la tarde.** El cambio aplica de inmediato: si algo se rompe justo antes del envío, el correo sale roto.

## Cuidados

**Las cuentas están duplicadas.** Los cálculos de este archivo son una copia de los de `dashboards/ventas/flash-altas.html`, en el repositorio del centralizado. **Si cambiás una regla allá, cambiala acá también.** Las reglas están escritas arriba, en «Las reglas de conteo»: de ahí conviene partir en vez de reconstruirlas leyendo el código.

**Los acentos van como códigos.** Todo lo que no sea una letra inglesa se manda como `&#243;` en vez de `ó`. No lo quites: sin eso, Supabase y algunos correos rompen los acentos y sale `PeticiÃ³n`.

**El peso importa.** Gmail corta los correos arriba de unos 100 KB. Hoy ronda los 65 KB. Si se pasa de 95 KB, el propio reporte avisa dentro del correo que puede llegar cortado. Si hay que recortar, lo primero es el detalle de los ejecutivos con menos altas, no las gráficas.

**Nada de imágenes para las gráficas.** Están hechas con celdas de tabla pintadas, a propósito: los correos bloquean o borran las imágenes y el SVG. Los únicos archivos de imagen son el logo y las banderas, que viven en `docs/` de este mismo repositorio.

**Los colores de las series significan lo mismo en las tres gráficas:** verde las nuevas, azul las adiciones, ámbar lo que está en proceso. Lo que distingue a una gráfica de otra es el chip que dice en qué unidad está medida, no el color de las barras. Si se cambian los colores por gráfica, el lector tiene que volver a aprenderlos cada vez.

## Qué trae el reporte

- **Tres indicadores:** altas, en proceso y radicadas. Los tres en anexos.
- **Cuatro gráficas:** anexos por ejecutivo, unidades por ejecutivo, valor de servicios por ejecutivo, y el reparto entre nuevas y adiciones.
- **Resumen por ejecutivo** con nuevas, adiciones, clientes, unidades, SIM y valor. Cada ejecutivo va con su ficha (iniciales y nombre) para que las filas se distingan de un vistazo.
- **Radicaciones en curso** con preoferta, fecha, cliente, tipo de negocio y cantidad.

> **El detalle de altas una-fila-por-anexo se quitó** el 16 de noviembre de 2026. Repetía lo que ya decía el resumen de arriba y alargaba el correo sin agregar nada. Si hiciera falta volver a verlo, está en el historial de git.

## Lo que no incluye

- **Las renovaciones ya completadas.** La API de Flash solo devuelve `NUEVA` y `ADICION`. Las renovaciones que siguen en proceso sí aparecen, porque esas vienen de Workflow.
- **IMEI, modelos, planes y precios por componente.** `actualizar.js` no los publica, a propósito.
- **La etapa actual de cada radicación.** Se quitó de la tabla por pedido del área. Si hace falta consultar en qué etapa va una solicitud, se mira directamente en Workflow.
