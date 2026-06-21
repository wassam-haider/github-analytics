import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box } from '@mui/material';
import axios from 'axios';
import PredictWidget from '../components/PredictWidget';

const API_BASE = 'http://localhost:8000/api';

export default function RepositoryHealth() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}/health`).then(res => setData(res.data)).catch(console.error);
  }, []);

  if (!data.length) return (
    <div>
      <Typography variant="h4" gutterBottom>Repository Health</Typography>
      <Box mb={4}>
        <PredictWidget />
      </Box>
      <Typography>No health data available yet. Please run the ETL pipeline.</Typography>
    </div>
  );

  return (
    <div>
      <Typography variant="h4" gutterBottom>Repository Health</Typography>
      
      <Box mb={4}>
        <PredictWidget />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Repository Name</TableCell>
              <TableCell align="right">Health Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={row.name}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell align="right">{row.health_score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
