export const ADMIN_EMAIL = 'christianbcutter@yahoo.com';

export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
    if (!user || !user.email) return false;
    return user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
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
