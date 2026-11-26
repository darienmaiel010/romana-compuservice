# ROMANA COMPUSERVICE

Aplicacion web para administrar clientes, equipos, reparaciones, presupuestos,
pagos, usuarios y reportes. Usa Next.js, Prisma y MariaDB.

El inicio resume las ordenes del taller y enlaza con clientes, equipos,
presupuestos, avisos y alertas, reportes, usuarios y configuracion.

Desde la lista o ficha de clientes, **Escribir WhatsApp** abre el chat con un
saludo preparado. El usuario revisa el mensaje y lo envía en WhatsApp; no se
manda automáticamente. Se abre la cuenta que esté activa en el navegador o
dispositivo. Para enviar desde la línea Erika mediante Cloud API se requieren
las credenciales de Meta descritas abajo.

## Inicio local

Requisitos: Node.js y MariaDB.

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env` y configura la conexion `DATABASE_URL`, un
   `AUTH_SECRET` aleatorio y las credenciales iniciales del administrador.
   Cambia `ADMIN_PASSWORD` antes de sembrar la base de datos.
3. Crea/actualiza las tablas con `npm run db:push`.
4. Crea el usuario administrador y las plantillas iniciales con
   `npm run db:seed`.
5. Inicia en desarrollo con `npm run dev` y abre `http://localhost:3000`.

No compartas ni confirmes al repositorio el archivo `.env`; contiene secretos.
En produccion, configura las variables en el entorno del servidor, usando
una base de datos diferente a la de desarrollo.

## Despliegue en Vercel

El proyecto usa Next.js y Prisma con MySQL/MariaDB. Vercel aloja la aplicacion;
la base de datos debe estar en un servicio externo compatible con MySQL y
preparado para conexiones desde funciones serverless. No se debe subir una base
local, un respaldo de CP Reparaciones ni credenciales al repositorio.

1. Crea una base MySQL/MariaDB de produccion en un proveedor externo y otra
   base separada para Preview. Usa la URL de conexion con TLS y el pooler
   recomendado por el proveedor, si ofrece uno.
2. Sube el codigo a un repositorio privado de GitHub sin archivos `.env`,
   bases de datos, respaldos ni ejecutables. En Vercel, importa ese repositorio
   como proyecto Next.js y establece `main` como rama de produccion. El
   `vercel.json` del proyecto selecciona `npm run vercel-build` como comando
   de compilacion.
3. En **Settings > Environment Variables**, configura:
   - `DATABASE_URL`: URL de produccion solo para **Production** y URL de la
     base separada solo para **Preview**. No reutilices la URL de produccion en
     Preview ni la URL de desarrollo local.
   - `AUTH_SECRET`: secreto aleatorio diferente por entorno. Puedes generar
     uno localmente con
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   - `WHATSAPP_ERIKA_ACCESS_TOKEN` y
     `WHATSAPP_ERIKA_PHONE_NUMBER_ID` solo si se habilita el envio por Cloud
     API. `WHATSAPP_API_VERSION` es opcional.
4. El comando `vercel-build` genera Prisma Client, aplica las migraciones a la
   base correspondiente al entorno y compila Next.js. Cada push a `main`
   genera un despliegue de produccion; los cambios en otras ramas y pull
   requests generan Preview, aislado con su propia base.
5. Para crear el primer usuario administrador, ejecuta `npm run db:seed` una
   sola vez apuntando al entorno de produccion, con `ADMIN_EMAIL`,
   `ADMIN_USERNAME` y `ADMIN_PASSWORD` definidos de forma temporal y segura.
   No guardes la URL de produccion ni la contraseña en el `.env` de desarrollo,
   en GitHub ni en el chat. La semilla crea tambien las plantillas iniciales.

`.env.example` contiene solo valores de muestra. `.gitignore` excluye los
archivos de entorno salvo esa plantilla, y tambien excluye bases Access,
respaldos, ejecutables, archivos locales de base de datos y paquetes ZIP.
`NEXTAUTH_URL` no se necesita: esta aplicacion usa autenticacion propia y
funciona bajo el mismo origen de Vercel, sin configuracion CORS adicional.

## Uso offline en iPhone

El modo `/offline` permite guardar en el iPhone clientes, equipos, órdenes,
cambios de estado, presupuestos y pagos. La cola se envía al servidor cuando
vuelve la conexión; si el registro cambió entretanto, la aplicación pide
decidir entre conservar la versión del servidor o confirmar el cambio local.

