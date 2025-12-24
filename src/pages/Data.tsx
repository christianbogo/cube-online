import { useMemo } from 'react';
import Tabs from '../components/Tabs';
import Table from '../components/Table';
import { BarChart2, Hash, Activity } from 'lucide-react';

export default function Data() {
    const solvesData = useMemo(() => [
        { id: 1, time: '8.45s', scramble: 'R U R\' U\'', date: 'Just now' },
        { id: 2, time: '9.12s', scramble: 'F R U R\' U\' F\'', date: '2m ago' },
        { id: 3, time: '10.05s', scramble: 'U2 R2 F2', date: '5m ago' },
    ], []);

    const averagesData = useMemo(() => [
        { id: 1, type: 'Ao5', result: '9.20s', best: '8.90s' },
        { id: 2, type: 'Ao12', result: '9.50s', best: '9.10s' },
        { id: 3, type: 'Ao100', result: '10.10s', best: '9.80s' },
    ], []);

    const solveColumns = [
        { header: 'Time', accessor: 'time' as const },
        { header: 'Scramble', accessor: 'scramble' as const, className: 'font-mono text-xs' },
        { header: 'Date', accessor: 'date' as const },
    ];

    const averageColumns = [
        { header: 'Type', accessor: 'type' as const },
        { header: 'Current', accessor: 'result' as const },
        { header: 'Best', accessor: 'best' as const },
    ];

    const tabs = [
        {
            id: 'solves',
            label: 'Individual Solves',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Hash className="w-5 h-5 text-accent" /> Recent Solves
                    </h3>
                    <Table data={solvesData} columns={solveColumns} />
                </div>
            )
        },
        {
            id: 'averages',
            label: 'Statistics',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-500" /> Averages
                    </h3>
                    <Table data={averagesData} columns={averageColumns} />
                </div>
            )
        },
        {
            id: 'graphs',
            label: 'Progress',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-green-500" /> Improvement Graph
                    </h3>
                    <div className="h-64 w-full bg-bg-secondary border border-border rounded-lg flex items-center justify-center text-text-secondary">
                        Graph Placeholder (D3/Recharts implementation later)
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Data Analysis</h2>
            <Tabs tabs={tabs} />
        </div>
    );
}
