export interface PublicPlan {
  code: string;
  displayName: string;
  maxProjects: number;
  maxSeats: number;
  monthlyPriceCents: number;
  features: Record<string, unknown>;
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await fetch('/api/public/plans');
  if (!res.ok) {
    throw new Error('Failed to load plans');
  }
  const data = (await res.json()) as { plans: PublicPlan[] };
  return data.plans;
}
