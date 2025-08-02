// Enhanced server.js with performance optimizations and health endpoint

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

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

// Enhanced file upload endpoint with better error handling and optimization
app.post('/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded.',
        timestamp: new Date().toISOString()
      });
    }

    const buffer = req.file.buffer;
    const originalname = req.file.originalname;
    const fileSize = buffer.length;
    let extractedText = '';

    console.log(`Processing file: ${originalname} (${fileSize} bytes)`);

    // Process based on file type with better error handling
    if (originalname.toLowerCase().endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        
        // Log any warnings from mammoth
        if (result.messages && result.messages.length > 0) {
          console.log('Mammoth warnings:', result.messages);
        }
      } catch (docxError) {
        console.error('DOCX processing error:', docxError);
        return res.status(500).json({ 
          error: 'Failed to process DOCX file. The file may be corrupted or in an unsupported format.',
          details: docxError.message
        });
      }
    } 
    else if (originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdf(buffer);
        extractedText = data.text;
      } catch (pdfError) {
        console.error('PDF processing error:', pdfError);
        return res.status(500).json({ 
          error: 'Failed to process PDF file. The file may be corrupted, password-protected, or contain only images.',
          details: pdfError.message
        });
      }
    } 
    else {
      return res.status(400).json({ 
        error: 'Unsupported file type. Please upload a .docx or .pdf file.',
        supportedTypes: ['.docx', '.pdf']
      });
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(422).json({ 
        error: 'No text content could be extracted from the file. The file may be empty or contain only images.',
        extractedLength: extractedText.length
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`Successfully processed ${originalname} in ${processingTime}ms`);

    // Return successful response with metadata
    res.status(200).json({ 
      text: extractedText,
      metadata: {
        originalName: originalname,
        fileSize: fileSize,
        extractedLength: extractedText.length,
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Unexpected error:', error);
    
    res.status(500).json({ 
      error: 'An unexpected error occurred while processing the file.',
      details: error.message,
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large. Maximum size is 10MB.',
        maxSize: '10MB'
      });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: ['GET /', 'GET /health', 'POST /upload']
  });
});

// Start server
app.listen(port, () => {
  console.log(`IEP Harmony file processing server running on port ${port}`);
  console.log(`Health check available at: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
