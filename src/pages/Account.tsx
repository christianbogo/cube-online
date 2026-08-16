import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Check, X, LogOut, Info, Trash2, Download, TriangleAlert, Loader2
} from 'lucide-react';

import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tabs, FriendSidebar, SocialsTab, ProfileStatsTab, CubingFriendsTab, Logo } from '../components';

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, emailSignUp, emailSignIn, resendVerificationEmail, logout } = useAuth();
    const location = useLocation();

    // Profile State
    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const [downloadLoading, setDownloadLoading] = useState(false);

    // Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSignUpMode, setIsSignUpMode] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    // Handle initial mode from navigation state
    useEffect(() => {
        if (location.state?.mode) {
            setIsSignUpMode(location.state.mode === 'signup');
        }
    }, [location.state]);

    // Initial load
    useEffect(() => {
        if (user) {
            setUsername(user.username || 'CubingUser');
            setSelectedColor(user.color || '#3b82f6');
        }
    }, [user]);

    // Color Picker Close Click Outside
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
            const updates: Record<string, unknown> = {};
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

    const handleDownloadData = async () => {
        if (!user) return;
        setDownloadLoading(true);
        try {
            // 1. Fetch User Profile Document
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userDocSnap.exists() ? userDocSnap.data() : { uid: user.uid, email: user.email, username: user.username, color: user.color };

            // 2. Fetch User Solves from Firestore
            const solvesQuery = query(collection(db, 'solves'), where('userId', '==', user.uid));
            const solvesSnap = await getDocs(solvesQuery);
            const solvesList: any[] = [];
            solvesSnap.forEach(d => solvesList.push({ id: d.id, ...d.data() }));

            // 3. Fetch User Sessions from Firestore
            const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', user.uid));
            const sessionsSnap = await getDocs(sessionsQuery);
            const sessionsList: any[] = [];
            sessionsSnap.forEach(d => sessionsList.push({ id: d.id, ...d.data() }));

            // 4. Construct Data Backup Package
            const exportData = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                user: userData,
                solvesCount: solvesList.length,
                solves: solvesList,
                sessionsCount: sessionsList.length,
                sessions: sessionsList
            };

            // 5. Trigger Browser Download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            const dateStr = new Date().toISOString().slice(0, 10);
            const sanitizedName = (username || 'user').replace(/[^a-z0-9_-]/gi, '_');
            downloadAnchor.setAttribute("download", `cube-online-data-${sanitizedName}-${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (e) {
            console.error("Error downloading data:", e);
            alert("Failed to compile user data. Please try again.");
        } finally {
            setDownloadLoading(false);
        }
    };

    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
        '#64748b', '#000000'
    ];

    const SettingRow = ({ label, description, children }: { label: string, description: string, children: React.ReactNode }) => (
        <div className="flex items-center justify-between py-2 group border-b border-border/20 last:border-0">
            <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium text-sm">{label}</span>
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

    const TimerSettingsTab = () => (
        <div className="flex flex-col gap-1 p-2 max-w-lg">
            <SettingRow label="Show Inspection" description="Enable 15s inspection timer before solving">
                <button
                    onClick={() => updateSettings({ solveInspection: !settings.solveInspection })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${settings.solveInspection ? 'bg-accent' : 'bg-text-secondary/20'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.solveInspection ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </SettingRow>

            <SettingRow label="Show Timer" description="Show the timer while solving">
                <button
                    onClick={() => updateSettings({ showLiveTimer: !settings.showLiveTimer })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${settings.showLiveTimer ? 'bg-accent' : 'bg-text-secondary/20'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${settings.showLiveTimer ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </SettingRow>
        </div>
    );

    const DangerZoneTab = () => (
        <div className="p-4 flex flex-col items-start gap-4 max-w-lg">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500 flex items-start gap-2">
                <TriangleAlert className="w-5 h-5 shrink-0" />
                <span>
                    These actions are irreversible. Please proceed with caution.
                </span>
            </div>

            <button
                onClick={handleDownloadData}
                disabled={downloadLoading}
                className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-sm w-full md:w-auto justify-center cursor-pointer disabled:opacity-50"
            >
                {downloadLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Compiling Data...</span>
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        <span>Download My Data</span>
                    </>
                )}
            </button>
            <button
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 hover:bg-red-500/20 transition-colors text-sm w-full md:w-auto justify-center"
            >
                <Trash2 className="w-4 h-4" /> Delete Account
            </button>
        </div>
    );

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full bg-bg-primary min-w-0 transition-all duration-300 relative z-0">
                {/* Header (Mobile) */}
                <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-bg-secondary md:hidden shrink-0">
                    <h1 className="text-xl font-bold text-text-primary">Account</h1>
                </header>

                <main className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto p-4 md:p-8">
                    {!user ? (
                        // Not Signed In
                        <div className="flex flex-col items-center justify-center p-4 w-full h-full pb-32">
                            <div className="mb-12 w-full animate-in fade-in duration-500 max-w-md mx-auto">
                                <div className="flex flex-col items-center text-center gap-2 mb-8">
                                    <Logo className="w-12 h-12 mb-2" />
                                    <h1 className="text-3xl font-bold text-text-primary">
                                        {isSignUpMode ? 'Create Account' : 'Welcome Back'}
                                    </h1>
                                    <p className="text-text-secondary text-sm">
                                        {isSignUpMode ? 'Join the community and track your progress.' : 'Sign in to access your stats and settings.'}
                                    </p>
                                </div>
                                {/* Auth Form Container */}
                                <div className="flex flex-col w-full">
                                    <div className="flex gap-4 border-b border-border mb-6">
                                        <button
                                            type="button"
                                            className={`pb-2 text-sm font-medium px-4 flex-1 transition-colors relative cursor-pointer ${!isSignUpMode ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                                            onClick={() => { setIsSignUpMode(false); setAuthError(''); }}
                                        >
                                            Sign In
                                            {!isSignUpMode && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />}
                                        </button>
                                        <button
                                            type="button"
                                            className={`pb-2 text-sm font-medium px-4 flex-1 transition-colors relative cursor-pointer ${isSignUpMode ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                                            onClick={() => { setIsSignUpMode(true); setAuthError(''); }}
                                        >
                                            Create Account
                                            {isSignUpMode && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />}
                                        </button>
                                    </div>

                                    <form onSubmit={(e) => { e.preventDefault(); handleAuthAction(); }} className="flex flex-col gap-4 w-full">
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="auth-email" className="text-xs font-bold text-text-secondary uppercase mb-1 block">Email</label>
                                                <input
                                                    id="auth-email"
                                                    type="email"
                                                    name="email"
                                                    autoComplete="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                                    placeholder="hello@example.com"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="auth-password" className="text-xs font-bold text-text-secondary uppercase mb-1 block">Password</label>
                                                <input
                                                    id="auth-password"
                                                    type="password"
                                                    name="password"
                                                    autoComplete={isSignUpMode ? "new-password" : "current-password"}
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                            {isSignUpMode && (
                                                <div className="animate-in fade-in slide-from-top-2 duration-300">
                                                    <label htmlFor="auth-confirm-password" className="text-xs font-bold text-text-secondary uppercase mb-1 block">Confirm Password</label>
                                                    <input
                                                        id="auth-confirm-password"
                                                        type="password"
                                                        name="confirmPassword"
                                                        autoComplete="new-password"
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                                        placeholder="••••••••"
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {authError && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500 flex items-center gap-2">
                                                <TriangleAlert className="w-4 h-4 shrink-0" />
                                                {authError}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={authLoading}
                                            className="mt-2 bg-text-primary text-bg-primary hover:opacity-90 px-6 py-2.5 rounded-md font-bold w-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/5 cursor-pointer"
                                        >
                                            {authLoading ? 'Please Wait...' : (isSignUpMode ? 'Create Account' : 'Sign In')}
                                        </button>
                                    </form>
                                </div>
                                <div className="text-xs text-text-secondary mt-6 text-center max-w-xs mx-auto opacity-70">
                                    By continuing, you acknowledge that local solves are wiped upon signing in/out to ensure data consistency.
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Signed In
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                            {/* Profile Header */}
                            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 relative z-30 group">
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div
                                        className="w-24 h-24 rounded-2xl shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                        style={{ backgroundColor: selectedColor }}
                                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                        title="Click to change profile color"
                                    />

                                    {/* Color Picker Popover */}
                                    {isColorPickerOpen && (
                                        <div
                                            ref={colorPickerRef}
                                            className="absolute top-full left-0 mt-3 bg-bg-secondary border border-border shadow-2xl rounded-xl p-3 z-50 grid grid-cols-5 gap-2 animate-in fade-in zoom-in-95 w-[190px]"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {colors.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => handleColorSelect(c)}
                                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${selectedColor === c ? 'border-text-primary scale-110 shadow-sm' : 'border-transparent'}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-center sm:text-left min-w-0">
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 justify-center sm:justify-start animate-in fade-in">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={tempName}
                                                onChange={e => setTempName(e.target.value)}
                                                className="bg-bg-primary border border-border text-text-primary text-xl font-bold px-3 py-1 rounded focus:border-accent outline-none w-48"
                                                onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                                            />
                                            <button onClick={handleNameSubmit} className="p-2 bg-accent/10 text-accent rounded hover:bg-accent/20 cursor-pointer">
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setIsEditingName(false)} className="p-2 text-text-secondary hover:bg-bg-tertiary rounded cursor-pointer">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="group/name flex items-center gap-2 justify-center sm:justify-start">
                                            <h2 className="text-2xl font-bold text-text-primary truncate">{username}</h2>
                                            <button
                                                onClick={() => { setTempName(username); setIsEditingName(true); }}
                                                className="opacity-0 group-hover/name:opacity-100 p-1 text-text-secondary hover:text-accent transition-all cursor-pointer"
                                                title="Edit Username"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-text-secondary text-sm mt-1">{user.email}</p>

                                    {/* Short ID */}
                                    {user.shortId && (
                                        <div
                                            onClick={() => navigator.clipboard.writeText(user.shortId || '')}
                                            className="mt-1 text-xs text-text-secondary/50 font-mono cursor-pointer hover:text-text-primary transition-colors flex items-center gap-1 justify-center sm:justify-start"
                                            title="Click to copy ID"
                                        >
                                            #{user.shortId}
                                        </div>
                                    )}

                                    {!user.emailVerified && (
                                        <div className="mt-2 text-xs text-yellow-500 bg-yellow-500/10 inline-flex items-center px-2 py-1 rounded gap-2">
                                            <TriangleAlert className="w-3 h-3" />
                                            Email not verified
                                            <button onClick={resendVerificationEmail} className="underline hover:text-yellow-400 cursor-pointer">Resend</button>
                                        </div>
                                    )}
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={logout}
                                    className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex flex-col items-center gap-1 sm:self-center cursor-pointer"
                                    title="Sign Out"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Sign Out</span>
                                </button>
                            </div>

                            {/* Tabs & Content */}
                            <div className="relative z-10">
                                <Tabs
                                    tabs={[
                                        { label: "Profile Statistics", id: "stats", content: <ProfileStatsTab /> },
                                        { label: "Social Media Links", id: "socials", content: <SocialsTab /> },
                                        { label: "Cubing Friends", id: "friends", content: <CubingFriendsTab /> },
                                        { label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> },
                                        { label: "Danger Zone", id: "danger", content: <DangerZoneTab /> },
                                    ]}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {user && <FriendSidebar />}
        </div>
    );
}
