export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <img
        src={compact ? "/dink-promotion-mark.png" : "/dink-promotion-logo.png"}
        alt="Dink Promotion"
        width={compact ? 120 : 620}
        height={compact ? 120 : 231}
        className="brand-logo"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
}
