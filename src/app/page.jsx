"use client";

import { useState, useRef, useEffect } from "react";
import pdfToText from "react-pdftotext";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  TextField,
  Select,
  MenuItem,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
} from "@mui/material";
import icon from "@/public/icon.png";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

const chunkText = (text, chunkSize = 2000, overlap = 150) => {
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

  const handleFileChange = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setSelectedFile(files);
      setUploadStatus("");
      setUploadProgress(0);
    }
  };

  // Upload + parse file
  const handleFileUpload = async () => {
    if (!selectedFile || selectedFile.length === 0) {
      setUploadStatus("Please select file(s)");
      return;
    }
    for (const file of selectedFile) {
      const fileName = file.name.replace(/\s+/g, "_");
      setUploadStatus(`Parsing ${fileName}...`);
      let textContent = "";

      if (file.type === "application/pdf") {
        textContent = await pdfToText(file);
      } else {
        const fileBuffer = await file.arrayBuffer();
        textContent = new TextDecoder().decode(fileBuffer);
      }

      const chunks = chunkText(textContent);
      const totalChunks = chunks.length;
      const batchSize = 15;

      for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const res = await fetch(`${API_BASE}/api/process-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            chunks: batch,
            startChunkNumber: i,
          }),
        });

        if (!res.ok) throw new Error(`Failed to process ${fileName}`);
        const progress = Math.min(
          100,
          Math.round(((i + batchSize) / totalChunks) * 100)
        );
        setUploadProgress(progress);
        setUploadStatus(`${fileName}: ${progress}%`);
      }

      setUploadStatus(`✅ File "${fileName}" processed successfully!`);
      setUploadedFileName(fileName);
      setUploadedFiles((prev) => Array.from(new Set([fileName, ...prev])));
    }

    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const logo = () => {
    if (msg.role === "ai") {
      <img src={icon} height={20} width={20} />;
    }
  };

  return (
    <Stack sx={{ bgcolor: "white", height: "46rem" }}>
      <Container maxWidth="lg" sx={{ py: 3, bgcolor: "white" }}>
        {/* Header */}
        <Typography
          variant="h4"
          align="center"
          sx={{ mb: 3, fontWeight: "bold", color: "#33A89D" }}
        >
          Classory AI Assistant
        </Typography>

        <Box
          display="flex"
          flexDirection={{ xs: "column", md: "row" }}
          gap={3}
          sx={{ height: "38rem" }}
        >
          {/* Teacher Panel */}
          <Paper
            elevation={3}
            sx={{ p: 3, flex: 1, minWidth: "300px", border: "1px solid #ccc" }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                bgcolor: "#33A89D",
                fontWeight: "bold",
                color: "white",
                textAlign: "center",
                borderRadius: 2,
                height: "32px",
                width: "10rem",
                ml: "4.5rem",
              }}
            >
              Teacher&apos;s Panel
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: "gray" }}>
              Upload .txt or .pdf files for the AI to learn from.
            </Typography>

            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.pdf"
                multiple
                id="upload-file"
                style={{ display: "none" }}
              />
              <label htmlFor="upload-file">
                <Button
                  variant="contained"
                  component="span"
                  sx={{
                    bgcolor: "#EE4B2B",
                    "&:hover": { bgcolor: "#c53d22" },
                  }}
                >
                  Choose Files
                </Button>
              </label>
              <Typography variant="body2" sx={{ color: "gray" }}>
                {selectedFile && selectedFile.length > 0
                  ? selectedFile.map((f) => f.name).join(", ")
                  : "No file chosen"}
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="contained"
              sx={{
                bgcolor: "#FAB18B",
                "&:hover": { bgcolor: "#EE4B2B" },
                mb: 2,
              }}
              disabled={!selectedFile}
              onClick={handleFileUpload}
            >
              Upload Material
            </Button>

            {uploadStatus && (
              <Typography variant="body2" sx={{ mb: 1, color: "gray" }}>
                {uploadStatus}
              </Typography>
            )}
            {uploadProgress > 0 && (
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{
                  height: 8,
                  borderRadius: 2,
                  bgcolor: "#eee",
                  "& .MuiLinearProgress-bar": { bgcolor: "#FAB18B" },
                }}
              />
            )}

            {/* File Selector */}
            <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
              Active file for questions
            </Typography>
            <Select
              fullWidth
              value={uploadedFileName}
              onChange={(e) => setUploadedFileName(e.target.value)}
            >
              <MenuItem value="">
                {uploadedFiles.length ? "Select a file…" : "No files yet"}
              </MenuItem>
              {uploadedFiles.map((name, i) => (
                <MenuItem key={`${name}::${i}`} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </Paper>

          {/* Student Chat */}
          <Paper
            elevation={3}
            sx={{ flex: 2, display: "flex", flexDirection: "column", p: 2 }}
          >
            <Box flex={1} overflow="auto" mb={2}>
              <List>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent:
                        msg.role === "user" ? "flex-end" : "flex-start",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    {/* AI message with logo */}
                    {msg.role === "ai" && (
                      <div style={{ marginRight: "8px" }}>
                        <img
                          src={icon.src} // 👉 place your AI logo inside /public folder
                          alt="AI"
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "10px 14px",
                        borderRadius: "16px",
                        whiteSpace: "pre-wrap",
                        backgroundColor:
                          msg.role === "user" ? "#33A89D" : "#FAB18B",
                        color: msg.role === "user" ? "#fff" : "#000",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <ListItem>
                    <Typography sx={{ color: "gray" }}>Thinking...</Typography>
                  </ListItem>
                )}
              </List>
              <div ref={chatEndRef} />
            </Box>

            {/* Input */}
            <Divider />
            <Box
              component="form"
              onSubmit={handleSubmit}
              display="flex"
              gap={2}
              mt={2}
              sx={{ borderRadius: 10 }}
            >
              <TextField
                fullWidth
                inputRef={inputRef}
                placeholder={
                  uploadedFileName
                    ? "Ask a question about the selected file…"
                    : "Upload or select a file first…"
                }
                disabled={!uploadedFileName}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  bgcolor: "#33A89D",
                  "&:hover": { bgcolor: "#2a867e" },
                  height: 45,
                  mt: 0.5,
                }}
                disabled={isLoading || !uploadedFileName}
              >
                Send
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Stack>
  );
}
