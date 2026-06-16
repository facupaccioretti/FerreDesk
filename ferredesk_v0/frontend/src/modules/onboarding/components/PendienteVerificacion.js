import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useOnboardingVerificationAPI from '../../../utils/useOnboardingVerificationAPI';
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme';

const PendienteVerificacion = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { reenviarEmail } = useOnboardingVerificationAPI();
    const theme = useFerreDeskTheme();
    
    const email = searchParams.get('email') || '';
    
    const [reenviando, setReenviando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');
    const [mensajeError, setMensajeError] = useState('');

    const handleReenviar = async () => {
        if (!email) {
            setMensajeError('No se proporcionó un correo válido.');
            return;
        }

        setReenviando(true);
        setMensajeExito('');
        setMensajeError('');

        try {
            await reenviarEmail(email);
            setMensajeExito('Hemos enviado un nuevo enlace de verificación a tu correo.');
        } catch (error) {
            setMensajeError(error.message || 'Error al intentar reenviar el correo.');
        } finally {
            setReenviando(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
            <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className={`max-w-md w-full space-y-8 ${theme.tarjetaClara} p-8 rounded-2xl shadow-xl text-center`}>
                    
                    <svg className="mx-auto h-16 w-16 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>

                    <h2 className="mt-6 text-2xl font-bold text-slate-800">
                        Cuenta pendiente de verificación
                    </h2>
                    
                    <p className="mt-2 text-slate-600">
                        Tu cuenta ha sido creada exitosamente, pero necesitamos verificar tu dirección de correo electrónico antes de que puedas continuar.
                    </p>

                    {email && (
                        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-sm text-slate-700">
                                Hemos enviado un enlace de activación a:
                                <br/>
                                <strong className="text-slate-900">{email}</strong>
                            </p>
                        </div>
                    )}

                    {mensajeExito && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm">
                            {mensajeExito}
                        </div>
                    )}

                    {mensajeError && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                            {mensajeError}
                        </div>
                    )}

                    <div className="mt-8 space-y-4">
                        <button
                            onClick={handleReenviar}
                            disabled={reenviando}
                            className={`w-full flex justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50`}
                        >
                            {reenviando ? 'Reenviando...' : 'Reenviar correo de verificación'}
                        </button>

                        <button
                            onClick={() => navigate('/login')}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager}`}
                        >
                            Ir al login
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PendienteVerificacion;
