const { GoogleGenerativeAI } = require("@google/generative-ai"); // imports Gemini SDK

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // creates Gemini client

const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
});

// Generates structured study tools from extracted PDF text
async function generateStudyTools(text) {
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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return JSON.parse(responseText);
}

// Generates a chatbot answer using uploaded document context
async function generateChatAnswer(question, chunks) {
    const context = chunks.map((chunk) => chunk.content).join("\n\n");

    const prompt = `
You are an AI document assistant.

Answer the user's question using ONLY the document context below.

Rules:
- If the answer is not in the context, say you cannot find it in the document.
- Be clear and helpful.
- Do not make up information.
- Keep the answer concise.

Document Context:
${context}

User Question:
${question}
`;

    const result = await model.generateContent(prompt);

    return result.response.text();
}

module.exports = {
    generateStudyTools,
    generateChatAnswer,
};