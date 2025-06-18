import { useState, useEffect } from 'react';

const DRAFT_KEY = 'proveedorFormDraft';


export default function useProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '', sigla: '' });
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setProveedores(mockProveedores);
  }, []);

  // Draft
  useEffect(() => {
    if (showModal && !editId) {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        setForm(JSON.parse(draft));
      } else {
        setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '', sigla: '' });
      }
    }
  }, [showModal, editId]);

  useEffect(() => {
    if (showModal && !editId) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  }, [form, showModal, editId]);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!form.razon) return false;
    if (editId) {
      setProveedores(prev => prev.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      const newId = Math.max(0, ...proveedores.map(p => p.id)) + 1;
      setProveedores(prev => [...prev, { ...form, id: newId }]);
    }
    setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '', sigla: '' });
    setEditId(null);
    setShowModal(false);
    localStorage.removeItem(DRAFT_KEY);
    return true;
  };

  const handleEdit = (prov) => {
    setForm({ razon: prov.razon, fantasia: prov.fantasia, domicilio: prov.domicilio, tel1: prov.tel1, cuit: prov.cuit, sigla: prov.sigla });
    setEditId(prov.id);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setProveedores(prev => prev.filter(p => p.id !== id));
    if (editId === id) {
      setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '', sigla: '' });
      setEditId(null);
      setShowModal(false);
    }
  };

  const handleCancel = () => {
    setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '', sigla: '' });
    setEditId(null);
    setShowModal(false);
    localStorage.removeItem(DRAFT_KEY);
  };

  const proveedoresFiltrados = proveedores.filter(p =>
    p.razon.toLowerCase().includes(search.toLowerCase()) ||
    p.fantasia.toLowerCase().includes(search.toLowerCase()) ||
    p.cuit.toLowerCase().includes(search.toLowerCase())
  );

  return {
    proveedores,
    setProveedores,
    search,
    setSearch,
    form,
    setForm,
    editId,
    setEditId,
    expandedId,
    setExpandedId,
    showModal,
    setShowModal,
    handleChange,
    handleSave,
    handleEdit,
    handleDelete,
    handleCancel,
    proveedoresFiltrados,
  };
} 