export function formatRelativeDate(dateString: string | Date): string;
export function gigTotalPay(
  gig: { pay_rate?: number | null; duration_hrs?: number | null; day_rate?: number | null; day_count?: number | null }
): number;
export function gigTotalPay(payRate: number | null | undefined, durationHrs: number | null | undefined): number;
