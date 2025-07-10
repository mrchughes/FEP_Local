// Fully implemented real code for backend/app.js - updated for deployment
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const formRoutes = require("./routes/formRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const aiAgentRoutes = require("./routes/aiAgentRoutes");

dotenv.config();

const app = express();

// Configure CORS for production
const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Prevent payload too large attacks
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/ai-agent", aiAgentRoutes);
// Serve uploaded evidence files statically
const path = require("path");
app.use("/uploads/evidence", express.static(path.join(__dirname, "../uploads/evidence")));

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
