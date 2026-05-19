const fs = require("fs"); // lets Node read files from your uploads folder
const pdfParse = require("pdf-parse"); // extracts text from PDF files

// Reads a PDF file from disk and extracts its text
async function extractTextFromPdf(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(fileBuffer);

  return pdfData.text;
}

// Splits extracted text into smaller pieces for storage and future chatbot retrieval
function chunkText(text, chunkSize = 1000) {
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

module.exports = {
  extractTextFromPdf,
  chunkText,
};