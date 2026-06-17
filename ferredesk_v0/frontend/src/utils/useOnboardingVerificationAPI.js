import { useCallback } from 'react';

const useOnboardingVerificationAPI = () => {
    
    const activarEmail = useCallback(async (token, email) => {
        const respuesta = await fetch('/api/public/onboarding/activar-email/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, email }),
        });

        if (!respuesta.ok) {
            const data = await respuesta.json();
            throw new Error(data.token ? data.token[0] : 'Error al activar el correo.');
        }

        return await respuesta.json();
    }, []);

    const reenviarEmail = useCallback(async (email) => {
        const respuesta = await fetch('/api/public/onboarding/reenviar-email/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (!respuesta.ok) {
            const data = await respuesta.json();
            throw new Error(data.message || 'Error al intentar reenviar el correo.');
        }

        return await respuesta.json();
    }, []);

    return {
        activarEmail,
        reenviarEmail,
    };
};

export default useOnboardingVerificationAPI;
