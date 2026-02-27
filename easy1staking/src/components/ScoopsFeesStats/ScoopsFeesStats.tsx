import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { EASY1STAKING_API } from '@/lib/util/Constants';

interface ScoopsFeesStatsProps {
    timePeriod?: number;
}

type StatsData = {
    total_scoops: number;
    total_orders: number;
    total_protocol_fee: number;
    total_transaction_fee: number;
    total_num_mempool_orders: number;
};

const ScoopsFeesStats = ({ timePeriod = 7 }: ScoopsFeesStatsProps) => {
    const [stats, setStats] = React.useState<StatsData | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        setLoading(true);
        const duration = `P${timePeriod}D`;

        fetch(`${EASY1STAKING_API}/scoops/stats/${duration}`)
            .then((res) => res.json())
            .then((data: StatsData) => {
                setStats(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching fees stats:', error);
                setLoading(false);
            });
    }, [timePeriod]);

    if (loading || !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    // Convert protocol fee from lovelace to ADA
    const protocolFeeAda = stats.total_protocol_fee / 1_000_000;
    const transactionFeeAda = stats.total_transaction_fee / 1_000_000;

    return (
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'stretch', width: '100%' }}>
            {/* Chart Section - Left */}
            <Box sx={{ flex: 1 }}>
                <BarChart
                    xAxis={[{ scaleType: 'band', data: ['Orders', 'Scoops', 'Protocol Fees (₳)'] }]}
                    series={[
                        {
                            data: [stats.total_orders, stats.total_scoops, protocolFeeAda],
                            color: '#F070D0',
                        }
                    ]}
                    width={600}
                    height={300}
                />
            </Box>

            {/* Aggregated Stats - Right */}
            <Paper
                sx={{
                    p: 3,
                    minWidth: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2
                }}
            >
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    Aggregated Stats
                </Typography>

                <Box>
                    <Typography variant="caption" color="text.secondary">
                        Total Orders
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#F070D0' }}>
                        {stats.total_orders.toLocaleString()}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary">
                        Total Scoops
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#A855F7' }}>
                        {stats.total_scoops.toLocaleString()}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary">
                        Protocol Fees
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#F070D0' }}>
                        ₳ {protocolFeeAda.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary">
                        Transaction Fees
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        ₳ {transactionFeeAda.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary">
                        Mempool Orders
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {stats.total_num_mempool_orders.toLocaleString()}
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
};

export default ScoopsFeesStats;
