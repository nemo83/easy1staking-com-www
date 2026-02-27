import * as React from "react";
import {
  Box,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Typography,
  TextField,
  Divider,
  Autocomplete
} from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import { EASY1_SCOOPER_HASH, SCOOPER_API } from '@/lib/util/Constants';

const EASY1_PKH = EASY1_SCOOPER_HASH;

const ScoopsCsvDownload = () => {
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth() + 1);
  const [downloading, setDownloading] = React.useState(false);

  // Custom report states
  const [scooperPkh, setScooperPkh] = React.useState<string>('');
  const [dateStart, setDateStart] = React.useState<string>('');
  const [dateEnd, setDateEnd] = React.useState<string>('');
  const [downloadingCustom, setDownloadingCustom] = React.useState(false);
  const [scooperList, setScooperList] = React.useState<string[]>([]);

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

  // Fetch scooper list
  React.useEffect(() => {
    fetch(`${SCOOPER_API}/scoops/scoopers`)
      .then(res => res.json())
      .then(data => {
        setScooperList(data);
      })
      .catch(error => {
        console.error('Error fetching scoopers:', error);
      });
  }, []);

  // Create display options with EASY1 label
  const scooperOptions = React.useMemo(() => {
    return scooperList.map(pkh => ({
      value: pkh,
      label: pkh === EASY1_PKH ? 'EASY1' : pkh,
    }));
  }, [scooperList]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const yearMonthParam = `${selectedYear}-${monthStr}`;
      const fileName = `${yearMonthParam}-scoops-aggregated.csv`;

      const response = await fetch(
        `${SCOOPER_API}/scoops/stats/csv?month=${yearMonthParam}`
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
        `${SCOOPER_API}/scoops/csv?${params.toString()}`
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
    <Paper sx={{ width: '100%', maxWidth: 1200, margin: '0 auto', p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" component="div">
          Scooper Reports
        </Typography>
      </Box>

      <Box>
          {/* Monthly Aggregated Report */}
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Monthly Payouts Report
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
            Scoops History
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              freeSolo
              options={scooperOptions}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
              value={scooperPkh}
              onChange={(event, newValue) => {
                if (typeof newValue === 'string') {
                  setScooperPkh(newValue);
                } else if (newValue && newValue.value) {
                  setScooperPkh(newValue.value);
                } else {
                  setScooperPkh('');
                }
              }}
              onInputChange={(event, newInputValue) => {
                setScooperPkh(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Scooper Public Key Hash (optional)"
                  placeholder="Select or enter a scooper PKH"
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.value}>
                  {option.label}
                  {option.label === 'EASY1' && (
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                      ({option.value.substring(0, 8)}...)
                    </Typography>
                  )}
                </li>
              )}
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
    </Paper>
  );
};

export default ScoopsCsvDownload;
