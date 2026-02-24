import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFerreDeskTheme } from '../../hooks/useFerreDeskTheme';
import { toast } from 'react-toastify';

export default function AsistenteConfiguracion() {
    const tema = useFerreDeskTheme();
    const navegar = useNavigate();
    const [cargando, setCargando] = useState(false);
    const [paso, setPaso] = useState(1);
    const [datosFormulario, setDatosFormulario] = useState({
        nombre: '',
        razon_social: '',
        cuit_cuil: '',
        situacion_iva: 'RI',
        direccion: '',
        telefono: '',
        email: '',
        ingresos_brutos: '',
        inicio_actividad: '',
        permitir_stock_negativo: false
    });

    useEffect(() => {
        // Verificar si ya está configurado para no permitir re-entrada
        fetch('/api/ferreteria/', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data && data.no_configurada !== true) {
                    navegar('/home');
                }
            })
            .catch(() => { });
    }, [navegar]);

    const manejarCambio = (e) => {
        const { name, value, type, checked } = e.target;
        setDatosFormulario(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const manejarEnvio = async (e) => {
        e.preventDefault();
        setCargando(true);

        try {
            // Obtener CSRF Token de las cookies
            const obtenerCookie = (nombre) => {
                let valorCookie = null;
                if (document.cookie && document.cookie !== "") {
                    const cookies = document.cookie.split(";");
                    for (let i = 0; i < cookies.length; i++) {
                        const cookie = cookies[i].trim();
                        if (cookie.substring(0, nombre.length + 1) === nombre + "=") {
                            valorCookie = decodeURIComponent(cookie.substring(nombre.length + 1));
                            break;
                        }
                    }
                }
                return valorCookie;
            };

            const tokenCSRF = obtenerCookie("csrftoken");
            const respuesta = await fetch('/api/ferreteria/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': tokenCSRF
                },
                credentials: 'include',
                body: JSON.stringify(datosFormulario)
            });

            if (respuesta.ok) {
                toast.success('¡Configuración inicial completada con éxito!');
                navegar('/home');
            } else {
                const datosError = await respuesta.json();
                toast.error(datosError.detail || 'Error al guardar la configuración. Verifique los campos.');
            }
        } catch (error) {
            console.error('Error en la configuración:', error);
            toast.error('Error de conexión con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className={tema.fondo}>
            <div className={tema.patron} style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
            <div className={tema.overlay}></div>

            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl shadow-2xl border border-slate-800 ring-1 ring-orange-500/20 overflow-hidden text-slate-100">
                    {/* Encabezado */}
                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-8 text-white text-center shadow-inner">
                        <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">Bienvenido a FerreDesk</h1>
                        <p className="text-orange-50 font-medium opacity-90">Configura tu negocio para comenzar a operar</p>
                    </div>

                    <div className="p-8">
                        {/* Barra de Progreso */}
                        <div className="flex items-center mb-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg transition-all duration-300 ${paso >= 1 ? 'bg-orange-600 text-white ring-4 ring-orange-500/20' : 'bg-slate-600 text-slate-400'}`}>1</div>
                            <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-500 ${paso >= 2 ? 'bg-orange-600' : 'bg-slate-600'}`}></div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg transition-all duration-300 ${paso >= 2 ? 'bg-orange-600 text-white ring-4 ring-orange-500/20' : 'bg-slate-600 text-slate-400'}`}>2</div>
                        </div>

                        <form onSubmit={manejarEnvio}>
                            {paso === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-xl font-bold border-b border-slate-600/50 pb-2 flex items-center gap-2 text-slate-200">
                                        <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                                        Datos Principales
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Comercial <span className="text-orange-500">*</span></label>
                                            <input
                                                required
                                                name="nombre"
                                                value={datosFormulario.nombre}
                                                onChange={manejarCambio}
                                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                placeholder="Ej: Mi Ferretería"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Razón Social <span className="text-orange-500">*</span></label>
                                            <input
                                                required
                                                name="razon_social"
                                                value={datosFormulario.razon_social}
                                                onChange={manejarCambio}
                                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                placeholder="Ej: Juan Pérez S.A."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">CUIT / CUIL <span className="text-orange-500">*</span></label>
                                            <input
                                                required
                                                name="cuit_cuil"
                                                value={datosFormulario.cuit_cuil}
                                                onChange={manejarCambio}
                                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                placeholder="Ej: 20-12345678-9"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Situación IVA <span className="text-orange-500">*</span></label>
                                            <select
                                                name="situacion_iva"
                                                value={datosFormulario.situacion_iva}
                                                onChange={manejarCambio}
                                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="RI" className="bg-slate-800">Responsable Inscripto</option>
                                                <option value="MO" className="bg-slate-800">Monotributista</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setPaso(2)}
                                            className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:translate-x-1 shadow-lg"
                                        >
                                            Siguiente paso
                                        </button>
                                    </div>
                                </div>
                            )}

                            {paso === 2 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-xl font-bold border-b border-slate-600/50 pb-2 flex items-center gap-2 text-slate-200">
                                        <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                                        Contacto y Localización
                                    </h2>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dirección <span className="text-orange-500">*</span></label>
                                            <input
                                                required
                                                name="direccion"
                                                value={datosFormulario.direccion}
                                                onChange={manejarCambio}
                                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                placeholder="Calle y número"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Teléfono <span className="text-orange-500">*</span></label>
                                                <input
                                                    required
                                                    name="telefono"
                                                    value={datosFormulario.telefono}
                                                    onChange={manejarCambio}
                                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                    placeholder="Ej: 011-1234-5678"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ingresos Brutos (Opcional)</label>
                                                <input
                                                    name="ingresos_brutos"
                                                    value={datosFormulario.ingresos_brutos}
                                                    onChange={manejarCambio}
                                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                                                    placeholder="Ej: 901-123456-7"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha Inicio de Actividad</label>
                                                <input
                                                    type="date"
                                                    name="inicio_actividad"
                                                    value={datosFormulario.inicio_actividad}
                                                    onChange={manejarCambio}
                                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setPaso(1)}
                                            className="text-slate-400 hover:text-white font-bold py-3 px-4 transition-colors"
                                        >
                                            Volver
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={cargando}
                                            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-black py-4 px-10 rounded-lg transition-all shadow-xl hover:shadow-orange-500/20 transform hover:-translate-y-1 disabled:opacity-50 tracking-wider"
                                        >
                                            {cargando ? 'GUARDANDO...' : 'FINALIZAR CONFIGURACIÓN'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Nota al pie */}
                    <div className="bg-slate-900/30 p-6 border-t border-slate-600/30 flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-blue-400 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12v-.008Z" />
                        </svg>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Podrás modificar estos datos, subir tu logo o configurar certificados ARCA más tarde desde el panel de <span className="font-bold text-slate-200">Configuración</span>.
                        </p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out forwards;
                }
            ` }} />
        </div>
    );
}
