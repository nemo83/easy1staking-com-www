import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Divider,
  Chip,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { SCOOPER_API } from '@/lib/util/Constants';

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
  const now = new Date();
  const [selectedYear, setSelectedYear] = React.useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(now.getMonth()); // 0-indexed
  const [data, setData] = React.useState<AnalyticsDataPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<MetricToggles>({
    scoops: true,
    orders: true,
    protocolFees: true,
    transactionFees: true,
  });

  const handleMetricToggle = (metric: keyof MetricToggles) => {
    setMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  const handlePreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const currentDate = new Date();
    const isCurrentMonth = selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth();

    if (isCurrentMonth) {
      return; // Can't go into the future
    }

    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Check if we're viewing the current month
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let apiUrl = '';

    if (isCurrentMonth) {
      // Use current-month endpoint for the current month
      apiUrl = `${SCOOPER_API}/scoops/analytics/current-month`;
    } else {
      // Use timeseries endpoint with daily granularity for past months
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of selected month
      // Add 1 day to end date since API treats end_date as exclusive
      endDate.setDate(endDate.getDate() + 1);
      apiUrl = `${SCOOPER_API}/scoops/analytics/timeseries?date_start=${formatDate(startDate)}&date_end=${formatDate(endDate)}&granularity=day`;
    }

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
  }, [selectedYear, selectedMonth, isCurrentMonth]);

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
  const protocolProfitAda = protocolFeesAda - transactionFeesAda;

  // Calculate profit distribution
  const sundaeLabsShare = protocolProfitAda * 0.16;
  const sundaeTokenHoldersShare = protocolProfitAda * 0.15;
  const qusdmShare = protocolProfitAda * 0.15;

  // Determine which scooper regime is active
  const fiftyPercentShare = protocolProfitAda * 0.50;
  const baseFormulaShare = 20000 + protocolProfitAda * 0.10;
  const scoopersBaseShare = Math.min(fiftyPercentShare, baseFormulaShare);
  const scoopersPercentage = (scoopersBaseShare / protocolProfitAda) * 100;
  const isCapActive = fiftyPercentShare <= baseFormulaShare;

  // Get month name for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const displayMonthYear = `${monthNames[selectedMonth]} ${selectedYear}`;

  // Prepare chart data - always show day and month for daily breakdown
  const xAxisData = data.map((point) => {
    const date = new Date(point.period);
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
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Month Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handlePreviousMonth} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center', fontWeight: 600 }}>
            {displayMonthYear}
          </Typography>
          <IconButton onClick={handleNextMonth} color="primary" disabled={isCurrentMonth}>
            <ArrowForwardIcon />
          </IconButton>
        </Box>

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
            <Tooltip title="Profit before removing transaction fees, which must be repaid to scoopers" arrow>
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                Protocol Fees ⓘ
              </Typography>
            </Tooltip>
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

          <Box>
            <Tooltip title="Protocol Fees minus Transaction Fees (which are repaid to scoopers)" arrow>
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                Protocol Profit ⓘ
              </Typography>
            </Tooltip>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#10B981' }}>
              ₳ {protocolProfitAda.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
            Profit Distribution
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Sundae Labs (16%)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₳ {sundaeLabsShare.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                SUNDAE Holders (15%)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₳ {sundaeTokenHoldersShare.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                qUSDM (15%)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₳ {qusdmShare.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Tooltip title="min(50%, 20k ADA + 10%)" arrow>
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                    Scoopers ({scoopersPercentage.toFixed(1)}%) ⓘ
                  </Typography>
                </Tooltip>
                <Chip
                  label={isCapActive ? "50% Cap Active" : "Base Formula (20k + 10%)"}
                  size="small"
                  color={isCapActive ? "warning" : "success"}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    width: 'fit-content'
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₳ {scoopersBaseShare.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default ProtocolAnalytics;
