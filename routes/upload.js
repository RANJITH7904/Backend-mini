const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/auth');

const router = express.Router();


// ✅ Cloudinary Storage for Evidence
const evidenceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'evidence_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

// ✅ Cloudinary Storage for Corrections
const correctionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'correction_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});


// File filter
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};


// Multer Upload
const uploadEvidence = multer({
  storage: evidenceStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadCorrection = multer({
  storage: correctionStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});


// ================= ROUTES =================

// @route POST /api/upload/evidence
router.post('/evidence', protect, uploadEvidence.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      url: req.file.path, // ✅ Cloudinary URL
    });

  } catch (error) {
    console.error('Evidence upload error:', error.message);
    res.status(500).json({ message: 'Error uploading evidence photo' });
  }
});


// @route POST /api/upload/correction
router.post('/correction', protect, uploadCorrection.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      url: req.file.path, // ✅ Cloudinary URL
    });

  } catch (error) {
    console.error('Correction upload error:', error.message);
    res.status(500).json({ message: 'Error uploading correction photo' });
  }
});


module.exports = router;