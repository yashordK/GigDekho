export function formatRelativeDate(dateString) {
  if (!dateString) return '';
  
  const dateObj = new Date(dateString);
  const today = new Date();
  
  // Set to midnight for relative day checking
  const checkDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Diff in days
  const diffTime = checkDate - todayDate;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  
  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Tomorrow, ${timeStr}`;
  } else if (diffDays === -1) {
    return `Yesterday, ${timeStr}`;
  }

  // Fallback pattern like "Mon 6 Apr, 6:39 PM"
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  
  return `${weekday} ${day} ${month}, ${timeStr}`;
}

/**
 * The advertised pay for one person on a gig, in whole rupees.
 *
 * Two ways a gig is priced, and each is read the way it was agreed:
 *
 *   by the hour  ->  pay_rate x duration_hrs
 *   by the day   ->  day_rate x day_count
 *
 * The day case used to be reconstructed from an hourly rate derived at save
 * time (day_rate x days / hours). That made the stored price depend on a day
 * count held in form state, and a gig once went live advertising one day's
 * pay for three days' work. The day rate and the day count are both on the
 * row now, so there is nothing to reconstruct.
 *
 * Takes either a gig row, or (payRate, durationHrs) for the callers that only
 * ever had those two.
 */
export function gigTotalPay(gigOrRate, durationHrs) {
  if (gigOrRate && typeof gigOrRate === "object") {
    const g = gigOrRate;
    if (g.day_rate != null) {
      return Math.round(Number(g.day_rate) * Math.max(Number(g.day_count) || 1, 1));
    }
    return Math.round(Number(g.pay_rate || 0) * Number(g.duration_hrs || 0));
  }
  return Math.round(Number(gigOrRate || 0) * Number(durationHrs || 0));
}
