const express = require("express"); // imports Express to create routes
const prisma = require("../prisma"); // imports Prisma so routes can talk to PostgreSQL
const protect = require("../middleware/authMiddleware"); // imports JWT middleware to protect routes
const upload = require("../middleware/uploadMiddleware"); // imports Multer upload middleware for PDF files
const { extractTextFromPdf, chunkText } = require("../utils/pdfProcessor"); // imports PDF extraction and chunking helpers
const { generateStudyTools, generateChatAnswer } = require("../utils/gemini"); // imports Gemini helpers for study tools and chat answers

const router = express.Router(); // creates a mini-router for document routes

// Upload a real PDF file, extract its text, chunk it, and save everything for the logged-in user
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    const { title } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required" });
    }

    const document = await prisma.document.create({
      data: {
        title: title || req.file.originalname,
        originalFilename: req.file.originalname,
        s3Key: req.file.path,
        status: "PROCESSING",
        userId: req.user.userId,
      },
    });

    const extractedText = await extractTextFromPdf(req.file.path);
    const chunks = chunkText(extractedText);

    await prisma.documentChunk.createMany({
      data: chunks.map((chunk, index) => ({
        content: chunk,
        chunkIndex: index,
        documentId: document.id,
      })),
    });

    const studyTools = await generateStudyTools(extractedText.slice(0, 12000)); // sends extracted PDF text to Gemini and gets structured study data

    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "COMPLETED",
        summary: studyTools.summary,
        keyConcepts: studyTools.keyConcepts,
        flashcards: studyTools.flashcards,
        quizQuestions: studyTools.quizQuestions,
      },
    });

    res.status(201).json({
      message: "PDF uploaded and processed successfully",
      document: updatedDocument,
      chunkCount: chunks.length,
      file: {
        originalName: req.file.originalname,
        savedPath: req.file.path,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({ message: "Server error uploading document" });
  }
});

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

// Get one document by ID, including its extracted chunks
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: req.user.userId,
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc",
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({
      message: "Document retrieved successfully",
      document,
    });
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).json({ message: "Server error getting document" });
  }
});

// Chat with a document using its extracted chunks as context
router.post("/:id/chat", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Chat message is required" });
    }

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: req.user.userId,
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc",
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.chunks.length === 0) {
      return res.status(400).json({
        message: "Document has no extracted chunks yet",
      });
    }

    const answer = await generateChatAnswer(message, document.chunks);

    await prisma.chatMessage.create({
      data: {
        role: "user",
        content: message,
        userId: req.user.userId,
        documentId: document.id,
      },
    });

    await prisma.chatMessage.create({
      data: {
        role: "assistant",
        content: answer,
        userId: req.user.userId,
        documentId: document.id,
      },
    });

    res.json({
      message: "Chat response generated successfully",
      answer,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ message: "Server error during chat" });
  }
});

// Get chat history for one document owned by the logged-in user
router.get("/:id/chat", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: req.user.userId,
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        documentId: id,
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json({
      message: "Chat history retrieved successfully",
      messages,
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ message: "Server error getting chat history" });
  }
});

module.exports = router; // exports routes so index.js can use them