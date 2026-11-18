const backend = process.env.DEVDESK_API_ORIGIN;
if (
  !backend ||
  !backend.startsWith("https://") ||
  new URL(backend).origin !== backend
) {
  throw new Error(
    "DEVDESK_API_ORIGIN debe ser el origen HTTPS de Render, sin barra final.",
  );
}

export const config = {
  framework: "vite",
  installCommand: "npm ci",
  buildCommand: "npm run build -w apps/web",
  outputDirectory: "apps/web/dist",
  rewrites: [
    { source: "/api/:path*", destination: backend + "/api/:path*" },
    { source: "/tickets/:path*", destination: "/index.html" },
    { source: "/login", destination: "/index.html" },
    { source: "/registro", destination: "/index.html" },
  ],
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        },
      ],
    },
  ],
};
