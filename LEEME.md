# Flash de altas — versión pública en GitHub Pages

El dashboard es el mismo. Los datos llegan así:

```
Robot (actualizar.js)  →  pide los datos a SAN con la llave  →  guarda docs/datos.json
GitHub Pages           →  muestra docs/index.html, que lee docs/datos.json
```

La llave **nunca** va en el repositorio: vive en tu archivo `.env` (tu compu) o en los *Secrets* de GitHub.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `actualizar.js` | El robot: pide las altas a SAN y genera `docs/datos.json`. |
| `docs/index.html` | El dashboard (lo que publica GitHub Pages). |
| `docs/datos.json` | Los datos. Lo crea el robot; no se edita a mano. |
| `.github/workflows/actualizar.yml` | Robot en GitHub: corre cada hora. Solo sirve si SAN abre desde internet. |
| `actualizar-y-subir.bat` | Robot en tu compu: para cuando SAN solo abre en la red de la empresa. |
| `.env.example` | Plantilla para tu archivo `.env` con la llave. |

## Importante antes de publicar

- La página será **pública**: cualquiera con el link ve el dashboard y puede descargar `datos.json`
  (nombres de clientes, anexos, valores). Confirma que la empresa está de acuerdo.
- En `datos.json` solo van los 16 campos que usa el dashboard (no van IMEI ni datos técnicos).

## Pasos

### 1. Generar los datos por primera vez (en tu compu, conectada a la red de la empresa)
1. Copia `.env.example` como `.env` y pega la llave en `FLASH_API_KEY=`.
2. En la terminal: `node actualizar.js`
3. Debe decir `✔ datos.json guardado: N altas`.

### 2. Subir a GitHub
1. Crea un repositorio **público** en GitHub (GitHub Pages gratis solo funciona con repos públicos).
2. Sube esta carpeta. El archivo `.env` NO se sube (ya está en `.gitignore`).

### 3. Activar GitHub Pages
En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` · carpeta `/docs` → Save**. En 1–2 minutos aparece el link público.

### 4. Dejarlo automático — hay dos formas, según si SAN abre desde internet

**Forma A — Robot en GitHub (100% automático, no depende de tu compu)**
1. En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**.
   Nombre: `FLASH_API_KEY` · Valor: la llave.
2. Pestaña **Actions → "Actualizar datos de Flash" → Run workflow**.
3. Si termina en verde ✔: listo, se actualizará solo cada hora.
4. Si termina en rojo ✖ con "No se pudo llegar a la API de Flash": SAN no abre desde internet → usa la Forma B
   y desactiva este robot (Actions → Actualizar datos de Flash → ··· → Disable workflow).

**Forma B — Robot en tu computadora (cuando SAN solo abre en la red de la empresa)**
1. Programa `actualizar-y-subir.bat` con el **Programador de tareas de Windows** para que corra cada hora.
2. Se actualiza mientras tu compu esté encendida y conectada a la red de la empresa.

## Si algo falla
El robot nunca publica datos incompletos: si un mes falla, o llegan muchas menos altas que antes,
cancela y deja el archivo anterior. El dashboard, si no encuentra `datos.json`, muestra la copia guardada
y lo avisa en una franja amarilla.
