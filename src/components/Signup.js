import React, { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";

export default function Signup({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      await setDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        email,
        createdAt: serverTimestamp(),
        friends: []
      });

      toast.success("Account created successfully!");

      setUsername("");
      setEmail("");
      setPassword("");
      setError("");

      // Delay navigation so user can see toast
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (err) {
      setError(err.message);
      toast.error("Failed to create account");
    }
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <p>Please choose a username unique to you this way friends can add you. You cannot change it later.</p>
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign Up</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
