import { useState, useEffect } from 'react';
import { Box, BarChart2, Sun, Moon, Monitor, ChevronLeft, ChevronRight, Keyboard, Target, Users, Lock, CodeXml, ShieldCheck, Swords, Construction } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGoals } from '../../contexts/GoalsContext';
import { isAdmin } from '../../utils/admin';

export interface LeftSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

interface NavItem {
    name: string;
    icon: React.ElementType;
    path: string;
    locked?: boolean;
    underConstruction?: boolean;
}

const defaultNavItems: NavItem[] = [
    { name: 'Cube', icon: Box, path: '/' },
    { name: 'Logs', icon: BarChart2, path: '/logs' },
    { name: 'Goals', icon: Target, path: '/goals' },
    { name: 'Arena', icon: Swords, path: '/arena', underConstruction: true },
    { name: 'Social', icon: Users, path: '/social' },
    { name: 'Dev', icon: CodeXml, path: '/dev' },
    { name: 'Binds', icon: Keyboard, path: '/keybinds' },
];

const guestNavItems: NavItem[] = [
    { name: 'Cube', icon: Box, path: '/' },
    { name: 'Social', icon: Users, path: '/social' },
    { name: 'Binds', icon: Keyboard, path: '/keybinds' },
    { name: 'Logs', icon: BarChart2, path: '/logs' },
    { name: 'Goals', icon: Target, path: '/goals' },
    { name: 'Arena', icon: Swords, path: '/arena', underConstruction: true },
    { name: 'Dev', icon: CodeXml, path: '/dev' },
];

