# Consulta DIN

Versión ampliada del repositorio existente `igutierrezb/consulta-din`. Conserva GitHub Pages, los planos, Google Sheets y el servicio de horarios de Drive.

## Operación cuatrimestral

1. Entra a Administración exclusivamente con `ivan.gutierrez@uteq.edu.mx`.
2. Crea o selecciona el periodo del borrador.
3. Descarga `Plantilla-DIN.xlsx` desde el panel. Tiene una sola hoja, encabezados en fila 1 y comentarios con instrucciones. Captura desde fila 2: una fila por grupo y aula asignada. Selecciona «Hoja única», carga el archivo, revisa las columnas y la vista previa, comprueba el resumen y confirma al borrador.
4. Revisa grupos/tutores, edificios, aulas y asignaciones; también puedes editar registros en la tabla.
5. Carga los PDFs completos de grupos y profesores. Se verifican todos los encabezados antes de guardarlos.
6. Actualiza croquis desde PNG/JPEG o una página PDF. Selecciona cada aula y delimita su zona con dos clics o coordenadas. La identificación requiere revisión humana.
7. Valida y publica. Los datos, periodo, PDFs y croquis se activan juntos. Puedes restaurar la publicación anterior.

Grupos y asignaciones se sustituyen solo para el periodo seleccionado. La importación combina aulas y edificios con el catálogo existente y conserva las posiciones de los croquis. Las repeticiones iguales se agrupan; los datos contradictorios muestran las filas a corregir en la vista previa. Las columnas no seleccionadas se ignoran, aunque tengan signos o encabezados repetidos. Los códigos internos son opcionales en la hoja única: se reconocen o generan. Los IDs deben ser texto para conservar ceros iniciales. Se importan valores, sin ejecutar fórmulas ni macros.

Aula y salón significan lo mismo. «Tutor» es una persona; «Edificio» es el nombre del edificio; «Aula» es su número o nombre; «Planta» admite BAJA, ALTA, NIVEL 2 u otro nombre. Capacidad y tipo de aula son opcionales. La posición se marca en Croquis. El apartado Catálogo permite agregar edificios y aulas sin Excel. Para una nueva planta usa «Nuevo plano / nueva planta», elige el edificio y escribe la planta. Los PDF y las imágenes se cargan por separado.

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
| `remote.js` | Consultas públicas JSON sin cookies de Google, con timeout y deduplicación |
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
5. Crear un despliegue administrativo separado como **usuario que accede**, con acceso **Solo yo** para el administrador. Cada operación verifica exactamente `ivan.gutierrez@uteq.edu.mx`; la propiedad histórica `DIN_ADMINS` no autoriza cuentas adicionales. Guardar su URL en `config.js` como `adminUrl` una sola vez.
6. Probar el rechazo de usuarios anónimos/no autorizados, ambos PDFs, grupos y ubicaciones. Publicar el borrador inicial solo después de revisarlo.
7. Actualizar los archivos del repositorio conservando `vendor/`, planos, CSV y configuración de GitHub Pages. No subir respaldos privados ni credenciales.

## Arquitectura

### Aulas y directorio de profesores

En **Asignar aulas**, selecciona grupo, turno, área/edificio, planta y aula. **Revisar cambio** muestra qué grupos se retirarán del destino y cuáles quedarán sin aula. Si hay ocupantes, confirma su retiro. **Guardar cambio en borrador** conserva otros turnos y periodos; luego publica para que se vea en la consulta.

En **Directorio de profesores**, descarga los encabezados CSV y completa una fila por profesor: `nombre`, `categoria`, `correo`, `horario_laboral` (ejemplo: «Lunes a viernes, 7:00–15:00»). También admite Excel y selección de columnas. `nombre_pdf` permite indicar el nombre del horario; `nombre_tutor` identifica el nombre usado en Grupos cuando difiere. La comparación lee el PDF del borrador y permite elegir manualmente las coincidencias pendientes. Los nombres parecidos no se vinculan automáticamente. Guarda el directorio y publica. Si sustituyes el PDF, verifica nuevamente el directorio antes de publicar.

