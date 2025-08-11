module.exports = {
  webpack: function (config, env) {
    // No tocamos la configuración de Webpack en sí
    return config;
  },
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      // Configurar puerto 3000 para el frontend
      config.port = 3000;
      
      // Ajuste clave: permitir cualquier host
      config.allowedHosts = "all";

      return config;
    };
  }
};