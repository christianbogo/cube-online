const fs = require('fs');

let content = fs.readFileSync('src/pages/Logs.tsx', 'utf8');

// 1. Add firestore imports
content = content.replace(
  "import { useMemo, useState, useEffect, useCallback } from 'react';",
  "import { useMemo, useState, useEffect, useCallback } from 'react';\nimport { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';"
);
content = content.replace(
  "import { functions } from '../lib/firebase';",
  "import { db, functions } from '../lib/firebase';"
);

// 2. Add userStats to useSolves
content = content.replace(
  "const { solves, updateSolve, deleteSolve } = useSolves();",
  "const { solves, updateSolve, deleteSolve, userStats } = useSolves();"
);

// 3. Remove displayCount and add serverTableSolves state
content = content.replace(
  "    const [displayCount, setDisplayCount] = useState(50);",
  `    const [serverTableSolves, setServerTableSolves] = useState<Solve[]>([]);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [hasMoreTable, setHasMoreTable] = useState(true);
    const [isMigratingStats, setIsMigratingStats] = useState(false);

    useEffect(() => {
        if (!user || !settings.scrambleType) return;
        setServerTableSolves([]);
        setLastVisible(null);
        setHasMoreTable(true);
        fetchTableSolves(true, null);
    }, [user, settings.scrambleType, sortConfig.key, sortConfig.direction]);

    const fetchTableSolves = async (reset: boolean, cursor: any) => {
        if (!user || !settings.scrambleType) return;
        setLoadingTable(true);
        try {
            let q = query(
                collection(db, 'solves'),
                where('userId', '==', user.uid),
                where('scrambleType', '==', settings.scrambleType)
            );

            if (sortConfig.key === 'date') {
                q = query(q, orderBy('date', sortConfig.direction));
            } else if (sortConfig.key === 'time') {
                q = query(q, orderBy('time', sortConfig.direction));
            }

            if (!reset && cursor) {
                q = query(q, startAfter(cursor));
            }

            q = query(q, limit(50));

            const snapshot = await getDocs(q);
            const newSolves = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Solve));
            
            if (snapshot.docs.length > 0) {
                setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
                setHasMoreTable(snapshot.docs.length === 50);
            } else {
                setHasMoreTable(false);
            }

            if (reset) {
                setServerTableSolves(newSolves);
            } else {
                setServerTableSolves(prev => {
                    const existingIds = new Set(prev.map(s => s.id));
                    const uniqueNew = newSolves.filter(s => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
            }
        } catch (e) {
            console.error("Error fetching solves", e);
        } finally {
            setLoadingTable(false);
        }
    };

    const handleMigrateStats = async () => {
        setIsMigratingStats(true);
        try {
            const migrateFn = httpsCallable(functions, 'backfillUserStats');
            await migrateFn();
            alert("Migration complete! Reloading page...");
            window.location.reload();
        } catch (err) {
            console.error("Failed to migrate stats", err);
            alert("Failed to migrate stats");
        } finally {
            setIsMigratingStats(false);
        }
    };

    const needsMigration = userStats && (
        !userStats.totalSolvesCount || 
        userStats.totalSolvesCount === 100
    );`
);

// 4. Update tableSolves dependency (remove the whole useMemo for tableSolves)
// wait, I can just remove it using regex, but easier to just comment it out or let it be unused.
// Let's replace `tableSolves` references in the file.
content = content.replace(/tableSolves/g, "serverTableSolves");

// 5. Update index column in solvesColumns
content = content.replace(
  "header: '#', accessor: (_: any, i: number) => serverTableSolves.length - i,",
  "header: '#', accessor: (_: any, i: number) => i + 1,"
);

// 6. Update Table component props for Section 4
content = content.replace(
  "data={serverTableSolves.slice(0, displayCount)}",
  "data={serverTableSolves}"
);

// 7. Update the Load More button logic
const loadMoreBlockOriginal = `{displayCount < serverTableSolves.length && (
                            <button
                                onClick={() => setDisplayCount(prev => prev + 50)}
                                className="w-full py-3 mt-2 rounded-lg bg-surface-elevation-1 border border-border/80 hover:bg-bg-hover text-sm font-semibold text-text-primary transition-colors"
                            >
                                Load More
                            </button>
                        )}`;

const loadMoreBlockNew = `{hasMoreTable && (
                            <button
                                onClick={() => fetchTableSolves(false, lastVisible)}
                                disabled={loadingTable}
                                className="w-full py-3 mt-2 rounded-lg bg-surface-elevation-1 border border-border/80 hover:bg-bg-hover text-sm font-semibold text-text-primary transition-colors disabled:opacity-50"
                            >
                                {loadingTable ? "Loading..." : "Load More"}
                            </button>
                        )}`;

content = content.replace(loadMoreBlockOriginal, loadMoreBlockNew);

// 8. Add Banner to UI
const bannerJSX = `
            {needsMigration && (
                <div className="mx-2 mt-2 sm:mx-4 sm:mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-yellow-500">Data Migration Required</h4>
                            <p className="text-xs text-yellow-500/80 mt-0.5">
                                We've updated how stats are calculated. Since you have an older account, please run the one-time migration to see all your historical data properly.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleMigrateStats} 
                        disabled={isMigratingStats}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                        {isMigratingStats ? "Migrating..." : "Run Migration"}
                    </button>
                </div>
            )}
`;

content = content.replace(
  '<div className="flex-1 flex flex-row overflow-hidden relative">',
  '<div className="flex-1 flex flex-col overflow-hidden relative">' + bannerJSX + '<div className="flex-1 flex flex-row overflow-hidden relative">'
);
content = content.replace(
  '            <div className="flex-1 flex flex-row overflow-hidden relative">', // closing tag adjustment
  '            </div>\n        </div>' // Need to ensure balance. Let's do it carefully.
);

fs.writeFileSync('src/pages/Logs.tsx.new', content);
