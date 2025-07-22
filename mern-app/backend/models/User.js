const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: false }, // Not required for OneLogin users
  formData: { type: mongoose.Schema.Types.Mixed, default: null },
  webId: { type: String, sparse: true }, // WebID for SOLID PDS integration
  isOneLoginUser: { type: Boolean, default: false }, // Flag for OneLogin users
  oneLoginSubject: { type: String, sparse: true }, // OneLogin subject identifier
  oneLoginMetadata: {
    lastLogin: { type: Date },
    tokenExpiry: { type: Date }
  },
  pdsTokens: { // Tokens for PDS operations
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
