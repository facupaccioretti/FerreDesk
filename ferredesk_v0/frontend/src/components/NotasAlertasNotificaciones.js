import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import AnimatedBackground from './AnimatedBackground';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

const NotasAlertasNotificaciones = () => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Notas, Alertas y Notificaciones - FerreDesk";
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const response = await fetch("/api/user/", { credentials: "include" });
            const data = await response.json();
            if (data.status === "success") setUser(data.user);
        } catch (error) {
            console.error('Error al obtener el usuario:', error);
        }
    };

    const handleLogout = () => {
        setUser(null);
        window.location.href = "/login";
    };

    const cards = [
        {
            label: 'Notas',
            description: 'Gestión de notas y recordatorios',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-yellow-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ),
            iconColor: '',
            bgColor: 'bg-white',
            path: '/dashboard/notas'
        },
        {
            label: 'Alertas',
            description: 'Gestión de alertas del sistema',
            icon: (
                <ErrorOutlineIcon sx={{ color: '#e53935', fontSize: 32 }} />
            ),
            iconColor: '',
            bgColor: 'bg-white',
            path: '/dashboard/alertas'
        },
        {
            label: 'Notificaciones',
            description: 'Gestión de notificaciones',
            icon: (
                <NotificationsNoneIcon sx={{ color: '#FFD600', fontSize: 32 }} />
            ),
            iconColor: '',
            bgColor: 'bg-white',
            path: '/dashboard/notificaciones'
        }
    ];

    return (
        <div className="min-h-screen bg-white relative">
            <AnimatedBackground />
            <Navbar user={user} onLogout={handleLogout} />
            
            <div className="container mx-auto px-4 py-12">
                <h2 className="mb-10 text-4xl font-semibold font-sans tracking-tight text-gray-900 text-center">
                    Notas, Alertas y Notificaciones
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div
                            key={card.label}
                            className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-300 shadow hover:shadow-lg hover:-translate-y-1"
                            onClick={() => navigate(card.path)}
                        >
                            <div className="p-6">
                                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${card.iconColor} bg-gray-50 shadow-sm mb-4`}>
                                    {card.icon}
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">{card.label}</h3>
                                <p className="text-gray-600">{card.description}</p>
                            </div>
                            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                <span className="text-sm font-medium text-gray-900 flex items-center">
                                    Acceder
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NotasAlertasNotificaciones; 