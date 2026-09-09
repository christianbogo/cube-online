import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// 1. Export User Data
export const exportUserData = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;

    const userDocSnap = await db.collection('users').doc(userId).get();
    const userData = userDocSnap.exists ? userDocSnap.data() : { uid: userId };

    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    const solvesList = solvesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const sessionsSnap = await db.collection('sessions').where('userId', '==', userId).get();
    const sessionsList = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        user: userData,
        solvesCount: solvesList.length,
        solves: solvesList,
        sessionsCount: sessionsList.length,
        sessions: sessionsList
    };

    return exportData;
});

// 2. Delete User Account
export const deleteUserAccountFn = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;

    // Delete Solves
    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    let batch = db.batch();
    let count = 0;
    for (const d of solvesSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete Sessions
    const sessionsSnap = await db.collection('sessions').where('userId', '==', userId).get();
    batch = db.batch();
    count = 0;
    for (const d of sessionsSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete subcollections and user doc
    const goalsSnap = await db.collection('users').doc(userId).collection('goals').get();
    for (const d of goalsSnap.docs) await d.ref.delete();
    
    const privateSnap = await db.collection('users').doc(userId).collection('private').get();
    for (const d of privateSnap.docs) await d.ref.delete();
    
    const statsSnap = await db.collection('users').doc(userId).collection('stats').get();
    for (const d of statsSnap.docs) await d.ref.delete();

    const recordsSnap = await db.collection('users').doc(userId).collection('records').get();
    for (const d of recordsSnap.docs) await d.ref.delete();

    await db.collection('users').doc(userId).delete();

    // Delete auth user
    await admin.auth().deleteUser(userId);

    return { success: true };
});

// 3. Delete All Solves
export const deleteAllSolvesFn = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;

    // Delete Solves
    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    let batch = db.batch();
    let count = 0;
    for (const d of solvesSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete Sessions
    const sessionsSnap = await db.collection('sessions').where('userId', '==', userId).get();
    batch = db.batch();
    count = 0;
    for (const d of sessionsSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete Stats Overview
    await db.collection('users').doc(userId).collection('stats').doc('overview').delete();

    return { success: true };
});

// 4. Delete Imported Solves
export const deleteImportedSolvesFn = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const source = data.source || 'cstimer';

    const solvesSnap = await db.collection('solves').where('userId', '==', userId).get();
    const toDeleteSolves = solvesSnap.docs.filter(d => {
        const docData = d.data();
        return docData.source === source || (typeof docData.sessionId === 'string' && docData.sessionId.startsWith(`${source}_`));
    });

    let batch = db.batch();
    let count = 0;
    for (const d of toDeleteSolves) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    const sessionsSnap = await db.collection('sessions').where('userId', '==', userId).get();
    const toDeleteSessions = sessionsSnap.docs.filter(d => {
        const docData = d.data();
        return d.id.startsWith(`${source}_`) || docData.source === source;
    });

    batch = db.batch();
    count = 0;
    for (const d of toDeleteSessions) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    return { success: true, deletedCount: toDeleteSolves.length };
});


// 5. Admin Delete User Account
export const adminDeleteUserAccountFn = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    
    // verify admin
    const ADMIN_EMAIL = 'christianbcutter@yahoo.com';
    const callerEmail = context.auth.token.email;
    if (callerEmail?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
        throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const targetUserId = data.targetUserId;
    if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'targetUserId is required');

    // Delete Solves
    const solvesSnap = await db.collection('solves').where('userId', '==', targetUserId).get();
    let batch = db.batch();
    let count = 0;
    for (const d of solvesSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete Sessions
    const sessionsSnap = await db.collection('sessions').where('userId', '==', targetUserId).get();
    batch = db.batch();
    count = 0;
    for (const d of sessionsSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();

    // Delete subcollections and user doc
    const goalsSnap = await db.collection('users').doc(targetUserId).collection('goals').get();
    for (const d of goalsSnap.docs) await d.ref.delete();
    
    const privateSnap = await db.collection('users').doc(targetUserId).collection('private').get();
    for (const d of privateSnap.docs) await d.ref.delete();
    
    const statsSnap = await db.collection('users').doc(targetUserId).collection('stats').get();
    for (const d of statsSnap.docs) await d.ref.delete();

    const recordsSnap = await db.collection('users').doc(targetUserId).collection('records').get();
    for (const d of recordsSnap.docs) await d.ref.delete();

    await db.collection('users').doc(targetUserId).delete();

    // Note: To delete another auth user from client SDK via cloud function, we use admin.auth()
    try {
        await admin.auth().deleteUser(targetUserId);
    } catch (e) {
        console.warn('Could not delete auth user', e);
    }

    return { success: true };
});
