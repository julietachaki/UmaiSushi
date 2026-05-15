# Guía paso a paso — Juli 💚

Esta es **tu guía**. Acá está todo lo que te toca hacer a vos manualmente para terminar de poner en marcha el sistema. Andá tildando los pasos a medida que los hagas.

> ✋ **Antes de empezar**: avisame por WhatsApp cuándo te ponés con esto así estoy disponible si te trabás en algo.

---

## 📋 Tus credenciales

```
URL del panel:    http://127.0.0.1:8001/login/   (mientras esté en local)
Email:            umai@admin.com
Password:         umaisanrafael123
```

> Cuando deployemos a internet (Vercel), la URL va a cambiar. Por ahora solo funciona si Emi tiene el server prendido en su computadora.

---

## ✅ PASO 1 — Probar el sistema básico (5 min)

Antes de configurar Sheets, asegurate que TODO lo demás anda. Hacé este recorrido completo:

### Como cliente público (sin login)

- [ ] Abrí `http://127.0.0.1:8001/`
- [ ] Debería redirigir solo a `/u/?slug=umai`
- [ ] Tenés que ver el hero "Umai Sushi" en verde Bristol + "San Rafael"
- [ ] Bajá al menú → ves todos los productos con su imagen a la derecha, descripción, precio, botón [− 0 +]
- [ ] Tocá el botón **+** de un producto → se suma al carrito y aparece la barra verde abajo "1 producto / $X total"
- [ ] Tocá el **+** otra vez → 2 productos
- [ ] Tocá **Ver mi pedido** (barra verde) → te lleva a la página del pedido
- [ ] Completá: Nombre, Teléfono
- [ ] Tildá **Retiro en el local** (más simple para probar primero)
- [ ] Tildá **Efectivo**, poné monto "20000"
- [ ] Tocá **Confirmar pedido por WhatsApp**
- [ ] Debería abrirse WhatsApp con un mensaje listo (no lo envíes, solo verificá que tenga: cliente, productos, total, y un link al final)

### Como admin (con login)

- [ ] Abrí `http://127.0.0.1:8001/login/`
- [ ] Ingresá email + password (los de arriba)
- [ ] Te lleva al dashboard. Arriba ves el navbar verde "Umai Sushi"
- [ ] Tocá **Pedidos** → tu pedido de prueba aparece arriba con badge rojo "nuevo"
- [ ] Tocá el pedido → se expande con el detalle completo
- [ ] Tocá **Empezar a preparar** → badge cambia a naranja "preparando"
- [ ] Tocá **Marcar listo** → azul
- [ ] Tocá **Marcar entregado** → gris
- [ ] Tocá **Menú** → ves los productos. Probá editar uno (cambiar precio y guardar).
- [ ] Tocá **Zonas** → ves las 2 zonas existentes (Centro, Lejos) con mapa
- [ ] Tocá **Configuración** → ves tu info de negocio
- [ ] Tocá **Salir** arriba a la derecha → te saca del panel

> Si **cualquier** paso falla, contame qué pasa antes de seguir con Sheets.

---

## ✅ PASO 2 — Crear tu Google Sheet (5 min)

Vas a tener TU propia hoja de cálculo donde se guardan todos los pedidos. Pasa por dos pasos: crear el Sheet, y crear un Apps Script que escribe pedidos en él.

### Opción A — Importar el CSV (lo más rápido)

- [ ] Andá a https://github.com/julietachaki/UmaiSushi/blob/main/docs/sheet-template.csv
- [ ] Click en **Raw** (botón arriba a la derecha) → click derecho sobre la página → **Guardar como** → guardalo en tu compu como `sheet-template.csv`
- [ ] Abrí https://drive.google.com con la cuenta de Umai Sushi
- [ ] **Nuevo → Carga de archivo** → seleccioná el CSV que guardaste
- [ ] Una vez subido, click derecho sobre el archivo en Drive → **Abrir con → Hojas de cálculo de Google**
- [ ] Arriba dice "Archivo CSV (formato no editable)". Tocá **Archivo → Guardar como Hoja de cálculo de Google**
- [ ] Se abre la versión Sheet. **Borrá la fila 2** (es solo un ejemplo).
- [ ] Renombrá el archivo arriba a la izquierda → ponele `Pedidos Umai Sushi`

### Opción B — Crear desde cero con script

- [ ] En Drive: **Nuevo → Hojas de cálculo de Google**
- [ ] Renombrá a `Pedidos Umai Sushi`
- [ ] Hacé los pasos del PASO 3 abajo primero. La función `setupSheet` que vas a correr arma los headers automáticamente.

---

## ✅ PASO 3 — Crear el Apps Script (10 min)

El Apps Script es un mini-programa que vive **adentro** del Sheet y escucha cuando llegan pedidos.

- [ ] En el Sheet que creaste: **Extensiones → Apps Script**
- [ ] Se abre un editor con `function myFunction() {}`. **Borrá todo**.
- [ ] Abrí https://github.com/julietachaki/UmaiSushi/blob/main/docs/google-apps-script-template.gs → click en **Raw** → **Ctrl+A, Ctrl+C** (seleccionar todo y copiar)
- [ ] Volvé al editor de Apps Script → **Ctrl+V** (pegar)

