type FlatEl = { key: string; parentKey?: string; type: string; props: any };

function flatToTree(elements: FlatEl[]) {
  const elementMap: Record<string, any> = {};
  let root = "";

  for (const el of elements) {
    elementMap[el.key] = {
      type: el.type,
      props: el.props,
      children: [],
    };
  }

  for (const el of elements) {
    if (el.parentKey) {
      const parent = elementMap[el.parentKey];
      if (parent) parent.children.push(el.key);
    } else {
      root = el.key;
    }
  }

  return { root, elements: elementMap };
}

export function buildSummarySpec(input: {
  title: string;
  subtitle?: string;
  month: string;
  question?: string;
  adviceText?: string;
  overview: any;
}) {
  const { title, subtitle, month, question, adviceText, overview } = input;

  const els: FlatEl[] = [];
  els.push({ key: "page", type: "Page", props: { title, subtitle } });

  // Query section
  els.push({ key: "sec_q", parentKey: "page", type: "Section", props: { title: "Query" } });
  if (question) {
    els.push({ key: "q_callout", parentKey: "page", type: "Callout", props: { tone: "info", title: "Question", message: question } });
  }

  // Pixel take
  if (adviceText) {
    els.push({ key: "advice", parentKey: "page", type: "Card", props: { title: "Pixel’s take" } });
    els.push({ key: "advice_text", parentKey: "advice", type: "Callout", props: { tone: "info", message: adviceText } });
  }

  // Snapshot
  const tbb = Number(overview?.budget?.toBeBudgeted?.available ?? 0);
  const liquid = Number(overview?.netWorth?.liquid ?? 0);
  const nw = Number(overview?.netWorth?.total ?? 0);
  const cf = overview?.reports?.cashflow;

  els.push({ key: "snap", parentKey: "page", type: "Card", props: { title: "Snapshot", description: month } });
  els.push({ key: "m_tbb", parentKey: "snap", type: "MetricRow", props: { label: "To Be Budgeted", value: String(tbb), tone: tbb < 0 ? "bad" : tbb === 0 ? "warn" : "good" } });
  els.push({ key: "m_liquid", parentKey: "snap", type: "MetricRow", props: { label: "Liquid", value: String(liquid) } });
  els.push({ key: "m_nw", parentKey: "snap", type: "MetricRow", props: { label: "Net worth", value: String(nw) } });
  els.push({ key: "m_inc", parentKey: "snap", type: "MetricRow", props: { label: "Income", value: String(cf?.income ?? 0) } });
  els.push({ key: "m_exp", parentKey: "snap", type: "MetricRow", props: { label: "Expense", value: String(cf?.expense ?? 0) } });
  els.push({ key: "m_net", parentKey: "snap", type: "MetricRow", props: { label: "Net", value: String(cf?.net ?? 0), tone: Number(cf?.net ?? 0) >= 0 ? "good" : "bad" } });

  return flatToTree(els as any);
}
