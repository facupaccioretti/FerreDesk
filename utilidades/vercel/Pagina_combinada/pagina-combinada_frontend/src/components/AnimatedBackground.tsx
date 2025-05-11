'use client';

import React, { useState, useEffect } from 'react';

const AnimatedBackground = () => {
  const [circles, setCircles] = useState<{ id: number; style: React.CSSProperties }[]>([]);

  useEffect(() => {
    const newCircles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        opacity: 0.3,
      },
    }));
    setCircles(newCircles);
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800" />
      <div className="absolute inset-0">
        {circles.map((circle) => (
          <div
            key={circle.id}
            className="absolute w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-float"
            style={circle.style}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-blue-100/20 dark:to-gray-900/20" />
    </div>
  );
};

export default AnimatedBackground; 