# Resumen del problema y solución (FerreDesk Installer)

## Qué pasó
- El instalador (Inno Setup) lanza un script PowerShell para instalar FerreDesk.
- Se añadió un monitoreo del proceso padre (Inno) para que, si el instalador se cierra, también se cierre el script y no queden procesos huérfanos.
- En modo reanudación (/RESUME), el script veía `ParentPid = 0`, interpretaba que el padre estaba “muerto” y abortaba la espera de Docker en segundos. Esto era un falso negativo: en realidad el padre seguía vivo, pero el PID no llegaba correctamente al script.

## Qué se intentó inicialmente y por qué no funcionó
- Se agregó un chequeo periódico del proceso padre dentro de la espera de Docker.  
- Pero la función de chequeo no devolvía un valor booleano cuando no había PID válido; al evaluar `-not` sobre `$null`, la espera se abortaba de inmediato.  
- Además, el PID no siempre se persistía/leía en el registro, así que en /RESUME el script arrancaba sin PID y disparaba el falso negativo.

## Qué se cambió para que funcione
1) **Persistencia del PID del instalador en el registro**  
   - Inno Setup ahora escribe `InstallerParentPid` en `HKLM\SOFTWARE\FerreDesk\Installer` antes de lanzar PowerShell y loguea éxito o advertencia si falla.
2) **Chequeo del proceso padre robusto en PowerShell**  
   - La función `Test-ParentProcessAlivePeriodic` ahora siempre devuelve booleano.  
   - Si no hay `ParentPid`, registra una sola advertencia y retorna `true` (no aborta).  
   - Si hay PID, tolera 3 fallas consecutivas antes de devolver `false`; resetea el contador en cada éxito. No hace `exit` directo.
3) **Monitoreo en segundo plano**  
   - El monitor del proceso padre sigue activo y ahora tiene su propio log; los falsos negativos ya no cortan la espera de Docker.

## Resultado observado
- En /RESUME el script recupera `ParentPid` del registro y arranca el monitor correctamente.
- La espera de Docker ya no se corta a los pocos segundos; los logs muestran verificaciones continuas con el padre activo.

## Recomendaciones a futuro
- Mantener el guardado y lectura del `InstallerParentPid` en HKLM; si alguna vez falla, revisar permisos de escritura en RunOnce/RESUME.  
- Si se vuelve a ver `ParentPid = 0`, revisar primero el log de Inno para confirmar si logró escribir el PID en registro.  
- Dejar el chequeo del padre tolerante (3 fallas) para evitar abortar por transitorios.  
- Seguir usando el log del monitor para diagnosticar eventuales cierres del instalador.  

## Conceptos clave (en simple)
- **Proceso y PID:** Cada programa en ejecución es un proceso con un identificador único (PID). Con ese número se puede preguntar si sigue vivo o terminarlo.  
- **Padre e hijo:** Si A lanza B, A es el padre y B el hijo. El hijo puede vigilar a su padre usando el PID.  
- **Monitor del proceso padre:** Una tarea periódica que revisa si el PID del padre sigue activo; si no, puede cerrar al hijo para evitar procesos huérfanos.  
- **Booleano esperado:** Las funciones de verificación deben devolver siempre `true` (todo ok) o `false` (problema). Si devuelven `null` o nada, el código puede interpretarlo como error y abortar por equivocación.  
- **Falsos negativos:** Decir “el padre murió” cuando en realidad sigue vivo. Aquí pasó porque el PID faltaba y la función no devolvía un booleano claro.  
- **Persistir el PID:** Guardar el PID del instalador en el registro permite recuperarlo tras un reinicio (/RESUME) y monitorearlo correctamente. Si no se escribe o lee, el hijo no sabe a quién vigilar.  
- **Tolerancia a fallos:** Contar varias fallas consecutivas (ej. 3) antes de declarar muerto al padre evita cortar por fallos breves o transitorios.  
- **Espera de Docker:** Mientras se espera que Docker arranque (y el usuario acepte EULA si aparece), el monitoreo debe ser robusto: PID presente, función que devuelve booleano, y tolerancia a fallos para no abortar antes de tiempo.  

