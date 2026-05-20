# SourceMind

SourceMind is a cloud-native AI document intelligence platform that allows users to upload PDFs, process them asynchronously, generate AI-powered study tools, and chat with document content.

---

# Features

- User registration and login
- JWT authentication
- PDF upload system
- AWS S3 document storage
- Signed S3 download URLs
- AWS SQS asynchronous job queue
- AWS Lambda background document processing
- AI-generated summaries
- Key concepts extraction
- Flashcard generation
- Quiz question generation
- Chat with uploaded documents
- Retry failed processing jobs
- Delete documents from Postgres and S3
- CloudWatch logging and monitoring
- Dockerized local infrastructure

---

# Tech Stack

## Frontend
- React
- Vite
- Tailwind CSS
- Axios

## Backend
- Node.js
- Express
- Prisma ORM
- JWT Authentication

## Database
- Neon PostgreSQL

## Cloud Infrastructure
- AWS S3
- AWS SQS
- AWS Lambda
- AWS CloudWatch

## AI
- Google Gemini API
- Mock AI development mode

## DevOps
- Docker
- Docker Compose

---

# Architecture

SourceMind uses an asynchronous cloud-native architecture.

The React frontend communicates with an Express backend API. Uploaded PDFs are stored in AWS S3 while document metadata is stored in PostgreSQL. The backend sends processing jobs to AWS SQS, which automatically triggers AWS Lambda. Lambda downloads the PDF from S3, extracts text, generates study tools, and updates PostgreSQL.

```text
React Frontend
      ↓
Express Backend API
      ↓
PostgreSQL + AWS S3
      ↓
AWS SQS Queue
      ↓
AWS Lambda Worker
      ↓
Gemini API / Mock AI
      ↓
PostgreSQL Updated
      ↓
Frontend Polling Updates UI
```

--- 

## Document Processing Flow

```text
User uploads PDF
        ↓
Express uploads file to AWS S3
        ↓
Express creates document row in PostgreSQL
        ↓
Express sends processing job to AWS SQS
        ↓
AWS Lambda automatically triggered
        ↓
Lambda downloads PDF from S3
        ↓
Lambda extracts text and chunks content
        ↓
Lambda generates study tools
        ↓
Lambda updates PostgreSQL
        ↓
Frontend polls backend and updates UI
```

---


## Project Structure

```text
SourceMind/
│
├── client/             # React frontend
├── server/             # Express backend API
├── worker/             # Original local SQS worker
├── lambda-worker/      # AWS Lambda worker
├── docker-compose.yml
└── README.md
```

---

# Current System Design

## Frontend

The frontend allows users to:
- Register and login
- Upload PDFs
- View uploaded documents
- Download original PDFs
- Retry failed jobs
- Chat with processed documents
- View generated study tools

## Backend API

The Express backend:
- Handles authentication
- Uploads files to S3
- Stores metadata in Postgres
- Creates SQS processing jobs
- Serves signed S3 URLs
- Handles retry/delete operations

## AWS Lambda Worker

The Lambda worker:
- Consumes SQS messages
- Downloads PDFs from S3
- Extracts document text
- Generates AI study tools
- Updates PostgreSQL
- Handles failed processing states

---

# Failure Handling

If processing fails:
- Document status becomes FAILED
- User can retry processing
- CloudWatch stores execution logs
- Failed jobs can be re-queued

---

# Local Development

## Frontend

- cd client
- npm install
- npm run dev

## Backend

- cd server
- npm install
- npm run dev

---

# Docker Development

- docker compose up --build

---

## Environment Variables

### Server

```env
DATABASE_URL=
JWT_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
AWS_SQS_QUEUE_URL=
GEMINI_API_KEY=
```

### Lambda

```env
DATABASE_URL=
GEMINI_API_KEY=
USE_MOCK_AI=true
AWS_BUCKET_NAME=
```

---

# AI Modes

## Mock AI Mode

Used during infrastructure development and testing.

USE_MOCK_AI=true

## Gemini AI Mode

Used for real AI-generated study tools.

USE_MOCK_AI=false

---
