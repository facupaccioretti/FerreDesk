import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useOnboardingVerificationAPI from '../../../utils/useOnboardingVerificationAPI';
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme';

const ActivarEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { activarEmail } = useOnboardingVerificationAPI();
    const theme = useFerreDeskTheme();
    
    const [estado, setEstado] = useState('verificando'); // 'verificando', 'exito', 'error'
    const [mensajeError, setMensajeError] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        const email = searchParams.get('email');

        if (!token || !email) {
            setEstado('error');
            setMensajeError('Enlace inválido o incompleto.');
            return;
        }

        const procesarActivacion = async () => {
            try {
                await activarEmail(token, email);
                setEstado('exito');
            } catch (error) {
                setEstado('error');
                setMensajeError(error.message || 'No se pudo verificar tu correo.');
            }
        };

        procesarActivacion();
    }, [searchParams, activarEmail]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
            <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className={`max-w-md w-full space-y-8 ${theme.tarjetaClara} p-8 rounded-2xl shadow-xl text-center`}>
                    
                    {estado === 'verificando' && (
                        <div>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                            <h2 className="mt-6 text-2xl font-bold text-slate-800">
                                Verificando tu correo...
                            </h2>
                            <p className="mt-2 text-slate-600">
                                Por favor espera un momento mientras activamos tu cuenta.
                            </p>
                        </div>
                    )}

                    {estado === 'exito' && (
                        <div>
                            <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <h2 className="mt-6 text-2xl font-bold text-green-600">
                                ¡Cuenta activada!
                            </h2>
                            <p className="mt-2 text-slate-600">
                                Tu dirección de correo ha sido verificada exitosamente. Ya puedes acceder a FerreDesk.
                            </p>
                            <div className="mt-8">
                                <button
                                    onClick={() => navigate('/login')}
                                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager}`}
                                >
                                    Ir al login
                                </button>
                            </div>
                        </div>
                    )}

                    {estado === 'error' && (
                        <div>
                            <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <h2 className="mt-6 text-2xl font-bold text-red-600">
                                Ocurrió un problema
                            </h2>
                            <p className="mt-2 text-slate-600">
                                {mensajeError}
                            </p>
                            <div className="mt-8">
                                <button
                                    onClick={() => navigate('/login')}
                                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-600 hover:bg-slate-700`}
                                >
                                    Volver al inicio
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ActivarEmail;
