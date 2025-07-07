// Fully implemented real code for backend/controllers/authController.js
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const { createUser, findUserByEmail } = require("../services/dynamodbService");

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
        res.status(400);
        throw new Error("Please provide name, email, and password");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error("Please provide a valid email address");
    }

    // Password validation
    if (password.length < 8) {
        res.status(400);
        throw new Error("Password must be at least 8 characters long");
    }

    const userExists = await findUserByEmail(email.toLowerCase());
    if (userExists) {
        res.status(400);
        throw new Error("User already exists");
    }

    const salt = await bcrypt.genSalt(12); // Increased salt rounds for better security
    const hashedPassword = await bcrypt.hash(password, salt);

    await createUser({ name: name.trim(), email: email.toLowerCase(), password: hashedPassword });

    res.status(201).json({
        name: name.trim(),
        email: email.toLowerCase(),
        token: generateToken(email.toLowerCase()),
    });
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
        res.status(400);
        throw new Error("Please provide email and password");
    }

    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
        res.status(401);
        throw new Error("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        res.status(401);
        throw new Error("Invalid email or password");
    }

    res.json({
        name: user.name,
        email: user.email,
        token: generateToken(user.email),
    });
});

module.exports = { registerUser, loginUser };
