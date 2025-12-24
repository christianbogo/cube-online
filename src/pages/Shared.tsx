import { useMemo } from 'react';
import Tabs from '../components/Tabs';
import Table from '../components/Table';
import { Users, TrendingUp } from 'lucide-react';

export default function Shared() {
    const recentData = useMemo(() => [
        { id: 1, user: 'UnknownCuber', puzzle: '3x3', time: '12.33s', date: 'Just now' },
        { id: 2, user: 'SpeedDemon', puzzle: '2x2', time: '1.45s', date: '2m ago' },
        { id: 3, user: 'Cutter', puzzle: '4x4', time: '45.12s', date: '5m ago' },
    ], []);

    const popularData = useMemo(() => [
        { id: 1, user: 'WorldChamp', views: '1.2k', puzzle: '3x3', time: '3.47s' },
        { id: 2, user: 'Feliks', views: '900', puzzle: '3x3', time: '4.22s' },
    ], []);

    const columns = [
        { header: 'User', accessor: 'user' as const },
        { header: 'Puzzle', accessor: 'puzzle' as const },
        { header: 'Time', accessor: 'time' as const },
        { header: 'Date', accessor: 'date' as const },
    ];

    const popularColumns = [
        { header: 'User', accessor: 'user' as const },
        { header: 'Views', accessor: 'views' as const },
        { header: 'Puzzle', accessor: 'puzzle' as const },
        { header: 'Time', accessor: 'time' as const },
    ];

    const tabs = [
        {
            id: 'recent',
            label: 'Recent Solves',
            content: (
                <div className="animate-in fade-in duration-300">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
                            <Users className="w-5 h-5 text-accent" /> Community Activity
                        </h3>
                    </div>
                    <Table data={recentData} columns={columns} />
                </div>
            )
        },
        {
            id: 'popular',
            label: 'Popular',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" /> Trending Solves
                    </h3>
                    <Table data={popularData} columns={popularColumns} />
                </div>
            )
        }
    ];

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Shared Solves</h2>
            <Tabs tabs={tabs} />
        </div>
    );
}
