import React from "react";
import Signup from "../components/Signup";
import Login from "../components/Login";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function AuthPage() {
  return (
    <div>
      <img
        src="/Chatter Box.png"
        alt="Chatter Box Logo"
        style={{ width: "250px", marginBottom: "-60px", display: "block", marginLeft: "auto", marginRight: "auto" }}
      />
      <h1> Login or Signup</h1>
      <Signup />
      <Login />
      
      {/* Toast notifications container */}
      <ToastContainer
        position="top-center"
        autoClose={3000} // 3 seconds
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}
