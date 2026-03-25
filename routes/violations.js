const express = require('express');
const Violation = require('../models/Violation');
const { protect } = require('../middleware/auth');

const router = express.Router();

// --- REPEATED VIOLATION TRACKING: Helper function ---
// Business Rules (based on TOTAL complaints per student, ANY category):
//   1st complaint  → Excused        (no escalation, just recorded)
//   2nd complaint  → Warning        (student is warned)
//   3rd+ complaint → Meet the Parent (parent/guardian must be called)
//
// The count is per student_id — category does NOT matter here.
function getEscalationInfo(totalCount) {
  if (totalCount === 1) {
    // First complaint ever for this student — excused, no action
    return {
      warning_level: 0,
      recommended_action: 'Excused – First Complaint',
      is_repeat_offender: false,
      escalation_status: 'none',
    };
  } else if (totalCount === 2) {
    // Second complaint — issue a formal warning
    return {
      warning_level: 1,
      recommended_action: 'Warning Issued – 2nd Complaint',
      is_repeat_offender: true,
      escalation_status: 'pending',
    };
  } else {
    // 3rd complaint or more — parent/guardian must be contacted
    return {
      warning_level: 2,
      recommended_action: 'Meet the Parent – Call Parent/Guardian Immediately',
      is_repeat_offender: true,
      escalation_status: 'pending',
    };
  }
}
// --- END REPEATED VIOLATION TRACKING HELPER ---

// @route   GET /api/violations
// @desc    Get violations based on user role
// @access  Protected
router.get('/', protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'staff') {
      // Staff sees only violations they reported
      query = { reported_by: req.user._id };
    } else if (req.user.role === 'student') {
      // Students see their own violations by student_id (case-insensitive to prevent mismatches)
      query = { student_id: { $regex: new RegExp('^' + req.user.student_id + '$', 'i') } };
    }
    // Admin sees all violations (empty query)

    const violations = await Violation.find(query).sort({ created_at: -1 });
    res.json(violations);
  } catch (error) {
    console.error('Fetch violations error:', error.message);
    res.status(500).json({ message: 'Error fetching violations' });
  }
});

// --- REPEATED VIOLATION TRACKING: Admin endpoint — list all repeat offenders ---
// @route   GET /api/violations/repeat-offenders
// @desc    Returns all students who have 2 or more total complaints (any category).
//          Groups violations by student_id with total count and warning level.
// @access  Protected (Admin only)
router.get('/repeat-offenders', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view repeat offenders' });
    }

    // Find all violations flagged as repeat offender (is_repeat_offender = true)
    const repeatViolations = await Violation.find({ is_repeat_offender: true }).sort({ created_at: -1 });

    // Group by student_id to build a per-student summary
    const studentMap = {};
    repeatViolations.forEach((v) => {
      // Normalize to uppercase for grouping so cs338 and CS338 form one group
      const normalizedId = v.student_id.toUpperCase();
      if (!studentMap[normalizedId]) {
        studentMap[normalizedId] = {
          student_id: normalizedId,
          student_name: v.student_name,
          department: v.department,
          violations: [],
          max_warning_level: 0,
        };
      }
      studentMap[normalizedId].violations.push(v);
      if (v.warning_level > studentMap[normalizedId].max_warning_level) {
        studentMap[normalizedId].max_warning_level = v.warning_level;
      }
    });

    res.json(Object.values(studentMap));
  } catch (error) {
    console.error('Fetch repeat offenders error:', error.message);
    res.status(500).json({ message: 'Error fetching repeat offenders' });
  }
});
// --- END REPEATED VIOLATION TRACKING ENDPOINT ---

// @route   POST /api/violations
// @desc    Create a new violation (staff only)
// @access  Protected
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to create violations' });
    }

    let {
      student_id,
      student_name,
      department,
      category,
      description,
      due_date,
      priority,
      evidence_url,
    } = req.body;

    if (!student_id || !student_name || !department || !category || !description || !due_date) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Ensure student_id is always stored in uppercase to prevent duplicate separate records
    // e.g., cs338 and CS338 become CS338
    student_id = student_id.toUpperCase();

    // --- REPEATED VIOLATION TRACKING: Count ALL previous complaints for this student ---
    // We match by student_id case-insensitively to catch any existing lowercase records
    const priorCount = await Violation.countDocuments({ student_id: { $regex: new RegExp('^' + student_id + '$', 'i') } });

    // The total count for this student will be priorCount + 1 (including the current one)
    const totalCount = priorCount + 1;

    // Determine escalation details based on total complaint count
    const escalationInfo = getEscalationInfo(totalCount);

    console.log(
      `[Repeat Tracking] Student: ${student_id} (${student_name}) | Total complaints: ${totalCount} | Action: ${escalationInfo.recommended_action}`
    );
    // --- END REPEATED VIOLATION TRACKING CHECK ---

    const violation = await Violation.create({
      student_id,
      student_name,
      department,
      category,
      description,
      due_date: new Date(due_date),
      priority: priority || 'medium',
      evidence_url: evidence_url || null,
      reported_by: req.user._id,
      // Store computed repeat tracking fields on the violation document
      repeat_count: totalCount,
      warning_level: escalationInfo.warning_level,
      is_repeat_offender: escalationInfo.is_repeat_offender,
      recommended_action: escalationInfo.recommended_action,
      escalation_status: escalationInfo.escalation_status,
    });

    res.status(201).json(violation);
  } catch (error) {
    console.error('Create violation error:', error.message);
    res.status(500).json({ message: 'Error creating violation' });
  }
});

// @route   PATCH /api/violations/:id
// @desc    Update a violation (status changes, corrections, verifications)
// @access  Protected
router.patch('/:id', protect, async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    const updates = {};

    // Student acknowledging
    if (req.body.status === 'acknowledged') {
      updates.status = 'acknowledged';
      updates.acknowledged_at = new Date();
    }

    // Student submitting correction proof
    if (req.body.status === 'corrected') {
      updates.status = 'corrected';
      updates.correction_url = req.body.correction_url;
      updates.corrected_at = new Date();
    }

    // Admin verifying
    if (req.body.status === 'verified') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can verify violations' });
      }
      updates.status = 'verified';
      updates.verified_at = new Date();
      updates.verified_by = req.user._id;
    }

    // Admin rejecting correction
    if (req.body.status === 'correcting') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can reject corrections' });
      }
      updates.status = 'correcting';
      updates.rejection_reason = req.body.rejection_reason;
      updates.correction_url = null;
    }

    // --- REPEATED VIOLATION TRACKING: Admin marks escalation as actioned ---
    if (req.body.escalation_status === 'actioned') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can update escalation status' });
      }
      updates.escalation_status = 'actioned';
    }
    // --- END ESCALATION STATUS UPDATE ---

    const updatedViolation = await Violation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updatedViolation);
  } catch (error) {
    console.error('Update violation error:', error.message);
    res.status(500).json({ message: 'Error updating violation' });
  }
});

module.exports = router;
