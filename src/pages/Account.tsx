import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../utils/useIsMobile';
import { useLocation, Link } from 'react-router-dom';
import {
    Check, X, LogOut, Trash2, Download, Upload, TriangleAlert, Loader2, ShieldCheck, Copy
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useSolves } from '../contexts/SolvesContext';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    Tabs,
    SocialsTab,
    CubingFriendsTab,
    Logo,
    ImportCsTimerModal,
    UserAvatar,
    WcaBadge
} from '../components';
import { hasLinkedWca } from '../utils/wca';

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
    const { user, emailSignUp, emailSignIn, resendVerificationEmail, logout } = useAuth();
    const { deleteAllSolves } = useSolves();
    const location = useLocation();
    const isMobile = useIsMobile();
    const isWcaVerified = hasLinkedWca(user);

    // Profile State
    const [username, setUsername] = useState('');
    const [selectedColor, setSelectedColor] = useState('#ef4444');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const [copiedProfileCode, setCopiedProfileCode] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isDeleteSolvesModalOpen, setIsDeleteSolvesModalOpen] = useState(false);
    const [deleteSolvesLoading, setDeleteSolvesLoading] = useState(false);

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
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('../lib/firebase');
            const exportFn = httpsCallable(functions, 'exportUserData');
            const result = await exportFn();
            const exportData = result.data;

            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", url);
            const dateStr = new Date().toISOString().slice(0, 10);
            const sanitizedName = (username || 'user').replace(/[^a-z0-9_-]/gi, '_');
            downloadAnchor.setAttribute("download", `cube-online-data-${sanitizedName}-${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e) {
            console.error("Error downloading data:", e);
            alert("Failed to compile user data. Please try again.");
        } finally {
            setDownloadLoading(false);
        }
    };

    const handleConfirmDeleteSolves = async () => {
        setDeleteSolvesLoading(true);
        try {
            await deleteAllSolves();
            setIsDeleteSolvesModalOpen(false);
        } catch (e) {
            console.error("Failed to delete all solves:", e);
            alert("Failed to delete all solves. Please try again.");
        } finally {
            setDeleteSolvesLoading(false);
        }
    };

    const DangerZoneTab = () => (
        <div className="p-4 flex flex-col items-start gap-4 max-w-lg">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500 flex items-start gap-2.5 w-full">
                <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                    These actions are irreversible. Please proceed with caution.
                </span>
            </div>

            <div className="flex flex-col gap-2.5 w-full sm:w-64">
                <button
                    onClick={handleDownloadData}
                    disabled={downloadLoading}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-elevation-1 border border-border/70 hover:border-border hover:bg-bg-hover text-text-primary rounded-xl transition-all text-sm font-medium w-full justify-start cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                    {downloadLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-text-secondary shrink-0" />
                    ) : (
                        <Download className="w-4 h-4 text-text-secondary shrink-0" />
                    )}
                    <span>{downloadLoading ? 'Compiling Data...' : 'Download My Data'}</span>
                </button>

                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-elevation-1 border border-border/70 hover:border-border hover:bg-bg-hover text-text-primary rounded-xl transition-all text-sm font-medium w-full justify-start cursor-pointer shadow-2xs"
                >
                    <Upload className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Import csTimer Solves</span>
                </button>

                <button
                    onClick={() => setIsDeleteSolvesModalOpen(true)}
                    disabled={deleteSolvesLoading}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-elevation-1 border border-red-500/25 hover:bg-red-500/10 hover:border-red-500/40 text-red-500 rounded-xl transition-all text-sm font-medium w-full justify-start cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {deleteSolvesLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500 shrink-0" />
                    ) : (
                        <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span>{deleteSolvesLoading ? 'Deleting Solves...' : 'Delete All Solves'}</span>
                </button>

                <button
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-elevation-1 border border-red-500/25 hover:bg-red-500/10 hover:border-red-500/40 text-red-500 rounded-xl transition-all text-sm font-medium w-full justify-start cursor-pointer shadow-2xs"
                >
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Delete Account</span>
                </button>
            </div>

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

                <main className={`flex-1 overflow-y-auto no-scrollbar w-full ${user && !user.isAnonymous ? 'max-w-3xl mx-auto px-2.5 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5' : 'px-3 py-3 sm:px-4 sm:py-4'}`}>
                    {!user || user.isAnonymous ? (
                        // Not Signed In
                        <div className="min-h-full flex flex-col items-center justify-center py-2 sm:py-4">
                            <div className="w-full max-w-md my-auto animate-in fade-in duration-300 bg-bg-secondary/40 border border-border/60 rounded-2xl p-4 sm:p-6 shadow-sm">
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
                                    <UserAvatar
                                        user={user}
                                        color={selectedColor}
                                        className="w-24 h-24 cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center rounded-2xl shadow-lg"
                                        roundedClassName="rounded-2xl"
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
                                                            style={{ backgroundColor: item.hex === '#18181b' ? 'var(--profile-black, #2d333b)' : item.hex }}
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
                                            <h2 className={`text-2xl font-bold truncate text-center sm:text-left transition-colors flex items-center gap-1.5 ${
                                                !user.emailVerified ? 'text-text-secondary/50 select-none' : 'text-text-primary'
                                            }`}>
                                                <span>{username}</span>
                                                {isWcaVerified && (
                                                    <span
                                                        title={`Verified WCA Competitor (${user.wcaId || 'Linked'})`}
                                                        className="inline-flex items-center align-middle"
                                                    >
                                                        <WcaBadge user={user} color={selectedColor} className="w-5 h-5 drop-shadow-xs" />
                                                    </span>
                                                )}
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
                                        <div className="relative inline-flex items-center mt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!user.shortId) return;
                                                    navigator.clipboard.writeText(user.shortId);
                                                    setCopiedProfileCode(true);
                                                    setTimeout(() => setCopiedProfileCode(false), 2000);
                                                }}
                                                className="text-xs text-text-secondary/60 hover:text-text-primary font-mono cursor-pointer transition-colors flex items-center gap-1.5 justify-center sm:justify-start w-fit group py-0.5 px-1 rounded hover:bg-bg-secondary/60"
                                                title="Click to copy profile code"
                                            >
                                                <span>#{user.shortId}</span>
                                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>

                                            {copiedProfileCode && (
                                                <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bottom-full mb-1.5 px-2.5 py-1 bg-bg-secondary border border-border text-xs font-semibold text-green-500 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1.5 z-40">
                                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Copied to clipboard!</span>
                                                </div>
                                            )}
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
                                        { label: "Following", id: "following", content: <CubingFriendsTab /> },
                                        { label: "Profile", id: "profile", content: <SocialsTab /> },
                                        ...(isMobile ? [] : [{ label: "Danger Zone", id: "danger", content: <DangerZoneTab /> }]),
                                    ]}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>

            <ImportCsTimerModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />

            {/* Delete All Solves Confirmation Modal */}
            {isDeleteSolvesModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
                    <div
                        className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-text-primary">Delete All Solves</h2>
                                    <p className="text-xs text-text-secondary">This action cannot be undone</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !deleteSolvesLoading && setIsDeleteSolvesModalOpen(false)}
                                disabled={deleteSolvesLoading}
                                className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col gap-4">
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Are you sure you want to permanently delete all of your solves? This will wipe your entire solve history, session logs, and personal best records across all puzzles.
                            </p>
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                                <span>These actions are irreversible. Please proceed with caution.</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-border/60 bg-bg-secondary/60 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsDeleteSolvesModalOpen(false)}
                                disabled={deleteSolvesLoading}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteSolves}
                                disabled={deleteSolvesLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {deleteSolvesLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deleting Solves...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete All Solves</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
