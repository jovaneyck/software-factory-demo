import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export interface Session {
  dogId: string;
  trainingId: string;
  date: string;
  status: 'planned' | 'completed' | 'skipped';
  score?: number;
}

interface ProgressGraphProps {
  sessions: Session[];
}

const formatTickDate = d3.timeFormat('%b %d');

// Colors come from Tailwind token classes (stroke-*/fill-*) so the chart follows the design system.
function styleAxis(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
  g.attr('font-family', 'inherit').attr('font-size', 11);
  g.select('.domain').remove();
  g.selectAll('.tick line').remove();
  g.selectAll('.tick text').attr('fill', null).attr('class', 'fill-ink-subtle');
}

function ProgressGraph({ sessions }: ProgressGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const margin = { top: 12, right: 16, bottom: 28, left: 28 };
    const width = container.clientWidth || 400;
    const height = 260;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'overflow-visible');

    if (sessions.length === 0) return;

    const parseDate = d3.timeParse('%Y-%m-%d');

    const dataPoints = sessions.map((s) => ({
      date: parseDate(s.date)!,
      score: s.score ?? null,
      status: s.status,
    }));

    const completedPoints = dataPoints.filter((d) => d.status === 'completed' && d.score !== null);

    const xExtent = d3.extent(dataPoints, (d) => d.date) as [Date, Date];
    const x = d3
      .scaleTime()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([1, 10])
      .range([height - margin.bottom, margin.top]);

    // Horizontal grid
    svg
      .append('g')
      .selectAll('line')
      .data([2, 4, 6, 8, 10])
      .enter()
      .append('line')
      .attr('class', 'grid-line stroke-line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d));

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom + 8})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((d) => formatTickDate(d as Date)),
      )
      .call(styleAxis);

    svg
      .append('g')
      .attr('transform', `translate(${margin.left - 8},0)`)
      .call(d3.axisLeft(y).tickValues([2, 4, 6, 8, 10]))
      .call(styleAxis);

    // Segments between consecutive completed points: solid, or dashed when sessions were skipped in between
    if (completedPoints.length > 1) {
      const completedIndices = dataPoints
        .map((d, i) => ({ point: d, index: i }))
        .filter((d) => d.point.status === 'completed' && d.point.score !== null);

      for (let i = 0; i < completedIndices.length - 1; i++) {
        const from = completedIndices[i];
        const to = completedIndices[i + 1];

        const hasSkipBetween = dataPoints
          .slice(from.index + 1, to.index)
          .some((d) => d.status === 'skipped');

        const line = svg
          .append('line')
          .attr('x1', x(from.point.date))
          .attr('y1', y(from.point.score!))
          .attr('x2', x(to.point.date))
          .attr('y2', y(to.point.score!))
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round');

        if (hasSkipBetween) {
          line.attr('class', 'skipped stroke-ink-subtle').attr('stroke-dasharray', '2,6');
        } else {
          line.attr('class', 'solid stroke-brand-500');
        }
      }
    }

    svg
      .selectAll('circle.completed')
      .data(completedPoints)
      .enter()
      .append('circle')
      .attr('class', 'completed fill-surface stroke-brand-600')
      .attr('stroke-width', 2.5)
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.score!))
      .attr('r', 5);
  }, [sessions]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} data-testid="progress-graph" />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border-2 border-brand-600 bg-surface" />
          Score (1–10)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-5 border-t-2 border-dotted border-ink-subtle" />
          Skipped in between
        </span>
      </div>
    </div>
  );
}

export default ProgressGraph;
