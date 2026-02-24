import { formatearMoneda } from "./helpers"
import Tabla from "../../../Tabla"
import { Fragment } from "react"

const PlantillaPagos = ({ data }) => {
    const pagos = data.pagos_detalle || []

    // Calcular total cobrado neto (descontando vueltos)
    const totalCobradoNeto = pagos.reduce((acc, p) => {
        return p.metodo_vuelto ? acc - parseFloat(p.monto) : acc + parseFloat(p.monto)
    }, 0)

    return (
        <Fragment>
            {/* Contenido: Tabla de pagos */}
            <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Desglose de Cobranza</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <Tabla
                        columnas={[
                            { id: 'metodo', titulo: 'Método', align: 'left', ancho: '150px' },
                            { id: 'referencia', titulo: 'Referencia / Cuenta', align: 'left' },
                            { id: 'monto', titulo: 'Monto', align: 'right', ancho: '120px' },
                        ]}
                        datos={pagos.map(p => ({
                            id: p.id,
                            metodo: (
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${p.metodo_vuelto ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                                    <span className="font-medium text-slate-700">
                                        {p.metodo} {p.metodo_vuelto ? '(VUELTO)' : ''}
                                    </span>
                                </div>
                            ),
                            referencia: (
                                <span className="text-slate-500 text-sm">
                                    {p.cuenta ? `${p.cuenta} ${p.referencia ? `(${p.referencia})` : ''}` : (p.referencia || '-')}
                                </span>
                            ),
                            monto: (
                                <span className={`font-mono font-bold ${p.metodo_vuelto ? 'text-orange-600' : 'text-emerald-700'}`}>
                                    {p.metodo_vuelto ? '-' : ''}${formatearMoneda(p.monto)}
                                </span>
                            )
                        }))}
                        paginadorVisible={false}
                        mostrarBuscador={false}
                        mostrarOrdenamiento={false}
                        sinEstilos={true}
                        tamañoEncabezado="pequeño"
                        renderFila={(fila, idx) => (
                            <tr key={fila.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/50 transition-colors`}>
                                <td className="px-4 py-3 border-b border-slate-100">{fila.metodo}</td>
                                <td className="px-4 py-3 border-b border-slate-100">{fila.referencia}</td>
                                <td className="px-4 py-3 border-b border-slate-100 text-right">{fila.monto}</td>
                            </tr>
                        )}
                    />
                </div>
            </div>

            {/* Resumen Final */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Total Cobrado (Neto)</span>
                    <span className="text-2xl font-black text-slate-900 font-mono">
                        ${formatearMoneda(totalCobradoNeto)}
                    </span>
                </div>
            </div>
        </Fragment>
    )
}

export default PlantillaPagos
