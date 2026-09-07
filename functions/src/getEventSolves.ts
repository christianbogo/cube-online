import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';


export const getEventSolves = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const { scrambleType } = data;
    
    if (!scrambleType) {
        throw new functions.https.HttpsError('invalid-argument', 'scrambleType is required');
    }
    
    const solvesSnap = await admin.firestore().collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .get();
        
    const solves = solvesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort in memory
    solves.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { solves };
});
