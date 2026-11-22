# Private HQconnect enquiries

Revenue contains a founder-only inbox behind the same Access identity check as the rest of Headquarters. The dashboard uses an internal service binding; the inbox service has no public route or workers.dev address. It returns bounded pages of enquiries and has no endpoint for changing them. Enquiry text is rendered as text, not HTML, and is not included in AI research, analytics, logs, or notification emails.

The separate inbox service reads the existing intake database and checks it on a 15-minute schedule. If new enquiries exist, it submits a generic notification to the verified founder address. The configured email binding is restricted to that destination and sender. Only a sequence, latest observed creation time, and delivery-attempt timestamps are retained in the notification checkpoint table. The checkpoint advances after the mail provider accepts the notification; acceptance is not proof that an inbox received it. If sending fails, the next run retries. A failed checkpoint write can cause a duplicate notification rather than silently dropping an enquiry.

The service adapter can later be replaced with a self-hosted SQLite reader and mail transport without changing the visitor form or HQ interface. It never deploys code, edits source, alters ad settings, or contacts customers. The existing HQ release policy still requires a founder-authorized manual release for the new service binding; routine releases may only preserve the exact approved binding.

Verification uses synthetic records, a fake database, and a fake mail sender. Do not submit fake leads into the live website or copy real enquiry content into issues or CI logs. The real founder login and actual email delivery require separate confirmation.
