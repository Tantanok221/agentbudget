export type DashboardSection =
  | { id: 'snapshot' }
  | { id: 'top_spending' }
  | { id: 'goals' }
  | { id: 'schedules' }
  | { id: 'accounts' }
  | { id: 'agent_response' };

export function buildDashboardViewModel(input: {
  q: string;
  month: string;
  overview: any;
}) {
  const { q, overview } = input;

  const sections: DashboardSection[] = [];
  sections.push({ id: 'snapshot' });
  sections.push({ id: 'top_spending' });

  if (overview?.goals) sections.push({ id: 'goals' });
  if (overview?.schedules) sections.push({ id: 'schedules' });
  if (overview?.accounts?.list?.length) sections.push({ id: 'accounts' });

  // Always include; content comes later (LLM response, recommendations, etc.)
  sections.push({ id: 'agent_response' });

  return { question: q, sections };
}
