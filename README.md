# Consulta DIN

Versión ampliada del repositorio existente `igutierrezb/consulta-din`. Conserva GitHub Pages, los planos, Google Sheets y el servicio de horarios de Drive.

## Operación cuatrimestral

1. Entra a Administración con tu cuenta institucional.
2. Crea o selecciona el periodo del borrador.
3. Carga Excel o CSV, selecciona hoja y fila de encabezados, mapea columnas y revisa la vista previa. Confirma la importación al borrador.
4. Revisa grupos/tutores, edificios, aulas y asignaciones; también puedes editar registros en la tabla.
5. Carga los PDFs completos de grupos y profesores. Se verifican todos los encabezados antes de guardarlos.
6. Actualiza croquis desde PNG/JPEG o una página PDF. Selecciona cada aula y delimita su zona con dos clics o coordenadas. La identificación requiere revisión humana.
7. Valida y publica. Los datos, periodo, PDFs y croquis se activan juntos. Puedes restaurar la publicación anterior.

Grupos y asignaciones se sustituyen solo para el periodo seleccionado. Aulas y edificios se importan como catálogos completos. Los IDs deben ser texto para conservar ceros iniciales. Se importan valores, sin ejecutar fórmulas ni macros.

## Consulta pública

- Grupos como botones, con búsqueda y filtro de carrera.
- Tutor, aula y acceso al horario desde cada grupo.
- Sugerencias de profesores extraídas del PDF vigente.
- Visor con zoom, ajuste, transcripción y pantalla completa.
- Planos interactivos originales conservados.
- Fuentes independientes y errores por módulo. Caché de hasta 24 horas, fechada; las ubicaciones no se afirman como vigentes cuando falla una fuente relacionada.

## Archivos principales

| Archivo | Responsabilidad |
|---|---|
| `index.html`, `estilos.css`, `app.js` | Consulta pública |
| `datos.js`, `planos.js` | Modelo y geometrías originales |
| `source.js` | Backend, fuentes independientes y caché |
| `horarios.js`, `vendor/pdfjs/` | Extracción y visor PDF |
| `config.js` | URLs públicas, sin contraseñas |
| `admin.html` | Entrada al panel protegido |
| `AdminPanel.html` | Interfaz servida desde Apps Script |
| `Administracion.gs` | Autorización, borradores y publicación |
| `Servicio.gs` | Lectura pública compatible con los horarios anteriores |
| `Config.gs` | Configuración inicial de hoja y PDFs anteriores |
| `Catalogos.gs` | Herramientas originales de Sheets, con autorización |

En Apps Script, el archivo existente se llama `Catalogo.gs`: actualizarlo con `Catalogos.gs`, sin duplicar funciones. `admin.html` y `AdminPanel.html` tienen nombres distintos también en Windows.

## Instalación inicial

1. Respaldar el proyecto Apps Script y anotar la versión del despliegue público.
2. Actualizar `Config.gs`, `Servicio.gs`, `Catalogo.gs`; añadir `Administracion.gs` y el HTML `AdminPanel`.
3. Ejecutar `prepararAdministracion` como `ivan.gutierrez@uteq.edu.mx`. Configura `DIN_ADMINS` y crea una carpeta privada, registrada como `DIN_FOLDER`.
4. Mantener el despliegue público como propietario y actualizar su versión conservando su URL.
5. Crear un despliegue administrativo separado como **usuario que accede**, con acceso **Solo yo** para el administrador. La lista `DIN_ADMINS` se comprueba en cada operación. Guardar su URL en `config.js` como `adminUrl` una sola vez.
6. Probar el rechazo de usuarios anónimos/no autorizados, ambos PDFs, grupos y ubicaciones. Publicar el borrador inicial solo después de revisarlo.
7. Actualizar los archivos del repositorio conservando `vendor/`, planos, CSV y configuración de GitHub Pages. No subir respaldos privados ni credenciales.

## Arquitectura

Cada cambio administrativo guarda una versión JSON nueva en Drive. Un bloqueo evita escrituras simultáneas y una revisión evita sobrescribir cambios de otra sesión. Publicar cambia un único puntero; la versión anterior queda disponible. Los PDFs se guardan como archivos nuevos privados.

Antes de publicar la primera versión, el backend lee Sheets. Después, el panel administra las versiones; la hoja original se conserva como respaldo. No existe sincronización bidireccional automática con Sheets.

La autorización se comprueba en servidor mediante identidad de Google y una lista explícita. Los auxiliares terminan en `_`; las herramientas antiguas de escritura también verifican autorización. No se utiliza una contraseña en JavaScript.

## Límites y mantenimiento

Excel: 10 MB / 10 000 filas por tabla. PDF: 12 MB / 300 páginas, con texto identificable; sin OCR. Croquis: aproximadamente 2 MB. El panel usa SheetJS CE 0.20.3 y PDF.js 5.4.149 por CDN; la consulta conserva su PDF.js local. Una caída del CDN afecta la carga de archivos administrativa.

Los borradores y publicaciones se conservan en Drive. No borrar los archivos indicados por `DIN_RELEASE`, `DIN_PREVIOUS` o `DIN_DRAFT`, ni sus PDFs. Comprobar gestos y pantalla completa también en un teléfono físico.

Para revertir datos, usar Restaurar publicación anterior. Para revertir código, seleccionar la versión anterior del despliegue Apps Script y/o del repositorio.

Referencias: [Apps Script](https://developers.google.com/apps-script/guides/web), [identidad de sesión](https://developers.google.com/apps-script/reference/base/session), [SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).
