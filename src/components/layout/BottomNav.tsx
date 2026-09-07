import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BarChart2, Target, Users, User, Lock, Box, Swords, Construction } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdmin } from '../../utils/admin';

export default function BottomNav() {
    const { user } = useAuth();
    const isDev = import.meta.env.DEV;
    const userIsAdmin = isAdmin(user);
    const canAccessArena = isDev || userIsAdmin;

    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { name: 'Cube', icon: Box, path: '/' },
        { name: 'Logs', icon: BarChart2, path: '/logs' },
        { name: 'Goals', icon: Target, path: '/goals' },
        { name: 'Arena', icon: Swords, path: '/arena', underConstruction: true },
        { name: 'Social', icon: Users, path: '/social' },
        { name: 'Account', icon: User, path: '/account' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-bottomnav bg-bg-secondary border-t border-border flex items-center justify-around px-2 z-[60] pb-safe">
            {navItems.map((item) => {
                const isUnderConstruction = (!!item.underConstruction || item.name === 'Arena') && !(item.name === 'Arena' && canAccessArena);
                const isItemLocked = !isUnderConstruction && (!user && ['Logs', 'Goals', ...(canAccessArena && !isDev ? ['Arena'] : [])].includes(item.name));
                
                return (
                    <NavLink
                        key={item.name}
                        to={isUnderConstruction || isItemLocked ? '#' : item.path}
                        onClick={(e) => {
                            if (isUnderConstruction || isItemLocked) {
                                e.preventDefault();
                                return;
                            }
                            if (item.path === '/social' && location.pathname.startsWith('/social') && location.pathname !== '/social') {
                                e.preventDefault();
                                navigate('/social');
                            }
                        }}
                        title={isUnderConstruction ? 'Under Construction' : isItemLocked ? `${item.name} (Requires Account)` : item.name}
                        className={({ isActive }) => `
                            group relative flex flex-col items-center justify-center w-full h-full gap-1 select-none
                            ${isUnderConstruction
                                ? 'opacity-40 text-text-secondary cursor-not-allowed'
                                : (isActive && !isItemLocked)
                                    ? 'text-accent'
                                    : isItemLocked
                                        ? 'opacity-40 text-text-secondary cursor-not-allowed'
                                        : 'text-text-secondary hover:text-text-primary'
                            }
                        `}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{item.name}</span>
                        {isItemLocked && (
                            <Lock className="w-3 h-3 absolute top-1 right-2 opacity-70" />
                        )}
                        {isUnderConstruction && (
                            <Construction className="w-3 h-3 absolute top-1 right-2 opacity-70 text-text-secondary" />
                        )}
                        {isUnderConstruction && (
                            <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold shadow-2xl whitespace-nowrap z-50 pointer-events-none">
                                <Construction className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Under Construction</span>
                            </div>
                        )}
                    </NavLink>
                );
            })}
        </nav>
    );
}
