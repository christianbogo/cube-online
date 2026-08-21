# Privacy Policy for Cube Online

**Effective Date:** August 21, 2026  
**Last Updated:** August 21, 2026  
**Website:** [https://cubeonline.org](https://cubeonline.org)  
**Contact:** [feedback@cubeonline.org](mailto:feedback@cubeonline.org) | [christianbcutter@yahoo.com](mailto:christianbcutter@yahoo.com)

---

## 1. Introduction & Scope

Welcome to **Cube Online** ("we," "our," "us," or the "Service"), accessible at [cubeonline.org](https://cubeonline.org). Cube Online is a modern, high-performance speedcubing timer, personal analytics hub, and multiplayer platform designed for speedcubers, puzzle enthusiasts, and competitive solvers worldwide.

This Privacy Policy explains how Cube Online collects, stores, uses, processes, and protects your personal information and puzzle performance data when you visit our website, use our timer and data analysis tools, participate in live sessions, or communicate with our support and development team.

We are committed to transparency, data minimization, and protecting your digital privacy in compliance with international privacy frameworks, including the **General Data Protection Regulation (GDPR)**, the **California Consumer Privacy Act as amended by the California Privacy Rights Act (CCPA/CPRA)**, and the **Children’s Online Privacy Protection Act (COPPA)**.

By accessing or using Cube Online, you acknowledge that you have read and understood the practices described in this policy.

---

## 2. Information We Collect

We collect information in three ways: information you provide directly, information generated automatically during your use of our speedcubing tools, and information stored locally on your device.

### 2.1. Account & Authentication Data
When you create an account or sign in to Cube Online, we collect:
- **Email Address:** Used for authentication, password recovery, verification emails, and essential account notifications.
- **Display Username & Short ID:** A public identifier chosen by you or randomly generated (e.g., 6-character alphanumeric ID) to identify your profile, leaderboards, and multiplayer rooms.
- **Authentication Identifiers:** Unique user IDs (`uid`) generated securely via **Google Firebase Authentication**.
- **Profile Customizations:** Custom avatar color tokens, optional user bios, and privacy toggles (such as "Ghost Mode").
- **Social Profiles (Optional):** If you choose to link social networks (e.g., Discord, Twitter/X, Instagram, YouTube, Twitch), we store the handles and privacy visibility levels (`hidden`, `friends`, or `public`) you designate.
- **Social Graph / Connections:** UIDs of users you follow, star, or block within the platform.

### 2.2. Speedcubing & Solve Performance Data
Cube Online collects detailed puzzle performance telemetry to generate statistics, charts, session histories, and global comparisons:
- **Solve Timestamps & Duration:** Precise solve elapsed time (measured in milliseconds) and date/time of completion.
- **Scramble Formats & Sequences:** Official WCA-compliant or custom scramble notation strings (e.g., 3x3x3, 2x2x2, 4x4x4, Megaminx, Pyraminx, Clock).
- **Inspection Metrics:** Inspection durations and inspection penalties (e.g., OK, +2 penalty, DNF).
- **Penalties & Anomalies:** User-applied or referee-flagged solve statuses (`none`, `+2`, `DNF`, anomaly approval flags).
- **Session & Split Metadata:** Split times (such as Cross, F2L, OLL, PLL), session categorizations, session bests, and statistical aggregates (Ao5, Ao12, Ao50, Ao100).

### 2.3. Live Presence & Multiplayer Room Data
When you participate in live multiplayer rooms or connect to the platform:
- **Online Presence State:** Heartbeat timestamps (`lastSeenAt`), active connection indicators, and room participation IDs managed via the **Firebase Realtime Database**.
- **Ghost Mode:** If you activate Ghost Mode, your live presence is masked from public room participant lists and friend status indicators.

### 2.4. Local Browser Storage (`localStorage` & `sessionStorage`)
To facilitate seamless offline usage, instantaneous timer response, and low latency:
- **Guest / Offline Solves:** If you use Cube Online without an authenticated account, solve records, session structures, and personal bests are stored exclusively in your browser's `localStorage`.
- **User Interface & Keybind Preferences:** Custom keyboard shortcuts, spacebar hold delay (priming length), timer font scaling, scramble text size, inspection alerts, and Light/Dark CSS theme variables (`--bg-primary`, `--accent`, etc.).
- **Cached Profile Data:** Local cached copy of user metadata to eliminate render flashes on network reconnections.

### 2.5. User Uploads, Bug Reports & Feedback Attachments
When you submit a bug report, feature request, or feedback via our Developer Portal / Feedback modal:
- **Report Details:** Title, category (Bug, Feature Request, Improvement, General), description, and optional contact email.
- **Diagnostic Attachments:** Screenshots or log files (`.log`, `.txt`, `.json`) you choose to attach.
- **Client-Side Compression:** All image attachments are compressed client-side before transmission (e.g., bounded to a maximum of 1600x1600 resolution and optimized WebP/JPEG encoding) to minimize bandwidth and storage footprint.

---

## 3. Artificial Intelligence (AI) and Automated Data Processing

Cube Online may utilize modern computational algorithms, machine learning (ML), and artificial intelligence (AI) agents to assist in developer workflows, detect statistical anomalies in solve distributions, optimize scramble generation, or provide smart inspection analysis.

### 3.1. Non-Training Guarantee on User Data
**We strictly respect your privacy.**
- **No Third-Party Model Training:** Your private solve data, session histories, account email addresses, personal notes, and uploaded bug report attachments are **NEVER sold, licensed, or used to train public third-party foundation AI/LLM models** (including OpenAI, Anthropic, Google, or Meta models) without your explicit, opt-in consent.
- **Zero Data Retention API Boundaries:** When automated AI services are employed for developer diagnostics or code-assistance tools, data transmissions are governed by enterprise zero-retention / non-training commercial agreements.

### 3.2. Automated Solve Verification & Anomaly Detection
Cube Online may run automated mathematical checks to flag impossible move sequences, impossible turn-per-second (TPS) anomalies, or corrupted timer data to preserve competitive integrity on public leaderboards.

---

## 4. Third-Party Service Providers & Data Processors

We do not sell your personal information. We partner exclusively with industry-standard, security-certified third-party infrastructure providers to host, secure, and deliver Cube Online.

| Service Provider | Purpose | Data Shared / Processed | Privacy & Compliance |
| :--- | :--- | :--- | :--- |
| **Google Firebase / Google Cloud Platform** | User authentication, cloud database (Firestore), real-time presence (Realtime Database), hosting rules | Email, encrypted auth credentials, UID, solve records, profile settings, feedback submissions | [Google Cloud Privacy](https://cloud.google.com/terms/cloud-privacy-notice) / SOC 1/2/3, ISO 27001 |
| **Resend Inc.** | Transactional email delivery (bug report routing, feedback delivery, notifications) | Submitter email address, feedback message body, attached diagnostic screenshots | [Resend Privacy Policy](https://resend.com/privacy) / GDPR DPA |
| **Vercel Inc.** | Web application hosting, Edge network, static asset distribution, serverless API execution | IP address, browser user-agent, routing request headers | [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) / ISO 27001 |
| **Cloudflare / CDN Providers** | DDoS mitigation, DNS routing, SSL/TLS encryption management | Anonymized network telemetry, IP addresses for security screening | [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/) |

All data processors are contractually restricted from using personal information for any purpose other than providing services to Cube Online.

---

## 5. User Uploads, Security & Storage Access Controls

### 5.1. Secure Storage & Non-Public Indexing
- User uploads, attachments, and feedback submissions are stored with restricted permissions and are **not** made publicly indexable by search engines or accessible to unauthenticated third parties.
- Database access is enforced at the network and API level through robust **Firebase Security Rules**, ensuring that only the verified account owner (`request.auth.uid == userId`) has read/write privileges over their personal solves, private goals, and private settings.

### 5.2. Data Retention Periods
- **Account Data & Solves:** Stored for as long as your account remains active. You can delete individual solves, clear sessions, or wipe your entire account at any time.
- **Feedback & Bug Attachments:** Retained for the duration of the investigation or debugging lifecycle (typically up to 90 days after issue resolution), after which diagnostic logs and screenshot payloads are permanently purged.
- **Local Guest Storage:** Persists in your local browser until you clear your browser cache, reset website storage, or use the in-app "Clear Local Data" feature.

---

## 6. Your Rights & How to Delete Your Data (GDPR & CCPA/CPRA)

Whether you reside in the European Economic Area (EEA), United Kingdom, California, or elsewhere, Cube Online provides equal data rights to all users.

### 6.1. Your Privacy Rights
- **Right to Access (Data Portability):** You have the right to request a complete copy of all personal data, solve logs, and profile records we hold about you in a structured, machine-readable format (JSON/CSV).
- **Right to Rectification:** You may update or correct your username, social links, preferences, and solve entries at any time directly through the application interface.
- **Right to Restrict or Object to Processing:** You can enable "Ghost Mode" to prevent presence broadcasting, or switch to guest mode to avoid cloud synchronization.
- **Right to Erasure ("Right to be Forgotten"):** You have the absolute right to have all your personal information, solve archives, profile records, and uploaded attachments permanently deleted.

### 6.2. How to Request Account & Data Deletion

You can permanently delete your account and all associated data through either of the following methods:

#### Method A: In-App Self-Service Deletion
1. Open [Cube Online](https://cubeonline.org).
2. Sign in to your account.
3. Navigate to **Account Settings** / **Profile**.
4. Scroll to the **Danger Zone** section and click **"Delete Account"**.
5. Confirm your choice. Our system will immediately trigger a cascading deletion across Firestore (`solves`, `users`, `goals`), terminate your Firebase Auth credentials, and purge your cached local tokens.

#### Method B: Direct Email Deletion Request
If you cannot access your account or wish to verify complete erasure of backup feedback archives:
1. Send an email to **[feedback@cubeonline.org](mailto:feedback@cubeonline.org)** or **[christianbcutter@yahoo.com](mailto:christianbcutter@yahoo.com)** with the subject line: `DATA DELETION REQUEST - [Your Username or Email]`.
2. Include your registered email address and Short ID (if known).
3. We will process your deletion request within **30 days** (or sooner as required by law) and send a written confirmation once all records across authentication, database, and logging systems have been permanently destroyed.

---

## 7. Children's Privacy (COPPA & GDPR-K Compliance)

Cube Online recognizes that speedcubing is a popular sport and hobby enjoyed by youth and students of all ages. Protecting the privacy of minors is of paramount importance.

- **Children Under 13 (USA - COPPA):** Cube Online does not knowingly collect, solicit, or maintain personal information from children under the age of 13 without verifiable parental consent.
- **Minors Under 16 (EU/UK - GDPR-K):** In jurisdictions where the age of digital consent is 16, we do not knowingly process personal data without appropriate parental authorization.
- **Guest Mode for Minors:** Young cubers are encouraged to use Cube Online in **Guest Mode**, which operates entirely within the user's local browser (`localStorage`) without creating an account, transmitting personal identifiers, or storing data in cloud databases.
- **Parental Notice & Removal:** If a parent, guardian, or educator becomes aware that a child under 13 (or under 16) has provided us with personally identifiable information without consent, please contact us immediately at **[feedback@cubeonline.org](mailto:feedback@cubeonline.org)** or **[christianbcutter@yahoo.com](mailto:christianbcutter@yahoo.com)**. We will promptly delete such account records and all associated data from our servers.

---

## 8. International Data Transfers

Cube Online's services and cloud infrastructure are hosted within the United States via Google Cloud Platform and Vercel. If you access Cube Online from outside the United States, please be aware that your data will be transferred to, stored, and processed in the United States. We ensure that appropriate safeguards (such as Standard Contractual Clauses approved by the European Commission) are in place with our cloud providers to safeguard your data.

---

## 9. Security Measures

We implement robust administrative, technical, and physical safeguards designed to protect personal information from unauthorized access, alteration, disclosure, or destruction:
- Full SSL/TLS (HTTPS) encryption for all in-transit communications.
- Granular Firestore & Realtime Database security rules enforcing per-user data isolation.
- Client-side image sanitization and compression before upload.
- Restricted administrative access requiring multi-factor authenticated authorization.

While we take rigorous measures to protect your information, no transmission over the Internet or electronic storage system is 100% secure. We encourage users to maintain unique passwords and safeguard their login credentials.

---

## 10. Changes to This Privacy Policy

We may update this Privacy Policy periodically to reflect changes in our platform features, legal obligations, or technical architecture. When changes are published, we will revise the **"Last Updated"** date at the top of this document. For significant modifications affecting how your personal data is handled, we will provide a prominent notice on the website or via email prior to the changes taking effect.

We encourage you to review this Privacy Policy periodically to stay informed about our data practices.

---

## 11. Contact Information & Data Protection Inquiries

If you have any questions, concerns, feedback, or requests regarding this Privacy Policy, your personal data, or our compliance practices, please contact us:

- **Lead Developer & Administrator:** Christian Cutter
- **Official Feedback Email:** [feedback@cubeonline.org](mailto:feedback@cubeonline.org)
- **Direct Administrative Email:** [christianbcutter@yahoo.com](mailto:christianbcutter@yahoo.com)
- **Website:** [https://cubeonline.org](https://cubeonline.org)
- **Bug & Feedback Submission Portal:** Available directly within the Cube Online app under the Developer / Feedback tab.
