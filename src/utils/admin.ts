import { db } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';

export const ADMIN_EMAIL = 'christianbcutter@yahoo.com';

export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
    if (!user || !user.email) return false;
    return user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * Admin action: Erases a user profile and all associated data from Firestore
 * (solves, sessions, goals, private settings, and user document)
 */
export async function eraseUserProfileAndData(targetUserId: string): Promise<void> {
    if (!targetUserId) return;

    // 1. Delete all solves for this user
    try {
        const solvesQuery = query(collection(db, 'solves'), where('userId', '==', targetUserId));
        const solvesSnap = await getDocs(solvesQuery);
        
        let batch = writeBatch(db);
        let count = 0;
        for (const d of solvesSnap.docs) {
            batch.delete(d.ref);
            count++;
            if (count % 400 === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }
        if (count % 400 !== 0) {
            await batch.commit();
        }
    } catch (e) {
        console.warn("Solves deletion warning:", e);
    }

    // 2. Delete all sessions for this user
    try {
        const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', targetUserId));
        const sessionsSnap = await getDocs(sessionsQuery);
        
        let batch = writeBatch(db);
        let count = 0;
        for (const d of sessionsSnap.docs) {
            batch.delete(d.ref);
            count++;
            if (count % 400 === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }
        if (count % 400 !== 0) {
            await batch.commit();
        }
    } catch (e) {
        console.warn("Sessions deletion warning:", e);
    }

    // 3. Delete user's goals subcollection documents
    try {
        const goalsSnap = await getDocs(collection(db, 'users', targetUserId, 'goals'));
        for (const d of goalsSnap.docs) {
            await deleteDoc(d.ref);
        }
    } catch (e) {
        console.warn("Goals deletion warning:", e);
    }

    // 4. Delete user's private subcollection documents
    try {
        const privateSnap = await getDocs(collection(db, 'users', targetUserId, 'private'));
        for (const d of privateSnap.docs) {
            await deleteDoc(d.ref);
        }
    } catch (e) {
        console.warn("Private subcollection deletion warning:", e);
    }

    // 5. Delete the main user profile document
    await deleteDoc(doc(db, 'users', targetUserId));
}

/**
 * Format milliseconds into a human-readable duration (e.g. "4d 12h 30m 15s" or "2h 45m")
 */
export function formatTimeMs(ms: number): string {
    if (!ms || ms <= 0) return '0s';

    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 && days === 0) parts.push(`${remainingSeconds}s`);

    return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Compresses an uploaded image file on the client using an offscreen canvas.
 * Returns a base64 data URL.
 */
export function compressImage(
    file: File,
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target?.result as string);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Use webp if supported, otherwise jpeg
                try {
                    const dataUrl = canvas.toDataURL('image/webp', quality);
                    if (dataUrl.startsWith('data:image/webp')) {
                        resolve(dataUrl);
                        return;
                    }
                } catch {
                    // fallback
                }

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
