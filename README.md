# Tennis Star Admin

Aplicación de administración con frontend Next.js en la raíz, backend NestJS en `backend/` y PostgreSQL local ejecutado mediante Docker Compose.

## Requisitos locales

- Node.js 24.22.0 y npm 11.19.1.
- Docker Desktop con Docker Compose.

El archivo `.nvmrc` indica la versión principal de Node.js esperada. En Windows, instalar Node.js 24.22.0 directamente.

## Configuración del entorno

Desde la raíz del proyecto, crear los archivos locales de entorno:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

Editar ambos archivos antes de iniciar los servicios:

- En `.env`, configurar `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`. Estos valores se usan para inicializar PostgreSQL en Docker Compose.
- En `backend/.env`, configurar `DATABASE_URL` con los mismos datos de usuario, contraseña y base de datos, además del host `localhost` y puerto `5432`. Si la contraseña contiene caracteres especiales, codificarlos como URL.
- `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` se configuran localmente en `backend/.env` para crear el administrador inicial. El seed guarda únicamente un hash scrypt con sal aleatoria; no agregues credenciales reales a Git.
- Para la autenticación, genera y configura `JWT_SECRET` con al menos 32 bytes aleatorios y `JWT_EXPIRES_IN` con una duración como `8h`. Por ejemplo, desde `backend/`, ejecuta `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` y copia la salida solo en el `.env` local. No reutilices el valor de ejemplo ni publiques el secreto. La API autentica mediante cookie `httpOnly`, `sameSite=lax`, segura en producción; CORS admite el origen indicado por `FRONTEND_ORIGIN` con credenciales.
- `NEXT_PUBLIC_API_URL` configura el origen de la API del frontend.

Los archivos `.env` locales están excluidos de Git. Los `.env.example` contienen únicamente valores de ejemplo y nunca deben reemplazarse por credenciales reales dentro del repositorio.

## Iniciar PostgreSQL

Desde la raíz:

```powershell
docker compose up -d db
docker compose ps
```

La base de datos queda disponible en `localhost:5432`, limitada a conexiones locales del equipo. Compose persiste los datos en el volumen `postgres_data`; detener los contenedores no borra la base.

Para detener PostgreSQL:

```powershell
docker compose down
```

`docker compose down -v` elimina también el volumen y todos los datos persistidos. Ejecutarlo solo si se desea borrar la base local.

## Instalar e iniciar el backend

Desde una terminal:

```powershell
Set-Location backend
npm ci
npm run prisma:generate
npm run build
npm run start:dev
```

NestJS escucha en `http://localhost:4000/api`. Antes de arrancarlo, iniciar la base de datos y configurar `backend/.env`.

Endpoints de autenticación:

- `POST /api/auth/login`: inicia sesión y establece la cookie de autenticación.
- `POST /api/auth/logout`: elimina la cookie.
- `GET /api/auth/me`: devuelve el administrador de la sesión actual; requiere la cookie.

Para validar el esquema Prisma:

```powershell
Set-Location backend
npm run prisma:validate
```

## Migraciones y catálogo

Las migraciones versionadas están en `backend/prisma/migrations/`. Después de
revisar y respaldar la base existente, aplicar las migraciones pendientes desde
`backend/` con:

```powershell
npm run prisma:migrate:deploy
```

La migración del catálogo agrega jerarquía de categorías de dos niveles,
marcas y los campos requeridos de productos. No recrea la base de datos ni
modifica las tablas de ventas.

Las imágenes de productos se guardan fuera de PostgreSQL en
`backend/uploads/products/` por defecto. `PRODUCT_IMAGE_DIR` permite cambiar
la carpeta local; una ruta relativa se resuelve desde el directorio actual al
iniciar el backend. Se aceptan JPEG, PNG, GIF y WebP de hasta 5 MB. Los nombres
se generan en el servidor y PostgreSQL conserva la ruta relativa. Este
almacenamiento local es apropiado para desarrollo, pero no se comparte entre
varias instancias del backend y no sustituye un respaldo de archivos; para
producción con varias instancias se recomienda migrar el adaptador de
almacenamiento a un proveedor de objetos.

Para crear el usuario administrador inicial, asegurate de que PostgreSQL esté iniciado y que `backend/.env` tenga configuradas las variables anteriores y `DATABASE_URL`. Desde `backend/`, ejecutá:

```powershell
npm run prisma:generate
npm run prisma:seed
```

El seed usa `upsert` por email: repetirlo no crea otro usuario ni cambia la contraseña de uno que ya existe.

## Instalar e iniciar el frontend

Desde otra terminal en la raíz:

```powershell
npm ci
npm run dev
```

Next.js queda disponible en `http://localhost:3000`.

## Validar la configuración de Docker Compose

Para validar el archivo sin crear contenedores, usar la plantilla de entorno:

```powershell
docker compose --env-file .env.example config --quiet
```

## Organización del proyecto

- `src/app/`: rutas y layouts de Next.js.
- `src/components/`: componentes UI y piezas compartidas.
- `src/features/`: funcionalidades organizadas por dominio.
- `src/lib/`: cliente API, formato monetario y utilidades.
- `backend/src/`: aplicación NestJS y módulos.
- `backend/src/prisma/`: módulo y servicio de conexión Prisma.
- `backend/prisma/schema.prisma`: modelos y relaciones PostgreSQL.
- `backend/prisma.config.ts`: configuración de Prisma ORM.
