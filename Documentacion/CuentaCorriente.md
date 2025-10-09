Las cuentas corrientes manejan los saldos de deber y haber de los clientes.
La pantalla principal es una tabla que ordena las facturas, recibos y creditos de los clientes (se tiene que seleccionar primero el cliente para que aparezcan datos).
revisar cuentacorrientetabla.jpeg

La tabla es Fecha | Comprobante | Debe | Haber | Saldo
Puede aparecer Completa (Si) -> Aparecen todas las facturas imputadas o no, O Compelta (No) aparecen todas las facturas/recibos etc que falten de imputar (ignorar diferencias de imputacion por centavos)
Se ordenan de mas viejo a mas nuevo, el filtro es con fecha desde/hasta, automaticamente para seleccionar el dia de hoy hasta 30 dias atras. Ahora, el cliente puede tener saldos anteriores a la fecha seleccionada, entonces antes de mostrar el saldo se lo sumariza hasta el dia anterior de la fecha seleccionada, vendria a ser como un historial.

Si es factura, el monto de la factura va al debe
Si es  credito/recibo  el monto va en el saldo.'
Si es una factura que se imputa a si misma (fue pagada en el momento, o se pago en parte en el momento). Aparece repetida pero como FAC RCBO.

En la base de datos la relacion es una tabla de imputacion de ventas
se relaciona el ID VENTA | ID RECIBO | FECHA IMPUTACION | MONTO IMPUTACION
Si el id de venta e id de recibo es el mismo, es porque la factura se imputo a si misma. Al detectarse esto en el frontend, se muestra como FAC RCBO.

Si tenemos una venta de 100 y se imputa a si misma 50, quedan 50 POR imputar.
En la tabla se va a mostrar
Fecha | Comprobante | Debe | Haber | Saldo
06/10/25 Factura XXX  100             100
06-10-25  FAC RCBO            50      50
El saldo se paso a 50, porque la FAC RCBO se autoimputo 50

Es posible que los calculos del saldo se desconfiguren al elegir Completo  (No), ya que al solo mostrar las facturas sin imputar, no se esta calculando el completo. Esto es normal y no hay rpbolema o buscamos una solucion.(indicar cuales son las mejores practicas para hacer estos calculos al momento de entrar a la tabla)

Al tocar en las acciones de la tabla, se puede ver el detalle, y tambien se puede imputar un pago (solo en los recibos). Al tocar en el recibo, tocamos imputar pago y nos aparece la listas de facturas sin imputar o parcialmente imputadas (revisar imagen cuentacorrienterecibo.jpeg). luego el usuario puede seleccionar que tanto imputar de esa factura, si todo o una parte. Y luego pasa a la seccion de creacion de recibo. (Se sigue esta explicacion en (*))



Los recibos se pueden crear a nombre de un cliente y restan del saldo total, ahora un cliente puede tener saldo 0 pero puede haber muchas facturas sin imputar porque no se las relaciono.


(*) Al hacer un Recibo en la creacion, la letra es siempre X y el usuario puede elegir el numero formateado el mismo. Luego aparece la lista de comprobantes a imputar del cliente, donde el usuario puede elegir que montos ese recibo abona de cada uno. Luego pasa a otra pantalla donde se informarn los datos del recibo, (el monto total, que no puede ser menor que el monto previamente elegido, por ej si se seleccionaron 100 en 2 facturas, el monto minimo es 200. Esos 200 es el monto imputado 100 a cada factura, si luego se elecciona 300, quedan 100 sin imputar y asi).

