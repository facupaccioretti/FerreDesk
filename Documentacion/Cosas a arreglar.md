Agrego y testing del Dashboard


Cambiar modelo Cliente, para que campo CUIT sea unique.
cambiar la URL del home a /home y no /dashboard
Borrar presupuestos de cierta fecha.
En la barra de navegacion s
Mostrar mensajes del ARCA al facturar

Hook formularioDraft verificar compatibilidad con todos los formularios.

Verificar ;El enter en ningun formulario deberia completar el formulario (es molesto ya que si
 queremos apretar enter para autocompletar algun campo o algo se nos completa el formulario entero)
 

Revision General

arreglar draft para nueva grid y datos en venta

Revisar todas funcionalidades de forms


Para optimizar tabla de Ventas:
    Recomendaciones para optimizar:
    Cachear los totales en el backend o frontend
    Incluir los totales en la respuesta principal de ventas
    Usar virtualización para listas muy largas
    Optimizar la normalización de datos
    Implementar lazy loading para los detalles
    Usar React.memo para evitar re-renders innecesarios
     CRÍTICAS (Alto Impacto, Bajo Esfuerzo)
        API y Llamadas
        [ ] Eliminar llamadas redundantes: Incluir ven_total calculado en respuesta principal de ventas
        [ ] Auditar API actual: Verificar por qué se necesita llamada adicional para totales
        [ ] Implementar cache básico: Cachear totales por 5-10 minutos con React Query
        [ ] Batch requests: Una llamada para obtener todos los totales de la página actual
        Frontend
        [ ] Optimizar normalización: Usar useMemo para evitar recálculos innecesarios
        [ ] React.memo: Memoizar componentes CeldaTotalVenta y EstadoBadge
        [ ] Debounce búsqueda: Implementar debounce en filtros de búsqueda
     IMPORTANTES (Medio Impacto, Medio Esfuerzo)
        Lazy Loading
        [ ] Lazy loading de totales: Cargar totales solo cuando se ve la celda
        [ ] Lazy loading de detalles: Cargar items solo al expandir fila
        [ ] Intersection Observer: Detectar cuando celdas entran en viewport
        Virtualización
        [ ] Implementar react-window: Para listas de más de 1000 elementos
        [ ] Virtualizar tabla completa: Solo renderizar filas visibles
        [ ] Optimizar altura de filas: Altura fija para mejor performance
        Backend
        [ ] Optimizar queries: Incluir select_related y prefetch_related en Django
        [ ] Índices de base de datos: Agregar índices en campos de filtrado
        [ ] Paginación en backend: Implementar cursor-based pagination


Agregar funcionalidad clientes activos/inactivos y productos para el grid activos/inactivos.
Mejorar Libro IVA
Adaptar plantillas b y c usando el formato de plantilla A (pdf)


Plantillas C y capaz otras no mostrando subtotales

Nota Credito genericos no muestra alicuotas correctamente
  No anda buscador productos
  Bonif general no anda correctamente.




