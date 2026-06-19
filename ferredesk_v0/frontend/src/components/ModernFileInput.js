import React, { useRef } from 'react';
import { UploadCloud, File as FileIcon } from 'lucide-react';

const ModernFileInput = ({ label, accept, onChange, currentFile, helperText, disabled }) => {
  const inputRef = useRef(null);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && onChange) {
      onChange(file);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        disabled={disabled}
      />
      <div 
        onClick={handleClick}
        className={`flex items-center gap-3 py-1.5 px-3 border border-dashed rounded-lg transition-all duration-200 group ${
          disabled 
            ? "border-slate-200 bg-slate-100 cursor-not-allowed" 
            : "border-slate-300 bg-slate-50 cursor-pointer hover:border-orange-500 hover:bg-slate-100/70"
        }`}
      >
        <div className={`p-1.5 rounded-md text-orange-600 ${disabled ? "bg-slate-200/30 opacity-60" : "bg-slate-200/60 group-hover:bg-slate-200"}`}>
          <UploadCloud size={16} />
        </div>
        <div className="flex flex-col">
          <span className={`text-xs font-semibold ${disabled ? "text-slate-400" : "text-slate-700"}`}>
            {currentFile ? (currentFile.name || "Archivo cargado (Click para reemplazar)") : label}
          </span>
          {helperText && !currentFile && (
            <span className={`text-[11px] ${disabled ? "text-slate-400" : "text-slate-500"}`}>
              {helperText}
            </span>
          )}
          {currentFile && currentFile.name && (
             <span className={`text-[11px] flex items-center gap-1 mt-0.5 ${disabled ? "text-slate-400" : "text-blue-600"}`}>
               <FileIcon size={12} /> {disabled ? "Archivo cargado" : "Archivo listo para guardar"}
             </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModernFileInput;
