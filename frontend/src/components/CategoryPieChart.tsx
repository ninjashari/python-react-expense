import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from 'chart.js';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Option } from './MultiSelectDropdown';
import { formatCurrency } from '../utils/formatters';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryData {
  id: string;
  name: string;
  color: string;
  total_amount: number;
  transaction_count: number;
  average_amount: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  title: string;
  transactionType: 'income' | 'expense';
  startDate?: string;
  endDate?: string;
  accountIds: Option[];
  grandTotal: number;
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  title,
  transactionType,
  startDate,
  endDate,
  accountIds,
  grandTotal,
}) => {
  const navigate = useNavigate();

  // Prepare chart data
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        data: data.map(item => Math.abs(item.total_amount)),
        backgroundColor: data.map(item => item.color),
        borderColor: '#fff',
        borderWidth: 2,
      },
    ],
  };

  // Chart options
  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 15,
          padding: 10,
          font: {
            size: 11,
          },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels?.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i] as number;
                const percentage = ((value / grandTotal) * 100).toFixed(1);
                const bgColors = data.datasets[0].backgroundColor as string[];
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: bgColors[i],
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'pie'>) => {
            const item = data[context.dataIndex];
            const value = Math.abs(item.total_amount);
            const percentage = ((value / grandTotal) * 100).toFixed(1);
            return [
              `Amount: ${formatCurrency(value)}`,
              `Count: ${item.transaction_count} transactions`,
              `Average: ${formatCurrency(item.average_amount)}`,
              `Percentage: ${percentage}%`,
            ];
          },
        },
      },
    },
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const category = data[index];

        // Set filters in localStorage
        const newFilters = {
          startDate,
          endDate,
          accountIds: accountIds || [],
          categoryIds: [{ value: category.id, label: category.name }],
          excludeCategoryIds: [],
          payeeIds: [],
          excludePayeeIds: [],
          transactionTypeIds: [
            { value: transactionType, label: transactionType.charAt(0).toUpperCase() + transactionType.slice(1) }
          ],
          excludeAccounts: false,
          excludeTypes: false,
          sortBy: 'date',
          sortOrder: 'desc' as const,
          page: 1,
          size: 50,
        };

        localStorage.setItem('filtered-transactions-filters', JSON.stringify(newFilters));
        navigate('/reports');
      }
    },
  };

  if (data.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">
          No {transactionType} data available for the selected period
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom textAlign="center">
        {title}
      </Typography>
      <Box sx={{ maxWidth: 500, margin: '0 auto' }}>
        <Pie data={chartData} options={options} />
      </Box>
    </Box>
  );
};

export default CategoryPieChart;
