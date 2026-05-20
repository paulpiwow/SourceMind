import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [email, setEmail] = useState("paul@test.com");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Logs user in and loads their documents
  async function handleLogin(e) {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          email,
          password,
        }
      );

      const jwtToken = response.data.token;

      setToken(jwtToken);
      setUser(response.data.user);
      setMessage("Login successful");

      await fetchDocuments(jwtToken);
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  }

  // Logs user out and clears frontend state
  function handleLogout() {
    setToken("");
    setUser(null);
    setDocuments([]);
    setMessage("Logged out");
  }

  // Uploads a PDF to the backend, waits for processing, then adds it to the dashboard
  async function handleUpload(e) {
    e.preventDefault();

    if (!selectedFile) {
      setMessage("Please choose a PDF file first.");
      return;
    }

    setUploading(true);
    setMessage("Uploading and processing PDF...");

    try {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("file", selectedFile);

      const response = await axios.post(
        "http://localhost:5000/api/documents/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setDocuments((prev) => [response.data.document, ...prev]);
      setUploadTitle("");
      setSelectedFile(null);
      setMessage("Upload complete.");
    } catch (error) {
      console.error("Upload failed:", error);
      setMessage(error.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Loads one document and its saved chat history
  async function openDocument(documentId) {
    try {
      const documentResponse = await axios.get(
        `http://localhost:5000/api/documents/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const chatResponse = await axios.get(
        `http://localhost:5000/api/documents/${documentId}/chat`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSelectedDocument(documentResponse.data.document);
      setChatHistory(chatResponse.data.messages);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to open document.");
    }
  }

  // Sends a question to the backend chatbot route and updates chat history
  async function handleChatSubmit(e) {
    e.preventDefault();

    if (!chatMessage.trim()) {
      return;
    }

    setChatLoading(true);

    try {
      const response = await axios.post(
        `http://localhost:5000/api/documents/${selectedDocument.id}/chat`,
        {
          message: chatMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setChatHistory((prev) => [
        ...prev,
        {
          role: "user",
          content: chatMessage,
        },
        {
          role: "assistant",
          content: response.data.answer,
        },
      ]);

      setChatMessage("");
    } catch (error) {
      setMessage(error.response?.data?.message || "Chat failed.");
    } finally {
      setChatLoading(false);
    }
  }


  // Gets a temporary signed S3 URL from the backend and opens the PDF
  async function handleDownloadPdf() {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/documents/${selectedDocument.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      window.open(response.data.url, "_blank");
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to open PDF.");
    }
  }


  // Deletes the currently selected document and removes it from the dashboard
  async function handleDeleteDocument() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) return;

    try {
      await axios.delete(
        `http://localhost:5000/api/documents/${selectedDocument.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setDocuments((prev) =>
        prev.filter((doc) => doc.id !== selectedDocument.id)
      );

      setSelectedDocument(null);
      setMessage("Document deleted successfully.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to delete document.");
    }
  }


  // Fetches the latest documents for the logged-in user
  async function fetchDocuments(jwtToken = token) {
    const response = await axios.get("http://localhost:5000/api/documents", {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    setDocuments(response.data.documents);
  }

  // Auto-refreshes document statuses while user is logged in
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [token]);

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">SourceMind</h1>

          <p className="text-slate-400 mb-6">
            AI-powered document intelligence platform.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>

              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Password</label>

              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-2 font-semibold"
            >
              Login
            </button>
          </form>

          {message && (
            <p className="mt-4 text-sm text-green-400">{message}</p>
          )}
        </div>
      </div>
    );
  }

  // Document detail screen
  if (selectedDocument) {
    const isCompleted = selectedDocument.status === "COMPLETED";

    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => setSelectedDocument(null)}
            className="mb-6 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg"
          >
            ← Back to Dashboard
          </button>

          <div className="bg-slate-900 rounded-2xl p-6 mb-6">
            <h1 className="text-3xl font-bold">{selectedDocument.title}</h1>
            <p className="text-slate-400 mt-1">
              {selectedDocument.originalFilename}
            </p>

            <p className="text-sm mt-3">
              Status:{" "}
              <span
                className={
                  isCompleted ? "text-green-400" : "text-yellow-400"
                }
              >
                {selectedDocument.status}
              </span>
            </p>
            <button
              onClick={handleDownloadPdf}
              className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
            >
              View Original PDF
            </button>
            <button
              onClick={handleDeleteDocument}
              className="mt-4 ml-3 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold"
            >
              Delete Document
            </button>
          </div>

          {!isCompleted ? (
            <div className="bg-slate-900 rounded-2xl p-6">
              <h2 className="text-2xl font-semibold mb-2">
                Processing Document
              </h2>
              <p className="text-slate-400">
                This document is currently {selectedDocument.status}. The worker
                is extracting text, generating study tools, and preparing chat
                context. Please return to the dashboard and wait for it to finish.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-slate-900 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-3">AI Summary</h2>
                <p className="text-slate-300 whitespace-pre-wrap">
                  {selectedDocument.summary}
                </p>
              </div>

              <div className="bg-slate-900 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-4">
                  Chat with Document
                </h2>

                <div className="bg-slate-800 rounded-xl p-4 mb-4 max-h-80 overflow-y-auto space-y-3">
                  {chatHistory.length === 0 ? (
                    <p className="text-slate-400">
                      Ask a question about this document.
                    </p>
                  ) : (
                    chatHistory.map((message, index) => (
                      <div
                        key={index}
                        className={
                          message.role === "user"
                            ? "text-blue-300"
                            : "text-green-300"
                        }
                      >
                        <p className="text-xs uppercase text-slate-500 mb-1">
                          {message.role}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleChatSubmit} className="flex gap-3">
                  <input
                    className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask something about this document..."
                    type="text"
                  />

                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 font-semibold"
                  >
                    {chatLoading ? "Thinking..." : "Ask"}
                  </button>
                </form>
              </div>

              {selectedDocument.keyConcepts && (
                <div className="bg-slate-900 rounded-2xl p-6 mb-6">
                  <h2 className="text-2xl font-semibold mb-3">Key Concepts</h2>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    {selectedDocument.keyConcepts.map((concept, index) => (
                      <li key={index}>{concept}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedDocument.flashcards && (
                <div className="bg-slate-900 rounded-2xl p-6 mb-6">
                  <h2 className="text-2xl font-semibold mb-3">Flashcards</h2>
                  <div className="space-y-3">
                    {selectedDocument.flashcards.map((card, index) => (
                      <div key={index} className="bg-slate-800 rounded-xl p-4">
                        <p className="font-semibold">{card.question}</p>
                        <p className="text-slate-300 mt-2">{card.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument.quizQuestions && (
                <div className="bg-slate-900 rounded-2xl p-6">
                  <h2 className="text-2xl font-semibold mb-3">Quiz Questions</h2>
                  <div className="space-y-3">
                    {selectedDocument.quizQuestions.map((question, index) => (
                      <div key={index} className="bg-slate-800 rounded-xl p-4">
                        <p className="font-semibold">{question.question}</p>
                        <p className="text-slate-300 mt-2">{question.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Dashboard screen after login
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">SourceMind Dashboard</h1>

            <p className="text-slate-400 mt-1">
              Welcome back, {user.name}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
          >
            Logout
          </button>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Upload PDF</h2>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Document Title</label>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Example: Cloud Systems Notes"
                type="text"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">PDF File</label>
              <input
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />

              {selectedFile && (
                <p className="mt-2 text-sm text-green-400">
                  Selected file: {selectedFile.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 font-semibold"
            >
              {uploading ? "Uploading..." : "Upload PDF"}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-sm text-slate-300">{message}</p>
          )}
        </div>

        <div className="bg-slate-900 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold mb-4">Your Documents</h2>

          {documents.length === 0 ? (
            <p className="text-slate-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => openDocument(doc.id)}
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700 cursor-pointer hover:bg-slate-700"
                >
                  <h3 className="text-xl font-semibold">{doc.title}</h3>

                  <p className="text-slate-400 text-sm mt-1">
                    {doc.originalFilename}
                  </p>

                  <p className="text-sm mt-2">
                    Status:{" "}
                    <span className="text-green-400">{doc.status}</span>
                  </p>

                  {doc.summary && (
                    <div className="mt-4">
                      <p className="text-sm text-slate-400 mb-1">
                        AI Summary
                      </p>

                      <p className="text-slate-200 text-sm">{doc.summary}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;