import { Keyboard, Home, Activity, Box, Sparkles } from 'lucide-react';

interface KeybindCategory {
    title: string;
    description: string;
    icon: React.ReactNode;
    binds: { key: string; action: string; note?: string }[];
}

export default function Keybinds() {
    const categories: KeybindCategory[] = [
        {
            title: 'Navigation',
            description: 'Move quickly between pages and toggle panels',
            icon: <Home className="w-5 h-5" />,
            binds: [
                { key: 'Esc', action: 'Home / Reset Timer' },
                { key: 'b', action: 'Go to Keybinds' },
                { key: 'g', action: 'Go to Goals' },
                { key: 'l', action: 'Go to Logs' },
                { key: 'a', action: 'Go to Account' },
                { key: 'Tab', action: 'Toggle Right Sidebar' },
                { key: 'Shift', action: 'Toggle Left Sidebar' },
            ]
        },
        {
            title: 'Timer Controls',
            description: 'Start, stop, and penalty shortcuts',
            icon: <Activity className="w-5 h-5" />,
            binds: [
                { key: 'Space', action: 'Start / Stop Timer', note: 'Hold to prime' },
                { key: 'd', action: 'DNF Penalty', note: 'Within 5s after solve' },
                { key: 'f', action: '+2 Penalty (Fault)', note: 'Within 5s after solve' },
            ]
        },
        {
            title: 'Scrambler Hotkeys',
            description: 'Quickly switch active puzzle event',
            icon: <Box className="w-5 h-5" />,
            binds: [
                { key: '2 - 7', action: 'NxN Puzzles (2x2 to 7x7)' },
                { key: '1', action: 'Square-1 Scramble' },
                { key: 'c', action: 'Clock Scramble' },
                { key: 'm', action: 'Megaminx Scramble' },
                { key: 'p', action: 'Pyraminx Scramble' },
                { key: 's', action: 'Skewb Scramble' },
            ]
        },
        {
            title: 'Hidden & Power-User Features',
            description: 'Extra shortcuts for stats and session filtering',
            icon: <Sparkles className="w-5 h-5" />,
            binds: [
                { key: 'Click "Best"', action: 'Toggle Right Bar Best / Session Stats' },
                { key: 'Click Session', action: 'Filter Solves Table in Logs Sidebar' },
            ]
        }
    ];

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 select-none">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
                    <div className="p-2 bg-accent/10 text-accent rounded-xl">
                        <Keyboard className="w-8 h-8" />
                    </div>
                    Keybinds & Shortcuts
                </h1>
                <p className="text-text-secondary text-sm">
                    Master keyboard shortcuts and power-user actions to navigate and practice faster on Cube Online.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {categories.map((cat) => (
                    <div
                        key={cat.title}
                        className="bg-bg-secondary/60 border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm"
                    >
                        <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
                            <div className="text-accent">
                                {cat.icon}
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-text-primary">
                                    {cat.title}
                                </h2>
                                <p className="text-[11px] text-text-secondary">
                                    {cat.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {cat.binds.map((kb, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between bg-bg-primary/60 border border-border/70 px-3.5 py-2.5 rounded-xl hover:border-accent/30 transition-colors"
                                >
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <span className="font-medium text-xs text-text-primary truncate">
                                            {kb.action}
                                        </span>
                                        {kb.note && (
                                            <span className="text-[10px] text-text-secondary opacity-75">
                                                {kb.note}
                                            </span>
                                        )}
                                    </div>
                                    <kbd className="px-2.5 py-1 bg-bg-tertiary border border-border rounded-lg text-xs font-mono font-bold text-text-primary shadow-sm min-w-[2.2rem] text-center shrink-0">
                                        {kb.key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