La consulta muestra el horario del grupo dentro de su ficha, incluye **Mapa del campus** y presenta categoría, tutorías, correo y horario laboral junto al horario del profesor. Los datos aún no cargados aparecen como pendientes. Una falla del directorio permite seguir viendo el PDF de clases.

Pruebas adicionales: `node tests/classrooms-directory.cjs` verifica desplazados, concurrencia, turnos/periodos, ubicaciones ambiguas y correspondencia del directorio con la versión del PDF.

Cada cambio administrativo guarda una versión JSON nueva en Drive. Un bloqueo evita escrituras simultáneas y una revisión evita sobrescribir cambios de otra sesión. Publicar cambia un único puntero; la versión anterior queda disponible. Los PDFs se guardan como archivos nuevos privados.

Antes de publicar la primera versión, el backend lee Sheets. Después, el panel administra las versiones; la hoja original se conserva como respaldo. No existe sincronización bidireccional automática con Sheets.

La autorización se comprueba en servidor mediante identidad de Google y una lista explícita. Los auxiliares terminan en `_`; las herramientas antiguas de escritura también verifican autorización. No se utiliza una contraseña en JavaScript.

## Límites y mantenimiento

Excel: 10 MB / 10 000 filas por tabla. PDF: 12 MB / 300 páginas, con texto identificable; sin OCR. Croquis: aproximadamente 2 MB. El panel usa SheetJS CE 0.20.3 y PDF.js 5.4.149 por CDN; la consulta conserva su PDF.js local. Una caída del CDN afecta la carga de archivos administrativa.

Los borradores y publicaciones se conservan en Drive. No borrar los archivos indicados por `DIN_RELEASE`, `DIN_PREVIOUS` o `DIN_DRAFT`, ni sus PDFs. Comprobar gestos y pantalla completa también en un teléfono físico.

Para revertir datos, usar Restaurar publicación anterior. Para revertir código, seleccionar la versión anterior del despliegue Apps Script y/o del repositorio.

Referencias: [Apps Script](https://developers.google.com/apps-script/guides/web), [identidad de sesión](https://developers.google.com/apps-script/reference/base/session), [SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).

### Mapa del campus y horario laboral diario

El acceso al mapa aparece junto a «Un lugar para aprender». La imagen oficial se conserva en `campus-uteq.jpg`; `campus.js` añade áreas accesibles por ratón, teclado y botones para NANO/H1, H, I, F, G, CIC 4.0, PIDET y laboratorios D/E. Cada edificio consulta el catálogo vigente, sus grupos y plantas. D/E permanecen como referencias hasta tener catálogo y planos publicados.

La fecha bajo «Datos actualizados» proviene de la versión académica publicada, nunca del reloj del visitante. Si no se puede verificar, aparece como no disponible. Tutores muestra todos al entrar y permite filtrar después.

El directorio acepta PROFESOR, CORREO ELECTRÓNICO, CATEGORÍA, ENT1/SAL1, ENT2/SAL2, ENT3/SAL3, ENT4/SAL4 y ENT5/SAL5 (lunes–viernes). Detecta el encabezado y permite elegir su fila; en el formato institucional corresponde a la fila 3. Ignora contrato, número de empleado, sumas y totales. Cada día requiere entrada y salida válidas en orden; los días vacíos se muestran sin horario registrado. Se conserva compatibilidad con horario_laboral de texto libre.

### Visitas y resumen de tutorías

El pie muestra un contador agregado de cargas de la página, desde su instalación; no representa personas únicas ni visitas históricas. `visits_` persiste únicamente cantidad y fecha inicial en DIN_VISITS, con bloqueo para evitar incrementos perdidos. No almacena IP ni cuenta del visitante. Su falla no afecta los módulos académicos.
Las tarjetas de grupo muestran cuatrimestre y tutor cuando están capturados; los grupos sin tutor permanecen visibles, omitiendo tutores ficticios o pendientes. En Periodo, el resumen administrativo enumera grupos con/sin tutor y aula y desglosa por carrera/cuatrimestre. El resumen corresponde al borrador del periodo seleccionado.
