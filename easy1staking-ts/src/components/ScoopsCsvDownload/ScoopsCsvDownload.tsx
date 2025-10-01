import * as React from "react";
import {
  Box,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Collapse,
  Typography,
  IconButton,
  TextField,
  Divider
} from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '@mui/material/styles';

const ExpandMore = styled((props: any) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

const ScoopsCsvDownload = () => {
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth() + 1);
  const [downloading, setDownloading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // Custom report states
  const [scooperPkh, setScooperPkh] = React.useState<string>('');
  const [dateStart, setDateStart] = React.useState<string>('');
  const [dateEnd, setDateEnd] = React.useState<string>('');
  const [downloadingCustom, setDownloadingCustom] = React.useState(false);

  // Generate years from 2024 to current year
  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2024;
    return Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
  }, []);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearMonthParam = `${selectedYear}-${monthStr}`;
      const fileName = `${yearMonthParam}-scoops-aggregated.csv`;

      const response = await fetch(
        `https://scooper-api.easy1staking.com/scoops/stats/csv?month=${yearMonthParam}`
      );

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download CSV. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCustomDownload = async () => {
    setDownloadingCustom(true);
    try {
      const params = new URLSearchParams();

      if (scooperPkh) {
        params.append('scooper_pub_key_hash', scooperPkh);
      }

      if (dateStart) {
        params.append('date_start', dateStart);
      }

      if (dateEnd) {
        params.append('date_end', dateEnd);
      }

      const fileName = `scoops-custom-${dateStart || 'all'}-to-${dateEnd || 'all'}.csv`;

      const response = await fetch(
        `https://scooper-api.easy1staking.com/scoops/csv?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading custom CSV:', error);
      alert('Failed to download CSV. Please try again.');
    } finally {
      setDownloadingCustom(false);
    }
  };

  return (
    <Paper sx={{ width: '100%', maxWidth: 1200, margin: '2rem auto' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Reports
        </Typography>
        <ExpandMore
          expand={expanded}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </ExpandMore>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ p: 3, pt: 0 }}>
          {/* Monthly Aggregated Report */}
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Monthly Aggregated Report
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel id="year-select-label">Year</InputLabel>
              <Select
                labelId="year-select-label"
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value as number)}
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel id="month-select-label">Month</InputLabel>
              <Select
                labelId="month-select-label"
                value={selectedMonth}
                label="Month"
                onChange={(e) => setSelectedMonth(e.target.value as number)}
              >
                {months.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
              sx={{ minWidth: 150 }}
            >
              {downloading ? 'Downloading...' : 'Download CSV'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Custom Date Range Report */}
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Custom Date Range Report
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Scooper Public Key Hash (optional)"
              value={scooperPkh}
              onChange={(e) => setScooperPkh(e.target.value)}
              placeholder="37eb116b3ff8a70e4be778b5e8d30d3b40421ffe6622f6a983f67f3f"
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Start Date"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              />
              <TextField
                label="End Date"
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 200 }}
              />
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleCustomDownload}
                disabled={downloadingCustom}
                sx={{ minWidth: 150 }}
              >
                {downloadingCustom ? 'Downloading...' : 'Download CSV'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ScoopsCsvDownload;
