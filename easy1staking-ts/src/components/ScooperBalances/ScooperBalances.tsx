import * as React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Box,
  Chip,
  CircularProgress,
  Typography,
  IconButton,
  Tooltip,
  Link
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getScooperName, SCOOPER_API } from '@/lib/util/Constants';

type ScooperBalance = {
  pubKeyHash: string;
  enterpriseAddress: string;
  balance: string;
  lastScoop: number | null;
};

type ScooperBalanceRow = {
  pubKeyHash: string;
  address: string;
  name: string;
  balanceLovelace: number;
  balanceAda: number;
  lastScoop: number | null;
};

type Order = 'asc' | 'desc';
type OrderBy = 'pubKeyHash' | 'balanceAda' | 'lastScoop';

const LOVELACE_TO_ADA = 1_000_000;
const LOW_BALANCE_THRESHOLD = 10; // ADA
const WARNING_BALANCE_THRESHOLD = 50; // ADA

const ScooperBalances = () => {
  const [balances, setBalances] = React.useState<ScooperBalanceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<Order>('asc');
  const [orderBy, setOrderBy] = React.useState<OrderBy>('pubKeyHash');
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${SCOOPER_API}/scoopers/balances`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: ScooperBalance[]) => {
        const balanceRows: ScooperBalanceRow[] = data.map((item) => {
          const balanceLovelace = parseInt(item.balance, 10);
          return {
            pubKeyHash: item.pubKeyHash,
            address: item.enterpriseAddress,
            name: getScooperName(item.pubKeyHash),
            balanceLovelace,
            balanceAda: balanceLovelace / LOVELACE_TO_ADA,
            lastScoop: item.lastScoop,
          };
        });

        setBalances(balanceRows);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching scooper balances:', err);
        setError('Failed to load scooper balances');
        setLoading(false);
      });
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedBalances = React.useMemo(() => {
    return [...balances].sort((a, b) => {
      let comparison = 0;
      if (orderBy === 'pubKeyHash') {
        comparison = a.pubKeyHash.localeCompare(b.pubKeyHash);
      } else if (orderBy === 'balanceAda') {
        comparison = a.balanceAda - b.balanceAda;
      } else if (orderBy === 'lastScoop') {
        // Handle null values - put them at the end
        if (a.lastScoop === null && b.lastScoop === null) return 0;
        if (a.lastScoop === null) return 1;
        if (b.lastScoop === null) return -1;
        comparison = a.lastScoop - b.lastScoop;
      }
      return order === 'asc' ? comparison : -comparison;
    });
  }, [balances, order, orderBy]);

  const getLastScoopColor = (lastScoop: number | null): 'success' | 'warning' | 'error' | 'default' => {
    if (!lastScoop) return 'default';
    const now = Date.now();
    const diff = now - lastScoop;
    const hours = diff / (1000 * 60 * 60);

    if (hours < 4) return 'success'; // Green
    if (hours < 12) return 'warning'; // Amber
    return 'error'; // Red
  };

  const formatLastScoop = (lastScoop: number | null): string => {
    if (!lastScoop) return 'Never';

    const now = Date.now();
    const diff = now - lastScoop;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getBalanceColor = (balanceAda: number) => {
    if (balanceAda < LOW_BALANCE_THRESHOLD) return 'error';
    if (balanceAda < WARNING_BALANCE_THRESHOLD) return 'warning';
    return 'success';
  };

  const getBalanceLabel = (balanceAda: number) => {
    if (balanceAda < LOW_BALANCE_THRESHOLD) return 'Low';
    if (balanceAda < WARNING_BALANCE_THRESHOLD) return 'Warning';
    return 'Good';
  };

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

  const totalBalance = balances.reduce((sum, b) => sum + b.balanceAda, 0);

  return (
    <Box>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          Total Balance Across All Scoopers
        </Typography>
        <Typography variant="h4" sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #F070D0 0%, #A855F7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ₳ {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ maxWidth: 1400, margin: '0 auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'pubKeyHash'}
                  direction={orderBy === 'pubKeyHash' ? order : 'asc'}
                  onClick={() => handleRequestSort('pubKeyHash')}
                >
                  Scooper Key Hash
                </TableSortLabel>
              </TableCell>
              <TableCell>Address</TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'balanceAda'}
                  direction={orderBy === 'balanceAda' ? order : 'asc'}
                  onClick={() => handleRequestSort('balanceAda')}
                >
                  Balance (₳)
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === 'lastScoop'}
                  direction={orderBy === 'lastScoop' ? order : 'asc'}
                  onClick={() => handleRequestSort('lastScoop')}
                >
                  Last Scoop
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBalances.map((row) => (
              <TableRow
                key={row.pubKeyHash}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(240, 112, 208, 0.05)'
                  }
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {row.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      ({row.pubKeyHash.substring(0, 8)}...{row.pubKeyHash.substring(row.pubKeyHash.length - 8)})
                    </Typography>
                    <Tooltip title={copiedText === row.pubKeyHash ? 'Copied!' : 'Copy hash'}>
                      <IconButton size="small" onClick={() => handleCopy(row.pubKeyHash)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {row.address.substring(0, 12)}...{row.address.substring(row.address.length - 8)}
                    </Typography>
                    <Tooltip title={copiedText === row.address ? 'Copied!' : 'Copy address'}>
                      <IconButton size="small" onClick={() => handleCopy(row.address)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View on CExplorer">
                      <IconButton
                        size="small"
                        component={Link}
                        href={`https://cexplorer.io/address/${row.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: row.balanceAda < LOW_BALANCE_THRESHOLD ? 'error.main' : 'text.primary'
                    }}
                  >
                    ₳ {row.balanceAda.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getBalanceLabel(row.balanceAda)}
                    color={getBalanceColor(row.balanceAda)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={formatLastScoop(row.lastScoop)}
                    color={getLastScoopColor(row.lastScoop)}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Thresholds: Low &lt; ₳{LOW_BALANCE_THRESHOLD} | Warning &lt; ₳{WARNING_BALANCE_THRESHOLD}
        </Typography>
      </Box>
    </Box>
  );
};

export default ScooperBalances;
