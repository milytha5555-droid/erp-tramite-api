# Amazon Pedidos con API

App simple para Render con una sola pestaña: **Amazon Pedidos**. Los cuadros se pueden tipear y se guardan en el servidor mediante API.

## Ejecutar local

```bash
npm start
```

Luego abre:

```text
http://localhost:3000
```

Usuario inicial:

```text
Usuario: admin
Clave: admin123
```

En Render puedes cambiarlo creando variables de entorno:

```text
ADMIN_USER
ADMIN_PASSWORD
```

## API

- `POST /api/login`: inicia sesion.
- `POST /api/logout`: cierra sesion.
- `GET /api/me`: usuario conectado.
- `GET /api/tramites`: lista filas.
- `POST /api/tramites`: crea una fila.
- `PUT /api/tramites/:id`: actualiza una fila.
- `DELETE /api/tramites/:id`: elimina una fila.

## Tablet

La app esta adaptada para tablet y tambien incluye manifest PWA. En Android puedes abrir la URL desde Chrome y usar **Instalar app** o **Agregar a pantalla principal**.

Incluye auto refresh cada 10 segundos para traer cambios del servidor. Si estas tipeando en una celda, espera a que termines antes de refrescar.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Crear ERP tramite con API"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/erp-tramite-api.git
git push -u origin main
```

## Desplegar en Render

1. Crea un repositorio en GitHub y sube este proyecto.
2. En Render, elige **New Web Service**.
3. Conecta tu repositorio.
4. Render detecta `render.yaml` y crea el servicio con disco persistente.
5. Cuando termine el deploy, abre la URL de Render.

El archivo de datos se guarda en `/data/tramites.json` cuando se usa Render.

> Nota: Render no permite discos persistentes en servicios web gratuitos. Este proyecto usa `plan: starter` para que los datos escritos desde el ERP se conserven en el servidor.

## APK

Consulta [android-apk/README.md](android-apk/README.md). En esta maquina no estan instalados Java, Gradle ni Android SDK, asi que no se pudo compilar un APK directamente aqui.
