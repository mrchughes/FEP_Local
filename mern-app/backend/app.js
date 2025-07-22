// Fully implemented real code for backend/app.js - updated for deployment
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const authRoutes = require("./routes/authRoutes");
const oneloginAuthRoutes = require("./routes/oneloginAuthRoutes");
const formRoutes = require("./routes/formRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const aiAgentRoutes = require("./routes/aiAgentRoutes");
const testRoutes = require("./routes/testRoutes");
const pdsRoutes = require("./routes/pdsRoutes");
const pdsCredentialRoutes = require("./routes/pdsCredentialRoutes");
const didChallengeRoutes = require("./routes/didChallengeRoutes");
const credentialMappingRoutes = require("./routes/credentialMappingRoutes");

dotenv.config();


const app = express();
// Enable file upload middleware with increased file size limits
app.use(fileUpload({
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB file size limit
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Configure CORS for Cloudflare and production
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.CLOUDFLARE_URL,
  'https://your-production-domain.com', // Replace with your real domain
  'https://fep.mrchughes.site', // Cloudflare tunnel for MERN app
  'https://agent.mrchughes.site', // Cloudflare tunnel for Python app (if needed for CORS)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: "20mb" })); // Increased limit for JSON payloads
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Configure session middleware for OneLogin authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'fep-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Mount API routes
app.use("/api/users", authRoutes);  // Changed from /api/auth to /api/users to match frontend
app.use("/auth", oneloginAuthRoutes); // OneLogin auth routes at /auth endpoint
app.use("/api/forms", formRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/ai-agent", aiAgentRoutes);
app.use("/api/test", testRoutes);
app.use("/api/pds", pdsRoutes);
app.use("/api/credentials", pdsCredentialRoutes);
app.use("/pds", didChallengeRoutes);  // DID challenge routes at /pds endpoint
app.use("/api/mapping", credentialMappingRoutes);  // Field mapping routes
// Serve uploaded evidence files statically
const path = require("path");
// Fix path to uploads folder - evidence files are now organized by user ID
app.use("/uploads/evidence", express.static(path.join(__dirname, "uploads/evidence")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// DEBUG: List all registered routes on startup
app.on('mount', () => {
  setTimeout(() => {
    if (app._router && app._router.stack) {
      console.log('Registered routes:');
      app._router.stack.filter(r => r.route).forEach(r => {
        const methods = Object.keys(r.route.methods).join(',').toUpperCase();
        console.log(`${methods} ${r.route.path}`);
      });
    }
  }, 1000);
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app;