### Cambiar el token secreto

- [ ] Buscá esta línea:
  ```js
  const SECRET_TOKEN = 'CAMBIAR_POR_TU_TOKEN_ALEATORIO';
  ```
- [ ] Generá un token random. Algunas opciones:
  - https://passwordsgenerator.net/ → Length 32, Include Letters + Numbers
  - O inventá algo random de 32+ caracteres
- [ ] Reemplazá `CAMBIAR_POR_TU_TOKEN_ALEATORIO` por tu token. Ejemplo:
  ```js
  const SECRET_TOKEN = 'kxL9pQ7vT2nWmRsZ4hF8jD6yB3aE5cG1';
  ```
- [ ] **Guardá** (Ctrl+S o el ícono de disquete arriba)
- [ ] **Guardá ese token en un lugar seguro** (notas, password manager) — lo necesitás en el paso siguiente

### Solo si elegiste Opción B (Sheet en blanco): correr setupSheet

- [ ] En el dropdown de arriba del editor (donde dice una función), seleccioná `setupSheet`
- [ ] Click ▶ **Ejecutar**
- [ ] Google te pide autorización → seguí: **Revisar permisos → Tu cuenta → Configuración avanzada → Ir a (no seguro) → Permitir**
- [ ] Cuando termina te muestra un cartel "Sheet configurado". Listo: los 17 headers están en la fila 1 con formato verde.

### Deployar como Web App

- [ ] Arriba a la derecha del editor: **Implementar → Nueva implementación**
- [ ] ⚙️ Engranaje → **Aplicación web**
- [ ] Completá:
  - Descripción: `Webhook pedidos Umai Sushi`
  - Ejecutar como: **Yo (tu email)**
  - Quién tiene acceso: **Cualquier persona** ← MUY IMPORTANTE
- [ ] Click **Implementar**
- [ ] Google te pide autorizar de nuevo → autorizá
- [ ] **Copiá la URL que termina en `/exec`**. Se ve así:
  ```
  https://script.google.com/macros/s/AKfycb.../exec
  ```
- [ ] **Guardá esa URL** — la necesitás en el paso 4

---

## ✅ PASO 4 — Conectar todo en el dashboard (3 min)

- [ ] Volvé al panel: `http://127.0.0.1:8001/dashboard/` (si te desconectó, login de nuevo)
- [ ] Tocá **Configuración**
- [ ] En la sección **Integración Google Sheets**:
  - [ ] **URL del Google Sheet**: pegá la URL del Sheet (la que ves en la barra de direcciones cuando tenés el Sheet abierto, empieza con `https://docs.google.com/spreadsheets/d/...`)
  - [ ] **URL del Apps Script Web App**: pegá la URL que terminaba en `/exec`
  - [ ] **Token secreto**: pegá el mismo token que pusiste en el Apps Script
- [ ] Tildá **Habilitar sincronización con Sheets**
- [ ] Click **Guardar cambios**
- [ ] El badge a la derecha de "Integración Google Sheets" debería cambiar a **🟢 conectada**

---

## ✅ PASO 5 — Verificación final

- [ ] El badge de configuración dice **conectada** verde
- [ ] No hay mensajes de error rojos

Si todo está OK: 🎉 **estás lista**. La sincronización REAL de pedidos hacia el sheet la implementamos en una próxima etapa, pero ya tenés todo conectado.

---

## ❓ Si algo no anda

### "URL del Sheet inválida"
Asegurate que el link empieza exactamente con `https://docs.google.com/spreadsheets/d/`. No es el link de "compartir" — es la URL de la barra del navegador cuando tenés el Sheet abierto.

### "URL del Apps Script inválida"
La URL correcta termina en `/exec`, no `/dev`. Si terminás en `/dev`, deployaste de prueba — volvé a Apps Script → Implementar → Nueva implementación → Aplicación web.

### "Para habilitar sync necesitás Sheet URL, Apps Script URL y token secreto"
Te faltó completar uno de los tres campos. Llenalos los tres antes de tildar el checkbox.

### El badge dice "error"
Probablemente el token no coincide. Verificá que el token en el dashboard sea **exactamente** el mismo que en la línea `SECRET_TOKEN` del Apps Script. Sin espacios ni comillas extra.

### "No puedo iniciar sesión / la página no carga"
El server tiene que estar prendido en la compu de Emi. Avisale por WhatsApp.

### Cualquier otra cosa
Sacá screenshot de lo que pasa + el mensaje exacto del error → mandámelo por WhatsApp y lo arreglo.

---

## 💡 Cosas que podés hacer después

Cuando ya tengas el sistema funcionando:

- **Cambiar tu password**: por ahora es `umaisanrafael123` (la misma de la DB). Cuando me digas, te creo una password tuya privada o agregamos un "cambiar password" en el dashboard.
- **Cargar productos reales** en `/dashboard/menu.html` — sacar los del seed inicial y poner los actuales con sus precios verdaderos.
- **Cargar zonas de delivery reales** en `/dashboard/zonas.html` — borrar las 2 de ejemplo y dibujar tus zonas reales con sus precios de envío.
- **Subir el sitio a internet** (Vercel) cuando esté todo testeado.

---

¡Cualquier duda, decime! 🍣
