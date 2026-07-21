export function isWrappedSeason() {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  const day = now.getDate();
  // December 1-7
  return month === 11 && day <= 7;
}

export function getNextWrappedDate() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  if (month === 11 && day <= 7) {
    return new Date(now.getFullYear() + 1, 11, 1);
  }
  if (month < 11) return new Date(now.getFullYear(), 11, 1);
  return new Date(now.getFullYear() + 1, 11, 1);
}