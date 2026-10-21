"use client";

// Sustituye al layout raíz cuando éste falla: debe incluir <html> y <body> y no recibe los estilos globales.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f4f6f9", color: "#0f172a" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>La aplicación ha tenido un problema</h1>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Inténtalo de nuevo en unos instantes.{error.digest ? ` Código: ${error.digest}.` : ""}
          </p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
