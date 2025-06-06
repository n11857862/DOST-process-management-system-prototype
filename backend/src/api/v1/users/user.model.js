const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const USER_ROLES = ['staff', 'manager', 'admin'];

const userSchema = new Schema({
    name: {
        type: String,
        trim: true,
    },
    username: {
        type: String,
        required: [true, 'Username is required.'],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, 'Username must be at least 3 characters.'],
    },
    email: {
        type: String,
        unique: true,
        trim: true,
        sparse: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address if provided.'],
    },
    password: {
        type: String,
        required: [true, 'Password is required.'],
        minlength: [6, 'Password must be at least 6 characters long.'],
    },
    role: {
        type: String,
        enum: USER_ROLES,
        required: [true, 'User role is required.'],
        default: 'staff',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    
}, {
    timestamps: true,
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

userSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        delete ret.password;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = { 
    User, 
    USER_ROLES 
};