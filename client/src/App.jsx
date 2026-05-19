import { useState } from "react";
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

      // Fetches documents owned by the logged-in user
      const documentsResponse = await axios.get(
        "http://localhost:5000/api/documents",
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );

      setDocuments(documentsResponse.data.documents);
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
      setMessage(error.response?.data?.message || "Upload failed");
      setUploading(false);
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
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700"
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