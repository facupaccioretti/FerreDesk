# Legacy: backup local con pg_dump

Este directorio conserva una implementación histórica de dumps locales por schema.
No forma parte de FerreDesk en ejecución: no tiene endpoint, comando, tarea programada,
hook de Cierre Z, polling de frontend, ni dependencias instaladas en la imagen de la app.

No usar este código como procedimiento de backup o recuperación. El mecanismo operativo
actual es Render PITR: se crea una base temporal en el punto histórico requerido y se
extrae/restaura selectivamente el schema del tenant de forma manual. Ver
`PLAN_BACKUPS_RENDER_R2.md`.

Si se vuelve a necesitar una copia lógica, se debe diseñar como un flujo nuevo e
independiente (job one-off, almacenamiento externo, estado persistido y pruebas de
restore). Rehabilitar archivos de este directorio o volver a conectarlos al Cierre Z no
está soportado.

Los archivos `backup_service.py`, `backup_service_tests_legacy.py` y
`verify_f10_t8_legacy.py` se conservan sólo como referencia técnica. Requieren un
cliente PostgreSQL instalado por fuera de la imagen de FerreDesk y no son parte de la
suite de pruebas activa.
