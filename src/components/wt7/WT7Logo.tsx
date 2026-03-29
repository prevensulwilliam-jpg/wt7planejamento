import { cn } from "@/lib/utils";

export function WT7Logo({ className, size = 'lg' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <span
      className={cn("font-display font-[800] tracking-[-1px]", sizes[size], className)}
      style={{
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      WT7
    </span>
  );
}
