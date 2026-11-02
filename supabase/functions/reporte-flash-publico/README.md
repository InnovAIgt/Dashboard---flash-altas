# reporte-flash-publico

Función de Supabase que arma el **reporte semanal de altas** y lo devuelve en HTML, listo para mandar por correo.

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
| `mes` | No | `AAAA-MM`. Sin él usa el mes en curso, hora de Guatemala |

**Encabezado obligatorio:** `x-api-key: <la llave>`

También acepta `Authorization: Bearer <llave>` y, solo para pruebas en el navegador, `&clave=<llave>` en la dirección.

**Respuestas:** `200` con el reporte · `401` si falta la llave o está mal · `502` si falló una fuente de datos.

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

## Cómo desplegar un cambio

1. Editar este archivo.
2. Entrar al proyecto en Supabase → Edge Functions → `reporte-flash-publico` → pestaña **Code**.
3. Pegar el contenido completo y darle **Deploy**.
4. Probar las dos direcciones antes de dar por bueno el cambio.

**Hacelo a principio de semana, no un viernes.** El correo sale los viernes a las 6:00 p. m. y el cambio aplica de inmediato: si algo se rompe un viernes a las 5, el correo sale roto.

## Cuidados

**Las cuentas están duplicadas.** Los cálculos de este archivo son una copia de los de `dashboards/ventas/flash-altas.html`, en el repositorio del centralizado (funciones `normalizar`, `filtrados`, `indicadoresDatos`, `normalizarRad` y `radFiltradas`). **Si cambiás una regla allá, cambiala acá también**, o el correo y la pantalla van a decir cosas distintas.

**Los acentos van como códigos.** Todo lo que no sea una letra inglesa se manda como `&#243;` en vez de `ó`. No lo quites: sin eso, Supabase y algunos correos rompen los acentos y sale `PeticiÃ³n`.

**El peso importa.** Gmail corta los correos arriba de unos 100 KB. Hoy ronda los 50 KB porque las filas repetidas se agrupan. Si algún mes se pasa, lo primero que hay que recortar es el detalle de los ejecutivos con menos altas, no las gráficas.

**Nada de imágenes para las gráficas.** Están hechas con celdas de tabla pintadas, a propósito: los correos bloquean o borran las imágenes y el SVG. Los únicos archivos de imagen son el logo y las banderas, que viven en `docs/` de este mismo repositorio.

## Lo que no incluye

- **Las renovaciones ya completadas.** La API de Flash solo devuelve `NUEVA` y `ADICION`. Las renovaciones que siguen en proceso sí aparecen, porque esas vienen de Workflow.
- **IMEI, modelos, planes y precios por componente.** `actualizar.js` no los publica, a propósito.
