import React, { useState, useEffect } from "react";

export default function ProveedorForm({ onSave, onCancel, initialData, formError }) {
  const [form, setForm] = useState(initialData || {
    codigo: '',
    razon: '',
    fantasia: '',
    domicilio: '',
    impsalcta: '',
    fecsalcta: '',
    sigla: '',
    tel1: '',
    cuit: ''
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.codigo || !form.razon.trim() || !form.fantasia.trim() || !form.domicilio.trim() || !form.impsalcta || !form.fecsalcta || !form.sigla.trim()) {
      setError("Todos los campos obligatorios deben estar completos");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4 bg-white rounded shadow">
      <h3 className="text-xl font-semibold mb-4">{initialData ? "Editar Proveedor" : "Nuevo Proveedor"}</h3>
      {error && <div className="mb-2 text-red-600">{error}</div>}
      {formError && <div className="mb-2 text-red-600">{formError}</div>}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input name="codigo" value={form.codigo} onChange={handleChange} placeholder="Código*" className="border rounded p-2" type="number" />
        <input name="sigla" value={form.sigla} onChange={handleChange} placeholder="Sigla (3 letras)*" className="border rounded p-2" maxLength={3} />
        <input name="razon" value={form.razon} onChange={handleChange} placeholder="Razón social*" className="border rounded p-2" />
        <input name="fantasia" value={form.fantasia} onChange={handleChange} placeholder="Nombre de fantasía*" className="border rounded p-2" />
        <input name="domicilio" value={form.domicilio} onChange={handleChange} placeholder="Domicilio*" className="border rounded p-2" />
        <input name="tel1" value={form.tel1} onChange={handleChange} placeholder="Teléfono" className="border rounded p-2" />
        <input name="cuit" value={form.cuit} onChange={handleChange} placeholder="CUIT" className="border rounded p-2 col-span-2" />
        <input name="impsalcta" value={form.impsalcta} onChange={handleChange} placeholder="Importe Saldo Cuenta*" className="border rounded p-2" type="number" step="0.01" />
        <input name="fecsalcta" value={form.fecsalcta} onChange={handleChange} placeholder="Fecha Saldo Cuenta*" className="border rounded p-2" type="date" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-black text-white rounded" disabled={saving}>{initialData ? "Guardar Cambios" : "Crear Proveedor"}</button>
      </div>
    </form>
  );
}
