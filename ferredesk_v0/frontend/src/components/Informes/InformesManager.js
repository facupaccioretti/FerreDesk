import React from 'react';
import Navbar from '../Navbar';
import StockBajoList from './StockBajoList';

const InformesManager = () => {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    // Obtener información del usuario desde localStorage
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        setUser(JSON.parse(userInfo));
      } catch (error) {
        console.error('Error al parsear información del usuario:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} />
      <StockBajoList />
    </div>
  );
};

export default InformesManager; 