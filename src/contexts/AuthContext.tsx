import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    onAuthStateChanged,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification
} from 'firebase/auth';
import { doc, onSnapshot, query, collection, where, getDocs, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserData {
    uid: string;
    email: string | null;
    username: string;
    color: string;
    emailVerified: boolean;
    starredUsers?: string[];
    blockedUsers?: string[];
}

interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    emailSignUp: (email: string, pass: string) => Promise<any>;
    emailSignIn: (email: string, pass: string) => Promise<any>;
    resendVerificationEmail: () => Promise<void>;
    logout: () => Promise<void>;
    deleteUserAccount?: () => Promise<void>;
    toggleStarUser: (targetUid: string) => Promise<void>;
    toggleBlockUser: (targetUid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(() => {
        const cached = localStorage.getItem('cached_user_profile');
        return cached ? JSON.parse(cached) : null;
    });
    const [loading, setLoading] = useState(!user);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Real-time listener for user data
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                    let userData: UserData;
                    if (docSnap.exists()) {
                        userData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            ...docSnap.data() as { username: string; color: string }
                        };
                    } else {
                        userData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            emailVerified: firebaseUser.emailVerified,
                            username: firebaseUser.displayName || 'CubingUser',
                            color: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'][Math.floor(Math.random() * 10)],
                            starredUsers: [],
                            blockedUsers: []
                        };
                    }
                    setUser(userData);
                    localStorage.setItem('cached_user_profile', JSON.stringify(userData));
                    setLoading(false);
                });

                // Cleanup subscription when auth state changes or component unmounts
                return () => unsubscribeDoc();
            } else {
                setUser(null);
                localStorage.removeItem('cached_user_profile');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const emailSignUp = async (email: string, pass: string) => {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        // Send verification email on sign up
        await sendEmailVerification(result.user);
        return result;
    };

    const emailSignIn = (email: string, pass: string) => {
        return signInWithEmailAndPassword(auth, email, pass);
    };

    const resendVerificationEmail = async () => {
        if (auth.currentUser && !auth.currentUser.emailVerified) {
            await sendEmailVerification(auth.currentUser);
        }
    };

    const logout = async () => {
        await firebaseSignOut(auth);
        // Clear local cache
        localStorage.removeItem('cached_user_profile');
        setUser(null);
    };

    const deleteUserAccount = async () => {
        if (!user || !user.uid) return;

        try {
            // 1. Delete all user solves
            const q = query(collection(db, 'solves'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // 2. Delete user profile
            await deleteDoc(doc(db, 'users', user.uid));

            // 3. Delete Firebase Auth User
            // Note: This requires re-authentication if recent login is old, 
            // but for simplicity we assume active session.
            const currentUser = auth.currentUser;
            if (currentUser) {
                await currentUser.delete();
            }
        } catch (error) {
            console.error("Error deleting account", error);
            throw error;
        }
    };

    const toggleStarUser = async (targetUid: string) => {
        if (!user) return;
        const currentStarred = user.starredUsers || [];
        const isStarred = currentStarred.includes(targetUid);
        let newStarred;
        if (isStarred) {
            newStarred = currentStarred.filter(id => id !== targetUid);
        } else {
            newStarred = [...currentStarred, targetUid];
        }
        await updateDoc(doc(db, 'users', user.uid), { starredUsers: newStarred });
    };

    const toggleBlockUser = async (targetUid: string) => {
        if (!user) return;
        const currentBlocked = user.blockedUsers || [];
        const isBlocked = currentBlocked.includes(targetUid);
        let newBlocked;
        if (isBlocked) {
            newBlocked = currentBlocked.filter(id => id !== targetUid);
        } else {
            newBlocked = [...currentBlocked, targetUid];
        }
        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: newBlocked });
    };

    return (
        <AuthContext.Provider value={{ user, loading, emailSignUp, emailSignIn, resendVerificationEmail, logout, deleteUserAccount, toggleStarUser, toggleBlockUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
