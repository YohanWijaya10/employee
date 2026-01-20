"use client";
import { clsx } from 'clsx';

interface BadgeProps {
  variant: 'info' | 'warn' | 'high' | 'success' | 'default';
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeProps['variant'], string> = {
  info: 'badge-info',
  warn: 'badge-warning',
  high: 'badge-error',
  success: 'badge-success',
  default: 'badge-default',
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

// Visit Status Badge
interface VisitStatusBadgeProps {
  status: 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
}

const visitStatusVariants: Record<string, 'info' | 'warn' | 'success' | 'high' | 'default'> = {
  PENDING: 'default',
  VERIFIED: 'success',
  FLAGGED: 'warn',
  REJECTED: 'high',
};

const visitStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FLAGGED: 'Flagged',
  REJECTED: 'Rejected',
};

export function VisitStatusBadge({ status }: VisitStatusBadgeProps) {
  return (
    <Badge variant={visitStatusVariants[status] || 'default'}>
      {visitStatusLabels[status] || status}
    </Badge>
  );
}
