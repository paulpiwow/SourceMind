//This version imports your Prisma client and adds a new 
// route, /api/db-test, that counts users in your Neon database.

const express = require("express"); // imports express to build API routes
const cors = require("cors"); // allows frontend to backend requests
require("dotenv").config(); // loads environment variables from a .env file

const prisma = require("./src/prisma"); // imports Prisma client so backend can talk to PostgreSQL
const authRoutes = require("./src/routes/authRoutes"); // imports authentication routes
const documentRoutes = require("./src/routes/documentRoutes"); // imports document routes

const app = express(); // creates the express app - backend server

// Allows React frontend to make requests to backend
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json()); // allows backend to read JSON request bodies
app.use("/api/auth", authRoutes); // connects auth routes under /api/auth
app.use("/api/documents", documentRoutes); // connects document routes under /api/documents

// Basic homepage route for the backend
app.get("/", (req, res) => {
  res.json({ message: "SourceMind API is running" });
});

// Proves that backend is alive
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SourceMind backend",
  });
});

// Tests that Express can connect to PostgreSQL through Prisma
app.get("/api/db-test", async (req, res) => {
  try {
    const userCount = await prisma.user.count(); // counts rows in the User table

    res.json({
      status: "ok",
      message: "Database connection successful",
      userCount,
    });
  } catch (error) {
    console.error("Database test failed:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

// Use port from .env, otherwise use 5000
const PORT = process.env.PORT || 5000;

// Starts the backend server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});