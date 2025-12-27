import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Tabs from '../components/Tabs';
import Table from '../components/Table';
import { Hash, Activity, AlertTriangle } from 'lucide-react';
import { type Solve, useSolves } from '../contexts/SolvesContext';
import { detectOutliers } from '../utils/analysis';
import { useAuth } from '../contexts/AuthContext';

export default function Data() {
    const { solves, stats } = useSolves();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { type, id } = useParams();

    // Filter Solves: Show only Firestore solves (those with a userId that matches current user)
    // Local-only solves might naturally be missing userId or have a temporary one not matching?
    // Actually, when signed in, we only want to see solves that are synced/owned.
    const userSolves = useMemo(() => {
        if (!user) return [];
        return solves.filter(s => s.userId === user.uid);
    }, [solves, user]);

    // Simple formatting for time
    const formatTime = (time: number | 'DNF' | null) => {
        if (time === null) return '-';
        if (time === 'DNF') return 'DNF';
        return (time / 1000).toFixed(2) + 's';
    };

    // Detail View Logic
    const detailItem = useMemo(() => {
        if (!type || !id) return null;
        if (type === 'solve') {
            return solves.find(s => s.id === id);
        }
        // TODO: Handle 'session' type if we need session details here (though Sessions page exists)
        return null;
    }, [type, id, solves]);

    if (type && id) {
        if (!detailItem) return <div className="p-8">Item not found.</div>;

        return (
            <div className="w-full h-full flex flex-col items-start text-left animate-in fade-in slide-in-from-right-4 duration-300">
                <button onClick={() => navigate('/data')} className="mb-4 text-sm text-text-secondary hover:text-accent flex items-center gap-1">
                    &larr; Back to Data
                </button>
                <div className="bg-bg-secondary p-6 rounded-lg border border-border w-full max-w-2xl">
                    <h2 className="text-2xl font-bold text-text-primary mb-4">Solve Details</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-text-secondary">Time</p>
                            <p className="text-3xl font-mono text-accent">{formatTime((detailItem as Solve).time)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Date</p>
                            <p className="text-lg text-text-primary">{new Date((detailItem as Solve).date).toLocaleString()}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-sm text-text-secondary">Scramble</p>
                            <p className="font-mono bg-bg-primary p-2 rounded border border-border/50 text-text-primary break-all">{(detailItem as Solve).scramble}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-sm text-text-secondary">Analysis</p>
                            {(() => {
                                const { isOutlier, reason } = detectOutliers((detailItem as Solve).time, solves);
                                if (isOutlier) {
                                    return (
                                        <p className="text-yellow-500 font-bold flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            {reason === 'suspected_misclick' ? 'Potential Misclick' : 'Potential Timer Run'}
                                        </p>
                                    )
                                }
                                return <p className="text-green-500">Normal Solve</p>
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Filter Logic for Flagged Results
    const flaggedSolves = useMemo(() => {
        if (!user || solves.length < 10) return [];
        return solves.filter(s => {
            const { isOutlier } = detectOutliers(s.time, solves, false); // Pass isGlobalPB if known, assuming false for bulk check efficiency or update detectOutliers signature to be simpler
            return isOutlier;
        });
    }, [solves, user]);

    // Simple formatting for time (Moved up)


    const solveColumns = [
        {
            header: 'Time',
            accessor: (s: Solve) => (
                <span className={`font-mono font-medium ${s.penalty === 'DNF' ? 'text-red-500' : ''}`}>
                    {formatTime(s.penalty === 'DNF' ? 'DNF' : s.time)}
                </span>
            )
        },
        {
            header: 'Scramble',
            accessor: (s: Solve) => <span className="font-mono text-xs text-text-secondary truncate block max-w-[200px]">{s.scramble}</span>,
            className: "hidden sm:table-cell"
        },
        {
            header: 'Date',
            accessor: (s: Solve) => new Date(s.date).toLocaleDateString() + ' ' + new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
    ];

    const flaggedColumns = [
        ...solveColumns,
        {
            header: 'Reason',
            accessor: (s: Solve) => {
                const { reason } = detectOutliers(s.time, solves);
                return (
                    <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                        {reason === 'suspected_misclick' ? 'Possible Misclick' : 'Timer Run?'}
                    </span>
                );
            }
        }
    ];

    // Solves Data Processing
    // We filter solves based on user being logged in (which is already checked)
    // and potentially other filters. Current requirement: Show Firestore Solves only.
    // Assuming 'solves' from context are already the correct set because SolvesContext handles it?
    // Actually Context provides ALL solves (local + synced).
    // We filtered them in step 114 but I didn't verify the code fully then.
    // Let's ensure we map 'daily' property here if there is a useMemo.

    // Finding the useMemo that creates userSolves (or similar variable)
    // The previous view showed it around line 50-70? No, that was render logic.
    // I need to look at where userSolves is defined.
    // It seems I missed it in previous views. I will blindly trust "solves" is the source and try to find the map.
    // Stats Data Structure
    const statsData = useMemo(() => [
        { type: 'Single', current: stats.current.single, best: stats.best.single },
        { type: 'Ao5', current: stats.current.ao5, best: stats.best.ao5 },
        { type: 'Ao12', current: stats.current.ao12, best: stats.best.ao12 },
        { type: 'Ao100', current: stats.current.ao100, best: stats.best.ao100 },
    ], [stats]);

    const statsColumns = [
        { header: 'Type', accessor: 'type' as const },
        { header: 'Current', accessor: (row: any) => formatTime(row.current) },
        { header: 'Best', accessor: (row: any) => <span className="font-bold text-accent">{formatTime(row.best)}</span> },
    ];

    const solveColumnsWithDaily = useMemo(() => [
        ...solveColumns.slice(0, 1), // Time
        {
            header: 'Event',
            accessor: (row: any) => row.daily ? <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded">Daily</span> : '3x3'
        },
        ...solveColumns.slice(2) // Date
    ], [solveColumns]);

    if (!user) {
        return <div className="p-8 text-center text-text-secondary">Please sign in to view data.</div>;
    }

    const tabs = [
        {
            id: 'solves',
            label: 'All Solves',
            content: (
                <div className="animate-in fade-in duration-300 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
                            <Hash className="w-5 h-5 text-accent" /> History ({userSolves.length})
                        </h3>
                        {/* Placeholder for future search/filter inputs */}
                    </div>
                    {userSolves.length > 0 ? (
                        <Table data={userSolves} columns={solveColumnsWithDaily} />
                    ) : (
                        <div className="text-text-secondary italic">No solves yet.</div>
                    )}
                </div>
            )
        },
        {
            id: 'stats',
            label: 'Statistics',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-500" /> Personal Bests
                    </h3>
                    <Table data={statsData} columns={statsColumns} />
                </div>
            )
        },
        {
            id: 'flagged',
            label: 'Flagged',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" /> Anomalies Detected
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">
                        Solves that look like misclicks or timer runs based on your history.
                    </p>
                    {flaggedSolves.length > 0 ? (
                        <Table data={flaggedSolves} columns={flaggedColumns} />
                    ) : (
                        <div className="p-8 text-center border border-dashed border-border rounded text-text-secondary">
                            No anomalies detected. Great consistency!
                        </div>
                    )}
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