export default function LeftSidebar({ collapsed, onToggleCollapse }: LeftSidebarProps) {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();
    const { hasUnseenGoals } = useGoals();
    const isDev = import.meta.env.DEV;
    const userIsAdmin = isAdmin(user);
    const canAccessArena = isDev || userIsAdmin;

    const navItems = user ? defaultNavItems : guestNavItems;

    const location = useLocation();
    const navigate = useNavigate();

    // Floating temporary popup for locked items
    const [popupState, setPopupState] = useState<{ x: number; y: number; visible: boolean } | null>(null);

    const handleLockedClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).blur();

        const x = Math.min(e.clientX + 10, window.innerWidth - 220);
        const y = Math.max(10, Math.min(e.clientY - 15, window.innerHeight - 60));

        setPopupState({ x, y, visible: true });
    };

    useEffect(() => {
        if (!popupState?.visible) return;
        const timer = setTimeout(() => {
            setPopupState(null);
        }, 2500);
        return () => clearTimeout(timer);
    }, [popupState]);

    const handleNavClick = (e: React.MouseEvent) => {
        (e.currentTarget as HTMLElement).blur();
    };

    return (
        <nav className="h-full bg-bg-secondary flex flex-col select-none w-full transition-colors duration-200">
            {/* Temporary Popup on Locked Click */}
            {popupState?.visible && (
                <div
                    style={{ top: popupState.y, left: popupState.x }}
                    onClick={() => {
                        setPopupState(null);
                        navigate('/account', { state: { mode: 'signup' } });
                    }}
                    className="fixed z-50 bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-2xl flex items-center cursor-pointer hover:border-accent hover:bg-zinc-800 transition-all animate-in fade-in zoom-in-95 pointer-events-auto"
                >
                    <span className="whitespace-nowrap">Create Free Account to Access</span>
                </div>
            )}

            {/* Navigation Items */}
            <ul className="flex flex-col gap-1 px-2 pt-2 flex-1">
                {navItems.map((item) => {
                    const isUnderConstruction = (!!item.underConstruction || item.name === 'Arena') && !(item.name === 'Arena' && canAccessArena);
                    const isItemLocked = !isUnderConstruction && (!!item.locked || (!user && ['Logs', 'Goals', 'Dev', ...(canAccessArena && !isDev ? ['Arena'] : [])].includes(item.name)));

                    return (
                        <li key={item.name} className="relative group">
                            <NavLink
                                to={isUnderConstruction || isItemLocked ? '#' : item.path}
                                onClick={(e) => {
                                    if (isUnderConstruction) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                    }
                                    if (isItemLocked) {
                                        handleLockedClick(e);
                                        return;
                                    }
                                    if (item.path === '/social' && location.pathname.startsWith('/social') && location.pathname !== '/social') {
                                        e.preventDefault();
                                        navigate('/social');
                                    }
                                    handleNavClick(e);
                                }}
                                title={isUnderConstruction ? 'Under Construction' : isItemLocked ? `${item.name} (Requires Account)` : item.name}
                                className={({ isActive }) => `
                                w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left outline-none focus:outline-none select-none
                                ${isUnderConstruction
                                        ? 'opacity-40 cursor-not-allowed text-text-secondary'
                                        : (isActive && !isItemLocked)
                                            ? 'bg-accent/10 text-accent'
                                            : isItemLocked
                                                ? 'opacity-40 hover:opacity-60 cursor-pointer text-text-secondary'
                                                : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
                                    }
                                ${collapsed ? 'justify-center' : ''}
                            `}
                            >
                                {({ isActive }) => (
                                    <>
                                        <div className="relative shrink-0 flex items-center justify-center">
                                            <item.icon className={`w-5 h-5 ${(!isUnderConstruction && isActive && !isItemLocked) ? 'text-accent' : 'text-text-secondary'}`} />
                                            {item.name === 'Goals' && hasUnseenGoals && collapsed && (
                                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-text-primary ring-2 ring-bg-secondary" />
                                            )}
                                        </div>
                                        {!collapsed && (
                                            <div className="flex-1 flex items-center justify-between min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`text-sm font-medium ${(!isUnderConstruction && isActive && !isItemLocked) ? 'text-accent' : 'text-text-primary'} truncate`}>
                                                        {item.name}
                                                    </span>
                                                    {item.name === 'Goals' && hasUnseenGoals && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-text-primary shrink-0" title="New goal unlocked!" />
                                                    )}
                                                </div>
                                                {isItemLocked && (
                                                    <Lock className="w-3.5 h-3.5 text-text-secondary/70 shrink-0 ml-1.5" />
                                                )}
                                                {isUnderConstruction && (
                                                    <Construction className="w-3.5 h-3.5 text-text-secondary/70 shrink-0 ml-1.5" />
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </NavLink>
                            {isUnderConstruction && (
                                <div className={`
                                    absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150
                                    ${collapsed
                                        ? 'left-full ml-2.5 top-1/2 -translate-y-1/2'
                                        : 'left-1/2 -translate-x-1/2 bottom-full mb-1.5'
                                    }
                                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                                    bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold shadow-2xl whitespace-nowrap
                                `}>
                                    <Construction className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Under Construction</span>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            {/* Privacy Link (Bottom of Nav, Above Theme Actions) */}
            <div className="px-3 pb-1.5 flex items-center justify-center">
                <NavLink
                    to="/privacy"
                    onClick={(e) => handleNavClick(e)}
                    title="Privacy Policy"
                    className={({ isActive }) => `
                        text-[11px] text-text-secondary/70 hover:text-text-primary transition-colors outline-none focus:outline-none truncate
                        ${isActive ? 'text-accent font-medium' : ''}
                        ${collapsed ? 'p-1' : ''}
                    `}
                >
                    {collapsed ? (
                        <ShieldCheck className="w-4 h-4 text-text-secondary/70 hover:text-text-primary" />
                    ) : (
                        <span>Privacy Policy</span>
                    )}
                </NavLink>
            </div>

            {/* Bottom Actions */}
            <div className="p-2 border-t border-border flex flex-col gap-2">
                {/* Theme Selector */}
                {!collapsed ? (
                    <div className="flex items-center justify-between bg-bg-hover rounded-md p-1 border border-border/50">
                        <button
                            onClick={(e) => {
                                (e.currentTarget as HTMLElement).blur();
                                setTheme("light");
                            }}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all outline-none focus:outline-none ${theme === 'light' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="Light Mode"
                        >
                            <Sun className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                (e.currentTarget as HTMLElement).blur();
                                setTheme("system");
                            }}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all outline-none focus:outline-none ${theme === 'system' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="System Mode"
                        >
                            <Monitor className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                (e.currentTarget as HTMLElement).blur();
                                setTheme("dark");
                            }}
                            className={`flex-1 p-1 rounded-sm flex justify-center transition-all outline-none focus:outline-none ${theme === 'dark' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            title="Dark Mode"
                        >
                            <Moon className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    // Collapsed Theme Toggle (Cycle)
                    <button
                        onClick={(e) => {
                            (e.currentTarget as HTMLElement).blur();
                            if (theme === 'light') setTheme('dark');
                            else if (theme === 'dark') setTheme('system');
                            else setTheme('light');
                        }}
                        className="w-full flex justify-center p-2 rounded-md hover:bg-bg-hover transition-colors outline-none focus:outline-none"
                        title={`Current Theme: ${theme}`}
                    >
                        {theme === 'light' && <Sun className="w-5 h-5 text-text-secondary" />}
                        {theme === 'dark' && <Moon className="w-5 h-5 text-text-secondary" />}
                        {theme === 'system' && <Monitor className="w-5 h-5 text-text-secondary" />}
                    </button>
                )}

                {/* Collapse Button */}
                <button
                    onClick={(e) => {
                        (e.currentTarget as HTMLElement).blur();
                        onToggleCollapse();
                    }}
                    className={`w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary outline-none focus:outline-none`}
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
