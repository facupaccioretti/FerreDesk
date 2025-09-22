import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFerreDeskTheme } from '../hooks/useFerreDeskTheme';

const Register = () => {
    const theme = useFerreDeskTheme();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validaciones
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (formData.password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        try {
            const response = await fetch('/api/usuarios/register/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al conectar con el servidor');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
            {/* Patrón de puntos característico de FerreDesk */}
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>
            
            <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className={`max-w-md w-full space-y-8 ${theme.tarjetaClara} p-8 rounded-2xl shadow-xl`}>
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-orange-600">
                            Crear una cuenta
                        </h2>
                    </div>
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                                <span className="block sm:inline">{success}</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">Nombre de usuario</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Nombre de usuario"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">Correo electrónico</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Correo electrónico"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Contraseña"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">Confirmar contraseña</label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Confirmar contraseña"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager}`}
                            >
                                Registrarse
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