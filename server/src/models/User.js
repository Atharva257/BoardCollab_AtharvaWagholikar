const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = model('User', UserSchema);
