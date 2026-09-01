import { useState, useEffect, useCallback, useRef } from 'react';
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
import { isAdmin, compressImage } from '../../utils/admin';
import {
    Plus,
    Calendar,
    Tag,
    Trash2,
    Edit3,
    X,
    Check,
    RotateCcw,
    Sparkles,
    ZoomIn,
    Upload,
    ChevronRight,
    Loader2
} from 'lucide-react';
import type { ChangelogEntry, ChangelogCategory } from '../../types';

// Default initial posts if database is empty
const SEED_CHANGELOGS: Omit<ChangelogEntry, 'id'>[] = [
    {
        title: 'v0.3.1 - Developer Portal, Live Timing & Performance',
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
        title: 'v0.3.0 - Enhanced Socials, Goal Milestones & Binds',
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

export default function ChangelogTab() {
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);

    const [title, setTitle] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [version, setVersion] = useState('v0.3.2');
    const [category, setCategory] = useState<ChangelogCategory>('release');
    const [items, setItems] = useState<string[]>(['']);
    const [images, setImages] = useState<string[]>([]);
    const [imageUploading, setImageUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Lightbox image viewer
    const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch entries
    const loadEntries = useCallback(async () => {
        setLoading(true);
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
                // Seed default entries in local state
                const seedList = SEED_CHANGELOGS.map((item, index) => ({
                    id: `seed_${index}`,
                    ...item
                }));
                setEntries(seedList);
            } else {
                // Sort descending by date
                list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setEntries(list);
            }
        } catch (err) {
            console.error("Error loading changelog entries:", err);
            // Fallback to seeds
            const seedList = SEED_CHANGELOGS.map((item, index) => ({
                id: `seed_${index}`,
                ...item
            }));
            setEntries(seedList);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    // Open Modal for Create or Edit
    const handleOpenCreateModal = () => {
        setEditingEntry(null);
        setTitle('');
        setDate(new Date().toISOString().slice(0, 10));
        setVersion('v0.3.2');
        setCategory('release');
        setItems(['']);
        setImages([]);
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (entry: ChangelogEntry) => {
        setEditingEntry(entry);
        setTitle(entry.title);
        setDate(entry.date);
        setVersion(entry.version || '');
        setCategory(entry.category || 'release');
        setItems(entry.items.length > 0 ? [...entry.items] : ['']);
        setImages(entry.images ? [...entry.images] : []);
        setFormError(null);
        setIsModalOpen(true);
    };

    // Item List helpers
    const handleAddItem = () => {
        setItems(prev => [...prev, '']);
    };

    const handleItemChange = (index: number, val: string) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleRemoveItem = (index: number) => {
        if (items.length === 1) {
            setItems(['']);
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // Image Upload
    const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setImageUploading(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Compress client-side
                const compressedBase64 = await compressImage(file, 1400, 1400, 0.82);
                uploadedUrls.push(compressedBase64);
            }
            setImages(prev => [...prev, ...uploadedUrls]);
        } catch (err) {
            console.error("Error processing screenshots:", err);
            alert("Failed to process selected image.");
        } finally {
            setImageUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Save Entry (Create / Update)
    const handleSaveEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const cleanTitle = title.trim();
        const cleanItems = items.map(i => i.trim()).filter(Boolean);

        if (!cleanTitle) {
            setFormError('Please enter a post title.');
            return;
        }

        if (cleanItems.length === 0) {
            setFormError('Please provide at least one item of change.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                title: cleanTitle,
                date,
                version: version.trim() || undefined,
                category,
                items: cleanItems,
                images,
                createdAt: editingEntry?.createdAt || new Date().toISOString(),
                author: user?.email || 'admin'
            };

            if (editingEntry && !editingEntry.id.startsWith('seed_')) {
                await updateDoc(doc(db, 'changelog', editingEntry.id), payload);
            } else {
                await addDoc(collection(db, 'changelog'), payload);
            }

            setIsModalOpen(false);
            loadEntries();
        } catch (err) {
            console.error("Error saving changelog entry:", err);
            setFormError("Failed to save post. Please verify database permissions.");
        } finally {
            setSaving(false);
        }
    };

    // Delete Entry
    const handleDeleteEntry = async (id: string) => {
        if (!confirm("Are you sure you want to delete this changelog post?")) return;

        try {
            if (!id.startsWith('seed_')) {
                await deleteDoc(doc(db, 'changelog', id));
            }
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error("Error deleting changelog entry:", err);
            alert("Failed to delete post.");
        }
    };

    const getCategoryBadge = (cat?: ChangelogCategory) => {
        switch (cat) {
            case 'feature':
                return { label: 'Feature', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
            case 'improvement':
                return { label: 'Improvement', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' };
            case 'fix':
                return { label: 'Bug Fix', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
            default:
                return { label: 'Release', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header / Admin Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-secondary/40 border border-border p-5 rounded-2xl">
                <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-accent" />
                        Update Changelog & Release Notes
                    </h2>
                    <p className="text-xs text-text-secondary mt-0.5">
                        Track recent improvements, puzzle engine updates, and newly released tools.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadEntries}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-primary hover:bg-bg-hover text-text-primary border border-border transition-all cursor-pointer disabled:opacity-50"
                        title="Reload changelog"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>

                    {userIsAdmin && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-accent hover:opacity-90 text-white transition-all shadow-sm cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Post</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Changelog Timeline Feed */}
            {loading ? (
                <div className="py-16 text-center text-xs text-text-secondary">
                    Loading changelog history...
                </div>
            ) : entries.length === 0 ? (
                <div className="py-16 text-center text-xs text-text-secondary">
                    No changelog posts recorded yet.
                </div>
            ) : (
                <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-[2px] before:bg-border/70">
                    {entries.map((entry) => {
                        const badge = getCategoryBadge(entry.category);
                        return (
                            <div key={entry.id} className="relative group">
                                {/* Timeline Node Bullet */}
                                <div className="absolute -left-6 sm:-left-8 top-1.5 w-5 h-5 rounded-full bg-bg-primary border-2 border-accent flex items-center justify-center shadow-xs">
                                    <div className="w-2 h-2 rounded-full bg-accent" />
                                </div>

                                {/* Post Card */}
                                <div className="bg-bg-secondary/40 border border-border rounded-2xl p-5 hover:border-accent/30 transition-all shadow-sm">
                                    {/* Post Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-border/50">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.color}`}>
                                                <Tag className="w-3 h-3" />
                                                {entry.version || badge.label}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs text-text-secondary font-medium">
                                                <Calendar className="w-3.5 h-3.5 opacity-70" />
                                                {entry.date}
                                            </span>
                                        </div>

                                        {userIsAdmin && (
                                            <div className="flex items-center gap-1 self-end sm:self-auto">
                                                <button
                                                    onClick={() => handleOpenEditModal(entry)}
                                                    className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                                    title="Edit Post"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEntry(entry.id)}
                                                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    title="Delete Post"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Post Title */}
                                    <h3 className="text-base font-bold text-text-primary mb-3">
                                        {entry.title}
                                    </h3>

                                    {/* Items List */}
                                    <ul className="space-y-2 mb-4">
                                        {entry.items.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-xs text-text-primary/90 leading-relaxed">
                                                <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Screenshot Gallery */}
                                    {entry.images && entry.images.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-border/40">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block mb-2">
                                                Screenshots & Previews
                                            </span>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {entry.images.map((imgUrl, imgIdx) => (
                                                    <div
                                                        key={imgIdx}
                                                        onClick={() => setActiveLightboxImage(imgUrl)}
                                                        className="group/img relative aspect-video rounded-xl overflow-hidden border border-border bg-bg-primary cursor-pointer hover:border-accent transition-all"
                                                    >
                                                        <img
                                                            src={imgUrl}
                                                            alt={`Screenshot ${imgIdx + 1}`}
                                                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                                                            <ZoomIn className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Admin Composer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-bg-primary border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-accent" />
                                {editingEntry ? 'Edit Changelog Post' : 'Create New Changelog Post'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSaveEntry} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {formError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500">
                                    {formError}
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                    Post Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. v0.3.2 - Live Timing & Performance Enhancements"
                                    className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                                    required
                                />
                            </div>

                            {/* Date, Version & Category Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Version Tag
                                    </label>
                                    <input
                                        type="text"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        placeholder="v0.3.2"
                                        className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                        Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => {
                                            setCategory(e.target.value as ChangelogCategory);
                                        }}
                                        className="w-full bg-bg-secondary border border-border rounded-xl pl-3 pr-8 py-2 text-xs text-text-primary outline-none focus:outline-none focus:ring-0 focus:border-accent"
                                    >
                                        <option value="release">Release</option>
                                        <option value="feature">Feature</option>
                                        <option value="improvement">Improvement</option>
                                        <option value="fix">Bug Fix</option>
                                    </select>
                                </div>
                            </div>

                            {/* Items List */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                        Items of Change
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs text-accent hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Item</span>
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item}
                                                onChange={(e) => handleItemChange(index, e.target.value)}
                                                placeholder={`Change item #${index + 1}...`}
                                                className="flex-1 bg-bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 text-text-secondary hover:text-red-500 rounded-lg hover:bg-bg-secondary cursor-pointer"
                                                title="Remove item"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Screenshot Uploading */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                                    Screenshots & Attachments
                                </label>

                                <div className="space-y-3">
                                    {/* Upload Button */}
                                    <div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageFilesSelected}
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            id="changelog-image-upload"
                                        />
                                        <label
                                            htmlFor="changelog-image-upload"
                                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-bg-secondary border border-dashed border-border hover:border-accent rounded-xl text-xs font-semibold text-text-primary cursor-pointer transition-all hover:bg-bg-hover"
                                        >
                                            {imageUploading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                                    <span>Compressing Image...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4 text-accent" />
                                                    <span>Upload Screenshot(s)</span>
                                                </>
                                            )}
                                        </label>
                                    </div>

                                    {/* Preview Thumbnails */}
                                    {images.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2.5">
                                            {images.map((img, idx) => (
                                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border bg-bg-secondary group">
                                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(idx)}
                                                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-red-500 transition-colors cursor-pointer"
                                                        title="Remove screenshot"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-bg-secondary/40">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEntry}
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-5 py-2 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>{editingEntry ? 'Update Post' : 'Publish Post'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Lightbox for Screenshots */}
            {activeLightboxImage && (
                <div
                    onClick={() => setActiveLightboxImage(null)}
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                        <img
                            src={activeLightboxImage}
                            alt="Expanded screenshot"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10"
                        />
                        <button
                            onClick={() => setActiveLightboxImage(null)}
                            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
