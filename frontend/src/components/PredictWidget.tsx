import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, CircularProgress } from '@mui/material';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export default function PredictWidget() {
  const [repoId, setRepoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    if (!repoId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API_BASE}/predict/${repoId}`);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to get prediction. Ensure ML model is trained and loaded.');
    }
    setLoading(false);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>Repository Growth Prediction (ML)</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Enter a Repository ID to predict its expected stars next month based on our DagsHub-hosted Random Forest model.
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mt={2}>
          <TextField 
            label="Repository ID" 
            variant="outlined" 
            size="small" 
            value={repoId} 
            onChange={(e) => setRepoId(e.target.value)} 
          />
          <Button variant="contained" color="primary" onClick={handlePredict} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Predict'}
          </Button>
        </Box>
        {result && (
          <Box mt={2}>
            <Typography variant="body1"><strong>Current Stars:</strong> {result.current_stars}</Typography>
            <Typography variant="body1"><strong>Expected Next Month:</strong> {result.expected_stars_next_month}</Typography>
          </Box>
        )}
        {error && (
          <Box mt={2}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
