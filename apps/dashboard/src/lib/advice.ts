function fmtMoneyMYR(minor: number) {
  const v = (minor ?? 0) / 100;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(v);
}

export function buildAdvice(input: { question: string; month: string; overview: any }) {
  const { question, month, overview } = input;

  const tbb = Number(overview?.budget?.toBeBudgeted?.available ?? 0);
  const underfundedTotal = Number(overview?.goals?.underfundedTotal ?? 0);
  const topUnder = (overview?.goals?.topUnderfunded ?? []).slice(0, 3);

  const dueSoon = Number(overview?.schedules?.counts?.dueSoon ?? 0);
  const topDue = (overview?.schedules?.topDue ?? []).slice(0, 2);

  const liquid = Number(overview?.netWorth?.liquid ?? 0);
  const cashflow = overview?.reports?.cashflow;
  const net = Number(cashflow?.net ?? 0);

  const lines: string[] = [];
  lines.push(`Question: ${question || '(none)'}`);
  lines.push(`Month: ${month}`);
  lines.push('');

  lines.push(`To Be Budgeted: ${fmtMoneyMYR(tbb)}.`);
  lines.push(`Liquid cash: ${fmtMoneyMYR(liquid)}. Month net: ${fmtMoneyMYR(net)}.`);

  if (underfundedTotal > 0) {
    lines.push(`You’re underfunded by ${fmtMoneyMYR(underfundedTotal)} across targets.`);
    if (topUnder.length) {
      lines.push(`Top underfunded: ${topUnder.map((t: any) => `${t.name} (${fmtMoneyMYR(Number(t.underfunded ?? 0))})`).join(', ')}.`);
    }
  } else {
    lines.push('No underfunded targets detected.' );
  }

  if (dueSoon > 0 && topDue.length) {
    lines.push(`Upcoming: ${topDue.map((d: any) => `${d.name} on ${d.date} (${fmtMoneyMYR(Number(d.amount ?? 0))})`).join(', ')}.`);
  }

  // Tone: Pixel, but not overdoing it.
  if (tbb <= 0 && underfundedTotal > 0) {
    lines.push('If this purchase is discretionary, you’re basically trying to sprint with your shoelaces tied. Fund targets first or pick a smaller plan.');
  } else {
    lines.push('If you tell me the purchase amount + payment style (cash/installments), I can simulate the impact next.');
  }

  return lines.join('\n');
}
