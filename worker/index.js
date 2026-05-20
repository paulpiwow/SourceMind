require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require("pg");

const {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");

const {
    S3Client,
    GetObjectCommand,
} = require("@aws-sdk/client-s3");

const sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

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

// Pauses execution for a given number of milliseconds
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generates structured study tools from extracted PDF text with retry handling
async function generateStudyTools(text) {


    if (process.env.USE_MOCK_AI === "true") {
        return {
            summary:
                "Mock summary: This document was processed successfully through the worker pipeline.",
            keyConcepts: [
                "Mock concept 1",
                "Mock concept 2",
                "Mock concept 3",
                "Mock concept 4",
                "Mock concept 5",
            ],
            flashcards: [
                {
                    question: "Mock question 1?",
                    answer: "Mock answer 1.",
                },
                {
                    question: "Mock question 2?",
                    answer: "Mock answer 2.",
                },
                {
                    question: "Mock question 3?",
                    answer: "Mock answer 3.",
                },
                {
                    question: "Mock question 4?",
                    answer: "Mock answer 4.",
                },
                {
                    question: "Mock question 5?",
                    answer: "Mock answer 5.",
                },
            ],
            quizQuestions: [
                {
                    question: "Mock quiz question 1?",
                    answer: "Mock quiz answer 1.",
                },
                {
                    question: "Mock quiz question 2?",
                    answer: "Mock quiz answer 2.",
                },
                {
                    question: "Mock quiz question 3?",
                    answer: "Mock quiz answer 3.",
                },
                {
                    question: "Mock quiz question 4?",
                    answer: "Mock quiz answer 4.",
                },
                {
                    question: "Mock quiz question 5?",
                    answer: "Mock quiz answer 5.",
                },
            ],
        };
    }



    const prompt = `
You are an AI study assistant.

Analyze the document and return ONLY valid JSON in this exact structure:

{
  "summary": "A concise but useful summary of the document.",
  "keyConcepts": ["concept 1", "concept 2", "concept 3"],
  "flashcards": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ],
  "quizQuestions": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ]
}

Rules:
- Return JSON only.
- Do not include markdown.
- Do not include code fences.
- Make 5 key concepts.
- Make 5 flashcards.
- Make 5 quiz questions.

Document:
${text}
`;

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Calling Gemini attempt ${attempt}/${maxAttempts}`);

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            return JSON.parse(responseText);
        } catch (error) {
            console.error(`Gemini attempt ${attempt} failed:`, error.message);

            if (attempt === maxAttempts) {
                throw error;
            }

            await sleep(attempt * 2000);
        }
    }
}

async function processDocumentJob(job) {
    console.log("Processing document:", job.documentId);

    await pool.query(
        `UPDATE "Document" SET status = $1 WHERE id = $2`,
        ["PROCESSING", job.documentId]
    );

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
            [
                crypto.randomUUID(),
                chunks[i],
                i,
                job.documentId,
            ]
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

    console.log("Document completed:", job.documentId);
}

async function pollQueue() {
    console.log("Worker started. Polling SQS...");

    while (true) {
        const receiveCommand = new ReceiveMessageCommand({
            QueueUrl: process.env.AWS_SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 10,
        });

        const response = await sqs.send(receiveCommand);

        if (!response.Messages || response.Messages.length === 0) {
            console.log("No jobs found...");
            continue;
        }

        for (const message of response.Messages) {
            try {
                const job = JSON.parse(message.Body);

                console.log("Received job:", job);

                await processDocumentJob(job);

                const deleteCommand = new DeleteMessageCommand({
                    QueueUrl: process.env.AWS_SQS_QUEUE_URL,
                    ReceiptHandle: message.ReceiptHandle,
                });

                await sqs.send(deleteCommand);

                console.log("Job deleted from queue.");
            } catch (error) {
                console.error("Failed to process job:", error);

                try {
                    const job = JSON.parse(message.Body);

                    await pool.query(
                        `
                        UPDATE "Document"
                        SET 
                        status = $1,
                        "updatedAt" = NOW()
                        WHERE id = $2
                        `,
                        ["FAILED", job.documentId]
                    );

                    console.log("Document marked as FAILED:", job.documentId);
                } catch (dbError) {
                    console.error("Failed to update FAILED status:", dbError);
                }
            }
        }
    }
}

pollQueue().catch((error) => {
    console.error("Worker crashed:", error);
});