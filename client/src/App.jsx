import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  //Stores backend status - creates a variable the UI can display and update
  const [backendStatus, setBackendStatus] = useState("Checking backend...");

  //Calls your backend once when the page loads - checks whether Express is running
  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await axios.get("http://localhost:5000/api/health");
        setBackendStatus(response.data.service + " is running");
      } catch (error) {
        setBackendStatus("Backend connection failed");
      }
    }

    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="max-w-xl w-full rounded-2xl bg-slate-900 p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-4">SourceMind</h1>
        <p className="text-slate-300 mb-6">
          AI-powered document intelligence platform.
        </p>

        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Backend Status</p>
          <p className="text-lg font-semibold">{backendStatus}</p>
        </div>
      </div>
    </div>
  );
}

export default App;