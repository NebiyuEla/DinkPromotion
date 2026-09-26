import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <Image src="/logo.webp" alt="Dink Promotion" width={522} height={196} priority className="brand-logo" />
    </div>
  );
}
