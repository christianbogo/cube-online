# **Technical Requirements Document: Cutter’s Cubing Advanced Features**

Version: 1.0  
Target System: Next.js (App Router), Firebase (Firestore), TypeScript  
Author: Automated for Cutter's Development Workflow

## **Part 1: Adaptive Outlier Detection (MAD Algorithm)**

### **1.1 Objective**

To algorithmically flag anomalous solves (misclicks or distractions) in a non-stationary data stream where the user's average performance improves over time.

### **1.2 Core Algorithm**

The system shall use a **Rolling Window Median Absolute Deviation (MAD)** approach.

* **Formula:** MAD \= Median(|Xi \- Median(X)|)  
* **Z-Score Equivalent:** Modified\_Z \= 0.6745 \* (Xi \- Median(X)) / MAD (Optional, for standardizing)

### **1.3 Parameters & Constants**

These values are the "tunable knobs" for the algorithm.

| Parameter | Recommended Value | Description |
| :---- | :---- | :---- |
| **WINDOW\_SIZE** | 50 | The number of recent solves to analyze. *Note: If total\_solves \< 10, disable detection.* |
| **K\_LOW** | 3.0 | Sensitivity for "Too Fast" (Misclicks). Higher \= Less sensitive. *Protection: Must strictly exclude Global PBs.* |
| **K\_HIGH** | 5.0 | Sensitivity for "Too Slow" (Timer left running). Higher \= Less sensitive. |
| **MIN\_MAD** | 0.5s | **Critical Guardrail.** If a user is extremely consistent (SD ≈ 0), the MAD becomes tiny, flagging normal variance as outliers. Enforce MAD \= max(calculated\_MAD, MIN\_MAD). |

### **1.4 Logic Flow**

1. **Trigger:** Execute on page load of StatsPage or via Cloud Function onSolveCreate.  
2. **Fetch:** Retrieve the last WINDOW\_SIZE solves for the userId, ordered by date desc.  
3. **Compute:**  
   * Calculate WindowMedian.  
   * Calculate absolute deviations: |Time\_i \- WindowMedian|.  
   * Calculate WindowMAD (Median of deviations).  
   * Apply Guardrail: EffectiveMAD \= Math.max(WindowMAD, MIN\_MAD).  
4. **Evaluate:**  
   * LimitLow \= WindowMedian \- (K\_LOW \* EffectiveMAD)  
   * LimitHigh \= WindowMedian \+ (K\_HIGH \* EffectiveMAD)  
5. **Action:**  
   * If Time\_Current \< LimitLow AND \!isGlobalPB: **Flag as Suspected Misclick.**  
   * If Time\_Current \> LimitHigh: **Flag as Suspected Timer Run.**

## **Part 2: Gamified Daily Scramble System (The "Loot Box")**

### **2.1 Objective**

To serve deterministic, high-quality Kociemba scrambles based on a rarity tier system, prioritizing active engagement ("Live" hours) while allowing completionists to catch up on past missed scrambles.

### **2.2 Data Architecture**

* **Storage:** Static JSON file hosted in public/scrambles/.  
* **Filename:** scrambles-{YEAR}.json  
* **Format:** Key-Value Pair (UID \-\> Scramble String).  
* **Size Est:** \~650KB per year.

#### **JSON Schema (scrambles-2025.json)**

{  
  "y-2025": "R U R' ...",   
  "m-2025-01": "F2 D ...",  
  "w-2025-01": "L U2 ...",  
  "d-2025-01-01": "B2 R ...",  
  "h-2025-01-01-00": "D' F ..."  
}

### **2.3 User Profile Extensions (Firestore)**

Add the following fields to the users collection to track progress without massive array reads.  
interface UserScrambleStats {  
  loot\_chance\_modifier: number; // Starts at 0.05, increments on failure  
  completed\_years: string\[\];    // \["y-2025"\]  
  completed\_months: string\[\];   // \["m-2025-01"\]  
  completed\_weeks: string\[\];    // \["w-2025-01"\]  
  // Optimization: Use "High Water Mark" for high-frequency data  
  last\_completed\_day: string;   // "2025-01-14" (ISO Date)  
  last\_completed\_hour: string;  // "2025-01-14-16" (ISO Date-Hour)  
}

### **2.4 The "Weighted Lottery" Algorithm**

#### **Phase A: The Trigger**

* **Logic:** shouldServeDaily \= (Math.random() \< (BASE\_RATE \+ user.loot\_chance\_modifier))  
* **BASE\_RATE:** 0.60 (60%)  
* **On Fail:** user.loot\_chance\_modifier \+= 0.05  
* **On Success:** user.loot\_chance\_modifier \= 0 \-\> Proceed to Phase B.

#### **Phase B: Candidate Selection (The Backlog System)**

For each tier, determine **one** eligible candidate UID.

1. **Generate "Current" UID** for Year, Month, Week, Day, Hour.  
2. **Backtrack Check:**  
   * If Current\_UID is completed, look back T \- 1\.  
   * Repeat up to MAX\_BACKTRACK times (Prevent infinite loops).  
   * **Constraint:** A user cannot unlock a "Day" from 2024 if they haven't finished the "Days" from 2025? (Optional: Or strictly chronological catch-up). *Recommendation: Strict chronological reverse-search (Latest missed item).*

#### **Phase C: The Weighted Roll**

Select one candidate from the eligible list using these weights.

| Tier | Condition | Weight | Probability Context |
| :---- | :---- | :---- | :---- |
| **Year** | Any | **1** | 1/2811 (\~0.03%) |
| **Month** | Any | **10** | 1/281 (\~0.3%) |
| **Week** | Any | **50** | 1/56 (\~1.7%) |
| **Day** | Any | **250** | 1/11 (\~9.0%) |
| **Hour** | **Current (Live)** | **2000** | \~71% (Dominant) |
| **Hour** | **Past (Backlog)** | **500** | \~17% (Penalty) |

*Note: Weights are relative. Total Weight changes based on availability.*

### **2.5 Implementation Constraints**

1. **Determinism:** The client must fetch the scramble from the JSON using the UID derived from the DailyScrambleAlgorithm.  
2. **Security:** Ensure the onSolve function validates that the scramble submitted matches the active\_daily\_scramble tracked in local state/session to prevent cheating.  
3. **Timezones:** All UIDs must be generated using **UTC** to ensure global consistency, or **User Local Time** if you want "8 PM" to be 8 PM for everyone. *Recommendation: User Local Time for better UX ("Night" scrambles happen at night).*