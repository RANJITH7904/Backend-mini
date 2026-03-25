const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const evidenceDir = path.join(uploadsDir, 'evidence');
const correctionDir = path.join(uploadsDir, 'corrections');

[uploadsDir, evidenceDir, correctionDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer storage configuration for evidence photos
const evidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, evidenceDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `evidence-${Date.now()}${ext}`);
  },
});

// Multer storage configuration for correction photos
const correctionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, correctionDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `correction-${Date.now()}${ext}`);
  },
});

// File filter — only images allowed
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const uploadEvidence = multer({
  storage: evidenceStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadCorrection = multer({
  storage: correctionStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// @route   POST /api/upload/evidence
// @desc    Upload evidence photo (staff)
// @access  Protected
router.post('/evidence', protect, uploadEvidence.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/uploads/evidence/${req.file.filename}`;

    res.json({ url: publicUrl });
  } catch (error) {
    console.error('Evidence upload error:', error.message);
    res.status(500).json({ message: 'Error uploading evidence photo' });
  }
});

// @route   POST /api/upload/correction
// @desc    Upload correction proof photo (student)
// @access  Protected
router.post('/correction', protect, uploadCorrection.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/uploads/corrections/${req.file.filename}`;

    res.json({ url: publicUrl });
  } catch (error) {
    console.error('Correction upload error:', error.message);
    res.status(500).json({ message: 'Error uploading correction photo' });
  }
});

module.exports = router;
