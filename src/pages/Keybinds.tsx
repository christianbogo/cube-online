import { Keyboard, Home, User, Database, Activity } from 'lucide-react';

export default function Keybinds() {
    const keybinds = [
        { key: 'Space', action: 'Start/Stop Timer', icon: <Activity className="w-4 h-4" /> },
        { key: 'Esc', action: 'Home / Reset', icon: <Home className="w-4 h-4" /> },
        { key: 'Tab', action: 'Toggle Right Sidebar', icon: <Database className="w-4 h-4" /> },
        { key: 'Shift', action: 'Toggle Left Sidebar', icon: <Database className="w-4 h-4" /> },
        { key: 's', action: 'Go to Data', icon: <Database className="w-4 h-4" /> },
        { key: 'e / d', action: 'Go to Store', icon: <Keyboard className="w-4 h-4" /> },
        { key: 'g', action: 'Go to Guide / Mechanics', icon: <Keyboard className="w-4 h-4" /> },
        { key: 'a', action: 'Go to Account', icon: <User className="w-4 h-4" /> },
        { key: 'c', action: 'Go Home', icon: <Home className="w-4 h-4" /> },
        { key: '?', action: 'Go to Keybinds', icon: <Keyboard className="w-4 h-4" /> },
    ];

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Keyboard className="w-8 h-8" /> Keybinds
                </h1>
                <p className="text-text-secondary">Keyboard shortcuts for navigating Cube Online.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keybinds.map((kb, i) => (
                    <div key={i} className="flex items-center justify-between bg-bg-secondary/50 border border-border p-4 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="text-accent bg-accent/10 p-2 rounded-lg">
                                {kb.icon}
                            </div>
                            <span className="font-medium text-text-primary">{kb.action}</span>
                        </div>
                        <kbd className="px-3 py-1 bg-bg-tertiary border border-border rounded-lg text-sm font-mono font-bold text-text-primary shadow-sm min-w-[2rem] text-center">
                            {kb.key}
                        </kbd>
                    </div>
                ))}
            </div>
        </div>
    );
}
