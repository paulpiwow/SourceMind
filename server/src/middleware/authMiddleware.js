//This code checks the Authorization header, verifies the JWT, and 
// attaches the logged-in user info to req.user.

const jwt = require("jsonwebtoken"); // imports JWT so we can verify login tokens

// Middleware that protects routes by requiring a valid JWT token
function protect(req, res, next) {
  const authHeader = req.headers.authorization; // reads Authorization header from request

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  const token = authHeader.split(" ")[1]; // extracts token after "Bearer"

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // verifies token using secret from .env

    req.user = decoded; // stores decoded user info on request object

    next(); // allows request to continue to protected route
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
}

module.exports = protect; // exports middleware so routes can use it