import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  SelectChangeEvent
} from '@mui/material';
import { EASY1STAKING_API } from '@/lib/util/Constants';

type ViewType = 'current-month' | 'last-30' | 'last-90' | 'last-12-months' | 'custom';
type Granularity = 'hour' | 'day' | 'week' | 'month';

type AnalyticsDataPoint = {
  period: string;
  scoops: number;
  orders: number;
  protocol_fee: number;
  transaction_fee: number;
};

type MetricToggles = {
  scoops: boolean;
  orders: boolean;
  protocolFees: boolean;
  transactionFees: boolean;
};

const ProtocolAnalytics = () => {
  const [viewType, setViewType] = React.useState<ViewType>('last-30');
  const [granularity, setGranularity] = React.useState<Granularity>('day');
  const [dateStart, setDateStart] = React.useState<string>('');
  const [dateEnd, setDateEnd] = React.useState<string>('');
  const [data, setData] = React.useState<AnalyticsDataPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<MetricToggles>({
    scoops: true,
    orders: true,
    protocolFees: true,
    transactionFees: true,
  });

  const handleViewTypeChange = (event: SelectChangeEvent<ViewType>) => {
    setViewType(event.target.value as ViewType);
  };

  const handleGranularityChange = (event: SelectChangeEvent<Granularity>) => {
    setGranularity(event.target.value as Granularity);
  };

  const handleMetricToggle = (metric: keyof MetricToggles) => {
    setMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    let apiUrl = '';
    const now = new Date();

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (viewType) {
      case 'current-month':
        apiUrl = `${EASY1STAKING_API}/scoops/analytics/current-month`;
        break;

      case 'last-30':
        const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        apiUrl = `${EASY1STAKING_API}/scoops/analytics/timeseries?date_start=${formatDate(start30)}&date_end=${formatDate(now)}&granularity=day`;
        break;

      case 'last-90':
        const start90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        apiUrl = `${EASY1STAKING_API}/scoops/analytics/timeseries?date_start=${formatDate(start90)}&date_end=${formatDate(now)}&granularity=day`;
        break;

      case 'last-12-months':
        const start12 = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        apiUrl = `${EASY1STAKING_API}/scoops/analytics/monthly?date_start=${formatDate(start12)}&date_end=${formatDate(now)}`;
        break;

      case 'custom':
        if (!dateStart || !dateEnd) {
          setLoading(false);
          return;
        }
        apiUrl = `${EASY1STAKING_API}/scoops/analytics/timeseries?date_start=${dateStart}&date_end=${dateEnd}&granularity=${granularity}`;
        break;
    }

    if (apiUrl) {
      fetch(apiUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((apiData: AnalyticsDataPoint[]) => {
          setData(apiData);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching protocol analytics:', err);
          setError('Failed to load protocol analytics');
          setLoading(false);
        });
    }
  }, [viewType, granularity, dateStart, dateEnd]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Calculate aggregated totals
  const totals = data.reduce(
    (acc, point) => ({
      scoops: acc.scoops + point.scoops,
      orders: acc.orders + point.orders,
      protocolFees: acc.protocolFees + point.protocol_fee,
      transactionFees: acc.transactionFees + point.transaction_fee,
    }),
    { scoops: 0, orders: 0, protocolFees: 0, transactionFees: 0 }
  );

  // Convert fees from lovelace to ADA
  const protocolFeesAda = totals.protocolFees / 1_000_000;
  const transactionFeesAda = totals.transactionFees / 1_000_000;

  // Prepare chart data
  const xAxisData = data.map((point) => {
    const date = new Date(point.period);
    if (viewType === 'last-12-months') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const series = [];
  if (metrics.scoops) {
    series.push({
      data: data.map((point) => point.scoops),
      label: 'Scoops',
      color: '#A855F7',
      yAxisKey: 'leftAxis',
    });
  }
  if (metrics.orders) {
    series.push({
      data: data.map((point) => point.orders),
      label: 'Orders',
      color: '#F070D0',
      yAxisKey: 'leftAxis',
    });
  }
  if (metrics.protocolFees) {
    series.push({
      data: data.map((point) => point.protocol_fee / 1_000_000),
      label: 'Protocol Fees (₳)',
      color: '#EC4899',
      yAxisKey: 'rightAxis',
    });
  }
  if (metrics.transactionFees) {
    series.push({
      data: data.map((point) => point.transaction_fee / 1_000_000),
      label: 'Transaction Fees (₳)',
      color: '#8B5CF6',
      yAxisKey: 'rightAxis',
    });
  }

  return (
    <Box>
      {/* Controls Section */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* View Type Selector */}
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="view-type-label">View Type</InputLabel>
          <Select
            labelId="view-type-label"
            id="view-type-select"
            value={viewType}
            label="View Type"
            onChange={handleViewTypeChange}
          >
            <MenuItem value="current-month">Current Month</MenuItem>
            <MenuItem value="last-30">Last 30 Days</MenuItem>
            <MenuItem value="last-90">Last 90 Days</MenuItem>
            <MenuItem value="last-12-months">Last 12 Months</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </Select>
        </FormControl>

        {/* Custom Range Date Pickers */}
        {viewType === 'custom' && (
          <>
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
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel id="granularity-label">Granularity</InputLabel>
              <Select
                labelId="granularity-label"
                id="granularity-select"
                value={granularity}
                label="Granularity"
                onChange={handleGranularityChange}
              >
                <MenuItem value="hour">Hour</MenuItem>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
              </Select>
            </FormControl>
          </>
        )}

        {/* Metric Toggles */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
            Show Metrics
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={metrics.scoops}
                  onChange={() => handleMetricToggle('scoops')}
                  sx={{
                    color: '#A855F7',
                    '&.Mui-checked': { color: '#A855F7' },
                  }}
                />
              }
              label="Scoops"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={metrics.orders}
                  onChange={() => handleMetricToggle('orders')}
                  sx={{
                    color: '#F070D0',
                    '&.Mui-checked': { color: '#F070D0' },
                  }}
                />
              }
              label="Orders"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={metrics.protocolFees}
                  onChange={() => handleMetricToggle('protocolFees')}
                  sx={{
                    color: '#EC4899',
                    '&.Mui-checked': { color: '#EC4899' },
                  }}
                />
              }
              label="Protocol Fees"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={metrics.transactionFees}
                  onChange={() => handleMetricToggle('transactionFees')}
                  sx={{
                    color: '#8B5CF6',
                    '&.Mui-checked': { color: '#8B5CF6' },
                  }}
                />
              }
              label="Transaction Fees"
            />
          </FormGroup>
        </Paper>
      </Box>

      {/* Chart and Stats Section */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'stretch', width: '100%' }}>
        {/* Chart Section - Left */}
        <Box sx={{ flex: 1 }}>
          {series.length > 0 ? (
            <BarChart
              xAxis={[{ scaleType: 'band', data: xAxisData }]}
              yAxis={[
                { id: 'leftAxis', scaleType: 'linear' },
                { id: 'rightAxis', scaleType: 'linear' },
              ]}
              series={series}
              width={700}
              height={400}
              slotProps={{
                legend: {
                  direction: 'row',
                  position: { vertical: 'top', horizontal: 'middle' },
                  padding: 0,
                },
              }}
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <Typography color="text.secondary">
                Select at least one metric to display
              </Typography>
            </Box>
          )}
        </Box>

        {/* Aggregated Stats - Right */}
        <Paper
          sx={{
            p: 3,
            minWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Aggregated Stats
          </Typography>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Scoops
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#A855F7' }}>
              {totals.scoops.toLocaleString()}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Orders
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#F070D0' }}>
              {totals.orders.toLocaleString()}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Protocol Fees
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#EC4899' }}>
              ₳ {protocolFeesAda.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Transaction Fees
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              ₳ {transactionFeesAda.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ProtocolAnalytics;
