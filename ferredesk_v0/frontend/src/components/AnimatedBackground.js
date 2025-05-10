import React from 'react';

const AnimatedBackground = () => (
  <div className="fixed inset-0 -z-10">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
    <div className="absolute inset-0 opacity-50">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute w-4 h-4 bg-blue-500 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 5}s`,
            transform: `scale(${0.5 + Math.random() * 1.5})`,
          }}
        />
      ))}
    </div>
  </div>
);

export default AnimatedBackground; 