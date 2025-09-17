"use client";
import { useState, useRef, useEffect } from "react";
import pdfToText from "react-pdftotext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

// Split by words, with overlap, safe for Gemini embeddings
const chunkTextByParagraph = (text, chunkSize = 500, overlap = 50) => {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];

  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
};


export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Restore uploaded files from localStorage
  useEffect(() => {
    const savedFiles = JSON.parse(
      localStorage.getItem("uploadedFiles") || "[]"
    );
    const last = localStorage.getItem("uploadedFileName") || "";
    if (savedFiles.length) setUploadedFiles(savedFiles);
    if (last) setUploadedFileName(last);
  }, []);

  useEffect(() => {
    localStorage.setItem("uploadedFiles", JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  useEffect(() => {
    if (uploadedFileName) {
      localStorage.setItem("uploadedFileName", uploadedFileName);
    }
  }, [uploadedFileName]);

  // File input change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus("");
      setUploadProgress(0);
    }
  };

  // Upload + parse file
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file");
      return;
    }
    // const pdfjsLib = pdfjsLibRef.current;

    setUploadStatus("starting upload...");
    setUploadProgress(0);
    const fileName = selectedFile.name.replace(/\s+/g, "_");

try {
  setUploadStatus('parsing file...')
  let textContent=''

  if(selectedFile.type==='application/pdf'){
    textContent=await pdfToText(selectedFile)
  }else{
    const fileBuffer=await selectedFile.arrayBuffer()
    textContent=new TextDecoder().decode(fileBuffer)
  }
  setUploadStatus('chunking file...')
  const chunks=chunkTextByParagraph(textContent,500,50)
  const totalChunks=chunks.length
  const batchSize=5
      if (totalChunks === 0) {
        throw new Error("Could not extract any text from the file.");
      }

      for(let i=0;i<totalChunks;i+=batchSize){
        const batch=chunks.slice(i,i+batchSize)
    const res=await fetch(`${API_BASE}/api/process-batch`,{
      method:"POST",
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        fileName,
        chunks:batch,
        startChunkNumber:i
      })
    })

    if(!res.ok) throw new Error('failed to process batch')
        const progress = Math.min(
          100,
          Math.round(((i + batchSize) / totalChunks) * 100)
        );
        setUploadProgress(progress);
        setUploadStatus(`Processing... ${progress}%`);
      }
        setUploadStatus(`✅ File "${fileName}" processed successfully!`);
      setUploadedFileName(fileName);
      setUploadedFiles((prev) => Array.from(new Set([fileName, ...prev])));
} catch (error) {
    setUploadStatus(`❌ Error: ${error.message || "Failed to process file."}`);
}finally {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Ask a question
  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = inputRef.current?.value?.trim();
    if (!question || isLoading) return;

    if (!uploadedFileName) {
      setMessages((m) => [
        ...m,
        { role: "ai", content: "Please upload or select a file first." },
      ]);
      return;
    }

    setMessages((m) => [...m, { role: "user", content: question }]);
    setIsLoading(true);
    if (inputRef.current) inputRef.current.value = "";

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, fileName: uploadedFileName }),
      });

      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          content: res.ok && data?.success ? data.answer : "No answer found.",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "ai", content: "Unexpected error occurred." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col font-sans">
      <header className="bg-gray-800 p-4 border-b border-gray-700 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-cyan-400">
          Classory AI Assistant
        </h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
        {/* Teacher's Panel */}
        <div className="md:w-1/3 bg-gray-800 rounded-lg p-6 flex flex-col border border-gray-700 shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400 border-b border-cyan-700 pb-2">
            Teacher&apos;s Panel
          </h2>
          <p className="text-gray-400 mb-6 text-sm">
            Upload .txt or .pdf files for the AI to learn from.
          </p>

          <div className="flex flex-col gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,.pdf"
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 transition-colors"
            />
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Upload Material
            </button>
            {uploadStatus && (
              <p className="text-sm text-center text-gray-300 mt-1">
                {uploadStatus}
              </p>
            )}
            {uploadProgress > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                <div
                  className="bg-cyan-600 h-2.5 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* File selector */}
          <div className="mt-6">
            <label className="block text-sm text-gray-300 mb-2">
              Active file for questions
            </label>
            <select
              value={uploadedFileName}
              onChange={(e) => setUploadedFileName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-md px-3 py-2"
            >
              <option value="">
                {uploadedFiles.length ? "Select a file…" : "No files yet"}
              </option>
              {uploadedFiles.map((name, i) => (
                <option key={`${name}::${i}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {uploadedFileName && (
              <p className="text-xs text-gray-400 mt-1">
                Using: {uploadedFileName}
              </p>
            )}
          </div>
        </div>

        {/* Student's Chatbot */}
        <div className="flex-1 flex flex-col bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-md">
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xl lg:max-w-2xl px-4 py-2 rounded-2xl whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-cyan-600" : "bg-gray-700"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 px-4 py-3 rounded-2xl flex items-center space-x-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-gray-800 border-t border-gray-700">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  uploadedFileName
                    ? "Ask a question about the selected file…"
                    : "Upload or select a file to ask questions…"
                }
                className="flex-1 bg-gray-700 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={isLoading || !uploadedFileName}
                className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded-full disabled:bg-gray-600 transition-colors"
                title={!uploadedFileName ? "Select a file first" : "Send"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transform rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
