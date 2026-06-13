import { useState, useCallback, useEffect } from 'react';

export const useTenantRegistration = () => {
    const [formData, setFormData] = useState({
        nombre: '',
        slug: '',
        email_admin: '',
        password: '',
        confirmPassword: ''
    });

    const [loadingSlug, setLoadingSlug] = useState(false);
    const [slugResult, setSlugResult] = useState(null);
    const [slugError, setSlugError] = useState('');

    const [loadingRegistro, setLoadingRegistro] = useState(false);
    const [registroResult, setRegistroResult] = useState(null);
    const [registroError, setRegistroError] = useState('');
    const [localError, setLocalError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Autogenerar subdominio sugerido cuando el nombre cambia
    useEffect(() => {
        if (formData.nombre && !formData.slug && document.activeElement.name !== 'slug') {
            const sugerenciaSlug = formData.nombre
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            setFormData(prev => ({ ...prev, slug: sugerenciaSlug }));
        }
    }, [formData.nombre, formData.slug]);

    const validarSlug = useCallback(async (slugToValidate) => {
        if (!slugToValidate || slugToValidate.trim() === '') {
            setSlugResult(null);
            setSlugError('');
            return;
        }

        setLoadingSlug(true);
        setSlugError('');
        setSlugResult(null);

        try {
            const response = await fetch('/api/public/onboarding/validar-slug/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: slugToValidate }),
            });

            const data = await response.json();

            if (response.ok) {
                setSlugResult(data);
            } else {
                const errorMsg = Array.isArray(data) ? data.join(', ') : data.detail || (data.slug ? data.slug.join(', ') : 'Error validando el subdominio');
                setSlugError(errorMsg);
            }
        } catch (err) {
            setSlugError('Error de conexión al validar el subdominio.');
        } finally {
            setLoadingSlug(false);
        }
    }, []);

    const handleValidateSlug = () => {
        if (formData.slug !== slugResult?.slug) {
            validarSlug(formData.slug);
        }
    };

    const registrarTenant = useCallback(async (tenantData) => {
        setLoadingRegistro(true);
        setRegistroError('');
        setRegistroResult(null);

        try {
            const response = await fetch('/api/public/onboarding/tenants/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tenantData),
            });

            const data = await response.json();

            if (response.ok) {
                setRegistroResult(data);
                return data;
            } else {
                let errorMsg = 'Error al registrar el negocio.';
                if (data.detail) {
                    errorMsg = data.detail;
                } else if (typeof data === 'object') {
                    errorMsg = Object.values(data)
                        .map(err => Array.isArray(err) ? err.join(', ') : err)
                        .join(' | ');
                }
                setRegistroError(errorMsg);
                return null;
            }
        } catch (err) {
            setRegistroError('Error de conexión al intentar registrar el negocio.');
            return null;
        } finally {
            setLoadingRegistro(false);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        if (formData.password !== formData.confirmPassword) {
            setLocalError('Las contraseñas no coinciden');
            return;
        }

        if (formData.password.length < 8) {
            setLocalError('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (slugError || !slugResult || !slugResult.disponible || formData.slug !== slugResult.slug) {
            setLocalError('Por favor valida que el subdominio esté disponible antes de continuar.');
            return;
        }

        await registrarTenant({
            nombre: formData.nombre,
            slug: formData.slug,
            email_admin: formData.email_admin,
            password: formData.password
        });
    };

    return {
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
    };
};
