import { Link } from 'react-router-dom';

export default function Privacy() {
    return (
        <div className="max-w-3xl w-full mx-auto p-6 md:p-10 select-text font-sans text-text-primary">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                    Privacy Policy
                </h1>
                <p className="text-xs text-text-secondary">
                    Effective Date: August 21, 2026 &bull; Last Updated: August 21, 2026
                </p>
                <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                    Cube Online (<a href="https://cubeonline.org" className="underline text-accent">cubeonline.org</a>) is committed to protecting your privacy and personal data. This Privacy Policy describes how we collect, use, process, and protect your information when you use our website, timer, personal analytics tools, and multiplayer features.
                </p>
            </div>

            <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
                {/* 1. Introduction & Scope */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        1. Introduction &amp; Scope
                    </h2>
                    <p>
                        This policy applies to all users of Cube Online, including unregistered guest visitors and authenticated account holders. We comply with applicable data protection regulations, including the General Data Protection Regulation (GDPR), the California Consumer Privacy Act as amended by the California Privacy Rights Act (CCPA/CPRA), and the Children’s Online Privacy Protection Act (COPPA).
                    </p>
                </section>

                {/* 2. Information We Collect */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        2. Information We Collect
                    </h2>
                    <p>We collect only the minimum data necessary to operate our speedcubing timer and platform services:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Account &amp; Authentication Data:</strong> When creating an account, we store your email address, username, short ID, profile theme color, and unique authentication identifier via Google Firebase Authentication. Social links and friend lists are optional.
                        </li>
                        <li>
                            <strong className="text-text-primary">Speedcubing Performance Telemetry:</strong> Solve times (in milliseconds), WCA-standard and custom scrambles, inspection times, user-applied penalties (+2 or DNF), split checkpoints, session names, and statistical averages (Ao5, Ao12, Ao100).
                        </li>
                        <li>
                            <strong className="text-text-primary">Live Presence &amp; Multiplayer State:</strong> Active room participation and connection timestamps stored in the Firebase Realtime Database. You can enable Ghost Mode in settings to hide your online status from others.
                        </li>
                        <li>
                            <strong className="text-text-primary">Local Browser Storage (localStorage):</strong> When using Cube Online as a guest without signing in, all solves, session history, and keybindings are stored strictly within your browser's local storage and are never transmitted to our servers.
                        </li>
                        <li>
                            <strong className="text-text-primary">Feedback &amp; Uploaded Attachments:</strong> If you submit a bug report or feedback, we collect your message and any optional screenshots or log files you attach. All image attachments are compressed on your device prior to transmission.
                        </li>
                    </ul>
                </section>

                {/* 3. Artificial Intelligence (AI) & Non-Training Guarantee */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        3. Artificial Intelligence (AI) &amp; Automated Processing
                    </h2>
                    <p>
                        We may use algorithmic processing to generate scrambles, compute solve statistics, and detect timer anomalies.
                    </p>
                    <p>
                        <strong className="text-text-primary">Non-Training Guarantee:</strong> Your private solve logs, session histories, account credentials, and uploaded feedback attachments are <strong>never sold, leased, or used to train public third-party AI models</strong> (such as models from OpenAI, Anthropic, Google, or Meta) without your explicit opt-in consent.
                    </p>
                </section>

                {/* 4. Third-Party Data Processors */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        4. Third-Party Service Providers
                    </h2>
                    <p>
                        We do not sell personal data. We utilize reputable third-party infrastructure providers solely to host and deliver our application:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5">
                        <li>
                            <strong className="text-text-primary">Google Firebase / Google Cloud Platform:</strong> User authentication, Firestore database, and Realtime Database presence.
                        </li>
                        <li>
                            <strong className="text-text-primary">Resend Inc.:</strong> Transactional email delivery for feedback submissions and developer alerts.
                        </li>
                        <li>
                            <strong className="text-text-primary">Vercel &amp; Cloudflare:</strong> Edge hosting, CDN content delivery, and DDoS mitigation.
                        </li>
                    </ul>
                </section>

                {/* 5. User Uploads, Security & Retention */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        5. User Uploads, Security &amp; Data Retention
                    </h2>
                    <p>
                        User feedback attachments and screenshots are stored with restricted permissions and are not publicly indexable.
                    </p>
                    <p>
                        Account solve data is retained as long as your account remains active. Feedback attachments and diagnostic logs are retained only as needed for issue resolution (up to 90 days), after which they are purged.
                    </p>
                </section>

                {/* 6. User Rights & How to Delete Data */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        6. Your Rights &amp; How to Delete Your Data (GDPR &amp; CCPA)
                    </h2>
                    <p>
                        You have the right to access, rectify, export, or permanently erase your personal data ("Right to be Forgotten"). You can delete your information at any time through either of the following options:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">In-App Self-Service Deletion:</strong> Go to <Link to="/account" className="underline text-accent">Account Settings</Link> &gt; <strong>Danger Zone</strong> &gt; <strong>Delete Account</strong>. This permanently deletes your solves, profile data, and authentication credentials immediately.
                        </li>
                        <li>
                            <strong className="text-text-primary">Email Request:</strong> Send an email to <a href="mailto:feedback@cubeonline.org" className="underline text-accent">feedback@cubeonline.org</a> or <a href="mailto:christianbcutter@yahoo.com" className="underline text-accent">christianbcutter@yahoo.com</a> with the subject line <code>DATA DELETION REQUEST</code>. We will purge all associated records within 30 days.
                        </li>
                    </ul>
                </section>

                {/* 7. Children's Privacy */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        7. Children's Privacy (COPPA Compliance)
                    </h2>
                    <p>
                        Speedcubing is enjoyed by solvers of all ages. Cube Online does not knowingly collect personally identifiable information from children under 13 (or under 16 in the EU/UK) without verifiable parental consent.
                    </p>
                    <p>
                        Younger cubers are encouraged to use <strong>Guest Mode</strong>, which operates 100% locally in the browser with zero cloud synchronization. Parents or guardians may contact us at any time to request immediate deletion of any account created by a minor.
                    </p>
                </section>

                {/* 8. Security Measures */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        8. Security Measures
                    </h2>
                    <p>
                        We enforce HTTPS encryption for all network traffic, strict per-user database security rules (`request.auth.uid == userId`), client-side image compression, and restricted administrative privileges.
                    </p>
                </section>

                {/* 9. Contact Information */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        9. Contact Information
                    </h2>
                    <p>
                        If you have any questions or requests regarding this Privacy Policy, please contact:
                    </p>
                    <p>
                        Christian Cutter &bull; Lead Developer<br />
                        Email: <a href="mailto:feedback@cubeonline.org" className="underline text-accent">feedback@cubeonline.org</a> / <a href="mailto:christianbcutter@yahoo.com" className="underline text-accent">christianbcutter@yahoo.com</a><br />
                        Website: <a href="https://cubeonline.org" className="underline text-accent">https://cubeonline.org</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
