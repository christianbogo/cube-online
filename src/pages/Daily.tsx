import { useMemo } from 'react';
import Tabs from '../components/Tabs';
import Table from '../components/Table';
import { Trophy, Clock, Calendar as CalendarIcon } from 'lucide-react';

export default function Daily() {
    const challengeData = useMemo(() => [
        { id: 1, rank: 1, user: 'SpeedyCube', time: '8.45s', ao5: '9.12s' },
        { id: 2, rank: 2, user: 'Cutter', time: '9.01s', ao5: '9.34s' },
        { id: 3, rank: 3, user: 'CubeMaster', time: '9.15s', ao5: '9.50s' },
    ], []);

    const historyData = useMemo(() => [
        { id: 1, date: '2025-12-23', result: '9.12s', scramble: 'R U R\' U\'' },
        { id: 2, date: '2025-12-22', result: '9.45s', scramble: 'F R U R\' U\' F\'' },
    ], []);

    const columns = [
        { header: 'Rank', accessor: 'rank' as const, className: 'w-16' },
        { header: 'User', accessor: 'user' as const },
        { header: 'Best Time', accessor: 'time' as const },
        { header: 'Ao5', accessor: 'ao5' as const },
    ];

    const historyColumns = [
        { header: 'Date', accessor: 'date' as const },
        { header: 'Result', accessor: 'result' as const },
        { header: 'Scramble', accessor: 'scramble' as const },
    ];

    const tabs = [
        {
            id: 'challenge',
            label: "Today's Challenge",
            content: (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                        <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-accent" /> Daily Scramble
                        </h3>
                        <p className="font-mono text-xl text-center bg-bg-primary p-4 rounded border border-border/50 text-text-primary">
                            D2 F2 U' L2 B2 D F2 U B2 D' L2 F L B' D L2 U2 F R2 B2
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
                        </h3>
                        <Table data={challengeData} columns={columns} />
                    </div>
                </div>
            )
        },
        {
            id: 'history',
            label: 'My History',
            content: (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" /> Past Results
                    </h3>
                    <Table data={historyData} columns={historyColumns} />
                </div>
            )
        }
    ];

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Daily Challenge</h2>
            <Tabs tabs={tabs} />
        </div>
    );
}
