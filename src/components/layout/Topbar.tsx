import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEconomy } from '../../contexts/EconomyContext';
import { Logo } from '../ui/Logo';
import { Coins, HeartCrack, ShoppingBag } from 'lucide-react';

export default function Topbar() {
    const { user } = useAuth();
    const { economy } = useEconomy();
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

            {/* Right Side: Economy Balance & Auth / Profile */}
            <div className="flex items-center gap-3 md:gap-4">
                {/* Store & Wallet Pill */}
                <Link
                    to="/store"
                    className="flex items-center gap-2.5 px-3 py-1.5 bg-bg-primary hover:bg-bg-hover border border-border/80 rounded-xl transition-all shadow-sm"
                    title="View Store & Vault"
                >
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-500">
                        <Coins className="w-3.5 h-3.5" />
                        <span>{economy.coins.toLocaleString()}</span>
                    </div>

                    {economy.heartbreakTokens > 0 && (
                        <>
                            <div className="w-[1px] h-3.5 bg-border/60" />
                            <div className="flex items-center gap-1 text-xs font-mono font-bold text-rose-500">
                                <HeartCrack className="w-3.5 h-3.5" />
                                <span>{economy.heartbreakTokens}</span>
                            </div>
                        </>
                    )}

                    <div className="w-[1px] h-3.5 bg-border/60" />
                    <ShoppingBag className="w-3.5 h-3.5 text-text-secondary hover:text-text-primary" />
                </Link>

                {user ? (
                    <Link
                        to="/account"
                        className="flex items-center gap-3 py-1 pl-3 pr-1 rounded-lg hover:bg-bg-hover transition-colors border border-transparent hover:border-border/50"
                    >
                        <span className="font-medium text-sm text-text-primary hidden sm:block">
                            {user.username || 'CubingUser'}
                        </span>
                        <div
                            className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center font-bold text-white text-xs"
                            style={{ backgroundColor: economy.equippedColor || user.color || '#ef4444' }}
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
