const path = require('path');
const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ✅ Cloudinary Storage for Evidence
const evidenceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'evidence_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  }),
});

// ✅ Cloudinary Storage for Corrections
const correctionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'correction_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  }),
});

// ✅ File filter — checks mimetype AND extension for mobile compatibility
const imageFilter = (req, file, cb) => {
  console.log('Mimetype received:', file.mimetype, '| Filename:', file.originalname);

  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream', // ✅ mobile camera fallback
  ];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
  }
};

// ✅ Multer Upload instances
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
router.post('/evidence', protect, (req, res) => {
  uploadEvidence.single('photo')(req, res, (err) => {
    if (err) {
      console.error('Evidence upload error:', err.message);
      return res.status(500).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log('Evidence uploaded:', req.file.path);
    res.json({ url: req.file.path });
  });
});

// @route POST /api/upload/correction
router.post('/correction', protect, (req, res) => {
  uploadCorrection.single('photo')(req, res, (err) => {
    if (err) {
      console.error('Correction upload error:', err.message);
      return res.status(500).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log('Correction uploaded:', req.file.path);
    res.json({ url: req.file.path });
  });
});

module.exports = router;