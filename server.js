// Enhanced server.js with performance optimizations, /analyze endpoint, and health endpoint

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Enable JSON parsing for analyze endpoint
app.use(express.json());

// Set up Multer for file storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Health check endpoint to keep server warm
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'IEP Harmony File Processing Server' });
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.', timestamp: new Date().toISOString() });
    }

    const buffer = req.file.buffer;
    const originalname = req.file.originalname;
    const fileSize = buffer.length;
    let extractedText = '';

    console.log(`Processing file: ${originalname} (${fileSize} bytes)`);

    if (originalname.toLowerCase().endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        if (result.messages?.length > 0) console.log('Mammoth warnings:', result.messages);
      } catch (docxError) {
        return res.status(500).json({ error: 'Failed to process DOCX file.', details: docxError.message });
      }
    } else if (originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdf(buffer);
        extractedText = data.text;
      } catch (pdfError) {
        return res.status(500).json({ error: 'Failed to process PDF file.', details: pdfError.message });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file type.', supportedTypes: ['.docx', '.pdf'] });
    }

    if (!extractedText?.trim()) {
      return res.status(422).json({ error: 'No text extracted.', extractedLength: extractedText.length });
    }

    const processingTime = Date.now() - startTime;
    console.log(`Processed ${originalname} in ${processingTime}ms`);

    res.status(200).json({ 
      text: extractedText,
      metadata: {
        originalName: originalname,
        fileSize,
        extractedLength: extractedText.length,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Unexpected error during file processing.', details: error.message });
  }
});

// AI Analyze Endpoint
app.post('/analyze', (req, res) => {
  try {
    const { accommodations, lessonPlan } = req.body;

    // For now, return dummy data
    res.status(200).json({
      message: 'Analysis received.',
      summary: `Accommodations and lesson plan received (${accommodations?.length || 0} / ${lessonPlan?.length || 0} characters).`,
      received: {
        accommodations,
        lessonPlan
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze input.', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max size is 10MB.' });
  }
  res.status(500).json({ error: 'Internal server error', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: ['GET /', 'GET /health', 'POST /upload', 'POST /analyze']
  });
});

// Start server
app.listen(port, () => {
  console.log(`IEP Harmony file processing server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
