const express = require("express"); // imports Express to create routes
const prisma = require("../prisma"); // imports Prisma so routes can talk to PostgreSQL
const protect = require("../middleware/authMiddleware"); // imports JWT middleware to protect routes
const upload = require("../middleware/uploadMiddleware"); // imports Multer upload middleware for PDF files
const { extractTextFromPdf, chunkText } = require("../utils/pdfProcessor"); // imports PDF extraction and chunking helpers
const { generateStudyTools, generateChatAnswer } = require("../utils/gemini"); // imports Gemini helpers for study tools and chat answers
const { sendDocumentJob } = require("../utils/sqs"); // sends document processing jobs to AWS SQS
const {
  uploadFileToS3,
  getS3SignedUrl,
  deleteFileFromS3,
} = require("../utils/s3"); // uploads, signs, and deletes S3 files

const router = express.Router(); // creates a mini-router for document routes

// Upload a PDF, store it in S3, create a document record, and queue background processing
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    const { title } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required" });
    }

    const s3Key = await uploadFileToS3(
      req.file.path,
      req.file.originalname,
      req.user.userId
    );

    const document = await prisma.document.create({
      data: {
        title: title || req.file.originalname,
        originalFilename: req.file.originalname,
        s3Key,
        status: "QUEUED",
        userId: req.user.userId,
      },
    });

    await sendDocumentJob({
      documentId: document.id,
      userId: req.user.userId,
      s3Key,
      originalFilename: req.file.originalname,
    });

    res.status(202).json({
      message: "PDF uploaded and queued for processing",
      document,
      file: {
        originalName: req.file.originalname,
        s3Key,
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

// Creates a temporary signed URL so the logged-in user can view/download their original PDF
router.get("/:id/download", protect, async (req, res) => {
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

    if (!document.s3Key) {
      return res.status(400).json({ message: "Document has no S3 file" });
    }

    const signedUrl = await getS3SignedUrl(document.s3Key);

    res.json({
      message: "Signed URL created successfully",
      url: signedUrl,
    });
  } catch (error) {
    console.error("Download URL error:", error);
    res.status(500).json({ message: "Server error creating download URL" });
  }
});

// Delete one document owned by the logged-in user
router.delete("/:id", protect, async (req, res) => {
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

    if (document.s3Key) {
      await deleteFileFromS3(document.s3Key);
    }

    await prisma.document.delete({
      where: {
        id: document.id,
      },
    });

    res.json({
      message: "Document deleted successfully",
      deletedDocumentId: id,
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ message: "Server error deleting document" });
  }
});

// Retry processing for a failed document
router.post("/:id/retry", protect, async (req, res) => {
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

    if (!document.s3Key) {
      return res.status(400).json({ message: "Document has no S3 file" });
    }

    const updatedDocument = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        status: "QUEUED",
      },
    });

    await sendDocumentJob({
      documentId: document.id,
      userId: req.user.userId,
      s3Key: document.s3Key,
      originalFilename: document.originalFilename,
    });

    res.json({
      message: "Document retry queued successfully",
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Retry document error:", error);
    res.status(500).json({ message: "Server error retrying document" });
  }
});

module.exports = router; // exports routes so index.js can use them