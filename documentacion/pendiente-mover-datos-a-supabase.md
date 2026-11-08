# Pendiente: sacar `datos.json` de internet público

**Estado:** planeado, no empezado
**Escrito el:** noviembre de 2026

---

## El problema

El archivo `docs/datos.json` está publicado en internet sin ninguna protección:

```
https://innovaigt.github.io/Dashboard---flash-altas/datos.json
```

Cualquiera con ese enlace puede ver, de las más de 4,000 altas, los **nombres de los clientes, sus códigos, los montos mensuales y los plazos de contrato**. No hace falta llave ni permiso.

## Por qué quedó así

Porque el dashboard corre en el navegador, y un navegador solo puede leer archivos que estén públicos en internet. No puede entrar a un repositorio privado, ni hablar con SAN directamente: SAN es interno y va por `http`, que el navegador bloquea desde una página segura.

GitHub Pages publica el archivo gratis, pero en el plan gratuito **solo funciona con repositorios públicos**. De ahí la decisión.

---

## Qué resuelve este cambio, y qué no

Conviene ser honestos con el alcance antes de empezar.

| | Hoy | Después |
|---|---|---|
| Quién puede ver los datos | Cualquiera con el enlace | Solo quien tenga la llave |
| Dónde vive esa llave | — | Dentro del HTML del dashboard |
| Quién puede extraerla | — | Cualquiera que pueda abrir el dashboard |

**La mejora es real:** el archivo deja de estar abierto en internet, deja de ser indexable y deja de encontrarse por casualidad. Haría falta tener acceso al dashboard.

**Pero no queda hermético.** El dashboard corre en el navegador, así que la llave tiene que estar escrita adentro y se puede copiar desde las herramientas del navegador.

Cerrarlo del todo requiere dos cosas más, que son otro proyecto:

1. Que el login del tablero centralizado **valide credenciales de verdad** (hoy no lo hace).
2. Que la función devuelva solo lo que el dashboard necesita mostrar, en vez de los datos crudos de los clientes.

---

## Una restricción que hay que resolver primero

**El correo no puede llevar llave.**

El reporte incluye el logo de RED y las banderas de los dos países. Esas imágenes viven en `docs/` y se sirven por GitHub Pages. Cuando el cliente de correo del destinatario va a buscarlas, va sin credenciales.

Si el repositorio se vuelve privado, **el correo se queda sin imágenes**.

Por eso el paso 2 del plan es mover esas tres imágenes a un lugar público aparte, antes de tocar nada más.

---

## El plan, en orden

El orden importa: está pensado para que nada se rompa en el medio.

### 1. Crear el lugar privado en Supabase

Dentro del proyecto `Flash_ventas`, que ya existe. Un espacio de almacenamiento privado donde va a vivir el archivo.

*Sin riesgo: no toca nada de lo que está funcionando.*

### 2. Mover las imágenes a un lugar público aparte

Las tres: `logo-red.png`, `bandera-gt.png` y `bandera-sv.png`. Y apuntar el reporte a la dirección nueva.

Va antes que todo lo demás, para que el correo deje de depender de este repositorio.

*Sin riesgo si se verifica que el correo siga mostrando las imágenes antes de seguir.*

### 3. Que el robot suba el archivo a los dos lados

Que `actualizar.js` siga escribiendo `docs/datos.json` **y además** suba el archivo a Supabase.

A propósito los dos a la vez: así nada se rompe mientras se prueba lo demás.

*Necesita una llave de escritura de Supabase guardada en los Secrets de GitHub. Esa llave es más poderosa que las demás —permite leer y modificar todo el proyecto— y no debe salir de ahí nunca.*

### 4. Crear la función que sirve los datos

Una función que lea el archivo de Supabase y lo entregue a quien traiga la llave correcta. Mismo patrón que `reporte-flash-publico`.

Probarla sola, sin conectar nada todavía.

### 5. Apuntar el dashboard a la función nueva

Cambiar `CONFIG.API_URL` en `dashboards/ventas/flash-altas.html`. Verificar que los números den exactamente igual que antes.

*Acá sí se toca algo que está en uso. Conviene un día tranquilo.*

### 6. Apuntar la función del reporte a la función nueva

Cambiar `ALTAS_URL` en el código del reporte. Comparar contra el dashboard con el mismo período.

### 7. Cerrar

Recién cuando los pasos 5 y 6 estén verificados:

- Quitar `datos.json` de la carpeta `docs/`.
- Quitar del robot la escritura al archivo público.
- Volver el repositorio privado.

---

## Lo importante del plan

**Entre el paso 3 y el 7, todo funciona por duplicado.** Si algo sale mal en cualquier punto, se vuelve atrás sin que nadie lo note.

Los pasos **1 a 4 no tocan nada** de lo que está en uso: se pueden hacer con calma.

Los pasos **5 y 6 sí**. No hacerlos un viernes por la tarde.

---

## Qué revisar cuando se haga

- Que el dashboard muestre las mismas cifras que antes del cambio, en los dos países y en dos períodos distintos.
- Que el reporte por correo muestre lo mismo que el dashboard.
- Que el correo siga mostrando el logo y las banderas.
- Que el robot siga corriendo en su horario y que los datos se actualicen.
