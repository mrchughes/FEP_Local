// Fully implemented real code for frontend/src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

import "./styles/main.css";
import "./styles/govuk-overrides.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <Router>
        <AuthProvider>
            <App />
        </AuthProvider>
    </Router>
);
