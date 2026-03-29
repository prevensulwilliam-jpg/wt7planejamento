interface WtBadgeProps {
  variant: 'gold' | 'green' | 'red' | 'cyan' | 'gray';
  children: React.ReactNode;
}

const styles = {
  gold: { background: 'rgba(201,168,76,0.15)', color: '#E8C97A' },
  green: { background: 'rgba(16,185,129,0.15)', color: '#10B981' },
  red: { background: 'rgba(244,63,94,0.15)', color: '#F43F5E' },
  cyan: { background: 'rgba(45,212,191,0.15)', color: '#2DD4BF' },
  gray: { background: 'rgba(74,85,104,0.2)', color: '#94A3B8' },
};

export function WtBadge({ variant, children }: WtBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={styles[variant]}
    >
      {children}
    </span>
  );
}
