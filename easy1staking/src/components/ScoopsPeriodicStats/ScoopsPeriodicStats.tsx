import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { getScooperName, SCOOPER_API } from '@/lib/util/Constants';

type ScoopStats = {
    period: string;
    selectedScoops: number;
    otherScoops: number;
};

interface BasicBarsProps {
    selectedPool?: string;
    timePeriod?: number;
}

const BasicBars = ({ selectedPool = 'all', timePeriod = 7 }: BasicBarsProps) => {
    const [stats, setStats] = React.useState<ScoopStats[]>([]);
    const [poolName, setPoolName] = React.useState<string>('');

    React.useEffect(() => {
        (async () => {
            const date = new Date();

            if (selectedPool === 'all') {
                // For "all", we'll show aggregated data
                // Get the top scooper and show total scoops trend
                fetch(`${SCOOPER_API}/scoops/stats/P1D`)
                    .then((res) => res.json())
                    .then((apiData) => {
                        // Get the top scooper to show its trend
                        const topScooper = apiData.scooper_stats.sort((a: any, b: any) =>
                            b.total_scoops - a.total_scoops
                        )[0];

                        if (topScooper) {
                            return fetch(`${SCOOPER_API}/scoops/stats/scooper/${topScooper.pub_key_hash}?period_length=${timePeriod}`)
                                .then((res) => res.json())
                                .then((data) => {
                                    const stats = data.map((stat: any) => {
                                        const periodDate = new Date();
                                        periodDate.setDate(date.getDate() + stat.period);

                                        return {
                                            period: periodDate.toLocaleDateString(undefined, {month: "short", day: "numeric"}),
                                            selectedScoops: stat.totalNumberScoops,
                                            otherScoops: 0
                                        };
                                    });

                                    setPoolName('All Pools (Total)');
                                    setStats(stats.reverse());
                                });
                        }
                    });
            } else {
                // Show specific pool vs others
                fetch(`${SCOOPER_API}/scoops/stats/scooper/${selectedPool}?period_length=${timePeriod}`)
                    .then((res) => res.json())
                    .then((data) => {
                        const stats = data.map((stat: any) => {
                            const periodDate = new Date();
                            periodDate.setDate(date.getDate() + stat.period);

                            return {
                                period: periodDate.toLocaleDateString(undefined, {month: "short", day: "numeric"}),
                                selectedScoops: stat.scooperNumberScoops,
                                otherScoops: stat.totalNumberScoops - stat.scooperNumberScoops
                            };
                        });

                        setPoolName(getScooperName(selectedPool));
                        setStats(stats.reverse());
                    });
            }
        })();
    }, [selectedPool, timePeriod]);

    return (
        <BarChart
            xAxis={[{ scaleType: 'band', data: stats.map(stat => stat.period) }]}
            series={
                selectedPool === 'all'
                    ? [{ label: poolName, data: stats.map(stat => stat.selectedScoops), stack: 'total' }]
                    : [
                        { label: poolName, data: stats.map(stat => stat.selectedScoops), stack: 'total' },
                        { label: 'Others', data: stats.map(stat => stat.otherScoops), stack: 'total' },
                    ]
            }
            width={500}
            height={300}
        />
    );
}

export default BasicBars;
