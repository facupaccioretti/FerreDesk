import React from 'react';

const DashboardBackground = ({ dark }) => (
  <div className="fixed inset-0 -z-10 overflow-hidden">
    {/* Fondo gradiente */}
    <div
      className={`absolute inset-0 transition-colors duration-200 ${dark ? 'bg-gradient-to-br from-gray-100 to-gray-300' : 'bg-gradient-to-br from-gray-300 to-white'}`}
    />
    {/* Líneas diagonales animadas */}
    <svg width="100%" height="100%" className="absolute inset-0" style={{ minHeight: '100vh' }}>
      {[...Array(16)].map((_, i) => (
        <line
          key={i}
          x1={-100 + i * 90}
          y1="0"
          x2={100 + i * 90}
          y2="1000"
          stroke={dark ? '#737373' : '#a3a3a3'}
          strokeWidth="3"
          opacity={dark ? '0.22' : '0.18'}
        >
          <animate
            attributeName="y2"
            values="1000;900;1000"
            dur={`${2.5 + i * 0.2}s`}
            repeatCount="indefinite"
          />
        </line>
      ))}
    </svg>
    {/* Puntos sutiles */}
    {[...Array(18)].map((_, i) => (
      <div
        key={i}
        className={`absolute rounded-full ${dark ? 'bg-gray-400' : 'bg-gray-500'}`}
        style={{
          width: `${18 + Math.random() * 18}px`,
          height: `${18 + Math.random() * 18}px`,
          left: `${5 + Math.random() * 90}%`,
          top: `${5 + Math.random() * 90}%`,
          opacity: dark ? 0.28 + Math.random() * 0.18 : 0.18 + Math.random() * 0.18,
          filter: 'blur(0.5px)',
          animation: `float 7s ease-in-out ${i * 0.5}s infinite alternate`,
        }}
      />
    ))}
    <style>{`
      @keyframes float {
        0% { transform: translateY(0px) scale(1); }
        100% { transform: translateY(-22px) scale(1.12); }
      }
    `}</style>
  </div>
);

export default DashboardBackground; 