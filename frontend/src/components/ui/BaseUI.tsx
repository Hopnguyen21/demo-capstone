import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// Button
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children, className, variant = 'primary', size = 'md', ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-[#119653] hover:bg-[#0e8046] text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200',
    outline: 'border border-slate-300 hover:bg-slate-100 text-slate-700',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
    ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};

// Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#119653] focus:ring-1 focus:ring-[#119653] transition-colors shadow-sm',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

// Select
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-[#119653] focus:ring-1 focus:ring-[#119653] transition-colors shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// StatusBadge
export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const upper = status.toUpperCase();
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  
  if (['ACTIVE', 'ONLINE', 'VALID', 'ACCEPTED', 'COMPLETED', 'RESOLVED', 'ON'].includes(upper)) {
    color = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (['WARNING', 'PENDING', 'PROPOSED', 'IN_PROGRESS', 'ASSIGNED', 'ACKNOWLEDGED'].includes(upper)) {
    color = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (['CRITICAL', 'DANGER', 'OFFLINE', 'SUSPENDED', 'CANCELLED', 'ERROR', 'ANOMALY'].includes(upper)) {
    color = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs', color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5',
        upper.includes('ACTIVE') || upper.includes('ONLINE') || upper.includes('ON') ? 'bg-emerald-500 animate-pulse' :
        upper.includes('WARNING') || upper.includes('PENDING') ? 'bg-amber-500 animate-ping' :
        upper.includes('CRITICAL') || upper.includes('OFFLINE') ? 'bg-rose-500' : 'bg-slate-400'
      )} />
      {label || status}
    </span>
  );
};

// MetricCard
export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'normal' | 'warning' | 'critical';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title, value, unit, subtext, icon, trend, trendValue, status = 'normal'
}) => {
  const border = status === 'warning' ? 'border-amber-300 bg-amber-50/50' :
                 status === 'critical' ? 'border-rose-300 bg-rose-50/50' :
                 'border-slate-200 bg-white hover:border-slate-300 shadow-sm';

  return (
    <div className={cn('p-4 rounded-xl border transition-all', border)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        {icon && <div className="p-2 rounded-lg bg-emerald-50 text-[#119653] border border-emerald-100">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>
      {(subtext || trendValue) && (
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          {subtext && <span>{subtext}</span>}
          {trendValue && (
            <span className={cn('font-medium', trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500')}>
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Environmental Range Band Component (Min -> Target -> Max)
export interface RangeBandProps {
  label: string;
  min: number;
  max: number;
  target: number;
  current: number;
  unit: string;
}

export const CropRangeBand: React.FC<RangeBandProps> = ({ label, min, max, target, current, unit }) => {
  const isHealthy = current >= min && current <= max;
  const pct = Math.min(Math.max(((current - (min - 10)) / ((max + 10) - (min - 10))) * 100, 5), 95);

  return (
    <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-lg font-bold', isHealthy ? 'text-emerald-700' : 'text-amber-600')}>
            {current}
          </span>
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>
      <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        {/* Target range band */}
        <div
          className="absolute h-full bg-emerald-100 border-x border-emerald-300"
          style={{ left: '25%', width: '50%' }}
        />
        {/* Current reading marker */}
        <div
          className={cn('absolute top-0 bottom-0 w-2 rounded-full transform -translate-x-1/2 transition-all duration-500', isHealthy ? 'bg-emerald-600' : 'bg-amber-500')}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
        <span>MIN: {min}{unit}</span>
        <span className="text-emerald-700 font-semibold">MỤC TIÊU: {target}{unit}</span>
        <span>MAX: {max}{unit}</span>
      </div>
    </div>
  );
};

// Modal
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200">
            ✕
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
