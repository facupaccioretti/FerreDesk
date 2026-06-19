import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmacionPeligroModal = ({ isOpen, onClose, onConfirm, palabraClave = "confirmar cambios", mensaje }) => {
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (inputValue.toLowerCase() === palabraClave.toLowerCase()) {
      onConfirm();
      setInputValue("");
    }
  };

  const isEnabled = inputValue.toLowerCase() === palabraClave.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay con fondo oscuro semitransparente */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 z-10 p-6">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle size={24} />
          </div>
          
          <h3 className="text-xl font-bold text-slate-800">Atención</h3>
          
          <p className="text-sm text-slate-600">
            {mensaje || "Estás a punto de modificar configuraciones críticas del sistema."}
          </p>

          <div className="w-full bg-slate-50 rounded-lg p-4 border border-slate-200 mt-2">
            <p className="text-sm text-slate-700 mb-3">
              Para confirmar, escribe: <strong className="text-red-600 select-none">{palabraClave}</strong>
            </p>
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={palabraClave}
              className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200"
              autoFocus
            />
          </div>

          <div className="flex gap-3 w-full mt-6">
            <button 
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!isEnabled}
              className={`flex-1 flex justify-center items-center py-2 px-4 rounded-lg font-semibold transition-all duration-300 ${
                isEnabled 
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-md cursor-pointer" 
                  : "bg-red-100 text-red-400 cursor-not-allowed"
              }`}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmacionPeligroModal;
