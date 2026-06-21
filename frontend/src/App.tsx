import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import Overview from './pages/Overview';
import LanguageAnalytics from './pages/LanguageAnalytics';
import TopContributors from './pages/TopContributors';
import RepositoryHealth from './pages/RepositoryHealth';

function App() {
  return (
    <Router>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              GitHub Analytics Platform
            </Typography>
            <Button color="inherit" component={Link} to="/">Overview</Button>
            <Button color="inherit" component={Link} to="/languages">Languages</Button>
            <Button color="inherit" component={Link} to="/contributors">Contributors</Button>
            <Button color="inherit" component={Link} to="/health">Repo Health</Button>
          </Toolbar>
        </AppBar>
        <Container sx={{ mt: 4 }}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/languages" element={<LanguageAnalytics />} />
            <Route path="/contributors" element={<TopContributors />} />
            <Route path="/health" element={<RepositoryHealth />} />
          </Routes>
        </Container>
      </Box>
    </Router>
  );
}

export default App;
