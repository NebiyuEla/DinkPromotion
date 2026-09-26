export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <img src="/logo.webp" alt="Dink Promotion" width={522} height={196} className="brand-logo" />
    </div>
  );
}
