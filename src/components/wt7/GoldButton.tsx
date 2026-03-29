import { cn } from "@/lib/utils";

interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'outline';
}

export function GoldButton({ children, className, variant = 'primary', ...props }: GoldButtonProps) {
  if (variant === 'outline') {
    return (
      <button
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] font-display font-bold text-sm transition-all duration-200",
          "border border-gold/30 text-gold-light hover:bg-gold/10",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] font-display font-bold text-sm transition-all duration-200",
        "hover:brightness-110",
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        color: '#080C10',
        boxShadow: '0 4px 16px rgba(201,168,76,0.2)',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
