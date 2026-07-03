import express from "express";
import cors from "cors";
import compression from "compression";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { parseExcel } from "./services/excelParser.js";
import { sendBulkEmails } from "./services/emailService.js";
import { generateWhatsAppLinks } from "./services/whatsappService.js";

// ---------- __dirname polyfill for ES modules ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Ensure uploads directory exists ----------
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`[Server] Created uploads directory: ${UPLOADS_DIR}`);
}

// ---------- Multer configuration ----------
// In-memory storage for Excel files (we only need the buffer)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for large Excel files (100K+ rows)
});

// Disk storage for attachments (PDFs, images, etc.)
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /pdf|png|jpe?g|gif|webp|bmp|svg|doc|docx|ppt|pptx|xls|xlsx|csv|txt|zip/i;
    const ext = path.extname(file.originalname).replace(".", "");
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} is not allowed`));
    }
  },
});

// ---------- Persistent job store for batch processing ----------
const JOBS_FILE = path.join(UPLOADS_DIR, "jobs.json");
const JOB_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to load jobs from file on startup
function loadJobsFromDisk() {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const raw = fs.readFileSync(JOBS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      const map = new Map(Object.entries(parsed));
      
      // Clean up/reset any jobs that were running when the server stopped
      for (const [id, job] of map) {
        if (job.status === "running") {
          job.status = "interrupted";
          job.completedAt = new Date().toISOString();
        }
      }
      console.log(`[Server] Loaded ${map.size} jobs from disk.`);
      return map;
    }
  } catch (err) {
    console.error("[Server] Error loading jobs from disk:", err.message);
  }
  return new Map();
}

const jobs = loadJobsFromDisk();

// Helper to save jobs to file
async function saveJobsToDisk() {
  try {
    const obj = Object.fromEntries(jobs);
    await fs.promises.writeFile(JOBS_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    console.error("[Server] Error saving jobs to disk:", err.message);
  }
}

// Debounced save to reduce disk writes during high-frequency updates
let saveTimeout = null;
function saveJobsDebounced() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    await saveJobsToDisk();
  }, 1000);
}

function createJob(contacts, payload) {
  const id = "job_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  // Add unique index to each contact
  const contactsWithId = contacts.map((c, idx) => ({ ...c, __idx: idx }));
  const job = {
    id,
    status: "running",
    total: contacts.length,
    sent: 0,
    failed: 0,
    results: [],
    contacts: contactsWithId,
    payload,
    startedAt: new Date().toISOString(),
    expiresAt: Date.now() + JOB_TTL_MS,
  };
  jobs.set(id, job);
  saveJobsToDisk();
  return job;
}

// Cleanup stale jobs every hour
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, job] of jobs) {
    if (job.expiresAt < now) {
      jobs.delete(id);
      changed = true;
      console.log(`[Server] Cleaned up expired job: ${id}`);
    }
  }
  if (changed) {
    saveJobsToDisk();
  }
}, 60 * 60 * 1000).unref(); // unref so it doesn't block process exit

// ---------- Express app ----------
const app = express();
const PORT = process.env.PORT || 3001;

// ── Performance middleware ──────────────────────────────────────────────
// Compress all responses > 1KB
app.use(compression({ level: 6, threshold: 1024 }));

// CORS – allow all origins (tighten in production by specifying origin list)
app.use(cors());

// Parse JSON bodies up to 50 MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cache uploaded static files aggressively (1 day)
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, { maxAge: "1d", etag: true })
);

// Serve Vite build output from dist folder if it exists (production)
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: "7d", etag: true }));
}

// =====================================================================
// ROUTES
// =====================================================================

// ---------- Health check ----------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ---------- POST /api/reset-server ----------
app.post("/api/reset-server", (req, res) => {
  console.log("[Route] POST /api/reset-server");
  try {
    // 1. Reset jobs map
    jobs.clear();
    
    // 2. Delete jobs.json if it exists
    if (fs.existsSync(JOBS_FILE)) {
      fs.unlinkSync(JOBS_FILE);
    }
    
    // 3. Delete files in uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        if (file !== "." && file !== "..") {
          const filePath = path.join(UPLOADS_DIR, file);
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error(`Error deleting file ${file}:`, e.message);
          }
        }
      }
    }
    
    return res.json({ success: true, message: "Backend data reset successfully!" });
  } catch (err) {
    console.error("[Route] reset-server error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});


// ---------- POST /api/test-smtp ----------
app.post("/api/test-smtp", async (req, res) => {
  console.log("[Route] POST /api/test-smtp");

  try {
    const { fromEmail, fromPassword, smtpHost, smtpPort } = req.body;

    if (!fromEmail || !fromPassword) {
      return res.status(400).json({ error: "Sender email and password are required" });
    }

    const host = smtpHost || "smtp.gmail.com";
    const port = smtpPort ? Number(smtpPort) : 587;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: fromEmail,
        pass: fromPassword,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    await transporter.verify();
    transporter.close();

    return res.json({ success: true, message: "SMTP connection verified successfully!" });
  } catch (err) {
    console.error("[Route] test-smtp error:", err.message);
    let errorMsg = err.message;
    if (
      err.message.includes("535") ||
      err.message.includes("Username and Password not accepted") ||
      err.message.includes("Invalid login")
    ) {
      errorMsg = "SMTP login failed: Username and Password not accepted. If using Gmail, you MUST use a 16-character App Password (not your regular Gmail account password). Make sure 2-Step Verification is enabled in your Google account settings before generating it.";
    }
    return res.status(400).json({ error: errorMsg });
  }
});

// ---------- POST /api/upload-excel ----------
app.post("/api/upload-excel", memoryUpload.single("file"), (req, res) => {
  console.log("[Route] POST /api/upload-excel");

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = parseExcel(req.file.buffer);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Route] upload-excel error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- POST /api/send-emails ----------
// Synchronous send — best for small batches (≤ 200 contacts)
app.post("/api/send-emails", async (req, res) => {
  // 10-minute timeout for large email sends
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);

  console.log("[Route] POST /api/send-emails");

  try {
    const {
      contacts,
      subject,
      htmlBody,
      fromEmail,
      fromPassword,
      smtpHost,
      smtpPort,
      concurrency,
      attachments = [],
    } = req.body;

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided" });
    }
    if (!subject || !htmlBody) {
      return res.status(400).json({ error: "Subject and HTML body are required" });
    }
    if (!fromEmail || !fromPassword) {
      return res.status(400).json({ error: "Sender email and password are required" });
    }

    // Separate file-based and base64-based attachments
    const fileAttachments = [];
    const base64Attachments = [];
    for (const att of attachments) {
      if (typeof att === "string") {
        fileAttachments.push(att);
      } else if (att && typeof att === "object" && att.content) {
        base64Attachments.push(att);
      }
    }

    // Resolve attachment filenames to absolute paths
    const attachmentPaths = fileAttachments.map((name) =>
      path.join(UPLOADS_DIR, name)
    );

    // Verify all attachment files exist
    for (const p of attachmentPaths) {
      if (!fs.existsSync(p)) {
        return res.status(400).json({ error: `Attachment not found: ${path.basename(p)}` });
      }
    }

    const results = await sendBulkEmails({
      contacts,
      subject,
      htmlBody,
      fromEmail,
      fromPassword,
      smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : undefined,
      concurrency: concurrency ? Number(concurrency) : 5, // parallel sends
      attachmentPaths,
      attachments: base64Attachments,
    });

    const sent   = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return res.json({
      success: true,
      message: `Processed ${results.length} contacts — ${sent} sent, ${failed} failed`,
      sent,
      failed,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error("[Route] send-emails error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Reusable helper to run a batch email job in the background (resumable)
async function runBatchJob(job, fromPassword) {
  const CONCURRENCY = job.payload.concurrency ? Number(job.payload.concurrency) : 5;
  const DELAY_MS = job.payload.delayBetweenMs !== undefined ? Number(job.payload.delayBetweenMs) : 1000;

  // Resolve attachment filenames to absolute paths
  const attachmentPaths = (job.payload.attachments || []).map((name) =>
    path.join(UPLOADS_DIR, name)
  );

  // Filter out already processed contacts using unique __idx
  const completedIndices = new Set(job.results.map((r) => r.__idx));
  const remainingContacts = job.contacts.filter((c) => !completedIndices.has(c.__idx));

  console.log(`[Batch Job ${job.id}] Starting run for ${remainingContacts.length} remaining contacts.`);

  try {
    await sendBulkEmails({
      contacts: remainingContacts,
      subject: job.payload.subject,
      htmlBody: job.payload.htmlBody,
      fromEmail: job.payload.fromEmail,
      fromPassword: fromPassword,
      smtpHost: job.payload.smtpHost,
      smtpPort: job.payload.smtpPort ? Number(job.payload.smtpPort) : undefined,
      concurrency: CONCURRENCY,
      delayBetweenMs: DELAY_MS,
      attachmentPaths,
      shouldStop: () => {
        const currentJob = jobs.get(job.id);
        return !currentJob || currentJob.status === "paused" || currentJob.status === "cancelled";
      },
      onProgress: (res) => {
        job.results.push(res);
        if (res.status === "sent") {
          job.sent++;
        } else {
          job.failed++;
        }
        saveJobsDebounced();
      },
    });

    const currentJob = jobs.get(job.id);
    if (currentJob) {
      if (currentJob.status === "paused" || currentJob.status === "cancelled") {
        console.log(`[Batch Job ${job.id}] Paused or Cancelled at ${job.sent + job.failed}/${job.total}`);
      } else {
        currentJob.status = "completed";
        currentJob.completedAt = new Date().toISOString();
        console.log(`[Batch Job ${job.id}] ✓ Completed — ${job.sent} sent, ${job.failed} failed`);
      }
      saveJobsToDisk();
    }
  } catch (err) {
    const currentJob = jobs.get(job.id);
    if (currentJob) {
      currentJob.status = "failed";
      currentJob.error = err.message;
      currentJob.completedAt = new Date().toISOString();
      console.error(`[Batch Job ${job.id}] ✗ Error:`, err.message);
      saveJobsToDisk();
    }
  }
}

// ---------- POST /api/send-emails-batch ----------
// Asynchronous background job — best for large batches (200+ contacts)
app.post("/api/send-emails-batch", async (req, res) => {
  console.log("[Route] POST /api/send-emails-batch");

  try {
    const {
      contacts,
      subject,
      htmlBody,
      fromEmail,
      fromPassword,
      smtpHost,
      smtpPort,
      concurrency,
      delayBetweenMs,
      attachments = [],
    } = req.body;

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided" });
    }
    if (!subject || !htmlBody) {
      return res.status(400).json({ error: "Subject and HTML body are required" });
    }
    if (!fromEmail || !fromPassword) {
      return res.status(400).json({ error: "Sender email and password are required" });
    }

    // Resolve attachment filenames to absolute paths
    const attachmentPaths = attachments.map((name) =>
      path.join(UPLOADS_DIR, name)
    );

    // Verify all attachment files exist
    for (const p of attachmentPaths) {
      if (!fs.existsSync(p)) {
        return res.status(400).json({ error: `Attachment not found: ${path.basename(p)}` });
      }
    }

    // Create job configuration payload
    const jobPayload = {
      subject,
      htmlBody,
      fromEmail,
      smtpHost,
      smtpPort,
      concurrency,
      delayBetweenMs,
      attachments,
    };

    // Create a background job and return immediately
    const job = createJob(contacts, jobPayload);

    res.json({
      success: true,
      jobId: job.id,
      message: `Processing ${contacts.length} emails in background`,
    });

    // Start background processing loop
    runBatchJob(job, fromPassword);
  } catch (err) {
    console.error("[Route] send-emails-batch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- POST /api/pause-job/:jobId ----------
app.post("/api/pause-job/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.status !== "running") {
    return res.status(400).json({ error: `Cannot pause job in '${job.status}' status` });
  }

  job.status = "paused";
  saveJobsToDisk();
  console.log(`[Route] Paused job: ${jobId}`);
  return res.json({ success: true, message: "Job pause requested successfully." });
});

// ---------- POST /api/cancel-job/:jobId ----------
app.post("/api/cancel-job/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  job.status = "cancelled";
  job.completedAt = new Date().toISOString();
  saveJobsToDisk();
  console.log(`[Route] Cancelled job: ${jobId}`);
  return res.json({ success: true, message: "Job cancellation requested successfully." });
});

// ---------- POST /api/resume-job/:jobId ----------
app.post("/api/resume-job/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { fromPassword } = req.body;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (!fromPassword) {
    return res.status(400).json({ error: "Sender password is required to resume the job" });
  }

  if (job.status !== "paused" && job.status !== "interrupted" && job.status !== "failed") {
    return res.status(400).json({ error: `Cannot resume job in '${job.status}' status` });
  }

  job.status = "running";
  job.error = null;
  saveJobsToDisk();

  console.log(`[Route] Resuming job: ${jobId}`);

  res.json({
    success: true,
    jobId: job.id,
    message: "Job resume initiated successfully.",
  });

  // Run in background
  runBatchJob(job, fromPassword);
});

// ---------- GET /api/job-status/:jobId ----------
app.get("/api/job-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json({
    id:          job.id,
    status:      job.status,
    total:       job.total,
    sent:        job.sent,
    failed:      job.failed,
    progress:    job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0,
    startedAt:   job.startedAt,
    completedAt: job.completedAt || null,
    error:       job.error || null,
    results:     job.results,
  });
});

// ---------- POST /api/generate-whatsapp-links ----------
app.post("/api/generate-whatsapp-links", (req, res) => {
  console.log("[Route] POST /api/generate-whatsapp-links");

  try {
    const { contacts, messageTemplate, defaultCountryCode } = req.body;

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided" });
    }
    if (!messageTemplate) {
      return res.status(400).json({ error: "Message template is required" });
    }

    const links = generateWhatsAppLinks({
      contacts,
      messageTemplate,
      defaultCountryCode,
    });

    return res.json({
      success: true,
      message: `Generated ${links.length} WhatsApp links`,
      total:   links.length,
      links,
    });
  } catch (err) {
    console.error("[Route] generate-whatsapp-links error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- POST /api/upload-attachment ----------
app.post("/api/upload-attachment", diskUpload.single("file"), (req, res) => {
  console.log("[Route] POST /api/upload-attachment");

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    return res.json({
      success:      true,
      message:      "Attachment uploaded successfully",
      filename:     req.file.filename,
      originalName: req.file.originalname,
      size:         req.file.size,
    });
  } catch (err) {
    console.error("[Route] upload-attachment error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- GET /api/attachments ----------
app.get("/api/attachments", (_req, res) => {
  console.log("[Route] GET /api/attachments");

  try {
    const files = fs.readdirSync(UPLOADS_DIR).map((name) => {
      const filePath = path.join(UPLOADS_DIR, name);
      const stats    = fs.statSync(filePath);
      return {
        filename:   name,
        size:       stats.size,
        uploadedAt: stats.mtime.toISOString(),
      };
    });

    return res.json({ total: files.length, files });
  } catch (err) {
    console.error("[Route] attachments list error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- DELETE /api/attachments/:filename ----------
// Bonus: allow deleting old attachments to free disk space
app.delete("/api/attachments/:filename", (req, res) => {
  const { filename } = req.params;
  // Sanitise: prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: `Deleted: ${safeName}` });
  } catch (err) {
    console.error("[Route] delete-attachment error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// Catch-all: serve index.html for client-side routing (SPA)
// =====================================================================
if (fs.existsSync(DIST_DIR)) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

// =====================================================================
// Global error handler (catches multer errors, etc.)
// =====================================================================
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    console.error("[Multer Error]", err.message);
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  console.error("[Unhandled Error]", err.message);
  return res.status(500).json({ error: err.message });
});

// =====================================================================
// Start server
// =====================================================================
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   Bulk Messaging Platform — Optimised Server  ⚡  ║
║   http://localhost:${PORT}                          ║
║   Parallel email sends | Connection pooling       ║
╚═══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown: close keep-alive connections cleanly
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received. Closing gracefully...");
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received. Closing gracefully...");
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });
});

export default app;
