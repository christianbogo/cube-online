import { useState, useEffect, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { compressImage } from '../../utils/admin';
import { Link } from 'react-router-dom';
import {
    Bug,
    Sparkles,
    Send,
    Check,
    AlertCircle,
    MessageSquarePlus,
    Flame,
    Paperclip,
    FileText,
    X,
    ShieldCheck
} from 'lucide-react';
import type { FeedbackType } from '../../types';

export default function FeedbackTab() {
    const { user } = useAuth();

    // Form State
    const [type, setType] = useState<FeedbackType>('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [attachments, setAttachments] = useState<{ filename: string; content: string; type?: string; isImage?: boolean }[]>([]);
    const [isProcessingAttachments, setIsProcessingAttachments] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize contact email from user
    useEffect(() => {
        if (user?.email && !contactEmail) {
            setContactEmail(user.email);
        }
    }, [user, contactEmail]);

    const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsProcessingAttachments(true);
        try {
            const newAttachments: { filename: string; content: string; type?: string; isImage?: boolean }[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const isImage = file.type.startsWith('image/');
                if (isImage) {
                    const base64 = await compressImage(file, 1600, 1600, 0.82);
                    newAttachments.push({
                        filename: file.name,
                        content: base64,
                        type: file.type,
                        isImage: true
                    });
                } else {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = (err) => reject(err);
                        reader.readAsDataURL(file);
                    });
                    newAttachments.push({
                        filename: file.name,
                        content: base64,
                        type: file.type || 'application/octet-stream',
                        isImage: false
                    });
                }
            }
            setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
        } catch (err) {
            console.error("Error processing attachments:", err);
            setFormError("Failed to process selected file(s).");
        } finally {
            setIsProcessingAttachments(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

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
                createdAt: new Date().toISOString(),
                attachments: attachments.map(a => ({
                    filename: a.filename,
                    content: a.content,
                    type: a.type
                }))
            };

            // 1. Send via Resend API
            try {
                const apiRes = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(feedbackData)
                });
                if (!apiRes.ok) {
                    const errData = await apiRes.json().catch(() => ({}));
                    console.warn('API error:', errData);
                }
            } catch (apiErr) {
                console.warn('Failed to call /api/feedback:', apiErr);
            }

            // 2. Firestore backup
            try {
                await addDoc(collection(db, 'feedback'), {
                    type: feedbackData.type,
                    title: feedbackData.title,
                    description: feedbackData.description,
                    userEmail: feedbackData.userEmail,
                    userId: feedbackData.userId,
                    username: feedbackData.username,
                    status: 'open',
                    createdAt: feedbackData.createdAt,
                    attachmentCount: attachments.length
                });
            } catch (dbErr) {
                console.warn('Firestore backup failed:', dbErr);
            }

            setTitle('');
            setDescription('');
            setAttachments([]);
            setSubmitSuccess(true);
            setTimeout(() => setSubmitSuccess(false), 5000);
        } catch (err) {
            console.error("Failed to submit feedback:", err);
            setFormError('Failed to submit. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                            <p className="text-[11px] opacity-90">Thank you for helping improve the site. Your report has been delivered.</p>
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

                    {/* Attachments */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                Attachments <span className="text-[10px] font-normal lowercase opacity-75">(screenshots or files, max 5)</span>
                            </label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFilesSelected}
                                accept="image/*,.log,.txt,.json"
                                multiple
                                className="hidden"
                                id="feedback-tab-file-upload"
                            />
                            <label
                                htmlFor="feedback-tab-file-upload"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border/80 cursor-pointer transition-colors"
                            >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>{isProcessingAttachments ? 'Processing...' : 'Attach Screenshot / File'}</span>
                            </label>
                        </div>

                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {attachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 p-1.5 pr-2 bg-bg-primary border border-border rounded-lg text-xs group"
                                    >
                                        {att.isImage ? (
                                            <div className="w-7 h-7 rounded overflow-hidden bg-bg-secondary shrink-0 border border-border/50">
                                                <img src={att.content} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-7 h-7 rounded bg-bg-secondary flex items-center justify-center shrink-0 border border-border/50 text-text-secondary">
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                        <span className="max-w-[140px] truncate text-text-primary text-[11px] font-medium" title={att.filename}>
                                            {att.filename}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttachment(idx)}
                                            className="text-text-secondary hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
                                            title="Remove attachment"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 w-fit"
                        >
                            <Send className="w-4 h-4" />
                            <span>{isSubmitting ? 'Submitting...' : 'Send Feedback'}</span>
                        </button>
                        <div className="text-[11px] text-text-secondary flex items-center gap-1.5 opacity-80">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Reports &amp; uploads handled securely per our <Link to="/privacy" className="text-accent underline font-medium">Privacy Policy</Link>.</span>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
