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
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` quedan reservados para una etapa posterior; todavía no se utilizan.
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

NestJS escucha en `http://localhost:4000/api`. El esqueleto verifica `/api` y establece la conexión a PostgreSQL al iniciar. Antes de arrancarlo, iniciar la base de datos y configurar `backend/.env`.

Para validar el esquema Prisma:

```powershell
Set-Location backend
npm run prisma:validate
```

En esta etapa están preparados los modelos y la conexión; la primera migración se generará en una etapa posterior.

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
