import nodemailer from "nodemailer";

/**
 * Replace {name}, {email}, {company} (and any other contact fields)
 * inside a template string.
 */
function applyTemplate(template, contact) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return contact[key.toLowerCase()] ?? "";
  });
}

/**
 * Pause execution for the given number of milliseconds.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send personalised emails to a list of contacts.
 *
 * @param {object}   opts
 * @param {object[]} opts.contacts        — [{name, email, company, …}]
 * @param {string}   opts.subject         — subject template
 * @param {string}   opts.htmlBody        — HTML body template
 * @param {string}   opts.fromEmail       — sender address
 * @param {string}   opts.fromPassword    — sender app-password / password
 * @param {string}   [opts.smtpHost]      — SMTP host (default: smtp.gmail.com)
 * @param {number}   [opts.smtpPort]      — SMTP port (default: 587)
 * @param {string[]} [opts.attachmentPaths] — absolute paths to files to attach
 *
 * @returns {Promise<{email: string, status: string, error?: string}[]>}
 */
export async function sendBulkEmails({
  contacts,
  subject,
  htmlBody,
  fromEmail,
  fromPassword,
  smtpHost = "smtp.gmail.com",
  smtpPort = 587,
  attachmentPaths = [],
}) {
  if (!contacts || contacts.length === 0) {
    throw new Error("No contacts provided");
  }
  if (!fromEmail || !fromPassword) {
    throw new Error("Sender email and password are required");
  }

  // ---------- Create transporter ----------
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for 587
    auth: {
      user: fromEmail,
      pass: fromPassword,
    },
  });

  // Verify connection before sending
  try {
    await transporter.verify();
    console.log("[EmailService] SMTP connection verified successfully");
  } catch (err) {
    console.error("[EmailService] SMTP verification failed:", err.message);
    throw new Error(`SMTP connection failed: ${err.message}`);
  }

  // ---------- Build attachments list ----------
  const attachments = attachmentPaths.map((filePath) => ({
    path: filePath,
  }));

  // ---------- Send emails ----------
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const recipientEmail = contact.email;

    if (!recipientEmail) {
      results.push({
        email: "(missing)",
        status: "failed",
        error: "No email address provided for this contact",
      });
      continue;
    }

    const personalSubject = applyTemplate(subject, contact);
    const personalBody = applyTemplate(htmlBody, contact);

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject: personalSubject,
        html: personalBody,
        attachments,
      });

      console.log(
        `[EmailService] (${i + 1}/${contacts.length}) Sent → ${recipientEmail}`
      );
      results.push({ email: recipientEmail, status: "sent" });
    } catch (err) {
      console.error(
        `[EmailService] (${i + 1}/${contacts.length}) Failed → ${recipientEmail}: ${err.message}`
      );
      results.push({
        email: recipientEmail,
        status: "failed",
        error: err.message,
      });
    }

    // Small delay between sends to respect rate limits
    if (i < contacts.length - 1) {
      await delay(500);
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  console.log(
    `[EmailService] Finished — ${sentCount}/${contacts.length} emails sent successfully`
  );

  return results;
}
