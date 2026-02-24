import React from 'react';

const TicketVentaRender = React.forwardRef(({ data }, ref) => {
    if (!data) return null;

    const { ferreteria } = data;

    // Calcular totales de pagos
    const totalVenta = parseFloat(data.ven_total || 0);
    const vuelto = parseFloat(data.vuelto_calculado || 0);

    return (
        <div
            ref={ref}
            className="ticket-container p-1 text-black bg-white"
            style={{
                width: '72mm',
                margin: '0 auto',
                fontSize: '11px',
                fontFamily: "'Courier New', Courier, monospace",
                lineHeight: '1.1',
                color: 'black'
            }}
        >
            {/* Estilos específicos para la impresora térmica */}
            <style type="text/css" media="print">
                {`
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background-color: white;
                        -webkit-print-color-adjust: exact;
                    }
                    .ticket-container {
                        width: 72mm !important;
                        margin: 0 auto !important;
                        padding: 2mm 2mm !important;
                        box-sizing: border-box;
                        color: black !important;
                    }
                    button, .no-print {
                        display: none !important;
                    }
                `}
            </style>

            {/* Cabecera Empresarial */}
            <div className="text-center mb-3">
                <h1 className="font-bold text-lg uppercase mb-0">
                    {ferreteria?.razon_social || ferreteria?.nombre || 'FERREDESK'}
                </h1>
                {ferreteria?.nombre && ferreteria?.nombre !== ferreteria?.razon_social && (
                    <p className="italic text-[10px]">{ferreteria.nombre}</p>
                )}
                <p>CUIT: {ferreteria?.cuit_cuil || '---'}</p>
                <p>{ferreteria?.situacion_iva || '---'}</p>
                <p className="leading-tight">{ferreteria?.direccion || '---'}</p>
                <p>
                    {ferreteria?.telefono && <span>TEL: {ferreteria.telefono}</span>}
                    {ferreteria?.email && <span className="ml-1">| {ferreteria.email}</span>}
                </p>
            </div>

            <div className="border-b border-dashed border-gray-600 my-2"></div>

            {/* Datos del Comprobante */}
            <div className="mb-2">
                <p className="font-bold text-center uppercase tracking-tighter">
                    {data.comprobante_nombre} {data.comprobante_letra}
                </p>
                <p className="text-center font-bold text-sm">Nº {data.numero_formateado}</p>
                <div className="flex justify-between mt-1 text-[10px]">
                    <span>FECHA: {data.ven_fecha}</span>
                    <span>HORA: {data.hora_creacion ? data.hora_creacion.substring(0, 5) : '---'}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-600 my-2"></div>

            {/* Datos del Cliente */}
            <div className="mb-2 text-[10px]">
                <p><span className="font-bold uppercase">Cliente:</span> {data.cliente_nombre || 'CONSUMIDOR FINAL'}</p>
                {data.cliente_cuit && data.cliente_cuit !== '0' && <p><span className="font-bold uppercase">CUIT/DNI:</span> {data.cliente_cuit}</p>}
                {data.cliente_condicion_iva && <p><span className="font-bold uppercase">IVA:</span> {data.cliente_condicion_iva}</p>}
                {data.cliente_domicilio && <p><span className="font-bold uppercase">Domicilio:</span> {data.cliente_domicilio}</p>}
            </div>

            <div className="border-b border-dashed border-gray-600 my-2"></div>

            {/* Tabla de Ítems Refinada - AJUSTADA PARA ESTABILIDAD VERTICAL */}
            <div className="mb-1">
                <table className="w-full table-fixed">
                    <thead>
                        <tr className="border-b border-dotted border-gray-500 text-[10px] font-bold">
                            <th className="w-[10%] text-left pb-1">CT</th>
                            <th className="w-[40%] text-left pb-1">DESC</th>
                            <th className="w-[25%] text-right pb-1">P.U</th>
                            <th className="w-[25%] text-right pb-1">SUBT</th>
                        </tr>
                    </thead>
                    <tbody className="text-[9px]">
                        {data.items && data.items.map((item, idx) => (
                            <tr key={item.id || idx} className="align-top">
                                <td className="py-1">{parseFloat(item.vdi_cantidad)}</td>
                                <td className="py-1 pr-1">
                                    <div className="flex flex-col">
                                        <span className="break-words line-clamp-none whitespace-normal">
                                            {item.vdi_detalle1 || '---'}
                                        </span>
                                        {item.codigo && <span className="text-[7px] text-gray-700 italic">#{item.codigo}</span>}
                                        {item.vdi_bonifica > 0 && <span className="text-[9px] font-bold border-b border-black">DESC {parseFloat(item.vdi_bonifica)}%</span>}
                                    </div>
                                </td>
                                <td className="py-1 text-right">
                                    {parseFloat(item.precio_unitario_bonificado_con_iva || item.vdi_precio_unitario_final || 0).toFixed(2)}
                                </td>
                                <td className="py-1 text-right font-bold">
                                    {parseFloat(item.total_item || (item.vdi_cantidad * item.vdi_precio_unitario_final)).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-b border-dashed border-gray-600 my-2"></div>

            {/* Totales */}
            <div className="mb-2">
                <div className="flex justify-between">
                    <span>NETO GRAVADO:</span>
                    <span>${parseFloat(data.ven_impneto || 0).toFixed(2)}</span>
                </div>
                {parseFloat(data.iva_global || 0) > 0 && (
                    <div className="flex justify-between">
                        <span>IVA TOTAL:</span>
                        <span>${parseFloat(data.iva_global).toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-base mt-1 pt-1 border-t border-dotted border-gray-400">
                    <span>TOTAL:</span>
                    <span>${totalVenta.toFixed(2)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-600 my-2"></div>

            {/* Medios de Pago */}
            <div className="mb-2 text-[10px]">
                <p className="font-bold mb-1 uppercase">Forma de Pago:</p>
                {data.pagos && data.pagos.length > 0 ? (
                    data.pagos.map((pago, idx) => (
                        <div key={idx} className="flex justify-between pl-1">
                            <span>{pago.metodo_pago_nombre || (pago.metodo_pago_codigo === 'efectivo' ? 'EFECTIVO' : 'OTRO')}</span>
                            <span>${parseFloat(pago.monto || 0).toFixed(2)}</span>
                        </div>
                    ))
                ) : (
                    <div className="flex justify-between pl-1">
                        <span>{data.comprobante_letra === 'P' ? 'PRESUPUESTO' : 'CUENTA CORRIENTE'}</span>
                        <span>${totalVenta.toFixed(2)}</span>
                    </div>
                )}

                {vuelto > 0 && (
                    <div className="flex justify-between pl-1 font-bold mt-1 border border-black p-1">
                        <span>VUELTO:</span>
                        <span>${vuelto.toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* Pie Fiscal Dinámico */}
            {data.ven_cae ? (
                <>
                    <div className="border-b border-dashed border-gray-600 my-2"></div>
                    <div className="text-center mt-2 text-[9px]">
                        <p><span className="font-bold">CAE:</span> {data.ven_cae}</p>
                        {data.ven_caevencimiento && <p><span className="font-bold">VTO CAE:</span> {data.ven_caevencimiento}</p>}

                        {data.ven_qr && (
                            <div className="mt-2 flex justify-center">
                                <img
                                    src={`data:image/png;base64,${data.ven_qr}`}
                                    alt="QR AFIP"
                                    width="100"
                                    height="100"
                                    style={{ filter: 'grayscale(100%) contrast(1000%)' }}
                                />
                            </div>
                        )}
                        <p className="mt-1 font-bold italic uppercase">Comprobante Autorizado</p>
                    </div>
                </>
            ) : (
                <div className="text-center mt-4 pt-2 border-t border-dotted border-gray-500 text-[9px] uppercase font-bold">
                    <p>Documento no válido como factura</p>
                </div>
            )}

            <div className="h-8"></div>
        </div>
    );
});

export default TicketVentaRender;
