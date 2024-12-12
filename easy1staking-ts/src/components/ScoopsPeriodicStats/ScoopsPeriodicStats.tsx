import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';

type ScoopStats = {
    period: string;
    easy1Scoops: number;
    totalScoops: number;
};

const BasicBars = () => {

    const [stats, setStats] = React.useState<ScoopStats[]>([]);

    React.useEffect(() => {

        (async () => {

            const date = new Date()

            fetch('https://scooper-api.easy1staking.com/scoops/stats/scooper/37eb116b3ff8a70e4be778b5e8d30d3b40421ffe6622f6a983f67f3f')
                .then((res) => res.json())
                .then((data) => {

                    const stats = data.map((stat: any) => {
                        const periodDate = new Date();
                        periodDate.setDate(date.getDate() - Math.abs(stat.period) - 1)
                            
                        return {
                            period: periodDate.toLocaleDateString(undefined, {month: "short", day: "numeric"}),
                            easy1Scoops: stat.scooperNumberScoops,
                            totalScoops: stat.totalNumberScoops - stat.scooperNumberScoops
                        }

                    })

                    setStats(stats.reverse());

                });

        })();

    }, [])

    return (
        <BarChart
            xAxis={[{ scaleType: 'band', data: stats.map(stat => stat.period) }]}
            series={[
                { label: 'EASY1', data: stats.map(stat => stat.easy1Scoops) }, 
                { label: 'Other', data: stats.map(stat => stat.totalScoops) }, 
            ]}
            width={500}
            height={300}
        />
    );
}

export default BasicBars;
