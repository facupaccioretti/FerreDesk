import { useState } from 'react';
import { login } from '../services/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(username, password);
    setMessage(res.message);
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuario" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" />
        <button type="submit">Ingresar</button>
      </form>
      <p>{message}</p>
    </div>
  );
}