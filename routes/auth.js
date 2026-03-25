const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role, student_id, department } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    if (role === 'student' && (!student_id || !department)) {
      return res.status(400).json({
        message: 'Student ID and Department are required for student accounts',
      });
    }

    const user = await User.create({
      email,
      password,
      full_name,
      role,
      student_id: role === 'student' ? student_id : null,
      department: role === 'student' ? department : null,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Protected
router.get('/profile', protect, async (req, res) => {
  try {
    res.json({ user: req.user.toSafeObject() });
  } catch (error) {
    console.error('Profile error:', error.message);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

module.exports = router;
