# Usuarios - Relevamiento de actor efectivo

**Base revisada:** rama `feat-usuarios`, commit `f5d4014`. Investigación estática sobre el código actual. Este documento complementa la especificación backend: enumera dónde debe persistirse o propagarse el actor y evita que la implementación se limite a Venta/Compra.

## Regla de implementación

- Una única cuenta comercial `Usuario` por tenant no identifica personas.
- `resolver_actor(request)` crea una vez, dentro de la transacción, un `ActorContext` inmutable con tipo, cuenta, perfil y etiqueta.
- Toda raíz operativa humana persiste esos cuatro datos. `actor_etiqueta` es un snapshot: un renombre no cambia historia.
- Los hijos que siempre pertenecen a una sola raíz derivan el actor y no duplican columnas.
- Los services reciben `actor` explícitamente; no releen request/sesión, no aceptan autor desde payload y no usan a quien abrió la Caja como operador actual.
- Una tarea diferida guarda al iniciador humano; el worker ejecuta como `SISTEMA`.
- Una fila mutable solo necesita eventos append-only cuando sus transiciones sucesivas tienen importancia contable o de seguridad. No se agrega auditoría genérica a cada CRUD.

## Matriz obligatoria

| Flujo / modelo | Estado actual | Regla nueva |
|---|---|---|
| `Venta` | Se crea en `ventas/serializers.py:623` y conversiones como `views_conversiones.py:793`; no tiene usuario. `ven_idvdo` es vendedor comercial. | Actor completo en Venta. Presupuesto original conserva creador; Venta convertida usa a quien confirma. Items derivan. |
| `Compra` | Se crea en `compras/serializers.py:201` sin usuario. | Actor completo. Cierre o edición posterior no reemplaza al creador; registra evento si corresponde. |
| `OrdenCompra` | Se crea en `compras/serializers.py:587` sin usuario y faltaba en la especificación original. | Actor completo. Items derivan. Conversión conserva actor del original y asigna actor actual a la nueva raíz. |
| `PostventaOperacion` | Guarda solo `usuario`; la vista pasa `request.user`. La idempotencia también se liga al Usuario global. | Actor completo. La idempotencia incluye `actor_perfil_id`. Nota de Crédito, nueva Venta, pagos, imputaciones y movimientos reciben el mismo contexto de quien confirma Postventa. |
| `Imputacion` | Se crea/acumula en `cuenta_corriente/services/imputacion_service.py`; no tiene actor y también se modifica/elimina. | Actor completo si es manual; contexto propagado si nace de Venta, Recibo, OrdenPago o Postventa. No cambiar el creador de una fila previa al acumular. |
| `Recibo`, `OrdenPago`, `AjusteProveedor` | Guardan solamente cuenta en sus campos `*_usuario`. | Conservar cuenta y sumar tipo, perfil y etiqueta. Cualquier perfil autorizado puede operar/anular sin comparar creador. |
| `PagoVenta` | No tiene actor y exige un único origen. | Deriva actor de Venta, Recibo, OrdenPago o Postventa. No duplica columnas si el origen es inequívoco. |
| `SesionCaja` | `usuario` representa hoy al propietario y la unicidad es por usuario. | Conservar cuenta legacy y agregar actor completo, con etiqueta, para apertura, cierre y X. Una Caja abierta por A puede ser operada por B y cerrada por C. |
| `MovimientoCaja` | Guarda solo `usuario`; varios flujos usan `sesion_caja.usuario`. | Actor completo. Manual usa perfil actual; derivado propaga su raíz. Nunca usar a quien abrió la Caja como actor del movimiento. |
| `Cheque` | Solo `usuario_registro`; depósito, acreditación, endoso, rechazo y reactivación sobrescriben la misma fila. | Actor completo de alta más `ChequeEvento` append-only por cada transición, con estado anterior/nuevo, fecha y actor completo. |
| `PrecioProductoLista` | Guarda la cuenta del último cambio y se sobrescribe. | Actor completo del último override. Es estado actual, no historial. |
| `ActualizacionListaDePrecios` | Es append-only pero guarda solo cuenta. | Actor completo y snapshot por actualización. |
| Importación de lista de precios | La solicitud guarda usuario; el worker crea historial sin actor. | Solicitud con iniciador humano completo; ejecución `SISTEMA`; historial enlaza la solicitud/iniciador. |
| Carga inicial de proveedor | La solicitud guarda usuario; el worker crea productos e historial sin actor. | Mismo patrón de iniciador humano + ejecución `SISTEMA`. |
| Productos, stock, códigos, promociones | Maestros mutables sin actor. | Validar permisos. Agregar evento append-only solo donde se requiera historia; no cuatro columnas a cada maestro. |
| Cliente, proveedor, bancos, medios de pago, configuración/ARCA | Maestros mutables. | Eventos con actor para cambios sensibles, sin secretos. Cliente restringido cubre también todas sus operaciones de cuenta corriente. |
| Signals de totales, ARCA y promociones | Efectos técnicos de otra operación. | Derivan de la raíz; nunca resuelven otro perfil ni elevan permisos. |
| Notas, Alertas, Reservas/Locks, `usuarios.Auditoria` | Legacy/deprecados. | No migrar a Perfil. Retirar/denegar y exportar antes de borrar donde corresponda. |

## Pruebas transversales

- Backfill histórico `TITULAR`, sin inventar perfiles ni traducir `Vendedor`.
- Cuenta histórica solo cuando el preflight demuestra que es inequívoca.
- `PERFIL` exige perfil y etiqueta; `TITULAR`/`SISTEMA` prohíben perfil.
- Renombrar conserva etiquetas anteriores y cambia las nuevas.
- Un perfil deshabilitado sigue visible en historia.
- El payload no puede elegir actor.
- Dos schemas en la misma ejecución no comparten actores.
- Un flujo compuesto conserva un solo `ActorContext` y revierte completo ante error.
- Postventa opera cualquier venta visible/elegible y no distingue propia/ajena.
- La suma agrupada por actor coincide con el total del mismo queryset de negocio.

## Riesgo que queda acotado

No hace falta auditar cada campo mutable del ERP. Sí hace falta conservar actores sucesivos cuando la misma fila atraviesa estados con efecto contable o de seguridad; Cheque es el caso claro. Para maestros comunes alcanza permiso y, cuando el negocio lo justifique, un evento específico.
