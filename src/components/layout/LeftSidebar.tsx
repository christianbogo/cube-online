import { Box, BarChart2, Sun, Moon, Monitor, ChevronLeft, ChevronRight, Keyboard, Target } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSolves } from '../../contexts/SolvesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmationContext';

export interface LeftSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

const navItems = [
    { name: 'Cube', icon: Box, path: '/' },
    { name: 'Logs', icon: BarChart2, path: '/logs' },
    { name: 'Goals', icon: Target, path: '/goals' },
    { name: 'Binds', icon: Keyboard, path: '/keybinds' },
];

export default function LeftSidebar({ collapsed, onToggleCollapse }: LeftSidebarProps) {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();

    const { isPrivateMode, togglePrivateMode } = useSolves();
    const { confirm: confirmAction } = useConfirm();
    const navigate = useNavigate();

    const handleNavClick = async (e: React.MouseEvent, path: string) => {
        if (isPrivateMode) {
            e.preventDefault();
            if (await confirmAction('Leave Private Mode?')) {
                togglePrivateMode();
                navigate(path);
            }
        }
    };

    return (
        <nav className="h-full bg-bg-secondary flex flex-col select-none w-full transition-colors duration-200">
            {/* Navigation Items */}
            <ul className="flex flex-col gap-1 px-2 pt-2 flex-1">
                {navItems.map((item) => {
                    const isItemLocked = (!user && ['Logs'].includes(item.name));

                    return (
                        <li key={item.name}>
                            <NavLink
                                to={isItemLocked ? '#' : item.path}
                                onClick={(e) => {
                                    if (isItemLocked) {
                                        e.preventDefault();
                                        return;
                                    }
                                    handleNavClick(e, item.path);
                                }}
                                className={({ isActive }) => `
                                w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left
                                ${(isActive && !isItemLocked)
                                        ? 'bg-accent/10 text-accent'
                                        : isItemLocked
                                            ? 'opacity-30 cursor-not-allowed text-text-secondary'
                                            : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
                                    }
                                ${collapsed ? 'justify-center' : ''}
                            `}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={`w-5 h-5 ${(isActive && !isItemLocked) ? 'text-accent' : 'text-text-secondary'}`} />
                                        {!collapsed && (
                                            <span className={`text-sm font-medium ${(isActive && !isItemLocked) ? 'text-accent' : 'text-text-primary'}`}>
                                                {item.name}
                                            </span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        </li>
                    )
                })}
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
