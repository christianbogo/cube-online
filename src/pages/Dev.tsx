import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
    getAggregateFromServer,
    sum,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, formatTimeMs, compressImage } from '../utils/admin';
import type {
    DevFeedback,
    FeedbackType,
    ChangelogEntry,
    ChangelogCategory,
    FirebaseMetrics
} from '../types';

// Default seed changelogs if collection is empty
const SEED_CHANGELOGS: Omit<ChangelogEntry, 'id'>[] = [
    {
        title: 'Developer Portal, Live Timing & Performance',
        date: '2026-08-20',
        version: 'v0.3.1',
        category: 'release',
        items: [
            'Added Developer Portal with live Firebase metrics, issue reporting, and changelogs.',
            'Integrated real-time presence counters with active cuber status.',
            'Added customizable theme switcher supporting System, Light, and Dark Github modes.',
            'Optimized Wasm scramble generation routines for faster puzzle reset times.'
        ],
        images: [],
        createdAt: '2026-08-20T12:00:00.000Z',
        author: 'christianbcutter@yahoo.com'
    },
    {
        title: 'Enhanced Socials, Goal Milestones & Binds',
        date: '2026-08-10',
        version: 'v0.3.0',
        category: 'feature',
        items: [
            'Launched Goal Milestones with visual progress bars and custom time targets.',
            'Added Keybinds & Shortcuts reference sheet for high-speed navigation.',
            'Introduced Private Practice Mode for incognito warmups without polluting stats.',
            'Added full data export option in Account Danger Zone.'
        ],
        images: [],
        createdAt: '2026-08-10T12:00:00.000Z',
        author: 'christianbcutter@yahoo.com'
    }
];

function formatVersionDate(version?: string, dateStr?: string): string {
    let formattedDate = '';
    if (dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            const y = parts[0].slice(-2);
            formattedDate = `${m}/${d}/${y}`;
        } else {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                formattedDate = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
            } else {
                formattedDate = dateStr;
            }
        }
    }
    if (version && formattedDate) return `${version} ${formattedDate}`;
    return version || formattedDate || '';
}

