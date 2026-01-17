import { Check, X, LogOut, Info, Trash2, Download, Upload, TriangleAlert, Star, Ban, BarChart3 } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
// import { useSolves } from '../contexts/SolvesContext'; // Unused
import { useState, useRef, useEffect } from 'react';
import { FriendSidebar } from '../components/FriendSidebar';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Tabs from '../components/Tabs';
import { useLocation } from 'react-router-dom';

export default function Account() {
    const { settings, updateSettings } = useSettings();
    const { user, emailSignUp, emailSignIn, resendVerificationEmail, logout, toggleStarUser, toggleBlockUser } = useAuth();
    const location = useLocation();

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

    // -- Tab Contents --

    const ProfileStatsTab = () => (
        <div className="p-4 flex flex-col items-center justify-center text-text-secondary italic h-32">
            <BarChart3 className="w-8 h-8 opacity-20 mb-2" />
            <span>Profile statistics coming soon...</span>
        </div>
    );

    const CubingFriendsTab = () => (
        <div className="p-2">
            {!user?.emailVerified ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <p className="text-sm text-yellow-500 flex items-center gap-2">
                        <TriangleAlert className="w-4 h-4" />
                        Please verify your email to access social features.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    {/* Favorites */}
                    <div>
                        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2 bg-bg-secondary/50 p-2 rounded">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Favorites
                        </h4>
                        {starredProfiles.length === 0 ? (
                            <p className="text-xs text-text-secondary italic px-2">No favorite users yet.</p>
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
                        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2 bg-bg-secondary/50 p-2 rounded">
                            <Ban className="w-4 h-4 text-red-500" /> Blocked Users
                        </h4>
                        {blockedProfiles.length === 0 ? (
                            <p className="text-xs text-text-secondary italic px-2">No blocked users.</p>
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
    );

    const SocialsTab = () => {
        const [newNetwork, setNewNetwork] = useState<'email' | 'discord' | 'twitter' | 'instagram' | 'youtube' | 'twitch' | 'other'>('discord');
        const [newValue, setNewValue] = useState('');

        // Ensure we always have the email entry
        const socials = user?.socials || [];
        const emailEntry = socials.find(s => s.network === 'email') || {
            id: 'email-default',
            network: 'email',
            value: user?.email || '',
            privacy: 'hidden'
        };
        const otherSocials = socials.filter(s => s.network !== 'email');

        // Sync email value if it changes in auth (though unlikely to change without re-auth)
        if (emailEntry.value !== user?.email) emailEntry.value = user?.email || '';

        const updateSocials = async (newSocialsList: any[]) => {
            if (!user) return;
            try {
                await setDoc(doc(db, 'users', user.uid), { socials: newSocialsList }, { merge: true });
            } catch (e) {
                console.error("Error updating socials", e);
            }
        };

        const handleAddSocial = () => {
            if (!newValue.trim()) return;
            const newEntry = {
                id: crypto.randomUUID(),
                network: newNetwork,
                value: newValue.trim(),
                privacy: 'hidden' as 'hidden' | 'friends' | 'public'
            };
            // Combine existing (minus any email duplicates which shouldn't exist in 'other') + new
            // Then ensuring we keep the structured list clean.
            // Actually, we usually want to store the WHOLE list including email preference.

            // If email entry didn't exist in DB, we should add it now so its privacy is saved.
            let fullList = [...socials];
            if (!fullList.find(s => s.network === 'email')) {
                fullList.push(emailEntry);
            }
            fullList.push(newEntry);

            updateSocials(fullList);
            setNewValue('');
        };

        const handlDeleteSocial = (id: string) => {
            const fullList = socials.filter(s => s.id !== id);
            updateSocials(fullList);
        };

        const handlePrivacyChange = (id: string, newPrivacy: string) => {
            let fullList = [...socials];
            // If we are changing privacy of the 'email-default' which might not be in DB yet:
            if (id === 'email-default' && !fullList.find(s => s.network === 'email')) {
                fullList.push({ ...emailEntry, privacy: newPrivacy as 'hidden' | 'friends' | 'public' });
            } else {
                fullList = fullList.map(s => s.id === id ? { ...s, privacy: newPrivacy as 'hidden' | 'friends' | 'public' } : s);
            }
            updateSocials(fullList);
        };

        return (
            <div className="flex flex-col gap-6 p-2">
                {/* Email (Special Case) */}
                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-text-primary">Contact</h4>
                    <div className="flex items-center justify-between p-3 bg-bg-secondary rounded border border-border">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-bg-primary rounded-md border border-border">
                                <span className="text-xs font-bold text-text-secondary uppercase">Email</span>
                            </div>
                            <span className="text-sm text-text-primary font-mono">{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={emailEntry.privacy}
                                onChange={(e) => handlePrivacyChange(emailEntry.id, e.target.value)}
                                className="bg-bg-primary border border-border text-xs text-text-secondary rounded px-2 py-1 focus:outline-none focus:border-accent cursor-pointer hover:bg-bg-hover transition-colors"
                            >
                                <option value="hidden">Hidden</option>
                                <option value="friends">Friends Only</option>
                                <option value="public">Public</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Other Socials */}
                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-text-primary">Social Profiles</h4>

                    {otherSocials.length === 0 && (
                        <p className="text-xs text-text-secondary italic mb-2">No social profiles added.</p>
                    )}

                    <div className="flex flex-col gap-2">
                        {otherSocials.map((social: any) => (
                            <div key={social.id} className="flex items-center justify-between p-3 bg-bg-secondary rounded border border-border">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Icon / Badge */}
                                    <div className="p-2 bg-bg-primary rounded-md border border-border shrink-0 capitalize w-24 text-center">
                                        <span className="text-xs font-bold text-text-secondary">{social.network}</span>
                                    </div>
                                    <span className="text-sm text-text-primary truncate">{social.value}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={social.privacy}
                                        onChange={(e) => handlePrivacyChange(social.id, e.target.value)}
                                        className="bg-bg-primary border border-border text-xs text-text-secondary rounded px-2 py-1 focus:outline-none focus:border-accent cursor-pointer hover:bg-bg-hover transition-colors"
                                    >
                                        <option value="hidden">Hidden</option>
                                        <option value="friends">Friends Only</option>
                                        <option value="public">Public</option>
                                    </select>
                                    <button
                                        onClick={() => handlDeleteSocial(social.id)}
                                        className="p-1 text-text-secondary hover:text-red-500 transition-colors"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 border border-dashed border-border rounded opacity-80 hover:opacity-100 transition-opacity">
                        <select
                            value={newNetwork}
                            onChange={(e) => setNewNetwork(e.target.value as any)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 w-full sm:w-auto focus:outline-none focus:border-accent"
                        >
                            <option value="discord">Discord</option>
                            <option value="twitter">Twitter</option>
                            <option value="instagram">Instagram</option>
                            <option value="youtube">YouTube</option>
                            <option value="twitch">Twitch</option>
                            <option value="other">Other</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Username or URL"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="bg-bg-secondary border border-border text-sm text-text-primary rounded px-3 py-2 w-full flex-1 focus:outline-none focus:border-accent"
                        />
                        <button
                            onClick={handleAddSocial}
                            disabled={!newValue.trim()}
                            className="bg-text-primary text-bg-primary px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity w-full sm:w-auto"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const TimerSettingsTab = () => (
        <div className="flex flex-col gap-1 p-2">
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
                            const val = e.target.value;
                            if (/^\d*\.?\d*$/.test(val)) {
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
    );

    const DangerZoneTab = () => (
        <div className="p-4 flex flex-col items-start gap-4">
            <p className="text-xs text-text-secondary">
                Actions here can cause data loss or permanent account changes. Proceed with caution.
            </p>

            <div className="w-full flex flex-col gap-2">
                <button
                    onClick={logout}
                    className="w-full text-left p-3 rounded border border-border hover:bg-bg-secondary flex items-center justify-between text-sm text-text-primary group transition-colors"
                >
                    <span className="flex items-center gap-2"><LogOut className="w-4 h-4 text-text-secondary group-hover:text-text-primary" /> Sign Out</span>
                </button>

                <button disabled className="w-full text-left p-3 rounded border border-border opacity-50 cursor-not-allowed flex items-center justify-between text-sm text-text-primary">
                    <span className="flex items-center gap-2"><Download className="w-4 h-4" /> Download Data</span>
                    <span className="text-xs uppercase font-bold border rounded px-1">Locked</span>
                </button>

                <button disabled className="w-full text-left p-3 rounded border border-border opacity-50 cursor-not-allowed flex items-center justify-between text-sm text-text-primary">
                    <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Data</span>
                    <span className="text-xs uppercase font-bold border rounded px-1">Locked</span>
                </button>

                <button
                    onClick={() => alert("Delete account functionality coming soon.")}
                    className="w-full text-left p-3 rounded border border-red-500/20 hover:bg-red-500/5 hover:border-red-500/50 flex items-center justify-between text-sm text-red-500 transition-colors mt-4"
                >
                    <span className="flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col items-center mx-auto text-left pb-0 overflow-hidden">

            {/* Header / Account Section */}
            {user ? (
                <div className="flex w-full h-full relative">
                    {/* Main Content (Tabs) */}
                    <div className="flex-1 p-4 sm:p-8 overflow-y-auto text-left">
                        <div className="mb-12 w-full text-left">
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
                                <div className="flex-1 flex flex-col justify-center items-start text-left">
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
                                        {user.shortId || user.uid}
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
                        {/* TABS - Ensure Left Align */}
                        <div className="w-full text-left">
                            <Tabs
                                tabs={[
                                    { id: 'stats', label: 'Profile Statistics', content: <div className="text-left"><ProfileStatsTab /></div> },
                                    { id: 'friends', label: 'Cubing Friends', content: <div className="text-left"><CubingFriendsTab /></div> },
                                    { id: 'socials', label: 'Social Media Links', content: <div className="text-left"><SocialsTab /></div> },
                                    { id: 'settings', label: 'Timer Settings', content: <div className="text-left"><TimerSettingsTab /></div> },
                                    { id: 'danger', label: 'Danger Zone', content: <div className="text-left"><DangerZoneTab /></div> },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Friend Sidebar (Resizable & Collapsible) */}
                    <FriendSidebar />
                </div>
            ) : (
                // Sign In / Sign Up UI (Centered 100%)
                <div className="flex flex-col items-center justify-center p-4 w-full h-full pb-32">
                    <div className="mb-12 w-full animate-in fade-in duration-500 max-w-md mx-auto">
                        <div className="flex flex-col items-center text-center gap-2 mb-8">
                            <img src="/logo.svg" alt="Logo" className="w-12 h-12 mb-2" />
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
                                    className={`pb-2 text-sm font-medium px-4 flex-1 transition-colors relative ${!isSignUpMode ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                                    onClick={() => { setIsSignUpMode(false); setAuthError(''); }}
                                >
                                    Sign In
                                    {!isSignUpMode && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />}
                                </button>
                                <button
                                    className={`pb-2 text-sm font-medium px-4 flex-1 transition-colors relative ${isSignUpMode ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                                    onClick={() => { setIsSignUpMode(true); setAuthError(''); }}
                                >
                                    Create Account
                                    {isSignUpMode && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />}
                                </button>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleAuthAction(); }} className="flex flex-col gap-4 w-full">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                            placeholder="hello@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Password</label>
                                        <input
                                            type="password"
                                            name="password"
                                            autoComplete={isSignUpMode ? "new-password" : "current-password"}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    {isSignUpMode && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Confirm Password</label>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                autoComplete="new-password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                                placeholder="••••••••"
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
                                    className="mt-2 bg-text-primary text-bg-primary hover:opacity-90 px-6 py-2.5 rounded-md font-bold w-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/5"
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
            )}
        </div >
    );
}
