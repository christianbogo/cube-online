import { NavLink } from 'react-router-dom';
import { BarChart2, Target, Users, User, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNav() {
    const { user } = useAuth();

    const navItems = [
        { name: 'Logs', icon: BarChart2, path: '/logs' },
        { name: 'Goals', icon: Target, path: '/goals' },
        { name: 'Social', icon: Users, path: '/social' },
        { name: 'Account', icon: User, path: '/account' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-bottomnav bg-bg-secondary border-t border-border flex items-center justify-around px-2 z-[60] pb-safe">
            {navItems.map((item) => {
                const isItemLocked = !user && ['Logs', 'Goals'].includes(item.name);
                
                return (
                    <NavLink
                        key={item.name}
                        to={isItemLocked ? '#' : item.path}
                        onClick={(e) => {
                            if (isItemLocked) {
                                e.preventDefault();
                            }
                        }}
                        className={({ isActive }) => `
                            relative flex flex-col items-center justify-center w-full h-full gap-1
                            ${(isActive && !isItemLocked)
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
                    </NavLink>
                );
            })}
        </nav>
    );
}
