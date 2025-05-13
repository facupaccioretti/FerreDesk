import React, { useState, useEffect } from "react";

export default function ProveedorForm({ onSave, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || {
    razon: "", fantasia: "", domicilio: "", tel1: "", cuit: "", sigla: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.razon.trim() || !form.sigla.trim()) {
      setError("Razón social y sigla son obligatorios");
      return;
    }
    setError("");
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4 bg-white rounded shadow">
      <h3 className="text-xl font-semibold mb-4">{initialData ? "Editar Proveedor" : "Nuevo Proveedor"}</h3>
      {error && <div className="mb-2 text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input name="razon" value={form.razon} onChange={handleChange} placeholder="Razón social*" className="border rounded p-2" />
        <input name="fantasia" value={form.fantasia} onChange={handleChange} placeholder="Nombre de fantasía" className="border rounded p-2" />
        <input name="domicilio" value={form.domicilio} onChange={handleChange} placeholder="Domicilio" className="border rounded p-2" />
        <input name="tel1" value={form.tel1} onChange={handleChange} placeholder="Teléfono" className="border rounded p-2" />
        <input name="cuit" value={form.cuit} onChange={handleChange} placeholder="CUIT" className="border rounded p-2 col-span-2" />
        <input name="sigla" value={form.sigla} onChange={handleChange} placeholder="Sigla (3 letras)" className="border rounded p-2 col-span-2" maxLength={3} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button type="submit" className="px-4 py-2 bg-black text-white rounded">{initialData ? "Guardar Cambios" : "Crear Proveedor"}</button>
      </div>
    </form>
  );
}
