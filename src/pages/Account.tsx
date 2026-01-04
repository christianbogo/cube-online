import { Settings, Check, X, LogOut, Info, Trash2, Download, Upload, TriangleAlert, Star, Ban, Users } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
// import { useSolves } from '../contexts/SolvesContext'; // Unused
import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, emailSignUp, emailSignIn, resendVerificationEmail, logout, toggleStarUser, toggleBlockUser } = useAuth();

    // Social Data State
    const [starredProfiles, setStarredProfiles] = useState<{ uid: string, username: string, color: string }[]>([]);
    const [blockedProfiles, setBlockedProfiles] = useState<{ uid: string, username: string, color: string }[]>([]);

    // Profile State
    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSignUpMode, setIsSignUpMode] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    // Initial load
    useEffect(() => {
        console.log("Account: user state changed", user);
        if (user) {
            setUsername(user.username || 'CubingUser');
            setSelectedColor(user.color || '#3b82f6');
        }
    }, [user]);

    // Fetch Social Profiles
    useEffect(() => {
        const fetchProfiles = async () => {
            if (!user) return;

            // Fetch Starred
            if (user.starredUsers?.length) {
                const profiles = await Promise.all(user.starredUsers.map(async (uid) => {
                    const snap = await getDoc(doc(db, 'users', uid));
                    if (snap.exists()) {
                        const d = snap.data();
                        return { uid, username: d.username, color: d.color };
                    }
                    return null;
                }));
                setStarredProfiles(profiles.filter(p => p !== null) as any[]);
            } else {
                setStarredProfiles([]);
            }

            // Fetch Blocked
            if (user.blockedUsers?.length) {
                const profiles = await Promise.all(user.blockedUsers.map(async (uid) => {
                    const snap = await getDoc(doc(db, 'users', uid));
                    if (snap.exists()) {
                        const d = snap.data();
                        return { uid, username: d.username, color: d.color };
                    }
                    return null;
                }));
                setBlockedProfiles(profiles.filter(p => p !== null) as any[]);
            } else {
                setBlockedProfiles([]);
            }
        };
        fetchProfiles();
    }, [user?.starredUsers, user?.blockedUsers, user]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setIsColorPickerOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const saveProfileUpdate = async (newUsername?: string, newColor?: string) => {
        if (!user) return;
        try {
            const updates: any = {};
            if (newUsername !== undefined) updates.username = newUsername;
            if (newColor !== undefined) updates.color = newColor;

            await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
        } catch (e) {
            console.error("Error saving profile", e);
        }
    };

    const handleNameSubmit = () => {
        const cleaned = tempName.trim();
        if (!cleaned) return;

        // 1. Format Check: a-z, 0-9, _
        if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
            alert("Username can only contain letters, numbers, and underscores.");
            return;
        }

        // 2. Profanity Check
        import('leo-profanity').then(filter => {
            if (filter.check(cleaned)) {
                alert("Username contains inappropriate language.");
                return;
            }
            saveProfileUpdate(cleaned, undefined);
            setIsEditingName(false);
        });
    };

    const handleColorSelect = (c: string) => {
        setSelectedColor(c);
        saveProfileUpdate(undefined, c);
        setIsColorPickerOpen(false);
    };

    const handleAuthAction = async () => {
        setAuthError('');
        setAuthLoading(true);
        try {
            if (isSignUpMode) {
                if (password !== confirmPassword) {
                    setAuthError("Passwords do not match");
                    return;
                }
                await emailSignUp(email, password);
            } else {
                await emailSignIn(email, password);
            }
        } catch (e: any) {
            setAuthError(e.message || 'Authentication failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
        '#64748b', '#000000'
    ];

    const SettingRow = ({ label, description, children }: { label: string, description: string, children: React.ReactNode }) => (
        <div className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium">{label}</span>
                <div className="relative group/info">
                    <Info className="w-3.5 h-3.5 text-text-secondary/50 cursor-help" />
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 p-2 bg-bg-secondary border border-border rounded shadow-lg text-xs text-text-secondary opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-10 pointer-events-none">
                        {description}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );

    return (
        <div className="w-full max-w-3xl flex flex-col items-start text-left p-4 sm:p-0 pb-20">

            {/* Header / Account Section */}
            {user ? (
                <div className="mb-12 w-full">
                    <div className="flex items-center gap-6 mb-2">
                        {/* Color Picker - Larger */}
                        <div className="relative" ref={colorPickerRef}>
                            <button
                                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                className="w-24 h-24 rounded-lg shadow-sm hover:ring-2 hover:ring-offset-2 hover:ring-text-secondary transition-all"
                                style={{ backgroundColor: selectedColor }}
                                title="Change Color"
                            />
                            {isColorPickerOpen && (
                                <div className="absolute top-28 left-0 bg-bg-secondary border border-border rounded-lg shadow-xl p-3 grid grid-cols-5 gap-2 z-50 w-64">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => handleColorSelect(c)}
                                            className="w-8 h-8 rounded-md hover:scale-110 transition-transform border border-black/10"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Name, Email, ID Stack */}
                        <div className="flex-1 flex flex-col justify-center">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleNameSubmit();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                        className="text-3xl font-bold bg-transparent border-b-2 border-accent text-text-primary focus:outline-none w-full max-w-md"
                                    />
                                    <button onClick={handleNameSubmit} className="text-accent hover:bg-accent/10 p-1.5 rounded"><Check className="w-5 h-5" /></button>
                                    <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded"><X className="w-5 h-5" /></button>
                                </div>
                            ) : (
                                <h1
                                    onClick={() => { setTempName(username); setIsEditingName(true); }}
                                    className="text-3xl font-bold text-text-primary cursor-pointer hover:underline decoration-dashed underline-offset-8 decoration-text-secondary/30 mb-1"
                                >
                                    {username}
                                </h1>
                            )}
                            <p className="text-text-primary text-sm opacity-80 mb-0.5">
                                {user.email}
                            </p>
                            <p className="text-text-secondary text-xs font-mono opacity-60">
                                {user.uid}
                            </p>
                            {!user.emailVerified && (
                                <div className="mt-2 flex flex-col items-start gap-1">
                                    <span className="text-xs text-yellow-500 font-medium flex items-center gap-1">
                                        <TriangleAlert className="w-3 h-3" /> Email not verified
                                    </span>
                                    <button
                                        onClick={() => {
                                            resendVerificationEmail();
                                            alert("Verification email sent!");
                                        }}
                                        className="text-xs text-accent hover:underline"
                                    >
                                        Resend Verification Email
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // Sign In / Sign Up UI
                <div className="mb-12 w-full animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-md bg-zinc-700 dark:bg-zinc-200 shadow-sm" />
                        <h1 className="text-3xl font-bold text-text-primary">Sign In</h1>
                    </div>

                    <div className="flex flex-col gap-6 max-w-md">
                        {/* Form - Always Visible, No Card Styling (Floating) */}
                        <div className="space-y-4 w-full">
                            <div className="flex gap-4 border-b border-border mb-4">
                                <button
                                    className={`pb-2 text-sm font-medium px-2 ${!isSignUpMode ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                    onClick={() => { setIsSignUpMode(false); setAuthError(''); }}
                                >
                                    Sign In
                                </button>
                                <button
                                    className={`pb-2 text-sm font-medium px-2 ${isSignUpMode ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                    onClick={() => { setIsSignUpMode(true); setAuthError(''); }}
                                >
                                    Create Account
                                </button>
                            </div>

                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); console.log("Form submitted"); handleAuthAction(); }} className="flex flex-col gap-4 w-full">
                            <input
                                type="email"
                                placeholder="Email"
                                name="email" // added name
                                autoComplete="email" // added autocomplete
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                name="password" // added name
                                autoComplete={isSignUpMode ? "new-password" : "current-password"} // added autocomplete
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            {isSignUpMode && (
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    name="confirmPassword" // added name
                                    autoComplete="new-password" // added autocomplete
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            )}

                            {authError && <p className="text-red-500 text-sm">{authError}</p>}

                            <button
                                type="submit"
                                disabled={authLoading}
                                onClick={() => console.log("Sign In Clicked", { authLoading })}
                                className="bg-accent text-white px-6 py-2 rounded-md hover:bg-accent/90 font-medium w-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {authLoading ? 'Loading...' : (isSignUpMode ? 'Sign Up' : 'Sign In')}
                            </button>
                        </form>
                    </div>

                    <div className="text-sm text-text-secondary mt-4">
                        Local solves are wiped on sign in/out. Sign in to sync unlimited solves.
                    </div>
                </div>
            )}

            {/* Device Settings (Vertical List) */}
            <div className="w-full mb-12">
                <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-zinc-400" /> Device Settings
                </h3>

                <div className="flex flex-col gap-2 max-w-md w-full pl-4 border-l border-border/50 ml-2">
                    <SettingRow label="Solve Inspection" description="Enable 15s inspection timer before solve.">
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.solveInspection}
                            onChange={(e) => updateSettings({ solveInspection: e.target.checked })}
                        />
                    </SettingRow>

                    <SettingRow label="Show Live Timer" description="Show running time during solve.">
                        <input
                            type="checkbox"
                            className="toggle-checkbox w-5 h-5 accent-accent cursor-pointer"
                            checked={settings.showLiveTimer}
                            onChange={(e) => updateSettings({ showLiveTimer: e.target.checked })}
                        />
                    </SettingRow>

                    <SettingRow label="Priming Length" description="Seconds to hold spacebar to ready (0.0 - 3.0s).">
                        <div className="flex items-center gap-1 font-mono text-sm">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={settings.primingLength}
                                onChange={(e) => {
                                    // Allow typing, but validate on blur or just soft parse
                                    const val = e.target.value;
                                    // Allow numbers and decimal point
                                    if (/^\d*\.?\d*$/.test(val)) {
                                        // Update context immediately so typing works, but we might want to clamp only on blur or if valid
                                        const num = parseFloat(val);
                                        if (!isNaN(num) && num >= 0 && num <= 3) {
                                            updateSettings({ primingLength: num });
                                        }
                                    }
                                }}
                                className="bg-transparent border-b border-border text-text-primary w-12 text-right focus:outline-none focus:border-accent"
                            />
                            <span className="text-text-secondary">s</span>
                        </div>
                    </SettingRow>
                </div>
            </div>

            {/* Social Settings */}
            {
                user && (
                    <div className="w-full mb-12">
                        <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-zinc-400" /> Social
                        </h3>

                        {!user.emailVerified ? (
                            <div className="pl-4 border-l border-border/50 ml-2">
                                <p className="text-sm text-text-secondary">
                                    Please verify your email to access social features (Friending & Blocking).
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 pl-4 border-l border-border/50 ml-2">
                                {/* Favorites */}
                                <div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Favorites
                                    </h4>
                                    {starredProfiles.length === 0 ? (
                                        <p className="text-xs text-text-secondary italic">No favorite users yet.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {starredProfiles.map(p => (
                                                <div key={p.uid} className="flex items-center justify-between p-2 bg-surface-elevation-1 rounded border border-border group">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.color }} />
                                                        <span className="text-sm font-medium text-text-primary truncate">{p.username}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleStarUser(p.uid)}
                                                        className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                        title="Unfavorite"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Blocked */}
                                <div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                                        <Ban className="w-4 h-4 text-red-500" /> Blocked Users
                                    </h4>
                                    {blockedProfiles.length === 0 ? (
                                        <p className="text-xs text-text-secondary italic">No blocked users.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {blockedProfiles.map(p => (
                                                <div key={p.uid} className="flex items-center justify-between p-2 bg-surface-elevation-1 rounded border border-border group">
                                                    <div className="flex items-center gap-2 opacity-50">
                                                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.color }} />
                                                        <span className="text-sm font-medium text-text-primary truncate">{p.username}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleBlockUser(p.uid)}
                                                        className="text-text-secondary hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                        title="Unblock"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* "Dangerous Buttons" Footer */}
            {
                user && (
                    <div className="w-full pt-8 border-t border-border mt-8">
                        <h3 className="text-sm font-semibold text-red-500 mb-4 flex items-center gap-2">
                            <TriangleAlert className="w-4 h-4" /> Dangerous Zone
                        </h3>

                        <div className="flex flex-col items-start gap-2">
                            <button
                                onClick={logout}
                                className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 px-2 py-1 hover:bg-bg-secondary rounded"
                            >
                                <LogOut className="w-3 h-3" /> Sign Out
                            </button>

                            <button disabled className="text-xs text-text-secondary/50 cursor-not-allowed flex items-center gap-2 px-2 py-1 rounded">
                                <Download className="w-3 h-3" /> Download Data (Locked)
                            </button>

                            <button disabled className="text-xs text-text-secondary/50 cursor-not-allowed flex items-center gap-2 px-2 py-1 rounded">
                                <Upload className="w-3 h-3" /> Upload Data (Locked)
                            </button>

                            <button
                                onClick={() => alert("Delete account functionality coming soon.")}
                                className="text-xs text-red-500/80 hover:text-red-500 transition-colors flex items-center gap-2 px-2 py-1 hover:bg-red-500/10 rounded"
                            >
                                <Trash2 className="w-3 h-3" /> Delete Account
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
