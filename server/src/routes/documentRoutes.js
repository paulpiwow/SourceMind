//This code lets logged-in users create a test document record and 
// list only their own documents.

const express = require("express"); // imports Express to create routes
const prisma = require("../prisma"); // imports Prisma so routes can talk to PostgreSQL
const protect = require("../middleware/authMiddleware"); // imports JWT middleware to protect routes

const router = express.Router(); // creates a mini-router for document routes

// Create a test document record for the logged-in user
router.post("/", protect, async (req, res) => {
  try {
    const { title, originalFilename } = req.body;

    if (!title || !originalFilename) {
      return res.status(400).json({
        message: "Title and originalFilename are required",
      });
    }

    const document = await prisma.document.create({
      data: {
        title,
        originalFilename,
        status: "UPLOADED",
        userId: req.user.userId,
      },
    });

    res.status(201).json({
      message: "Document created successfully",
      document,
    });
  } catch (error) {
    console.error("Create document error:", error);
    res.status(500).json({ message: "Server error creating document" });
  }
});

// Get all documents owned by the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      message: "Documents retrieved successfully",
      documents,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ message: "Server error getting documents" });
  }
});

module.exports = router; // exports routes so index.js can use them