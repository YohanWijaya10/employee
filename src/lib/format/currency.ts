export function formatIDR(value: number, options?: Intl.NumberFormatOptions) {
  const fmt = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    ...options,
  });
  return fmt.format(value || 0);
}

