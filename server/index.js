import express from "express";
import cors from "cors";
import compression from "compression";
import multer from "multer";
import { onRequest } from "firebase-functions/v2/https";
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
    // Preserve original name but prefix with timestamp to avoid collisions
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

// ---------- In-memory job store for batch processing ----------
const jobs = new Map();

function createJob(totalContacts) {
  const id = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const job = {
    id,
    status: 'running',
    total: totalContacts,
    sent: 0,
    failed: 0,
    results: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

// ---------- Express app ----------
const app = express();
const PORT = process.env.PORT || 3001;

// Allow all origins for now
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve uploaded files statically (optional, useful for previewing attachments)
app.use("/uploads", express.static(UPLOADS_DIR));

// Serve Vite build output from dist folder if it exists (production)
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// =====================================================================
// ROUTES
// =====================================================================

// ---------- Health check ----------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

    const results = await sendBulkEmails({
      contacts,
      subject,
      htmlBody,
      fromEmail,
      fromPassword,
      smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : undefined,
      attachmentPaths,
    });

    const sent = results.filter((r) => r.status === "sent").length;
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

// ---------- POST /api/send-emails-batch ----------
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

    // Create a background job
    const job = createJob(contacts.length);

    // Return immediately
    res.json({
      success: true,
      jobId: job.id,
      message: `Processing ${contacts.length} emails in background`,
    });

    // Process in background
    (async () => {
      const BATCH_SIZE = 50;
      const BATCH_DELAY_MS = 2000; // 2 seconds between batches

      try {
        for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
          const batch = contacts.slice(i, i + BATCH_SIZE);

          const batchResults = await sendBulkEmails({
            contacts: batch,
            subject,
            htmlBody,
            fromEmail,
            fromPassword,
            smtpHost,
            smtpPort: smtpPort ? Number(smtpPort) : undefined,
            attachmentPaths,
          });

          // Update job progress
          for (const r of batchResults) {
            job.results.push(r);
            if (r.status === "sent") {
              job.sent++;
            } else {
              job.failed++;
            }
          }

          console.log(`[Batch Job ${job.id}] Processed ${Math.min(i + BATCH_SIZE, contacts.length)}/${contacts.length}`);

          // Delay between batches (skip delay after last batch)
          if (i + BATCH_SIZE < contacts.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        job.status = "completed";
        job.completedAt = new Date().toISOString();
        console.log(`[Batch Job ${job.id}] Completed — ${job.sent} sent, ${job.failed} failed`);
      } catch (err) {
        job.status = "failed";
        job.error = err.message;
        job.completedAt = new Date().toISOString();
        console.error(`[Batch Job ${job.id}] Error:`, err.message);
      }
    })();
  } catch (err) {
    console.error("[Route] send-emails-batch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------- GET /api/job-status/:jobId ----------
app.get("/api/job-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    progress: job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0,
    startedAt: job.startedAt,
    completedAt: job.completedAt || null,
    error: job.error || null,
    results: job.results,
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
      total: links.length,
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
      success: true,
      message: "Attachment uploaded successfully",
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
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
      const stats = fs.statSync(filePath);
      return {
        filename: name,
        size: stats.size,
        uploadedAt: stats.mtime.toISOString(),
      };
    });

    return res.json({ total: files.length, files });
  } catch (err) {
    console.error("[Route] attachments list error:", err.message);
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
if (!process.env.FUNCTION_NAME && !process.env.K_SERVICE) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║  Bulk Messaging Platform — Backend Server      ║
║  Running on http://localhost:${PORT}              ║
║  Uploads dir: ${UPLOADS_DIR}  ║
╚════════════════════════════════════════════════╝
    `);
  });
}

// Export the Firebase Cloud Function API
export const api = onRequest({
  timeoutSeconds: 300, // 5 minutes
  memory: "1GiB",      // 1GB RAM for processing Excel files
  cors: true,          // Handle CORS automatically
}, app);
