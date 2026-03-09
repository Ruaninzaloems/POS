export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRequired(fields: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`${key} is required.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateNumericRange(value: number, min: number, max: number, fieldName: string): ValidationResult {
  const errors: string[] = [];
  if (isNaN(value)) {
    errors.push(`${fieldName} must be a valid number.`);
  } else if (value < min || value > max) {
    errors.push(`${fieldName} must be between ${min} and ${max}.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validatePercentageSum(values: number[], tolerance: number = 0.01): ValidationResult {
  const sum = values.reduce((acc, v) => acc + v, 0);
  const errors: string[] = [];
  if (Math.abs(sum - 100) > tolerance) {
    errors.push(`Percentages must total 100%. Current total: ${sum.toFixed(2)}%.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateAccountNo(accountNo: string): ValidationResult {
  const errors: string[] = [];
  if (!accountNo || accountNo.trim().length === 0) {
    errors.push('Account number is required.');
  }
  return { valid: errors.length === 0, errors };
}

export function isCourtReady(row: Record<string, unknown>): boolean {
  return !!(
    row['actionType'] &&
    row['entityType'] &&
    row['entityId'] &&
    row['userId'] &&
    row['userName'] &&
    row['ipAddress'] &&
    row['apiCallId'] &&
    row['timestamp'] &&
    row['legislationRef']
  );
}

export function getRiskCategory(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score <= 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  return 'HIGH';
}

export function getConfidenceLabel(score: number): string {
  if (score >= 70) return 'High Confidence';
  if (score >= 40) return 'Moderate Confidence';
  return 'Low Confidence';
}

export function sortByField<T>(items: T[], field: keyof T, dir: 'asc' | 'desc'): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    let cmp = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      cmp = aVal.localeCompare(bVal);
    } else {
      cmp = (aVal as number) - (bVal as number);
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('final')) return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
  if (s.includes('trial run review') || s.includes('review')) return 'bg-amber-500/15 text-amber-700 border-amber-200';
  if (s.includes('trial')) return 'bg-blue-500/15 text-blue-700 border-blue-200';
  if (s.includes('authorized') || s.includes('approved')) return 'bg-green-500/15 text-green-700 border-green-200';
  return 'bg-slate-500/15 text-slate-700 border-slate-200';
}
