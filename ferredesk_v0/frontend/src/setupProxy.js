const { createProxyMiddleware } = require("http-proxy-middleware");

function buildTenantAwareTarget(req) {
  const hostHeader = req.headers.host || "localhost:3000";
  const hostname = hostHeader.split(":")[0];

  return `http://${hostname}:8000`;
}

module.exports = function setupProxy(app) {
  app.use(
    ["/api", "/media"],
    createProxyMiddleware({
      changeOrigin: false,
      secure: false,
      target: "http://localhost:8000",
      router: buildTenantAwareTarget,
    })
  );
};
