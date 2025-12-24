import { Box, BarChart2, Radio, Sun, Moon, Monitor, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface LeftSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

const navItems = [
    { name: 'Cube', icon: Box },
    { name: 'Live', icon: Radio },
    { name: 'Data', icon: BarChart2 },
];

export default function LeftSidebar({ collapsed, onToggleCollapse }: LeftSidebarProps) {
    const { theme, setTheme } = useTheme();

    return (
        <nav className="h-full bg-bg-secondary flex flex-col select-none w-full transition-colors duration-200">
            {/* Navigation Items */}
            <ul className="flex flex-col gap-1 px-2 pt-2 flex-1">
                {navItems.map((item) => (
                    <li key={item.name}>
                        <button
                            className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors hover:bg-bg-hover text-left ${collapsed ? 'justify-center' : ''
                                }`}
                        >
                            <item.icon className="w-5 h-5 text-text-secondary" />
                            {!collapsed && (
                                <span className="text-sm font-medium text-text-primary">
                                    {item.name}
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>

            {/* Bottom Actions */}
            <div className="p-2 border-t border-border flex flex-col gap-2">

                {/* Theme Selector */}
                {!collapsed ? (
                    <div className="flex items-center justify-between bg-bg-hover rounded-md p-1 border border-border/50">
                        <button
                            onClick={() => setTheme("light")}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all ${theme === 'light' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="Light Mode"
                        >
                            <Sun className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setTheme("system")}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all ${theme === 'system' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="System Mode"
                        >
                            <Monitor className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setTheme("dark")}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all ${theme === 'dark' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="Dark Mode"
                        >
                            <Moon className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    // Collapsed Theme Toggle (Cycle)
                    <button
                        onClick={() => {
                            if (theme === 'light') setTheme('dark');
                            else if (theme === 'dark') setTheme('system');
                            else setTheme('light');
                        }}
                        className="w-full flex justify-center p-2 rounded-md hover:bg-bg-hover transition-colors"
                        title={`Current Theme: ${theme}`}
                    >
                        {theme === 'light' && <Sun className="w-5 h-5 text-text-secondary" />}
                        {theme === 'dark' && <Moon className="w-5 h-5 text-text-secondary" />}
                        {theme === 'system' && <Monitor className="w-5 h-5 text-text-secondary" />}
                    </button>
                )}

                {/* Collapse Button */}
                <button
                    onClick={onToggleCollapse}
                    className={`w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary`}
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>
        </nav>
    );
}
