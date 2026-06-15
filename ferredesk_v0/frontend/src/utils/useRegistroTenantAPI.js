import { useCallback, useEffect, useState } from 'react';
import { getCookie } from './csrf';

async function asegurarCsrf() {
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await fetch('/api/csrf/', { credentials: 'include' });
    csrftoken = getCookie('csrftoken');
  }
  return csrftoken;
}

function normalizarErrorRespuesta(data, fallback) {
  if (data?.detail) {
    return data.detail;
  }

  if (typeof data === 'object' && data !== null) {
    return Object.values(data)
      .flat()
      .map((valor) => (Array.isArray(valor) ? valor.join(', ') : String(valor)))
      .join(' | ');
  }

  return fallback;
}

export function useRegistroTenantAPI() {
  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    email_admin: '',
    password: '',
    confirmPassword: '',
  });
  const [loadingSlug, setLoadingSlug] = useState(false);
  const [slugResult, setSlugResult] = useState(null);
  const [slugError, setSlugError] = useState('');
  const [loadingRegistro, setLoadingRegistro] = useState(false);
  const [registroResult, setRegistroResult] = useState(null);
  const [registroError, setRegistroError] = useState('');
  const [localError, setLocalError] = useState('');

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  useEffect(() => {
    if (!formData.nombre || formData.slug || document.activeElement?.name === 'slug') {
      return;
    }

    const sugerenciaSlug = formData.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    setFormData((prev) => ({ ...prev, slug: sugerenciaSlug }));
  }, [formData.nombre, formData.slug]);

  const validarSlug = useCallback(async (slug) => {
    if (!slug?.trim()) {
      setSlugResult(null);
      setSlugError('');
      return null;
    }

    setLoadingSlug(true);
    setSlugError('');
    setSlugResult(null);

    try {
      const csrftoken = await asegurarCsrf();
      const response = await fetch('/api/public/onboarding/validar-slug/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();

      if (!response.ok) {
        const mensaje = normalizarErrorRespuesta(data, 'Error validando el subdominio.');
        setSlugError(mensaje);
        return null;
      }

      setSlugResult(data);
      return data;
    } catch (error) {
      setSlugError('Error de conexión al validar el subdominio.');
      return null;
    } finally {
      setLoadingSlug(false);
    }
  }, []);

  const handleValidateSlug = useCallback(() => {
    if (formData.slug !== slugResult?.slug) {
      validarSlug(formData.slug);
    }
  }, [formData.slug, slugResult?.slug, validarSlug]);

  const registrarTenant = useCallback(async (payload) => {
    setLoadingRegistro(true);
    setRegistroError('');
    setRegistroResult(null);

    try {
      const csrftoken = await asegurarCsrf();
      const response = await fetch('/api/registro-saas/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setRegistroError(normalizarErrorRespuesta(data, 'Error al registrar el negocio.'));
        return null;
      }

      setRegistroResult(data);
      return data;
    } catch (error) {
      setRegistroError('Error de conexión al intentar registrar el negocio.');
      return null;
    } finally {
      setLoadingRegistro(false);
    }
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setLocalError('');

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Las contraseñas no coinciden.');
      return null;
    }

    if (formData.password.length < 8) {
      setLocalError('La contraseña debe tener al menos 8 caracteres.');
      return null;
    }

    if (slugError || !slugResult?.disponible || formData.slug !== slugResult.slug) {
      setLocalError('Validá que el subdominio esté disponible antes de continuar.');
      return null;
    }

    return registrarTenant({
      nombre: formData.nombre,
      slug: formData.slug,
      email_admin: formData.email_admin,
      password: formData.password,
    });
  }, [formData, registrarTenant, slugError, slugResult]);

  return {
    formData,
    handleChange,
    handleSubmit,
    handleValidateSlug,
    loadingRegistro,
    loadingSlug,
    localError,
    registroError,
    registroResult,
    slugError,
    slugResult,
  };
}
