import * as React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';

const props = {
    width: 500,
    height: 200,
};

type ScoopStats = {
    easy1Scoops: number;
    easy1ScoopsPct: number;
    totalScoops: number;
};

const ScoopsPies = () => {

    const [stats, setStats] = React.useState<ScoopStats>({easy1Scoops: 0, easy1ScoopsPct: 0, totalScoops: 0});

    React.useEffect(() => {

        (async () => {

            fetch('https://scooper-api.easy1staking.com/scoops/stats/P1D')
                .then((res) => res.json())
                .then((data) => {
                    const easy1Stats = data.scooper_stats.find((stats: any) => stats.pub_key_hash == '37eb116b3ff8a70e4be778b5e8d30d3b40421ffe6622f6a983f67f3f');
                    
                    const easy1Scoops: number = easy1Stats == null ? 0 : easy1Stats.total_scoops;

                    const stats: ScoopStats = {
                        easy1Scoops: easy1Scoops,
                        easy1ScoopsPct: easy1Scoops / data.total_scoops * 100,
                        totalScoops: data.total_scoops - easy1Scoops
                    }
                    console.log('stats: ' + JSON.stringify(stats))
                    setStats(stats);

                });

        })();

    }, [])


    return (
        <PieChart
            {...props}
            series={[
                {
                    data: [
                        { id: 0, value: stats.easy1Scoops, label: 'EASY1' },
                        { id: 1, value: stats.totalScoops, label: 'Other' },
                    ],
                    type: 'pie',
                    arcLabel: 'label',
                    innerRadius: 30,
                    outerRadius: 100,
                    paddingAngle: 3,
                    cornerRadius: 5
                },
            ]}
        />
    );
}

export default ScoopsPies;

