const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require("pg");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({});
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
});

function chunkText(text, chunkSize = 1000) {
    const chunks = [];

    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }

    return chunks;
}

async function streamToBuffer(stream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

async function downloadPdfFromS3(s3Key) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
    });

    const response = await s3.send(command);
    return streamToBuffer(response.Body);
}

async function generateStudyTools(text) {
    if (process.env.USE_MOCK_AI === "true") {
        return {
            summary: "Mock summary: Lambda successfully processed this document.",
            keyConcepts: ["Lambda", "SQS", "S3", "Postgres", "Async processing"],
            flashcards: [
                { question: "What processed this document?", answer: "AWS Lambda." },
                { question: "What triggered Lambda?", answer: "An SQS message." },
            ],
            quizQuestions: [
                { question: "What cloud service stored the PDF?", answer: "Amazon S3." },
            ],
        };
    }

    const prompt = `
Return ONLY valid JSON:
{
  "summary": "...",
  "keyConcepts": ["..."],
  "flashcards": [{"question":"...", "answer":"..."}],
  "quizQuestions": [{"question":"...", "answer":"..."}]
}

Document:
${text}
`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

async function processDocumentJob(job) {
    await pool.query(`UPDATE "Document" SET status = $1 WHERE id = $2`, [
        "PROCESSING",
        job.documentId,
    ]);

    const pdfBuffer = await downloadPdfFromS3(job.s3Key);
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    const chunks = chunkText(extractedText);

    for (let i = 0; i < chunks.length; i++) {
        await pool.query(
            `
      INSERT INTO "DocumentChunk" ("id", "content", "chunkIndex", "documentId", "createdAt")
      VALUES ($1, $2, $3, $4, NOW())
      `,
            [crypto.randomUUID(), chunks[i], i, job.documentId]
        );
    }

    const studyTools = await generateStudyTools(extractedText.slice(0, 12000));

    await pool.query(
        `
    UPDATE "Document"
    SET 
      status = $1,
      summary = $2,
      "keyConcepts" = $3,
      flashcards = $4,
      "quizQuestions" = $5,
      "updatedAt" = NOW()
    WHERE id = $6
    `,
        [
            "COMPLETED",
            studyTools.summary,
            JSON.stringify(studyTools.keyConcepts),
            JSON.stringify(studyTools.flashcards),
            JSON.stringify(studyTools.quizQuestions),
            job.documentId,
        ]
    );
}

exports.handler = async (event) => {
    for (const record of event.Records) {
        const job = JSON.parse(record.body);

        try {
            console.log("Processing Lambda job:", job);
            await processDocumentJob(job);
            console.log("Completed Lambda job:", job.documentId);
        } catch (error) {
            console.error("Lambda job failed:", error);

            await pool.query(
                `
        UPDATE "Document"
        SET status = $1, "updatedAt" = NOW()
        WHERE id = $2
        `,
                ["FAILED", job.documentId]
            );

            throw error;
        }
    }
};