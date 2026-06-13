import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme';
import { useTenantRegistration } from '../hooks/useTenantRegistration';

const Register = () => {
    const theme = useFerreDeskTheme();
    const navigate = useNavigate();
    
    // Componente completamente declarativo y tonto: delega todo su estado y transacciones
    const {
        formData,
        handleChange,
        handleValidateSlug,
        handleSubmit,
        loadingSlug,
        slugResult,
        slugError,
        loadingRegistro,
        registroResult,
        registroError,
        localError
    } = useTenantRegistration();

    React.useEffect(() => {
        if (registroResult?.dominio?.url) {
            let finalUrl = registroResult.dominio.url;
            if (window.location.port) {
                const parsedUrl = new URL(finalUrl);
                parsedUrl.port = window.location.port;
                finalUrl = parsedUrl.toString();
            }
            const timer = setTimeout(() => {
                window.location.assign(finalUrl);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [registroResult]);

    if (registroResult) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
                <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                    <div className={`max-w-md w-full space-y-8 ${theme.tarjetaClara} p-8 rounded-2xl shadow-xl text-center`}>
                        <h2 className="mt-6 text-3xl font-extrabold text-green-600">
                            ¡Negocio Creado!
                        </h2>
                        <p className="mt-2 text-slate-600">
                            Tu plataforma FerreDesk ha sido configurada con éxito.
                        </p>
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-left">
                            <p className="text-sm text-slate-500 mb-1">Tu nueva URL de acceso es:</p>
                            <a href={registroResult.dominio.url} className={`text-lg font-medium ${theme.azulSecundario} hover:underline break-all`}>
                                {registroResult.dominio.url}
                            </a>
                        </div>
                        <p className="mt-4 text-sm text-slate-500">
                            Guarda esta URL. Deberás iniciar sesión usando el correo <strong>{registroResult.admin_inicial.email}</strong>
                        </p>
                        <div className="mt-8">
                            <a
                                href={registroResult.dominio.url}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager}`}
                            >
                                Ir a mi Negocio
                            </a>
                            <p className="mt-4 text-center text-sm font-medium text-blue-600 animate-pulse">
                                Redirigiendo automáticamente en unos segundos...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>
            
            <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className={`max-w-md w-full space-y-8 ${theme.tarjetaClara} p-8 rounded-2xl shadow-xl`}>
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-orange-600">
                            Registrar Negocio
                        </h2>
                        <p className="mt-2 text-center text-sm text-slate-600">Crea tu propio espacio de trabajo SaaS</p>
                    </div>
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {(localError || registroError) && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
                                <span className="block sm:inline">{localError || registroError}</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">Nombre del Negocio</label>
                                <input
                                    id="nombre"
                                    name="nombre"
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Ferretería Don Carlos"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="slug" className="block text-sm font-medium text-slate-700 mb-1">Subdominio</label>
                                <div className="flex rounded-lg shadow-sm">
                                    <input
                                        id="slug"
                                        name="slug"
                                        type="text"
                                        required
                                        className="flex-1 px-4 py-2 rounded-l-lg border border-r-0 border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                        placeholder="don-carlos"
                                        value={formData.slug}
                                        onChange={handleChange}
                                        onBlur={handleValidateSlug}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleValidateSlug} 
                                        className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 text-sm font-medium"
                                    >
                                        Validar
                                    </button>
                                </div>
                                <div className="mt-1 text-xs min-h-[16px]">
                                    {loadingSlug && <span className="text-blue-500 font-medium">Comprobando disponibilidad...</span>}
                                    {!loadingSlug && slugError && <span className="text-red-500 font-medium">{slugError}</span>}
                                    {!loadingSlug && slugResult?.disponible && formData.slug === slugResult.slug && (
                                        <span className="text-green-600 font-medium">
                                            ¡Subdominio disponible! ({slugResult.dominio_sugerido})
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email_admin" className="block text-sm font-medium text-slate-700 mb-1">Correo Administrador</label>
                                <input
                                    id="email_admin"
                                    name="email_admin"
                                    type="email"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="admin@ejemplo.com"
                                    value={formData.email_admin}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Contraseña"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Confirmar contraseña"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loadingRegistro || loadingSlug}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager} disabled:opacity-50`}
                            >
                                {loadingRegistro ? 'Creando negocio...' : 'Registrar Negocio'}
                            </button>
                        </div>
                    </form>
                    <div className="text-center mt-4">
                        <p className="text-sm text-slate-600">
                            ¿Ya tienes una cuenta?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className={`font-medium ${theme.azulSecundario} hover:text-blue-500`}
                            >
                                Iniciar sesión
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
