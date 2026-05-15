# 🚀 AI-Powered Document & Multimedia Q&A Web Application

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/cloud/atlas)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 📄 **An intelligent platform that lets you upload PDFs, audio, and video files, then ask questions and get AI-powered answers based on your content.**

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start](#-quick-start)
- [📖 API Documentation](#-api-documentation)
- [🧪 Testing](#-testing)
- [🐳 Docker Deployment](#-docker-deployment)
- [🔧 Environment Variables](#-environment-variables)
- [📊 Database Schema](#-database-schema)
- [🎥 Demo Video](#-demo-video)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **Multi-Format Upload** | Support for PDF, MP3, WAV, MP4, WebM (up to 100MB) |
| 🤖 **AI Chatbot** | Ask questions and get answers based on your uploaded content |
| 📝 **Auto-Summarization** | Automatically generate concise summaries of any document |
| 🎤 **Voice Input** | Speak your questions using browser speech recognition |
| ⏱️ **Timestamp Extraction** | Find specific topics in audio/video files with timestamps |
| ▶️ **Smart Playback** | Click timestamps to jump to exact positions in media |
| 🔐 **User Authentication** | Secure JWT-based authentication |
| 🎨 **Modern UI** | Clean, responsive interface with real-time streaming |
| 🐳 **Docker Ready** | Containerized for easy deployment anywhere |

---

## 🏗️ Architecture

# 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              🌐 USER BROWSER                               │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                │ HTTP / HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       ⚛️ REACT FRONTEND (Port 3000)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│  ✨ Features                                                               │
│  • Drag & Drop File Upload                                                 │
│  • AI Chat Interface (Streaming Responses)                                 │
│  • Voice Recognition Support                                               │
│  • Media Player with Timestamp Navigation                                  │
│  • Authentication & Session Management                                     │
│  • Responsive Modern UI                                                    │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                │ REST API / WebSocket
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        🚀 FASTAPI BACKEND (Port 8000)                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                              🔌 API ENDPOINTS                              │
│                                                                              │
│  📤 Upload APIs                                                             │
│  • POST /api/upload/file        → File Upload & Processing                  │
│                                                                              │
│  🤖 AI Chat APIs                                                            │
│  • POST /api/chat/ask           → Context-Based Q&A                         │
│  • POST /api/chat/ask-stream    → Real-Time Streaming Response              │
│  • POST /api/chat/summarize     → AI Document Summarization                 │
│                                                                              │
│  🔐 Authentication APIs                                                     │
│  • POST /api/auth/register      → User Registration                         │
│  • POST /api/auth/login         → JWT Authentication                        │
│                                                                              │
│  📂 Document APIs                                                           │
│  • GET /api/documents           → Fetch User Documents                      │
│  • GET /api/documents/{id}      → Get Document Details                      │
│  • DELETE /api/documents/{id}   → Delete User Document                      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┬────────────────────┐
        │                       │                        │                    │
        ▼                       ▼                        ▼                    ▼

┌──────────────────┐  ┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
│ 🗄️ MongoDB Atlas │  │ 🔎 Vector Store  │   │ 🤖 OpenRouter AI │  │ 📁 File Storage  │
├──────────────────┤  ├──────────────────┤   ├──────────────────┤  ├──────────────────┤
│ • User Data      │  │ • FAISS Indexing │   │ • GPT-3.5 Turbo  │  │ • Uploaded PDFs  │
│ • Documents      │  │ • Semantic Search│   │ • AI Responses   │  │ • Audio Files    │
│ • Chat History   │  │ • Embeddings     │   │ • Summarization  │  │ • Video Files    │
│ • Authentication │  │ • Context Search │   │ • Streaming APIs │  │ • Temp Chunks    │
└──────────────────┘  └──────────────────┘   └──────────────────┘  └──────────────────┘


# 🔄 Application Workflow

```text
1️⃣ User uploads PDF / Audio / Video
            │
            ▼
2️⃣ Frontend sends file to FastAPI backend
            │
            ▼
3️⃣ Backend processes & extracts content
            │
            ▼
4️⃣ Text chunks are generated
            │
            ▼
5️⃣ Embeddings stored in FAISS Vector DB
            │
            ▼
6️⃣ User asks questions via chat interface
            │
            ▼
7️⃣ Relevant chunks retrieved using semantic search
            │
            ▼
8️⃣ OpenRouter GPT model generates contextual answer
            │
            ▼
9️⃣ Streaming response sent back to frontend
            │
            ▼
🔟 User receives AI-generated answer in real-time
```

## 🛠️ Tech Stack

### **Backend**
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11 | Core language |
| FastAPI | 0.104.1 | Web framework |
| Motor | 3.3.2 | Async MongoDB driver |
| PyPDF | 3.17.4 | PDF text extraction |
| MoviePy | 1.0.3 | Audio/video processing |
| JWT | - | Authentication |
| Passlib | 1.7.4 | Password hashing |

### **Frontend**
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 5.0.8 | Build tool |
| Tailwind CSS | 3.3.6 | Styling |
| Axios | 1.6.2 | HTTP client |
| Zustand | 4.4.7 | State management |
| React Player | 2.13.0 | Media playback |

### **APIs & Services**
| Service | Purpose | Cost |
|---------|---------|------|
| OpenRouter (GPT-3.5 Turbo) | AI chat & summarization | FREE |
| MongoDB Atlas | Database | FREE (512MB) |
| Web Speech API | Voice recognition | FREE (browser) |

---

## 🚀 Quick Start

### **Prerequisites**

- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)
- OpenRouter API key ([get free key](https://openrouter.ai/))

### **Step 1: Clone Repository**

    git clone https://github.com/yourusername/ai-qa-app.git
    cd ai-qa-app

Step 2: Backend Setup

    cd backend
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt

Step 3: Configure Environment

    cp .env.example .env
    
Edit .env file:

    MONGODB_URL=mongodb://localhost:27017
    MONGODB_DB_NAME=ai_qa_db
    OPENROUTER_API_KEY=your_openrouter_api_key_here
    JWT_SECRET_KEY=your_super_secret_key
    
Step 4: Run Backend
    
    uvicorn app.main:app --reload --port 8000
    Backend running at: http://localhost:8000

Step 5: Frontend Setup
    
    cd ../frontend
    npm install
    npm run dev
    Frontend running at: http://localhost:3000

Step 6: Access Application

    Open browser and navigate to http://localhost:3000

# 📖 API Documentation

Welcome to the **AI-Powered Document Q&A Platform API** — a modern REST API for authentication, document processing, AI-powered chat, summarization, and file management.

---

# 🔐 Authentication Endpoints

Manage user registration, login, and authentication securely using JWT tokens.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `GET` | `/api/auth/me` | Get current authenticated user |

---

## 📝 Register User

### Endpoint
```http
POST /api/auth/register
```

### Example Request
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "password":"secure123",
    "full_name":"John Doe"
  }'
```

### Example Response
```json
{
  "message": "User registered successfully",
  "user": {
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

---

## 🔑 Login User

### Endpoint
```http
POST /api/auth/login
```

### Example Request
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=secure123"
```

### Example Response
```json
{
  "access_token": "jwt_token_here",
  "token_type": "bearer"
}
```

---

## 👤 Get Current User

### Endpoint
```http
GET /api/auth/me
```

### Headers
```http
Authorization: Bearer YOUR_TOKEN
```

### Example Response
```json
{
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user"
}
```

---

# 📂 Document Endpoints

Upload, manage, and retrieve user documents including PDFs, audio, and video files.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/file` | Upload document/audio/video |
| `GET` | `/api/documents` | List all user documents |
| `GET` | `/api/documents/{id}` | Get document details |
| `DELETE` | `/api/documents/{id}` | Delete a document |

---

## 📤 Upload File

### Endpoint
```http
POST /api/upload/file
```

### Example Request
```bash
curl -X POST http://localhost:8000/api/upload/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"
```

### Example Response
```json
{
  "document_id": "doc-uuid",
  "filename": "document.pdf",
  "status": "uploaded"
}
```

---

## 📄 Get User Documents

### Endpoint
```http
GET /api/documents
```

### Example Response
```json
[
  {
    "document_id": "doc-uuid",
    "filename": "document.pdf",
    "status": "completed"
  }
]
```

---

# 🤖 Chat & AI Endpoints

Interact with uploaded documents using AI-powered question answering and summarization.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/ask` | Ask AI questions (non-streaming) |
| `POST` | `/api/chat/ask-stream` | Streaming AI response |
| `POST` | `/api/chat/summarize` | Generate document summary |

---

## 💬 Ask Question

### Endpoint
```http
POST /api/chat/ask
```

### Example Request
```bash
curl -X POST http://localhost:8000/api/chat/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_id":"doc-id",
    "question":"What is this document about?"
  }'
```

---

## 📌 Example Response

```json
{
  "answer": "Based on the document, the main topic is...",
  "referenced_timestamp": null,
  "referenced_text": null,
  "timestamps": []
}
```

---

# 🧪 Testing

Comprehensive testing setup using **Pytest** with coverage reporting.

---

## ▶️ Run Backend Tests

```bash
cd backend
pytest --cov=app --cov-report=term --cov-report=html
```

---

## 📊 Generate Coverage Report

```bash
# Generate coverage report
pytest --cov=app --cov-report=html

# Open report in browser
open htmlcov/index.html

# Windows
start htmlcov/index.html
```

---

## 🎯 Run Specific Tests

### Authentication Tests
```bash
pytest app/tests/test_auth.py -v
```

### Upload Tests
```bash
pytest app/tests/test_upload.py -v
```

### Verbose Testing
```bash
pytest -v --tb=short
```

---

# ✅ Test Coverage Goals

| Module | Target Coverage | Status |
|---|---|---|
| `auth.py` | 95% | ✅ |
| `routers/auth_routes.py` | 95% | ✅ |
| `routers/upload.py` | 95% | ✅ |
| `services/file_processor.py` | 95% | ✅ |
| `utils/chunking.py` | 95% | ✅ |

---

# 🐳 Docker Deployment

Deploy the application seamlessly using Docker and Docker Compose.

---

## 🚀 Build & Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

---

## 🏗️ Individual Docker Builds

### Backend
```bash
cd backend
docker build -t ai-qa-backend .
```

### Frontend
```bash
cd ../frontend
docker build -t ai-qa-frontend .
```

### Run Backend
```bash
docker run -p 8000:8000 --env-file .env ai-qa-backend
```

### Run Frontend
```bash
docker run -p 3000:80 ai-qa-frontend
```

---

# ☁️ Deploy to Railway

## Install Railway CLI

```bash
npm install -g @railway/cli
```

## Login & Deploy

```bash
railway login
railway up
```

---

# 🔧 Environment Variables

## Backend (`.env`)

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Database name | `ai_qa_db` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `JWT_SECRET_KEY` | JWT signing secret | Required |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry time | `30` |
| `MAX_FILE_SIZE` | Maximum upload size | `104857600` |

---

## Frontend (`.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |

---

# 🗄️ Database Schema

---

## 👤 Users Collection

```javascript
{
  "_id": "uuid",
  "email": "user@example.com",
  "hashed_password": "bcrypt_hash",
  "full_name": "John Doe",
  "role": "user",
  "created_at": ISODate()
}
```

---

## 📄 Documents Collection

```javascript
{
  "_id": "uuid",
  "user_id": "user-uuid",
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_path": "uploads/...",
  "file_size": 92476,
  "extracted_text": "...",
  "summary": "...",
  "status": "completed",
  "created_at": ISODate()
}
```

---

## 💬 Chat History Collection

```javascript
{
  "_id": "uuid",
  "user_id": "user-uuid",
  "document_id": "doc-uuid",
  "question": "What is this about?",
  "answer": "...",
  "created_at": ISODate()
}
```

---

# 🌟 Features Overview

✅ JWT Authentication  
✅ Secure File Uploads  
✅ AI-Powered Question Answering  
✅ Document Summarization  
✅ Streaming AI Responses  
✅ MongoDB Integration  
✅ Docker Deployment  
✅ Railway Cloud Deployment  
✅ Automated Testing with Pytest  
✅ High Test Coverage  
✅ RESTful API Architecture  
✅ Scalable Backend Design  

