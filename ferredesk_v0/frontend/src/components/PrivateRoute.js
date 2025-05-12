import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then(res => {
        if (res.status === 200) return res.json();
        throw new Error("No autenticado");
      })
      .then(() => {
        setIsAuth(true);
        setLoading(false);
      })
      .catch(() => {
        setIsAuth(false);
        setLoading(false);
        navigate("/login");
      });
  }, [navigate]);

  if (loading) return <div>Cargando...</div>;
  return isAuth ? children : null;
}
