import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../utils/useIsMobile';
import { useLocation, Link } from 'react-router-dom';
import {
    Check, X, LogOut, Info, Trash2, Download, TriangleAlert, Loader2, RotateCcw, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';

import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    Tabs,
    FriendSidebar,
    SocialsTab,
    CubingFriendsTab,
    Logo,
    resetKeybindTooltips,
    setTooltipsDisabled,
    isTooltipsDisabled,
    KEYBIND_TOOLTIPS
} from '../components';

const AVAILABLE_COLORS = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Green', hex: '#10b981' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Purple', hex: '#8b5cf6' },
    { name: 'Fuchsia', hex: '#d946ef' },
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Slate', hex: '#64748b' },
    { name: 'Dark', hex: '#18181b' },
];

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, emailSignUp, emailSignIn, resendVerificationEmail, logout, updateGhostMode } = useAuth();
    const location = useLocation();
    const isMobile = useIsMobile();

    // Profile State
    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#ef4444');
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
            setSelectedColor(user.color || '#ef4444');
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
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userDocSnap.exists() ? userDocSnap.data() : { uid: user.uid, email: user.email, username: user.username, color: user.color };

            const solvesQuery = query(collection(db, 'solves'), where('userId', '==', user.uid));
            const solvesSnap = await getDocs(solvesQuery);
            const solvesList: any[] = [];
            solvesSnap.forEach(d => solvesList.push({ id: d.id, ...d.data() }));

            const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', user.uid));
            const sessionsSnap = await getDocs(sessionsQuery);
            const sessionsList: any[] = [];
            sessionsSnap.forEach(d => sessionsList.push({ id: d.id, ...d.data() }));

            const exportData = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                user: userData,
                solvesCount: solvesList.length,
                solves: solvesList,
                sessionsCount: sessionsList.length,
                sessions: sessionsList
            };

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

    const TimerSettingsTab = () => {
        const [isSubscribed, setIsSubscribed] = useState(() => !isTooltipsDisabled());
        const [resetSuccess, setResetSuccess] = useState(false);
        const [viewingIndex, setViewingIndex] = useState(0);

        useEffect(() => {
            const handleUpdate = () => {
                setIsSubscribed(!isTooltipsDisabled());
            };
            window.addEventListener('cube-tooltips-updated', handleUpdate);
            window.addEventListener('cube-tooltips-reset', handleUpdate);
            return () => {
                window.removeEventListener('cube-tooltips-updated', handleUpdate);
                window.removeEventListener('cube-tooltips-reset', handleUpdate);
            };
        }, []);

        const handleToggleSubscription = () => {
            const next = !isSubscribed;
            setTooltipsDisabled(!next);
            setIsSubscribed(next);
        };

        const handleReset = () => {
            resetKeybindTooltips();
            setIsSubscribed(true);
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 2000);
        };

        const currentTip = KEYBIND_TOOLTIPS[viewingIndex] || KEYBIND_TOOLTIPS[0];

        return (
            <div className="flex flex-col gap-3 p-2 max-w-lg">
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

                <SettingRow label="Ghost Mode" description="Disable live timing broadcasts and hide live active cubers (live is on by default)">
                    <button
                        onClick={() => updateGhostMode(!user?.isGhostMode)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${user?.isGhostMode ? '' : 'bg-text-secondary/20'}`}
                        style={user?.isGhostMode ? { backgroundColor: user.color || '#ef4444' } : undefined}
                        title={user?.isGhostMode ? "Disable Ghost Mode (Go Live)" : "Enable Ghost Mode"}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${user?.isGhostMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </SettingRow>

                <SettingRow
                    label="Practice Tooltips"
                    description={isSubscribed ? "Subscribed to timer & keybind hints" : "Unsubscribed from practice tooltips"}
                >
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleSubscription}
                            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isSubscribed ? 'bg-accent' : 'bg-text-secondary/20'}`}
                            title={isSubscribed ? "Click to unsubscribe from tooltips" : "Click to subscribe to tooltips"}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        {isSubscribed && (
                            <button
                                onClick={handleReset}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                                    resetSuccess
                                        ? 'bg-green-500/10 text-green-500 border-green-500/30'
                                        : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-hover border-border'
                                }`}
                                title="Reset tooltips order & history"
                            >
                                {resetSuccess ? (
                                    <>
                                        <Check className="w-3 h-3" />
                                        <span>Reset!</span>
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Reset</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </SettingRow>

                {/* Individual Tooltip Viewer */}
                <div className="mt-2 pt-4 border-t border-border/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-semibold text-text-primary">Practice Tooltip Library</h4>
                            <p className="text-[11px] text-text-secondary">View and explore each tip individually.</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setViewingIndex(prev => (prev - 1 + KEYBIND_TOOLTIPS.length) % KEYBIND_TOOLTIPS.length)}
                                className="p-1 rounded-md bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                title="Previous Tip"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[11px] font-mono font-medium text-text-secondary px-1 text-center min-w-[36px]">
                                {viewingIndex + 1} / {KEYBIND_TOOLTIPS.length}
                            </span>
                            <button
                                onClick={() => setViewingIndex(prev => (prev + 1) % KEYBIND_TOOLTIPS.length)}
                                className="p-1 rounded-md bg-bg-primary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                title="Next Tip"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Tooltip Card Preview */}
                    <div className="bg-bg-primary border border-border rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-text-primary text-xs">
                                {currentTip.title}
                            </span>
                            <span className="bg-bg-secondary border border-border text-text-secondary px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">
                                {currentTip.badge}
                            </span>
                        </div>
                        <p className="text-text-secondary text-[11px] leading-relaxed">
                            {currentTip.description}
                        </p>
                    </div>

                    {/* Quick navigation pill selector */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                        {KEYBIND_TOOLTIPS.map((tip, idx) => (
                            <button
                                key={tip.id}
                                onClick={() => setViewingIndex(idx)}
                                className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                                    viewingIndex === idx
                                        ? 'bg-accent/15 text-accent border-accent/40 font-semibold'
                                        : 'bg-bg-primary text-text-secondary hover:text-text-primary border-border hover:bg-bg-hover'
                                }`}
                            >
                                {tip.title}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

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

            <div className="pt-2 border-t border-border/50 w-full flex items-center justify-between text-xs text-text-secondary">
                <span>Looking for data rights &amp; retention terms?</span>
                <Link to="/privacy" className="text-accent hover:underline inline-flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" /> Privacy Policy
                </Link>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full bg-bg-primary overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full bg-bg-primary min-w-0 transition-all duration-300 relative z-0">
                {isMobile && user && (
                    <div className="text-xs text-text-secondary/70 text-center py-2 bg-bg-secondary border-b border-border/50 shrink-0">
                        Note: Please use a computer to access timing features.
                    </div>
                )}

                <main className={`flex-1 overflow-y-auto no-scrollbar w-full ${user ? 'max-w-3xl mx-auto p-4 md:p-8' : 'p-4 sm:p-6'}`}>
                    {!user ? (
                        // Not Signed In
                        <div className="min-h-full flex flex-col items-center justify-center py-4 sm:py-8">
                            <div className="w-full max-w-md my-auto animate-in fade-in duration-300 bg-bg-secondary/40 border border-border/60 rounded-2xl p-6 sm:p-8 shadow-sm">
                                <div className="flex flex-col items-center text-center gap-1.5 mb-6">
                                    <Logo className="w-10 h-10 mb-1" />
                                    <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                                        {isSignUpMode ? 'Create Account' : 'Welcome Back'}
                                    </h1>
                                    <p className="text-text-secondary text-xs sm:text-sm">
                                        {isSignUpMode ? 'Join the community and track your progress.' : 'Sign in to access your stats and settings.'}
                                    </p>
                                </div>
                                {/* Auth Form Container */}
                                <div className="flex flex-col w-full">
                                    <div className="flex gap-4 border-b border-border mb-5">
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
                                        <div className="space-y-3.5">
                                            <div>
                                                <label htmlFor="auth-email" className="text-xs font-bold text-text-secondary uppercase mb-1 block">Email</label>
                                                <input
                                                    id="auth-email"
                                                    type="email"
                                                    name="email"
                                                    autoComplete="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
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
                                                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
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
                                                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
                                                        placeholder="••••••••"
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {authError && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 flex items-center gap-2">
                                                <TriangleAlert className="w-4 h-4 shrink-0" />
                                                {authError}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={authLoading}
                                            className="mt-1 bg-text-primary text-bg-primary hover:opacity-90 px-6 py-2.5 rounded-lg font-bold w-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer text-sm"
                                        >
                                            {authLoading ? 'Please Wait...' : (isSignUpMode ? 'Create Account' : 'Sign In')}
                                        </button>
                                    </form>
                                </div>
                                <div className="text-[11px] text-text-secondary mt-4 text-center max-w-xs mx-auto opacity-80 leading-relaxed">
                                    <p>
                                        Read our <Link to="/privacy" className="text-accent underline font-medium">Privacy Policy</Link> for details on data protection &amp; AI usage.
                                    </p>
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
                                        className="w-24 h-24 rounded-2xl shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                                        style={{ backgroundColor: selectedColor }}
                                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                        title="Click to change profile color"
                                    />

                                    {/* Color Picker Popover */}
                                    {isColorPickerOpen && (
                                        <div
                                            ref={colorPickerRef}
                                            className="absolute top-full left-0 mt-3 bg-bg-secondary border border-border shadow-2xl rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 w-[240px]"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-[11px] font-bold uppercase text-text-secondary mb-2 tracking-wider">
                                                Select Color
                                            </div>

                                            <div className="grid grid-cols-4 gap-2">
                                                {AVAILABLE_COLORS.map(item => {
                                                    const isSelected = selectedColor.toLowerCase() === item.hex.toLowerCase();

                                                    return (
                                                        <button
                                                            key={item.hex}
                                                            onClick={() => handleColorSelect(item.hex)}
                                                            title={item.name}
                                                            className={`w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center relative cursor-pointer ${
                                                                isSelected
                                                                    ? 'border-text-primary scale-110 shadow-md ring-2 ring-accent/30'
                                                                    : 'border-transparent hover:scale-105'
                                                            }`}
                                                            style={{ backgroundColor: item.hex }}
                                                        >
                                                            {isSelected && <Check className="w-4 h-4 text-white stroke-[3] drop-shadow" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 justify-center sm:justify-start animate-in fade-in">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={tempName}
                                                onChange={e => setTempName(e.target.value)}
                                                className="bg-bg-primary border border-border text-text-primary text-xl font-bold px-3 py-1 rounded focus:border-accent outline-none w-48 text-center sm:text-left"
                                                onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                                            />
                                            <button onClick={handleNameSubmit} className="p-2 bg-accent/10 text-accent rounded hover:bg-accent/20 cursor-pointer" title="Save">
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setIsEditingName(false)} className="p-2 text-text-secondary hover:bg-bg-tertiary rounded cursor-pointer" title="Cancel">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="group/name flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
                                            <h2 className={`text-2xl font-bold truncate text-center sm:text-left transition-colors ${
                                                !user.emailVerified ? 'text-text-secondary/50 select-none' : 'text-text-primary'
                                            }`}>
                                                {username}
                                            </h2>
                                            {!user.emailVerified ? (
                                                <div className="relative group/verifytip flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            alert("Please verify your email address to edit your profile name.");
                                                        }}
                                                        className="p-1 text-text-secondary/40 hover:text-text-secondary transition-colors cursor-not-allowed"
                                                        aria-label="Email verification required to edit username"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                    </button>
                                                    <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bottom-full mb-1.5 px-2.5 py-1 bg-bg-secondary border border-border text-[11px] text-text-secondary rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/verifytip:opacity-100 transition-opacity z-20">
                                                        Verify your email to edit username
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setTempName(username); setIsEditingName(true); }}
                                                    className="opacity-0 group-hover/name:opacity-100 p-1 text-text-secondary hover:text-accent transition-all cursor-pointer"
                                                    title="Edit Username"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-text-secondary text-sm mt-1 text-center sm:text-left w-full sm:w-auto">{user.email}</p>

                                    {/* Short ID */}
                                    {user.shortId && (
                                        <div
                                            onClick={() => navigator.clipboard.writeText(user.shortId || '')}
                                            className="mt-1 text-xs text-text-secondary/50 font-mono cursor-pointer hover:text-text-primary transition-colors flex items-center gap-1 justify-center sm:justify-start w-fit"
                                            title="Click to copy ID"
                                        >
                                            #{user.shortId}
                                        </div>
                                    )}

                                    {!user.emailVerified && (
                                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-500 max-w-sm text-left">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-1.5 font-semibold">
                                                    <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Email not verified</span>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await resendVerificationEmail();
                                                            alert("Verification email sent. Please check your inbox and spam folder.");
                                                        } catch (e: any) {
                                                            alert(e?.message || "Failed to resend verification email.");
                                                        }
                                                    }}
                                                    className="underline hover:text-yellow-400 font-medium cursor-pointer"
                                                >
                                                    Resend
                                                </button>
                                            </div>
                                            <p className="text-yellow-500/80 leading-relaxed text-[11px]">
                                                Please check your spam or junk folder if you don't see the email, as the verification link will be sent from a new address.
                                            </p>
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
                                        { label: "Connections", id: "connections", content: <CubingFriendsTab /> },
                                        { label: "Public Profile", id: "socials", content: <SocialsTab /> },
                                        ...(isMobile ? [] : [{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> }]),
                                        ...(isMobile ? [] : [{ label: "Danger Zone", id: "danger", content: <DangerZoneTab /> }]),
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
