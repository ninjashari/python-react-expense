import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Box, Typography } from '@mui/material';
import { InvestmentTimelineEvent } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface InvestmentTimelineChartProps {
  events: InvestmentTimelineEvent[]; // ascending date order
  title?: string;
}

/**
 * Plots each Group B category's running_principal_after (already computed server-side by the
 * replay algorithm) as its own step series over time — "how much principal was deployed in this
 * category, at any point in time". Group A isn't charted here since it's a real tracked balance,
 * already shown in the accounts table above.
 */
const InvestmentTimelineChart: React.FC<InvestmentTimelineChartProps> = ({ events, title = 'Currently Invested Over Time (by Category)' }) => {
  const { labels, datasets } = useMemo(() => {
    const groupBEvents = events.filter(e => e.group === 'B' && e.category_id);

    const dateSet = new Set<string>();
    groupBEvents.forEach(e => dateSet.add(e.date));
    const sortedDates = Array.from(dateSet).sort();

    const byCategory = new Map<string, { name: string; color: string; valueByDate: Map<string, number> }>();
    groupBEvents.forEach(e => {
      const key = e.category_id as string;
      if (!byCategory.has(key)) {
        byCategory.set(key, { name: e.category_name || 'Category', color: e.category_color || '#1976d2', valueByDate: new Map() });
      }
      // If multiple events land on the same date, the last one (ascending order) wins.
      byCategory.get(key)!.valueByDate.set(e.date, e.running_principal_after ?? 0);
    });

    const datasets = Array.from(byCategory.entries()).map(([categoryId, info]) => {
      let lastValue = 0;
      const data = sortedDates.map(d => {
        if (info.valueByDate.has(d)) {
          lastValue = info.valueByDate.get(d)!;
        }
        return lastValue;
      });
      return {
        label: info.name,
        data,
        borderColor: info.color,
        backgroundColor: info.color,
        stepped: true as const,
        tension: 0,
        pointRadius: 3,
      };
    });

    return { labels: sortedDates.map(d => formatDate(d)), datasets };
  }, [events]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: { callback: (value) => formatCurrency(Number(value)) },
      },
    },
  };

  if (datasets.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">No category investment activity for the selected filters</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom textAlign="center">
        {title}
      </Typography>
      <Line data={{ labels, datasets }} options={options} />
    </Box>
  );
};

export default InvestmentTimelineChart;
