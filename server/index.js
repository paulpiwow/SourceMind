const express = require("express"); //imports express to build API routes
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "SourceMind API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SourceMind backend",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});