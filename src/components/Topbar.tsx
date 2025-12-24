import { User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Topbar() {
    return (
        <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 shrink-0 select-none z-20 transition-colors duration-200">
            <div className="flex items-center gap-3">
                {/* Logo: Plain dark grey square that becomes light in dark mode */}
                <div className="w-3.5 h-3.5 bg-zinc-700 dark:bg-zinc-200 rounded-sm shadow-sm transition-colors duration-200" />
                <span className="font-semibold text-lg tracking-tight text-text-primary">Cutter's Cubing</span>
            </div>

            <div className="flex items-center gap-1">
                <Link to="/account" className="p-2 hover:bg-bg-hover rounded-full transition-colors">
                    <User className="w-5 h-5 text-text-primary" />
                </Link>
            </div>
        </header>
    );
}
