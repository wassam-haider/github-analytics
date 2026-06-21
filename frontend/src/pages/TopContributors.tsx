import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export default function TopContributors() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}/contributors`).then(res => setData(res.data)).catch(console.error);
  }, []);

  if (!data.length) return <CircularProgress />;

  return (
    <div>
      <Typography variant="h4" gutterBottom>Top Contributors</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Username</TableCell>
              <TableCell align="right">Productivity Score (or Contributions)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={row.username}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.username}</TableCell>
                <TableCell align="right">{row.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