export default function Dev() {
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // ==========================================
    // 1. Firebase Metrics State
    // ==========================================
    const [metrics, setMetrics] = useState<FirebaseMetrics>({
        totalSolves: 0,
        totalSolvingTimeMs: 0,
        activeUsersPastMonth: 0,
        solvesToday: 0,
        lastUpdated: '',
        loading: true,
        error: null
    });

    const fetchMetrics = useCallback(async () => {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const todayStartISO = todayStart.toISOString();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            let totalSolves = 0;
            let totalSolvingTimeMs = 0;
            let solvesToday = 0;
            let activeUsersPastMonth = 0;

            const solvesColl = collection(db, 'solves');

            // Total Solves & Total Time
            try {
                const totalSolvesCountSnap = await getCountFromServer(solvesColl);
                totalSolves = totalSolvesCountSnap.data().count;

                const timeAggSnap = await getAggregateFromServer(solvesColl, {
                    totalTime: sum('time')
                });
                totalSolvingTimeMs = timeAggSnap.data().totalTime || 0;
            } catch (err) {
                console.warn("Aggregate query fallback:", err);
                const allSolvesSnap = await getDocs(solvesColl);
                totalSolves = allSolvesSnap.size;
                let sumTime = 0;
                allSolvesSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (typeof data.time === 'number') {
                        sumTime += data.time;
                    }
                });
                totalSolvingTimeMs = sumTime;
            }

            // Solves Today
            try {
                const todayQuery = query(solvesColl, where('date', '>=', todayStartISO));
                const todayCountSnap = await getCountFromServer(todayQuery);
                solvesToday = todayCountSnap.data().count;
            } catch {
                try {
                    const todayQuery = query(solvesColl, where('date', '>=', todayStartISO));
                    const todaySnap = await getDocs(todayQuery);
                    solvesToday = todaySnap.size;
                } catch {
                    solvesToday = 0;
                }
            }

            // Active Users Past Month
            try {
                const usersColl = collection(db, 'users');
                const usersSnap = await getDocs(usersColl);
                let activeCount = 0;
                usersSnap.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.lastSeenAt && new Date(data.lastSeenAt).getTime() >= thirtyDaysAgo.getTime()) {
                        activeCount++;
                    } else if (!data.lastSeenAt) {
                        activeCount++;
                    }
                });
                activeUsersPastMonth = Math.max(activeCount, 1);
            } catch {
                activeUsersPastMonth = 1;
            }

            setMetrics({
                totalSolves,
                totalSolvingTimeMs,
                activeUsersPastMonth,
                solvesToday,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                loading: false,
                error: null
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to query database';
            setMetrics(prev => ({ ...prev, loading: false, error: message }));
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    // ==========================================
    // 2. Feedback Form State
    // ==========================================
    const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
    const [feedbackTitle, setFeedbackTitle] = useState('');
    const [feedbackDescription, setFeedbackDescription] = useState('');
    const [feedbackEmail, setFeedbackEmail] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSuccess, setFeedbackSuccess] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.email && !feedbackEmail) {
            setFeedbackEmail(user.email);
        }
    }, [user, feedbackEmail]);

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedbackError(null);

        if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
            setFeedbackError('Please fill out both the summary and description.');
            return;
        }

        setIsSubmittingFeedback(true);
        try {
            const payload = {
                type: feedbackType,
                title: feedbackTitle.trim(),
                description: feedbackDescription.trim(),
                userEmail: feedbackEmail.trim() || (user?.email ?? ''),
                userId: user?.uid || null,
                username: user?.username || null,
                status: 'open',
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'feedback'), payload);

            setFeedbackTitle('');
            setFeedbackDescription('');
            setFeedbackSuccess(true);
            setTimeout(() => setFeedbackSuccess(false), 5000);

            if (userIsAdmin) {
                loadAdminFeedbacks();
            }
        } catch (err) {
            console.error("Failed to submit feedback:", err);
            setFeedbackError('Failed to submit. Please try again.');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    // ==========================================
    // 3. Changelog State
    // ==========================================
    const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
    const [changelogLoading, setChangelogLoading] = useState(true);

    // Changelog Modal
    const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
    const [editingChangelog, setEditingChangelog] = useState<ChangelogEntry | null>(null);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDate, setModalDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [modalVersion, setModalVersion] = useState('v0.3.2');
    const [modalCategory, setModalCategory] = useState<ChangelogCategory>('release');
    const [modalItems, setModalItems] = useState<string[]>(['']);
    const [modalImages, setModalImages] = useState<string[]>([]);
    const [isUploadingImages, setIsUploadingImages] = useState(false);
    const [isSavingChangelog, setIsSavingChangelog] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Lightbox
    const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadChangelogs = useCallback(async () => {
        setChangelogLoading(true);
        try {
            const q = query(collection(db, 'changelog'));
            const snap = await getDocs(q);
            const list: ChangelogEntry[] = [];
            snap.forEach(d => {
                const data = d.data();
                list.push({
                    id: d.id,
                    title: data.title || '',
                    date: data.date || '',
                    version: data.version || '',
                    category: data.category || 'release',
                    items: data.items || [],
                    images: data.images || [],
                    createdAt: data.createdAt || '',
                    author: data.author
                });
            });

            if (list.length === 0) {
                const seedList = SEED_CHANGELOGS.map((item, index) => ({
                    id: `seed_${index}`,
                    ...item
                }));
                setChangelogs(seedList);
            } else {
                list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setChangelogs(list);
            }
        } catch (err) {
            console.error("Error loading changelogs:", err);
            const seedList = SEED_CHANGELOGS.map((item, index) => ({
                id: `seed_${index}`,
                ...item
            }));
            setChangelogs(seedList);
        } finally {
            setChangelogLoading(false);
        }
    }, []);

    useEffect(() => {
        loadChangelogs();
    }, [loadChangelogs]);

    const handleOpenCreateChangelog = () => {
        setEditingChangelog(null);
        setModalTitle('');
        setModalDate(new Date().toISOString().slice(0, 10));
        setModalVersion('v0.3.2');
        setModalCategory('release');
        setModalItems(['']);
        setModalImages([]);
        setModalError(null);
        setIsChangelogModalOpen(true);
    };

    const handleOpenEditChangelog = (entry: ChangelogEntry) => {
        setEditingChangelog(entry);
        setModalTitle(entry.title);
        setModalDate(entry.date);
        setModalVersion(entry.version || '');
        setModalCategory(entry.category || 'release');
        setModalItems(entry.items.length > 0 ? [...entry.items] : ['']);
        setModalImages(entry.images ? [...entry.images] : []);
        setModalError(null);
        setIsChangelogModalOpen(true);
    };

    const handleAddModalItem = () => setModalItems(prev => [...prev, '']);
    const handleUpdateModalItem = (index: number, val: string) => {
        setModalItems(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };
    const handleRemoveModalItem = (index: number) => {
        if (modalItems.length === 1) {
            setModalItems(['']);
            return;
        }
        setModalItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingImages(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const compressedBase64 = await compressImage(file, 1600, 1600, 0.82);
                uploadedUrls.push(compressedBase64);
            }
            setModalImages(prev => [...prev, ...uploadedUrls]);
        } catch (err) {
            console.error("Error processing screenshots:", err);
            alert("Failed to process selected image.");
        } finally {
            setIsUploadingImages(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveModalImage = (index: number) => {
        setModalImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveChangelog = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);

        const cleanTitle = modalTitle.trim();
        const cleanItems = modalItems.map(i => i.trim()).filter(Boolean);

        if (!cleanTitle) {
            setModalError('Please enter a post title.');
            return;
        }

        if (cleanItems.length === 0) {
            setModalError('Please provide at least one item of change.');
            return;
        }

        setIsSavingChangelog(true);
        try {
            const payload = {
                title: cleanTitle,
                date: modalDate,
                version: modalVersion.trim() || undefined,
                category: modalCategory,
                items: cleanItems,
                images: modalImages,
                createdAt: editingChangelog?.createdAt || new Date().toISOString(),
                author: user?.email || 'admin'
            };

            if (editingChangelog && !editingChangelog.id.startsWith('seed_')) {
                await updateDoc(doc(db, 'changelog', editingChangelog.id), payload);
            } else {
                await addDoc(collection(db, 'changelog'), payload);
            }

            setIsChangelogModalOpen(false);
            loadChangelogs();
        } catch (err) {
            console.error("Error saving changelog entry:", err);
            setModalError("Failed to save post. Please verify database permissions.");
        } finally {
            setIsSavingChangelog(false);
        }
    };

    const handleDeleteChangelog = async (id: string) => {
        if (!confirm("Are you sure you want to delete this changelog post?")) return;

        try {
            if (!id.startsWith('seed_')) {
                await deleteDoc(doc(db, 'changelog', id));
            }
            setChangelogs(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Error deleting changelog entry:", err);
            alert("Failed to delete post.");
        }
    };

    // ==========================================
    // 4. Admin Feedback Submissions Management
    // ==========================================
    const [adminFeedbacks, setAdminFeedbacks] = useState<DevFeedback[]>([]);
    const [adminFeedbackLoading, setAdminFeedbackLoading] = useState(false);
    const [adminFilter, setAdminFilter] = useState<'all' | 'open' | 'archived' | 'bug' | 'feature'>('open');
    const [adminSearch, setAdminSearch] = useState('');
    const [actionBusyId, setActionBusyId] = useState<string | null>(null);

    const loadAdminFeedbacks = useCallback(async () => {
        if (!userIsAdmin) return;
        setAdminFeedbackLoading(true);
        try {
            const q = query(collection(db, 'feedback'));
            const snap = await getDocs(q);
            const list: DevFeedback[] = [];
            snap.forEach(d => {
                const data = d.data();
                list.push({
                    id: d.id,
                    type: data.type || 'bug',
                    title: data.title || '',
                    description: data.description || '',
                    userEmail: data.userEmail,
                    userId: data.userId,
                    username: data.username,
                    status: data.status || 'open',
                    createdAt: data.createdAt || new Date().toISOString(),
                    archivedAt: data.archivedAt
                });
            });
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAdminFeedbacks(list);
        } catch (err) {
            console.error("Error loading feedbacks:", err);
        } finally {
            setAdminFeedbackLoading(false);
        }
    }, [userIsAdmin]);

    useEffect(() => {
        if (userIsAdmin) {
            loadAdminFeedbacks();
        }
    }, [userIsAdmin, loadAdminFeedbacks]);

    const handleDismissFeedback = async (item: DevFeedback) => {
        setActionBusyId(item.id);
        try {
            const newStatus = item.status === 'archived' ? 'open' : 'archived';
            const updates = {
                status: newStatus,
                archivedAt: newStatus === 'archived' ? new Date().toISOString() : null
            };
            await updateDoc(doc(db, 'feedback', item.id), updates);
            setAdminFeedbacks(prev =>
                prev.map(f => f.id === item.id ? { ...f, ...updates, status: newStatus } : f)
            );
        } catch (err) {
            console.error("Error updating feedback status:", err);
            alert("Failed to update status.");
        } finally {
            setActionBusyId(null);
        }
    };

    const handleDeleteFeedback = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this submission?")) return;
        setActionBusyId(id);
        try {
            await deleteDoc(doc(db, 'feedback', id));
            setAdminFeedbacks(prev => prev.filter(f => f.id !== id));
        } catch (err) {
            console.error("Error deleting feedback:", err);
            alert("Failed to delete submission.");
        } finally {
            setActionBusyId(null);
        }
    };

    const filteredAdminFeedbacks = adminFeedbacks.filter(f => {
        if (adminFilter === 'open' && f.status !== 'open') return false;
        if (adminFilter === 'archived' && f.status !== 'archived') return false;
        if (adminFilter === 'bug' && f.type !== 'bug') return false;
        if (adminFilter === 'feature' && f.type !== 'feature') return false;

        if (adminSearch.trim()) {
            const q = adminSearch.toLowerCase();
            return (
                f.title.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q) ||
                (f.userEmail || '').toLowerCase().includes(q) ||
                (f.username || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const openFeedbackCount = adminFeedbacks.filter(f => f.status === 'open').length;
    const archivedFeedbackCount = adminFeedbacks.filter(f => f.status === 'archived').length;

    return (
        <div className="max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col gap-8 select-none">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-text-primary mb-1">Developer</h1>
                <p className="text-text-secondary text-sm">
                    System telemetry, feedback reporting, and release changelog.
                </p>
            </div>

            {/* 1. Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                        Total Solves
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                        {metrics.loading ? '...' : metrics.totalSolves.toLocaleString()}
                    </div>
                </div>

                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                        Time Spent Solving
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                        {metrics.loading ? '...' : formatTimeMs(metrics.totalSolvingTimeMs)}
                    </div>
                </div>

                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                        Solves Today
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                        {metrics.loading ? '...' : metrics.solvesToday.toLocaleString()}
                    </div>
                </div>

                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                        Active Users (30d)
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                        {metrics.loading ? '...' : metrics.activeUsersPastMonth.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* 2. Bug Report & Requests Form */}
            <div className="bg-bg-secondary/40 border border-border rounded-xl p-5 shadow-xs">
                <h2 className="text-base font-bold text-text-primary mb-4">
                    Bug Report & Requests
                </h2>

                {feedbackSuccess && (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-xs font-medium">
                        Submission received. Thank you for your feedback!
                    </div>
                )}

                {feedbackError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-medium">
                        {feedbackError}
                    </div>
                )}

                <form onSubmit={handleFeedbackSubmit} className="space-y-3.5">
                    {/* Row 1: Title on left, Type on right */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                                Title / Summary
                            </label>
                            <input
                                type="text"
                                value={feedbackTitle}
                                onChange={(e) => setFeedbackTitle(e.target.value)}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                required
                            />
                        </div>
                        <div className="w-full sm:w-48 shrink-0">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                                Type
                            </label>
                            <select
                                value={feedbackType}
                                onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                            >
                                <option value="bug">Bug Report</option>
                                <option value="feature">Feature Request</option>
                                <option value="improvement">Improvement</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Description */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                            Description
                        </label>
                        <textarea
                            value={feedbackDescription}
                            onChange={(e) => setFeedbackDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y custom-scrollbar"
                            required
                        />
                    </div>

                    {/* Row 3: Contact Email on left, Send Feedback button on right */}
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                                Contact Email
                            </label>
                            <input
                                type="email"
                                value={feedbackEmail}
                                onChange={(e) => setFeedbackEmail(e.target.value)}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmittingFeedback}
                            className="w-full sm:w-auto px-5 py-2 bg-bg-primary border border-border text-text-primary hover:bg-accent hover:text-white hover:border-accent rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0 h-[38px]"
                        >
                            {isSubmittingFeedback ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </form>
            </div>

            {/* 3. Changelog & Updates */}
            <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <h2 className="text-base font-bold text-text-primary">
                        Changelog
                    </h2>
                    {userIsAdmin && (
                        <button
                            onClick={handleOpenCreateChangelog}
                            className="px-3 py-1.5 bg-transparent border border-border hover:bg-bg-hover hover:border-text-secondary text-text-primary rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                            Add Post
                        </button>
                    )}
                </div>

                {changelogLoading ? (
                    <div className="py-8 text-xs text-text-secondary">Loading changelog...</div>
                ) : changelogs.length === 0 ? (
                    <div className="py-8 text-xs text-text-secondary">No changelog posts yet.</div>
                ) : (
                    <div className="space-y-6">
                        {changelogs.map((entry) => (
                            <div key={entry.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono text-text-secondary">
                                        {formatVersionDate(entry.version, entry.date)}
                                    </span>
                                    {userIsAdmin && (
                                        <div className="flex items-center gap-3 text-xs">
                                            <button
                                                onClick={() => handleOpenEditChangelog(entry)}
                                                className="text-text-secondary hover:text-text-primary underline cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteChangelog(entry.id)}
                                                className="text-text-secondary hover:text-red-500 underline cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-sm font-bold text-text-primary">
                                    {entry.title}
                                </h3>

                                <ul className="space-y-1.5 text-xs text-text-secondary">
                                    {entry.items.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                            <span className="text-text-secondary/60 select-none">•</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>

                                {entry.images && entry.images.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                                        {entry.images.map((imgUrl, imgIdx) => (
                                            <div
                                                key={imgIdx}
                                                onClick={() => setActiveLightboxImage(imgUrl)}
                                                className="aspect-video rounded-lg overflow-hidden border border-border bg-bg-secondary cursor-pointer hover:opacity-90 transition-opacity"
                                            >
                                                <img
                                                    src={imgUrl}
                                                    alt="Changelog Screenshot"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Submission Management (Admin Only, at bottom) */}
            {userIsAdmin && (
                <div className="bg-bg-secondary/40 border border-border rounded-xl p-5 shadow-xs space-y-4 mt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                        <div>
                            <h2 className="text-base font-bold text-text-primary">
                                Submission Management
                            </h2>
                            <p className="text-xs text-text-secondary">
                                Review, dismiss to archive, or delete user feedback.
                            </p>
                        </div>
                        <button
                            onClick={loadAdminFeedbacks}
                            disabled={adminFeedbackLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-primary hover:bg-bg-hover text-text-primary border border-border transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-center"
                        >
                            {adminFeedbackLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {/* Filter buttons & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setAdminFilter('open')}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                    adminFilter === 'open'
                                        ? 'bg-text-primary text-bg-primary'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Active ({openFeedbackCount})
                            </button>
                            <button
                                onClick={() => setAdminFilter('archived')}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                    adminFilter === 'archived'
                                        ? 'bg-text-primary text-bg-primary'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Archived ({archivedFeedbackCount})
                            </button>
                            <button
                                onClick={() => setAdminFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                    adminFilter === 'all'
                                        ? 'bg-text-primary text-bg-primary'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                All ({adminFeedbacks.length})
                            </button>
                            <button
                                onClick={() => setAdminFilter('bug')}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                    adminFilter === 'bug'
                                        ? 'bg-text-primary text-bg-primary'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Bugs
                            </button>
                            <button
                                onClick={() => setAdminFilter('feature')}
                                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                    adminFilter === 'feature'
                                        ? 'bg-text-primary text-bg-primary'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Features
                            </button>
                        </div>

                        <input
                            type="text"
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full sm:w-48 px-3 py-1 bg-bg-primary border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                        />
                    </div>

                    {/* Submissions List */}
                    {adminFeedbackLoading ? (
                        <div className="py-6 text-xs text-text-secondary">Loading submissions...</div>
                    ) : filteredAdminFeedbacks.length === 0 ? (
                        <div className="py-6 text-xs text-text-secondary">No submissions in this view.</div>
                    ) : (
                        <div className="space-y-2.5">
                            {filteredAdminFeedbacks.map((item) => {
                                const isArchived = item.status === 'archived';
                                const isBusy = actionBusyId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                                            isArchived
                                                ? 'bg-bg-primary/40 border-border/40 opacity-70'
                                                : 'bg-bg-primary border-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-bg-secondary border border-border text-text-secondary">
                                                    {item.type}
                                                </span>
                                                <span className="text-text-secondary text-[11px]">
                                                    {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDismissFeedback(item)}
                                                    disabled={isBusy}
                                                    className="text-text-secondary hover:text-text-primary underline cursor-pointer disabled:opacity-50"
                                                >
                                                    {isArchived ? 'Restore' : 'Dismiss'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFeedback(item.id)}
                                                    disabled={isBusy}
                                                    className="text-text-secondary hover:text-red-500 underline cursor-pointer disabled:opacity-50"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        <div className="font-semibold text-text-primary">
                                            {item.title}
                                        </div>

                                        <p className="text-text-secondary whitespace-pre-wrap leading-relaxed">
                                            {item.description}
                                        </p>

                                        {(item.userEmail || item.username) && (
                                            <div className="text-[10px] text-text-secondary/70 font-mono pt-1">
                                                From: {item.username || ''} {item.userEmail ? `<${item.userEmail}>` : ''}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 5. Large Changelog Post Editor Modal */}
            {isChangelogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs">
                    <div className="bg-bg-primary border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="text-lg font-bold text-text-primary">
                                {editingChangelog ? 'Edit Changelog Post' : 'New Changelog Post'}
                            </h3>
                            <button
                                onClick={() => setIsChangelogModalOpen(false)}
                                className="text-text-secondary hover:text-text-primary text-sm font-semibold cursor-pointer"
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={handleSaveChangelog} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                            {modalError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500">
                                    {modalError}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={modalTitle}
                                    onChange={(e) => setModalTitle(e.target.value)}
                                    className="w-full bg-bg-secondary border border-border rounded-lg px-4 py-2.5 text-base text-text-primary focus:outline-none focus:border-accent"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={modalDate}
                                        onChange={(e) => setModalDate(e.target.value)}
                                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Version Tag
                                    </label>
                                    <input
                                        type="text"
                                        value={modalVersion}
                                        onChange={(e) => setModalVersion(e.target.value)}
                                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Category
                                    </label>
                                    <select
                                        value={modalCategory}
                                        onChange={(e) => setModalCategory(e.target.value as ChangelogCategory)}
                                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                    >
                                        <option value="release">Release</option>
                                        <option value="feature">Feature</option>
                                        <option value="improvement">Improvement</option>
                                        <option value="fix">Bug Fix</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                        Items of Change
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddModalItem}
                                        className="text-xs text-accent hover:underline font-semibold cursor-pointer"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {modalItems.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item}
                                                onChange={(e) => handleUpdateModalItem(index, e.target.value)}
                                                className="flex-1 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveModalItem(index)}
                                                className="px-2.5 py-1 text-xs text-text-secondary hover:text-red-500 rounded hover:bg-bg-secondary cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-2">
                                    Screenshots
                                </label>
                                <div className="space-y-3">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageFilesSelected}
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        id="changelog-image-upload-single"
                                    />
                                    <label
                                        htmlFor="changelog-image-upload-single"
                                        className="inline-block px-4 py-2 bg-bg-secondary border border-border rounded-lg text-xs font-semibold text-text-primary cursor-pointer hover:bg-bg-hover transition-colors"
                                    >
                                        {isUploadingImages ? 'Processing Images...' : 'Select Screenshot(s)'}
                                    </label>

                                    {modalImages.length > 0 && (
                                        <div className="grid grid-cols-3 gap-3">
                                            {modalImages.map((img, idx) => (
                                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border bg-bg-secondary">
                                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveModalImage(idx)}
                                                        className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/70 text-white hover:bg-red-500 text-[10px] rounded cursor-pointer"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-bg-secondary/30">
                            <button
                                type="button"
                                onClick={() => setIsChangelogModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveChangelog}
                                disabled={isSavingChangelog}
                                className="px-5 py-2 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-bold transition-opacity cursor-pointer disabled:opacity-50"
                            >
                                {isSavingChangelog ? 'Saving...' : (editingChangelog ? 'Update Post' : 'Publish Post')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Lightbox */}
            {activeLightboxImage && (
                <div
                    onClick={() => setActiveLightboxImage(null)}
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
                >
                    <img
                        src={activeLightboxImage}
                        alt="Screenshot"
                        className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