Para prepararlo:

1. Publica la aplicación con HTTPS y asegúrate de que el iPhone pueda alcanzar
   el servidor del taller. `localhost` solo funciona en el propio PC.
2. En Safari del iPhone, inicia sesión y abre `/offline` mientras haya
   conexión. Pulsa **Actualizar y sincronizar** para descargar la copia local.
3. En Safari, usa **Compartir > Añadir a pantalla de inicio**. Abre el icono
   instalado y vuelve a `/offline` para trabajar sin Internet.
4. Cuando el PC vuelva a ser accesible por la red local o Internet, abre la
   aplicación y sincroniza los cambios pendientes. WhatsApp necesita conexión.

La copia queda en el almacenamiento local del navegador y no está cifrada por
la aplicación. Usa un iPhone personal protegido con código/Face ID; no guardes
datos en un dispositivo compartido. El servicio de sincronización requiere que
el servidor y su base de datos MariaDB estén funcionando.

## Instalación independiente en otra PC Windows

El instalador crea una aplicación y una base MariaDB nuevas; no copia clientes,
órdenes, el archivo `.env` ni las claves de esta PC.

1. En esta PC, genera el paquete con:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\package-windows.ps1"
   ```

2. Copia el ZIP resultante a la otra PC, descomprímelo y ejecuta
   `Instalar-Romana.cmd`. Se necesita conexión a Internet durante la
   instalación. Si faltan Node.js o MariaDB, el script puede instalarlos con
   `winget`; Windows podría pedir autorización de administrador.
3. El instalador solicita el usuario y contraseña de MariaDB root en la
   consola, y crea una base nueva con credenciales aleatorias. Luego te pide
   crear el usuario/contraseña del administrador de la aplicación.
4. Abre **Iniciar ROMANA COMPUSERVICE** desde el menú Inicio. La aplicación
   abrirá en `http://127.0.0.1:3000` y tendrá sus propios registros.

Esta instalación es local a la otra PC: no comparte datos con la instalación
del taller ni publica acceso al celular por Internet/HTTPS. Para usar esa copia
desde el iPhone se requerirá configurar acceso de red y HTTPS por separado.

## WhatsApp Business Cloud API (opcional)

Para habilitar los botones manuales de WhatsApp en una orden, configura en el
entorno del servidor las credenciales de la linea emisora de Erika:

- `WHATSAPP_ERIKA_ACCESS_TOKEN` y `WHATSAPP_ERIKA_PHONE_NUMBER_ID`.
- `WHATSAPP_API_VERSION`: version de Graph API; si se omite, se usa `v21.0`.

Los identificadores `PHONE_NUMBER_ID` se obtienen en la configuracion de
WhatsApp Cloud API de Meta; no son los numeros telefonicos. Guarda los tokens
solo en el `.env` local o en el gestor de secretos del servidor, nunca en el
chat, en el navegador ni en el repositorio. Reinicia la aplicacion despues de
cambiar las variables. La pantalla de configuracion informa por linea si las
credenciales estan presentes; eso no verifica que Meta las acepte.

En cada orden, la linea emisora es Erika. Los mensajes solo se intentan cuando
un usuario pulsa una accion.
Las plantillas editables dentro de esta aplicacion son texto local: no son
plantillas aprobadas por Meta. El envio actual usa texto y Meta puede rechazarlo
si no esta abierta la ventana de atencion de WhatsApp; para iniciar mensajes
fuera de esa ventana se requiere enviar una plantilla aprobada mediante la API
de plantillas de Meta, que aun no esta integrada. Una respuesta aceptada por
Meta no confirma la entrega al destinatario.

## CP Reparaciones

La base de datos heredada no se importa ni modifica automaticamente. Antes de
planificar una importacion, hay que analizar una exportacion o una copia de la
base con acceso valido. El archivo original debe mantenerse intacto.

Para comprobar la estructura del respaldo sin mostrar ni almacenar la
contraseña maestra, ejecuta en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Server\Desktop\RCRC\romana-compuservice\scripts\inspect-cprepair-backup.ps1"
```

La herramienta pide la contraseña del MDB con entrada oculta y solo imprime
nombres de tablas y campos; no extrae registros ni altera el respaldo.
