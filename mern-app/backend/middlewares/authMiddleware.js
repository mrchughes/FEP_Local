// Fully implemented real code for backend/middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { findUserByEmail } = require("../services/dynamodbService");

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            
            if (!token) {
                res.status(401);
                throw new Error("Not authorized, no token");
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await findUserByEmail(decoded.email);
            if (!user) {
                res.status(401);
                throw new Error("User not found");
            }

            req.user = user;
            next();
        } catch (error) {
            console.error("JWT verification error:", error.message);
            res.status(401);
            throw new Error("Not authorized, token failed");
        }
    } else {
        res.status(401);
        throw new Error("Not authorized, no token");
    }
});

module.exports = { protect };
