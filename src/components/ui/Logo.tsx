export interface LogoProps {
    className?: string;
    size?: number | string;
}

export function Logo({ className = "w-6 h-6" }: LogoProps) {
    return (
        <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${className} shrink-0`}
        >
            <rect x="15" y="15" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
            <rect x="76" y="15" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
            <rect x="137" y="15" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />

            <rect x="15" y="76" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
            <rect x="76" y="76" width="48" height="48" rx="10" className="fill-accent dark:fill-accent transition-colors" />
            <rect x="137" y="76" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />

            <rect x="15" y="137" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
            <rect x="76" y="137" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
            <rect x="137" y="137" width="48" height="48" rx="10" className="fill-slate-400 dark:fill-slate-300 transition-colors" />
        </svg>
    );
}

export default Logo;
