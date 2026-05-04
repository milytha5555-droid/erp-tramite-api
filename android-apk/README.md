# APK para tablet Android

Esta app ya funciona como PWA instalable. Para una tablet, la forma mas simple es:

1. Sube el proyecto a GitHub.
2. Despliega en Render.
3. Abre la URL de Render desde Chrome en la tablet.
4. En el menu de Chrome, elige **Instalar app** o **Agregar a pantalla principal**.

## Generar APK

Esta carpeta incluye un proyecto Android WebView listo para compilar.

Por defecto abre:

```text
http://127.0.0.1:3000/
```

Esa URL sirve para probar desde una tablet conectada por USB usando:

```bash
adb reverse tcp:3000 tcp:3000
```

Asi no importa si la tablet esta en otra red: Android envia `127.0.0.1:3000` por USB hacia el servidor local de la PC.

Si usas emulador de Android, cambia `APP_URL` en:

```text
app/src/main/java/com/erp/tramite/MainActivity.java
```

por:

```text
http://10.0.2.2:3000/
```

Cuando ya tengas Render, cambia esa URL por la URL final:

```text
https://TU-SERVICIO.onrender.com/
```

Cuando tengas la URL final de Render, puedes generar APK de dos maneras:

### Opcion rapida: PWABuilder

1. Entra a https://www.pwabuilder.com/
2. Pega la URL de Render.
3. Elige Android.
4. Descarga el APK/AAB.

### Opcion Android Studio

1. Instala Android Studio.
2. Abre esta carpeta `android-apk`.
3. Espera que Gradle sincronice.
4. Conecta la tablet con depuracion USB activa.
5. Presiona Run para instalar y probar.

Ejemplo de URL a usar:

```text
https://TU-SERVICIO.onrender.com/
```
