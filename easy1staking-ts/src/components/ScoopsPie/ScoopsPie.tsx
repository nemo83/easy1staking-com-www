import * as React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { getScooperName, EASY1STAKING_API } from '@/lib/util/Constants';

const props = {
    width: 500,
    height: 250,
};

type ScooperStat = {
    pub_key_hash: string;
    total_scoops: number;
};

type PieDataItem = {
    id: number;
    value: number;
    label: string;
    hash: string;
};

interface ScoopsPiesProps {
    selectedPool?: string;
    timePeriod?: number;
}

const ScoopsPies = ({ selectedPool, timePeriod = 7 }: ScoopsPiesProps) => {
    const [pieData, setPieData] = React.useState<PieDataItem[]>([]);
    const TOP_K = 5;

    React.useEffect(() => {
        (async () => {
            // Convert days to ISO duration format (P7D, P14D, etc.)
            const duration = `P${timePeriod}D`;
            fetch(`${EASY1STAKING_API}/scoops/stats/${duration}`)
                .then((res) => res.json())
                .then((data) => {
                    const scooperStats: ScooperStat[] = data.scooper_stats;

                    // Sort by total_scoops descending
                    const sortedStats = [...scooperStats].sort((a, b) => b.total_scoops - a.total_scoops);

                    if (selectedPool && selectedPool !== 'all') {
                        // Show only selected pool vs others
                        const selectedStat = sortedStats.find(s => s.pub_key_hash === selectedPool);
                        const selectedScoops = selectedStat?.total_scoops || 0;
                        const otherScoops = data.total_scoops - selectedScoops;

                        setPieData([
                            {
                                id: 0,
                                value: selectedScoops,
                                label: getScooperName(selectedPool),
                                hash: selectedPool
                            },
                            {
                                id: 1,
                                value: otherScoops,
                                label: 'Others',
                                hash: 'others'
                            }
                        ]);
                    } else {
                        // Show top K pools + others
                        const topPools = sortedStats.slice(0, TOP_K);
                        const otherPools = sortedStats.slice(TOP_K);
                        const otherScoops = otherPools.reduce((sum, stat) => sum + stat.total_scoops, 0);

                        const chartData: PieDataItem[] = topPools.map((stat, index) => ({
                            id: index,
                            value: stat.total_scoops,
                            label: getScooperName(stat.pub_key_hash),
                            hash: stat.pub_key_hash
                        }));

                        if (otherScoops > 0) {
                            chartData.push({
                                id: TOP_K,
                                value: otherScoops,
                                label: 'Others',
                                hash: 'others'
                            });
                        }

                        setPieData(chartData);
                    }
                });
        })();
    }, [selectedPool, timePeriod]);

    return (
        <PieChart
            {...props}
            series={[
                {
                    data: pieData,
                    type: 'pie',
                    arcLabel: 'label',
                    innerRadius: 30,
                    outerRadius: 100,
                    paddingAngle: 3,
                    cornerRadius: 5,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                },
            ]}
        />
    );
}

export default ScoopsPies;

