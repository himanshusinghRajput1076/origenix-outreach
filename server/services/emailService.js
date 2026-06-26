import nodemailer from "nodemailer";

/**
 * Replace {name}, {email}, {company} (and any other contact fields)
 * inside a template string.
 */
function applyTemplate(template, contact) {
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "");
    for (const contactKey of Object.keys(contact)) {
      if (contactKey.toLowerCase().replace(/[\s_-]/g, "") === normalizedKey) {
        return contact[contactKey] ?? "";
      }
    }
    if (/^[a-zA-Z0-9\s_-]+$/.test(key)) {
      return "";
    }
    return match;
  });
}

/**
 * Pause execution for the given number of milliseconds.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run async tasks with limited concurrency (semaphore pattern).
 * @param {Function[]} tasks   — array of () => Promise functions
 * @param {number}     limit   — max simultaneous in-flight
 */
async function withConcurrency(tasks, limit = 5, shouldStop) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      if (shouldStop && shouldStop()) {
        break;
      }
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Send mail using a transient-error retry loop.
 */
async function sendMailWithRetry(transporter, mailOptions, retries = 3, initialDelay = 1000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      attempt++;
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "EPIPE" ||
        err.code === "ENOTFOUND" ||
        err.message.includes("timeout") ||
        (err.responseCode && err.responseCode >= 400 && err.responseCode < 500);

      if (isTransient && attempt < retries) {
        const delayMs = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`[EmailService] Transient error sending to ${mailOptions.to}: ${err.message}. Retrying in ${delayMs}ms (Attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Send personalised emails to a list of contacts.
 * Uses connection pooling and parallel sends for maximum throughput.
 *
 * @param {object}   opts
 * @param {object[]} opts.contacts          — [{name, email, company, …}]
 * @param {string}   opts.subject           — subject template
 * @param {string}   opts.htmlBody          — HTML body template
 * @param {string}   opts.fromEmail         — sender address
 * @param {string}   opts.fromPassword      — sender app-password / password
 * @param {string}   [opts.smtpHost]        — SMTP host (default: smtp.gmail.com)
 * @param {number}   [opts.smtpPort]        — SMTP port (default: 587)
 * @param {string[]} [opts.attachmentPaths] — absolute paths to files to attach
 * @param {number}   [opts.concurrency]     — parallel send limit (default: 5)
 * @param {number}   [opts.delayBetweenMs]  — ms between each send slot (default: 100)
 * @param {Function} [opts.shouldStop]      — checks if campaign should stop/pause
 * @param {Function} [opts.onProgress]      — real-time callback when an email completes
 *
 * @returns {Promise<{email: string, status: string, error?: string, __idx?: number}[]>}
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
  attachments = [],
  concurrency = 5,
  delayBetweenMs = 100,
  shouldStop,
  onProgress,
}) {
  if (!contacts || contacts.length === 0) {
    throw new Error("No contacts provided");
  }
  if (!fromEmail || !fromPassword) {
    throw new Error("Sender email and password are required");
  }

  // ── Pooled transporter: reuses connections across sends ──────────────
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: fromEmail,
      pass: fromPassword,
    },
    // Connection pool — up to 5 simultaneous SMTP connections
    pool: true,
    maxConnections: concurrency,
    maxMessages: Infinity,
    rateDelta: delayBetweenMs,    // time window in ms
    rateLimit: concurrency,       // max messages per rateDelta window
  });

  // Verify once before bulk send
  try {
    await transporter.verify();
    console.log("[EmailService] SMTP connection pool verified ✓");
  } catch (err) {
    console.error("[EmailService] SMTP verification failed:", err.message);
    throw new Error(`SMTP connection failed: ${err.message}`);
  }

  // Pre-build attachments list (shared across all mails)
  const nodemailerAttachments = [];
  for (const filePath of attachmentPaths) {
    nodemailerAttachments.push({ path: filePath });
  }
  for (const att of attachments) {
    if (att && att.content) {
      nodemailerAttachments.push({
        filename: att.filename,
        content: Buffer.from(att.content, "base64"),
        contentType: att.contentType,
      });
    } else if (att && att.path) {
      nodemailerAttachments.push({ path: att.path });
    }
  }

  const results = new Array(contacts.length);
  let doneCount = 0;
  const total = contacts.length;

  // Build one task per contact
  const tasks = contacts.map((contact, i) => async () => {
    const recipientEmail = contact.email;

    if (!recipientEmail) {
      const res = {
        email: "(missing)",
        status: "failed",
        error: "No email address provided for this contact",
        __idx: contact.__idx,
      };
      results[i] = res;
      if (onProgress) onProgress(res);
      return;
    }

    const personalSubject = applyTemplate(subject, contact);
    const personalBody    = applyTemplate(htmlBody, contact);

    try {
      await sendMailWithRetry(transporter, {
        from:        fromEmail,
        to:          recipientEmail,
        subject:     personalSubject,
        html:        personalBody,
        attachments: nodemailerAttachments,
      });

      doneCount++;
      if (doneCount % 10 === 0 || doneCount === total) {
        console.log(`[EmailService] Progress: ${doneCount}/${total} sent`);
      }
      const res = { email: recipientEmail, status: "sent", __idx: contact.__idx };
      results[i] = res;
      if (onProgress) onProgress(res);
    } catch (err) {
      console.error(`[EmailService] Failed → ${recipientEmail}: ${err.message}`);
      const res = {
        email:  recipientEmail,
        status: "failed",
        error:  err.message,
        __idx:  contact.__idx,
      };
      results[i] = res;
      if (onProgress) onProgress(res);
    }
  });

  // Send with controlled concurrency (default: 5 parallel)
  await withConcurrency(tasks, concurrency, shouldStop);

  // Close the pool cleanly
  transporter.close();

  const sentCount = results.filter((r) => r && r.status === "sent").length;
  console.log(
    `[EmailService] Finished — ${sentCount}/${total} emails sent successfully`
  );

  return results;
}
