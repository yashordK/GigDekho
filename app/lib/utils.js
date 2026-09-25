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
 * pay_rate stopped being a whole number when multi-day gigs arrived: the day
 * rate is divided across the run's hours, so Rs 600 a day over three 11-hour
 * days stores 54.55/hr and multiplies back to Rs 1800.15. Nobody is paid
 * fifteen paise, and a price with a decimal tail on it reads like a mistake,
 * so every figure shown to a person goes through here.
 */
export function gigTotalPay(payRate, durationHrs) {
  return Math.round(Number(payRate || 0) * Number(durationHrs || 0));
}
