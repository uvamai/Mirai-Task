export interface PlanMatrixItem {
  code: 'starter' | 'standard' | 'pro' | 'enterprise';
  name: string;
  headlinePrice: string;
  subPrice?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  ctaDisabled: boolean;
  ctaHint?: string;
}

export const planMatrix: PlanMatrixItem[] = [
  {
    code: 'starter',
    name: 'Starter',
    headlinePrice: 'Free forever',
    description: 'For individuals and very small teams getting started.',
    features: [
      'Up to 3 users',
      'Up to 2 projects',
      'Up to 200 total tasks',
      'Kanban + list views',
      'Starter built-in templates',
    ],
    ctaLabel: 'Start free',
    ctaHref: '/register?plan=starter',
    ctaDisabled: false,
  },
  {
    code: 'standard',
    name: 'Standard',
    headlinePrice: '$5',
    subPrice: 'per user / month',
    description: 'Collaboration baseline for growing teams.',
    features: [
      'Up to 25 users',
      'Up to 20 projects',
      'Up to 20,000 tasks',
      'Invite links + revoke/regenerate',
      'Comments, mentions, notifications',
      'Custom board columns + resize',
    ],
    ctaLabel: 'Coming soon',
    ctaDisabled: true,
    ctaHint: 'Payments are not enabled yet.',
  },
  {
    code: 'pro',
    name: 'Pro',
    headlinePrice: '$9',
    subPrice: 'per user / month',
    description: 'Operational scale with automation and SLA controls.',
    features: [
      '100 users included (expandable)',
      'Up to 100 projects',
      'Up to 200,000 tasks',
      'Recurring tasks + reminder engine',
      'SLA defaults by priority',
      'My Work cross-board queue',
      'Org custom templates',
    ],
    ctaLabel: 'Coming soon',
    ctaDisabled: true,
    ctaHint: 'Payments are not enabled yet.',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    headlinePrice: 'Contact Sales',
    description: 'Governance, compliance, and contractual scale.',
    features: [
      'Contractual limits',
      'Dedicated support channel + custom SLA',
      'Compliance and legal-hold workflows',
      'Advanced integration and governance controls',
      'Enterprise onboarding and solutioning',
    ],
    ctaLabel: 'Contact Sales',
    ctaHref: '/contact-sales',
    ctaDisabled: false,
  },
];

export const planAvailabilityNotice =
  'Only Starter and Enterprise are available right now. Standard and Pro checkout will be enabled once payments are live.';
