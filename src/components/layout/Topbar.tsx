import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../ui/Logo';

export default function Topbar() {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 shrink-0 select-none z-20 transition-colors duration-200">
            {/* Left Side: Logo/Brand */}
            <div className="flex items-center gap-3">
                <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Logo className="w-6 h-6" />
                    <span className="font-semibold text-lg tracking-tight text-text-primary">Cube Online</span>
                </Link>
            </div>

            {/* Right Side: Auth / Profile */}
            <div className="flex items-center gap-4">
                {user ? (
                    <Link
                        to="/account"
                        className="flex items-center gap-3 py-1 pl-3 pr-1 rounded-lg hover:bg-bg-hover transition-colors border border-transparent hover:border-border/50"
                    >
                        <span className="font-medium text-sm text-text-primary hidden sm:block">
                            {user.username || 'CubingUser'}
                        </span>
                        <div
                            className="w-8 h-8 rounded-lg shadow-sm"
                            style={{ backgroundColor: user.color || '#3b82f6' }}
                        />
                    </Link>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/account', { state: { mode: 'signin' } })}
                            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-2 py-1"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/account', { state: { mode: 'signup' } })}
                            className="text-sm font-medium bg-text-primary text-bg-primary hover:opacity-90 transition-opacity px-4 py-1.5 rounded-md"
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
