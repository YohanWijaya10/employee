"use client";
import { clsx } from 'clsx';

interface BadgeProps {
  variant: 'info' | 'warn' | 'high' | 'success' | 'default';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  info: 'bg-blue-100 text-blue-800',
  warn: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
  success: 'bg-green-100 text-green-800',
  default: 'bg-gray-100 text-gray-800',
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={clsx('badge', variantStyles[variant], className)}>
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'CREATED' | 'READY_TO_SHIP' | 'DELIVERED' | 'CANCELLED';
}

const statusVariants: Record<string, 'info' | 'warn' | 'success' | 'high' | 'default'> = {
  CREATED: 'default',
  READY_TO_SHIP: 'info',
  DELIVERED: 'success',
  CANCELLED: 'high',
};

const statusLabels: Record<string, string> = {
  CREATED: 'Created',
  READY_TO_SHIP: 'Ready to Ship',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status] || 'default'}>
      {statusLabels[status] || status}
    </Badge>
  );
}

interface SeverityBadgeProps {
  severity: 'INFO' | 'WARN' | 'HIGH';
}

const severityVariants: Record<string, 'info' | 'warn' | 'high'> = {
  INFO: 'info',
  WARN: 'warn',
  HIGH: 'high',
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <Badge variant={severityVariants[severity] || 'info'}>
      {severity}
    </Badge>
  );
}
