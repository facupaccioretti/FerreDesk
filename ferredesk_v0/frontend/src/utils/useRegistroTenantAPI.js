import { useCallback, useRef, useState } from 'react';
import { getCookie } from './csrf';

function normalizarSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function asegurarCsrf() {
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await fetch('/api/csrf/', { credentials: 'include' });
    csrftoken = getCookie('csrftoken');
  }
  return csrftoken;
}

function normalizarErrorRespuesta(data, fallback) {
  if (data?.message) {
    const solicitudId = data?.solicitud_id ? ` Solicitud #${data.solicitud_id}.` : '';
    return `${data.message}${solicitudId}`;
  }

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
  const [solicitudId, setSolicitudId] = useState(null);
  const [localError, setLocalError] = useState('');
  const slugRequestIdRef = useRef(0);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'slug' ? normalizarSlug(value) : value,
    }));

    if (name === 'slug') {
      setSlugResult(null);
      setSlugError('');
      setLocalError('');
    }
  }, []);

  const validarSlug = useCallback(async (slug) => {
    const slugNormalizado = normalizarSlug(slug);

    if (!slugNormalizado) {
      setSlugResult(null);
      setSlugError('');
      return null;
    }

    const requestId = ++slugRequestIdRef.current;

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
        body: JSON.stringify({ slug: slugNormalizado }),
      });
      const data = await response.json();

      if (requestId !== slugRequestIdRef.current) {
        return null;
      }

      if (!response.ok) {
        const mensaje = normalizarErrorRespuesta(data, 'Error validando el subdominio.');
        setSlugError(mensaje);
        return null;
      }

      setSlugResult(data);
      return data;
    } catch (error) {
      if (requestId !== slugRequestIdRef.current) {
        return null;
      }

      setSlugError('Error de conexion al validar el subdominio.');
      return null;
    } finally {
      if (requestId === slugRequestIdRef.current) {
        setLoadingSlug(false);
      }
    }
  }, []);

  const handleValidateSlug = useCallback(async () => {
    if (formData.slug !== slugResult?.slug || slugError) {
      return validarSlug(formData.slug);
    }

    return slugResult;
  }, [formData.slug, slugError, slugResult, validarSlug]);

  const registrarTenant = useCallback(async (payload) => {
    setLoadingRegistro(true);
    setRegistroError('');
    setRegistroResult(null);
    setSolicitudId(null);

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
        setSolicitudId(data?.solicitud_id ?? null);
        setRegistroError(normalizarErrorRespuesta(data, 'Error al registrar el negocio.'));
        return null;
      }

      setRegistroResult(data);
      return data;
    } catch (error) {
      setRegistroError('Error de conexion al intentar registrar el negocio.');
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

    let slugValidado = slugResult;

    if (slugError || !slugResult?.disponible || formData.slug !== slugResult?.slug) {
      slugValidado = await handleValidateSlug();
    }

    if (!slugValidado?.disponible || formData.slug !== slugValidado.slug) {
      setLocalError(slugError || 'Revisa el subdominio antes de continuar.');
      return null;
    }

    return registrarTenant({
      nombre: formData.nombre,
      slug: formData.slug,
      email_admin: formData.email_admin,
      password: formData.password,
    });
  }, [formData, handleValidateSlug, registrarTenant, slugError, slugResult]);

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
    solicitudId,
    slugError,
    slugResult,
  };
}
