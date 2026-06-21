import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Box } from '@mui/material';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import axios from 'axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API_BASE = 'http://localhost:8000/api';

export default function LanguageAnalytics() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}/languages`).then(res => setData(res.data)).catch(console.error);
  }, []);

  if (!data.length) return <CircularProgress />;

  const labels = data.map(d => d.language);
  const counts = data.map(d => d.repo_count);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Repositories',
        data: counts,
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'
        ]
      }
    ]
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>Language Analytics</Typography>
      <Box display="flex" justifyContent="space-around" flexWrap="wrap">
        <Box width="400px" mb={4}>
          <Typography variant="h6" align="center">Language Distribution</Typography>
          <Pie data={chartData} />
        </Box>
        <Box width="600px">
          <Typography variant="h6" align="center">Repository Count by Language</Typography>
          <Bar data={chartData} />
        </Box>
      </Box>
    </div>
  );
}
