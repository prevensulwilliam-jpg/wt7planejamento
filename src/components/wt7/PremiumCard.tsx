import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function PremiumCard({ children, className, glowColor, ...props }: PremiumCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 transition-all duration-200",
        "hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
        className
      )}
      {...props}
      style={{
        background: '#0D1318',
        border: '1px solid #1A2535',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        ...(glowColor ? { borderColor: glowColor } : {}),
      }}
    >
      {children}
    </div>
  );
}
