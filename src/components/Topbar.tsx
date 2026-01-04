import { User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Topbar() {
    const { user } = useAuth();

    return (
        <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 shrink-0 select-none z-20 transition-colors duration-200">
            <div className="flex items-center gap-3">
                {user ? (
                    <>
                        <div
                            className="w-4 h-4 rounded-sm shadow-sm"
                            style={{ backgroundColor: user.color || '#3b82f6' }}
                        />
                        <span className="font-semibold text-lg tracking-tight text-text-primary">{user.username || 'CubingUser'}</span>
                    </>
                ) : (
                    <>
                        {/* Logo: Plain dark grey square that becomes light in dark mode */}
                        <img src="/logo.svg" alt="Logo" className="w-4 h-4" />
                        <span className="font-semibold text-lg tracking-tight text-text-primary">Cube Online</span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-1">
                <Link to="/account" className="p-2 hover:bg-bg-hover rounded-full transition-colors">
                    <UserIcon className="w-5 h-5 text-text-primary" />
                </Link>
            </div>
        </header>
    );
}
