# Setup integración Google Sheets — Umai Sushi

Esta guía explica paso a paso cómo conectar el dashboard del negocio a una hoja de cálculo de Google para que los pedidos se puedan sincronizar automáticamente.

> ⚠️ La sincronización **automática** se habilita en Stage 2 (próxima etapa). Por ahora solo dejamos la conexión lista y validada — todo el schema ya soporta el flujo completo.

---

## Tu primer setup en 5 pasos

### 1. Crear el Google Sheet

Tenés **dos opciones** para crear la estructura inicial (los 17 headers en la fila 1). Elegí la que te resulte más cómoda:

#### 🅐 Opción más fácil: importar el CSV pre-armado

1. Bajá el archivo [`docs/sheet-template.csv`](./sheet-template.csv) de este repo.
   - Si lo tenés clonado: está en `UmaiSushi/docs/sheet-template.csv`.
   - O abrí el repo en GitHub → carpeta `docs/` → `sheet-template.csv` → botón **Raw** → **Save As**.
2. Andá a [Google Drive](https://drive.google.com) con la cuenta del negocio.
3. Arrastrá el archivo CSV a Drive (o **Nuevo → Subir archivo**).
4. Click derecho sobre el archivo subido → **Abrir con → Google Sheets**.
5. Una vez abierto: **Archivo → Guardar como Google Sheets** (si te lo pide).
6. La fila 1 ya viene con los 17 headers correctos. La fila 2 es una fila de ejemplo — **borrala** antes de empezar (es solo para que veas cómo se ven los datos).
7. Renombrá el archivo: arriba a la izquierda donde dice el nombre → poné, ej., `Pedidos Umai Sushi`.

#### 🅑 Opción "todo desde Apps Script"

1. **Nuevo → Google Sheets en blanco** en Drive.
2. Renombrá el archivo, ej. `Pedidos Umai Sushi`.
3. **Extensiones → Apps Script** (te abre el editor con `myFunction()` vacío).
4. Borrá todo y pegá el contenido de [`docs/google-apps-script-template.gs`](./google-apps-script-template.gs).
5. En el dropdown de arriba del editor, seleccioná `setupSheet` → click ▶ **Ejecutar**.
6. Google te pide autorización → permití (es tu propio script).
7. Cuando termina, te muestra un alert "Sheet configurado". Los headers ya están en la fila 1 con formato verde Umai. 🎉

### 2. Crear el Apps Script Web App

> Si elegiste la **Opción 🅑** del paso anterior, el script ya está pegado — saltá al cambio del token (paso 4).

1. En el mismo Sheet: **Extensiones → Apps Script**.
2. Vas a ver un editor con `function myFunction() {}`. Borrá todo.
3. Pegá el contenido de [`google-apps-script-template.gs`](./google-apps-script-template.gs) (en este mismo repo).
4. En el código, **cambiá la línea**:

```js
const SECRET_TOKEN = 'CAMBIAR_POR_TU_TOKEN_ALEATORIO';
```

   Generá un token aleatorio (32+ caracteres alfanuméricos). Ejemplo:
   `kxL9pQ7vT2nWmRsZ4hF8jD6yB3aE5cG1`

   **Guardalo en un lugar seguro** — vas a pegarlo también en el dashboard.

### 3. Deployar el Web App

1. En Apps Script: **Implementar → Nueva implementación**.
2. ⚙️ Icono de tuerca → **Aplicación web**.
3. Configurá:
   - **Descripción**: `Webhook pedidos Umai Sushi`
   - **Ejecutar como**: *Yo (tu email)*
   - **Quién tiene acceso**: **Cualquier persona** ← importante
4. Click **Implementar**.
5. Google te pide autorización → permite los permisos (es tu propio script).
6. Copia la **URL de implementación**. Tiene este formato:

```
https://script.google.com/macros/s/AKfycb.../exec
```

> ⚠️ Esta URL es **secreta** — quien la tenga puede escribir en tu Sheet. **No la compartas.**

### 4. Cargar todo en el dashboard

1. Entrá a `/dashboard/configuracion` con tu cuenta.
2. En la sección **Integración Google Sheets**:
   - **URL del Google Sheet**: pegá la URL del Sheet (de la barra de direcciones del navegador).
   - **URL del Apps Script Web App**: pegá la URL que copiaste en el paso 3.
   - **Token secreto**: pegá el mismo token que pusiste en el código del Apps Script.
3. Marcá **"Habilitar sincronización con Sheets"**.
4. Click **Guardar cambios**.
5. Si todo está bien, el badge cambia a **"conectada"** verde.

### 5. (Próxima etapa) Probar la sincronización

En Stage 2 vamos a agregar:
- Botón "Sincronizar pedidos pendientes" en `/dashboard/pedidos` para mandar manualmente.
- Edge Function que sincroniza automáticamente al crearse un pedido.
- Botón "Test conexión" en la configuración.

Por ahora la conexión queda *configurada* pero la sync se dispara en Stage 2.

---

## ¿Por qué dos URLs distintas?

| URL | Para qué sirve | Quién la usa |
|---|---|---|
| **Google Sheet URL** | Para que VOS abras el sheet y veas los pedidos. | El dueño manualmente en su navegador. |
| **Apps Script Web App URL** | Endpoint HTTP donde el sistema POSTea cada pedido nuevo. | El backend de Umai Sushi (sin que VOS hagas nada). |

Son URLs completamente diferentes — viven en dominios distintos (`docs.google.com` vs `script.google.com`).

---

## Seguridad

### ¿Qué pasa si alguien consigue mi Apps Script URL?

Puede mandar requests POST y escribir filas en tu Sheet, **PERO** el código del Apps Script valida el `secret` token en cada request. Si no coincide, devuelve 403.

Por eso es importante:
- Usar un token aleatorio largo (32+ caracteres).
- No publicar el token en ningún lado.
- Cambiarlo periódicamente si sospechás filtración (cambiarlo en el Apps Script + en el dashboard).

### ¿El Sheet queda público?

No por defecto. Cuando comparta el link de visualización con su equipo, asegurate de configurar permisos:
- **Solo personas específicas**: máxima seguridad, ideal.
- **Cualquiera con el link, solo ver**: cómodo, riesgo bajo.
- Evitá **"Cualquiera con el link puede editar"** ← cualquier rando podría borrar pedidos.

---

## Troubleshooting

### "URL del Sheet inválida"
Asegurate que el link empieza exactamente con `https://docs.google.com/spreadsheets/d/`.

### "URL del Apps Script inválida"
La URL correcta es `https://script.google.com/macros/s/.../exec`. Si terminás en `/dev` (deployment de prueba), no funciona desde fuera.

### "Para habilitar sync necesitás Sheet URL, Apps Script URL y token secreto"
Faltó uno de los tres campos. Completá los tres antes de tildar "Habilitar sincronización".

### El badge dice "error"
Hubo un error en la última sync. Mirá el mensaje debajo de los campos. Causas comunes:
- Token secreto no coincide entre el dashboard y el código del Apps Script.
- Apps Script no está deployado como **Web App** (revisar paso 3).
- Permisos: "Quién tiene acceso" debe ser **Cualquier persona** (no "Solo yo").
