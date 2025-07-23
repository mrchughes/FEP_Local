// PrivateRoute component in components directory
import React from "react";
import { Navigate } from "react-router-dom";
import { useContext } from "react";
import AuthContext from "../auth/AuthContext";

const PrivateRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);

    console.log("🛡️ PrivateRoute check:", { user: !!user, loading }); // Debug log

    if (loading) {
        return <div>Loading...</div>;
    }

    return user ? children : <Navigate to="/" />;
};

export default PrivateRoute;
