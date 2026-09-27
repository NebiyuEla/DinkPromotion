export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <img
        src="/dink-promotion-mark.png"
        alt="Dink Promotion"
        width={compact ? 120 : 512}
        height={compact ? 120 : 512}
        className="brand-logo"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
}
