'use client';

import React from 'react';

interface DashboardBackgroundProps {
  dark: boolean;
}

const DashboardBackground = ({ dark }: DashboardBackgroundProps) => {
  return (
    <div className="absolute inset-0 -z-10">
      <div className={`absolute inset-0 ${dark ? 'bg-gray-900' : 'bg-gray-100'}`} />
      <div className="absolute inset-0">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 ${dark ? 'bg-blue-400' : 'bg-blue-500'} rounded-full animate-float`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent ${dark ? 'to-gray-900/20' : 'to-blue-100/20'}`} />
    </div>
  );
};

export default DashboardBackground; 