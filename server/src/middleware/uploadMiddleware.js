const multer = require("multer"); // imports Multer for handling file uploads
const path = require("path"); // imports path utilities for file extensions

// Configures where uploaded files are stored and how filenames are generated
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();

    cb(
      null,
      uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Only allows PDF uploads
function fileFilter(req, file, cb) {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
}

// Creates upload middleware using storage + validation rules
const upload = multer({
  storage,
  fileFilter,
});

module.exports = upload;