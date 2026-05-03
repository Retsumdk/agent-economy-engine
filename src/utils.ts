export function formatTokens(amount: number): string {
  return `${amount.toFixed(2)} tokens`;
}

export function calculateReputationImpact(success: boolean, amount: number): number {
  const base = success ? 1 : -5;
  const weight = Math.log10(amount + 1);
  return base * weight;
}

export function isTaskExpired(deadline: number): boolean {
  return Date.now() > deadline;
}

export function generateSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
