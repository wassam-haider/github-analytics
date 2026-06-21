import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export default function Overview() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/overview`).then(res => setData(res.data)).catch(console.error);
  }, []);

  if (!data) return <CircularProgress />;

  const cards = [
    { title: 'Repositories Analyzed', value: data.repositories },
    { title: 'Total Contributors', value: data.contributors },
    { title: 'Total Commits', value: data.commits },
    { title: 'Total Issues', value: data.issues },
  ];

  return (
    <div>
      <Typography variant="h4" gutterBottom>Platform Overview</Typography>
      <Grid container spacing={4}>
        {cards.map(c => (
          <Grid item xs={12} sm={6} md={3} key={c.title}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>{c.title}</Typography>
                <Typography variant="h3">{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}
