/** Dibujo del icono de la app (calendario sobre fondo azul marino), compartido por favicon, manifest y apple-icon. */
export function AppIconArt({ size, safeZone = false }: { size: number; safeZone?: boolean }) {
  // Los iconos "maskable" necesitan margen: el sistema recorta hasta un 20 %.
  const inner = size * (safeZone ? 0.5 : 0.62);
  return (
    <div style={{ width: size, height: size, background: "#0b1a33", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: inner, height: inner, background: "#ffffff", borderRadius: inner * 0.16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: inner * 0.28, background: "#2563eb", display: "flex" }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: inner * 0.3, height: inner * 0.3, borderRadius: inner, background: "#2563eb", display: "flex" }} />
        </div>
      </div>
    </div>
  );
}
