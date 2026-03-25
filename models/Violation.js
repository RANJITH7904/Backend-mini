const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema(
  {
    student_id: {
      type: String,
      required: true,
      trim: true,
    },
    student_name: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    due_date: {
      type: Date,
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'correcting', 'corrected', 'verified'],
      default: 'pending',
    },
    evidence_url: {
      type: String,
      default: null,
    },
    correction_url: {
      type: String,
      default: null,
    },
    reported_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    acknowledged_at: {
      type: Date,
      default: null,
    },
    corrected_at: {
      type: Date,
      default: null,
    },
    verified_at: {
      type: Date,
      default: null,
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejection_reason: {
      type: String,
      default: null,
    },

    // --- REPEATED VIOLATION TRACKING FIELDS ---
    // repeat_count: how many violations (including this one) the student has in the same category
    repeat_count: {
      type: Number,
      default: 1,
    },
    // warning_level: the escalation tier based on repeat_count
    // 1 = Warning, 2 = Parent/Mentor Notification, 3 = Disciplinary Review, 4+ = Severe Repeat Offender
    warning_level: {
      type: Number,
      default: 1,
    },
    // is_repeat_offender: true if the student has more than 1 violation in this category
    is_repeat_offender: {
      type: Boolean,
      default: false,
    },
    // recommended_action: human-readable action suggested based on warning_level
    recommended_action: {
      type: String,
      default: 'Warning',
    },
    // escalation_status: tracks whether admin has acted on the escalation
    // 'none' = no escalation needed, 'pending' = needs admin attention, 'actioned' = admin has handled it
    escalation_status: {
      type: String,
      enum: ['none', 'pending', 'actioned'],
      default: 'none',
    },
    // --- END REPEATED VIOLATION TRACKING FIELDS ---
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Transform _id → id for frontend compatibility
violationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.reported_by && typeof ret.reported_by === 'object') {
      ret.reported_by = ret.reported_by.toString();
    }
    if (ret.verified_by && typeof ret.verified_by === 'object') {
      ret.verified_by = ret.verified_by.toString();
    }
    return ret;
  },
});

module.exports = mongoose.model('Violation', violationSchema);
