export interface ContactSalesPayload {
  name: string;
  workEmail: string;
  company: string;
  teamSize: '1-25' | '26-100' | '101-500' | '500+';
  message: string;
  source?: string;
}

export async function submitContactSalesLead(payload: ContactSalesPayload): Promise<void> {
  const res = await fetch('/api/public/contact-sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to submit contact sales request');
  }
}
