import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { isAdmin } from '../../utils/admin';
import {
    Bug,
    Sparkles,
    Send,
    Archive,
    Trash2,
    RotateCcw,
    Check,
    AlertCircle,
    Search,
    Shield,
    Inbox,
    MessageSquarePlus,
    Flame
} from 'lucide-react';
import type { DevFeedback, FeedbackType } from '../../types';

export default function FeedbackTab() {
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Form State
    const [type, setType] = useState<FeedbackType>('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Admin State
    const [feedbacks, setFeedbacks] = useState<DevFeedback[]>([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'archived' | 'bug' | 'feature'>('open');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Initialize contact email from user
    useEffect(() => {
        if (user?.email && !contactEmail) {
            setContactEmail(user.email);
        }
    }, [user, contactEmail]);

    // Fetch feedbacks if Admin
    const loadFeedbacks = useCallback(async () => {
        if (!userIsAdmin) return;
        setAdminLoading(true);
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

            // Sort descending by date
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setFeedbacks(list);
        } catch (err) {
            console.error("Error loading feedback list:", err);
        } finally {
            setAdminLoading(false);
        }
    }, [userIsAdmin]);

    useEffect(() => {
        if (userIsAdmin) {
            loadFeedbacks();
        }
    }, [userIsAdmin, loadFeedbacks]);

    // Submit new report / request
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!title.trim() || !description.trim()) {
            setFormError('Please provide both a title and description.');
            return;
        }

        setIsSubmitting(true);
        try {
            const feedbackData = {
                type,
                title: title.trim(),
                description: description.trim(),
                userEmail: contactEmail.trim() || (user?.email ?? ''),
                userId: user?.uid || null,
                username: user?.username || null,
                status: 'open',
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'feedback'), feedbackData);

            setTitle('');
            setDescription('');
            setSubmitSuccess(true);
            setTimeout(() => setSubmitSuccess(false), 5000);

            if (userIsAdmin) {
                loadFeedbacks();
            }
        } catch (err) {
            console.error("Failed to submit feedback:", err);
            setFormError('Failed to submit. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Admin: Dismiss / Archive submission
    const handleDismiss = async (item: DevFeedback) => {
        setActionLoadingId(item.id);
        try {
            const newStatus = item.status === 'archived' ? 'open' : 'archived';
            const updates = {
                status: newStatus,
                archivedAt: newStatus === 'archived' ? new Date().toISOString() : null
            };

            await updateDoc(doc(db, 'feedback', item.id), updates);

            setFeedbacks(prev =>
                prev.map(f => f.id === item.id ? { ...f, ...updates, status: newStatus } : f)
            );
        } catch (err) {
            console.error("Error archiving feedback:", err);
            alert("Failed to update status.");
        } finally {
            setActionLoadingId(null);
        }
    };

    // Admin: Delete submission
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this submission?")) return;

        setActionLoadingId(id);
        try {
            await deleteDoc(doc(db, 'feedback', id));
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        } catch (err) {
            console.error("Error deleting feedback:", err);
            alert("Failed to delete submission.");
        } finally {
            setActionLoadingId(null);
        }
    };

    // Filter feedback list
    const filteredFeedbacks = feedbacks.filter(f => {
        if (activeFilter === 'open' && f.status !== 'open') return false;
        if (activeFilter === 'archived' && f.status !== 'archived') return false;
        if (activeFilter === 'bug' && f.type !== 'bug') return false;
        if (activeFilter === 'feature' && f.type !== 'feature') return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesTitle = f.title.toLowerCase().includes(q);
            const matchesDesc = f.description.toLowerCase().includes(q);
            const matchesEmail = (f.userEmail || '').toLowerCase().includes(q);
            const matchesUser = (f.username || '').toLowerCase().includes(q);
            return matchesTitle || matchesDesc || matchesEmail || matchesUser;
        }

        return true;
    });

    const openCount = feedbacks.filter(f => f.status === 'open').length;
    const archivedCount = feedbacks.filter(f => f.status === 'archived').length;

    const getTypeBadge = (t: FeedbackType) => {
        switch (t) {
            case 'bug':
                return { label: 'Bug Report', bg: 'bg-red-500/10 text-red-500 border-red-500/20', icon: Bug };
            case 'feature':
                return { label: 'Feature Request', bg: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: Sparkles };
            case 'improvement':
                return { label: 'Improvement', bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', icon: Flame };
            default:
                return { label: 'General', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: MessageSquarePlus };
        }
    };

    return (
        <div className="space-y-8 max-w-5xl">
            {/* User Submission Form Card */}
            <div className="bg-bg-secondary/40 border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
                    <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                        <MessageSquarePlus className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-text-primary">
                            Submit a Bug Report or Feature Request
                        </h2>
                        <p className="text-xs text-text-secondary">
                            Found an issue or have an idea to make Cube Online better? Send it directly to the dev team.
                        </p>
                    </div>
                </div>

                {submitSuccess && (
                    <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 flex items-center gap-3 animate-in fade-in">
                        <Check className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">Submission Received!</p>
                            <p className="text-[11px] opacity-90">Thank you for helping improve the site. Your report has been saved.</p>
                        </div>
                    </div>
                )}

                {formError && (
                    <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 flex items-center gap-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-2">
                            Type
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['bug', 'feature', 'improvement', 'other'] as FeedbackType[]).map((t) => {
                                const isSelected = type === t;
                                const badge = getTypeBadge(t);
                                const Icon = badge.icon;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                            isSelected
                                                ? `${badge.bg} border-current ring-1 ring-current/30`
                                                : 'bg-bg-primary border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{badge.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                            Title / Summary
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Megaminx scramble preview occasionally clips on mobile"
                            className="w-full bg-bg-primary border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                            Description & Details
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what happened, steps to reproduce, or details of the feature you would like to see..."
                            rows={4}
                            className="w-full bg-bg-primary border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-y custom-scrollbar"
                            required
                        />
                    </div>

                    {/* Contact Email */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                            Contact Email <span className="text-[10px] font-normal lowercase opacity-75">(optional, for follow-up questions)</span>
                        </label>
                        <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="your-email@example.com"
                            className="w-full bg-bg-primary border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                        <span>{isSubmitting ? 'Submitting...' : 'Send Feedback'}</span>
                    </button>
                </form>
            </div>

            {/* Admin Management Dashboard */}
            {userIsAdmin ? (
                <div className="bg-bg-secondary/40 border border-border rounded-2xl p-6 shadow-sm space-y-5">
                    {/* Admin Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                    Submissions Management
                                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                        Admin Panel
                                    </span>
                                </h3>
                                <p className="text-xs text-text-secondary">
                                    Review, dismiss (archive), or delete user-submitted issues and requests.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={loadFeedbacks}
                            disabled={adminLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-primary hover:bg-bg-hover text-text-primary border border-border transition-all cursor-pointer disabled:opacity-50 self-start sm:self-center"
                        >
                            <RotateCcw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh List</span>
                        </button>
                    </div>

                    {/* Filter Pills & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                onClick={() => setActiveFilter('open')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'open'
                                        ? 'bg-accent text-white shadow-sm'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Active ({openCount})
                            </button>
                            <button
                                onClick={() => setActiveFilter('archived')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'archived'
                                        ? 'bg-accent text-white shadow-sm'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Archived Folder ({archivedCount})
                            </button>
                            <button
                                onClick={() => setActiveFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'all'
                                        ? 'bg-accent text-white shadow-sm'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                All ({feedbacks.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('bug')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'bug'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Bugs
                            </button>
                            <button
                                onClick={() => setActiveFilter('feature')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'feature'
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Features
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search submissions..."
                                className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-bg-primary border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent"
                            />
                        </div>
                    </div>

                    {/* Submissions List */}
                    {adminLoading ? (
                        <div className="py-12 text-center text-xs text-text-secondary">
                            Loading submissions from database...
                        </div>
                    ) : filteredFeedbacks.length === 0 ? (
                        <div className="py-12 text-center text-xs text-text-secondary flex flex-col items-center gap-2">
                            <Inbox className="w-8 h-8 opacity-40" />
                            <span>No submissions found in this view.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredFeedbacks.map((item) => {
                                const badge = getTypeBadge(item.type);
                                const Icon = badge.icon;
                                const isArchived = item.status === 'archived';
                                const isBusy = actionLoadingId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl border transition-all ${
                                            isArchived
                                                ? 'bg-bg-primary/40 border-border/40 opacity-70'
                                                : 'bg-bg-primary border-border hover:border-accent/40 shadow-xs'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}>
                                                    <Icon className="w-3 h-3" />
                                                    {badge.label}
                                                </span>
                                                {isArchived && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                                                        Archived
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-text-secondary">
                                                    {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                <button
                                                    onClick={() => handleDismiss(item)}
                                                    disabled={isBusy}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                                                        isArchived
                                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border-border'
                                                    }`}
                                                    title={isArchived ? "Restore to Active" : "Dismiss to Archived folder"}
                                                >
                                                    <Archive className="w-3.5 h-3.5" />
                                                    <span>{isArchived ? 'Restore' : 'Dismiss / Archive'}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={isBusy}
                                                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                                                    title="Permanently Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-bold text-text-primary mb-1">
                                            {item.title}
                                        </h4>

                                        <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed mb-3">
                                            {item.description}
                                        </p>

                                        {(item.userEmail || item.username) && (
                                            <div className="text-[11px] text-text-secondary/70 flex items-center gap-2 border-t border-border/40 pt-2 font-mono">
                                                <span>Submitted by:</span>
                                                {item.username && <span className="font-semibold text-text-primary">{item.username}</span>}
                                                {item.userEmail && <span>&lt;{item.userEmail}&gt;</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-bg-secondary/20 border border-border/40 rounded-2xl p-4 text-center">
                    <p className="text-xs text-text-secondary">
                        Sign in as the project administrator to review and moderate submitted feedback.
                    </p>
                </div>
            )}
        </div>
    );
}
