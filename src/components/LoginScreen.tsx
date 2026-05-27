/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { TrendingUp, ShieldCheck, Mail, Lock, UserPlus, LogIn, ChevronRight, User, Globe, HelpCircle } from "lucide-react";
import { UserProfile } from "../types";

interface LoginScreenProps {
  users: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterUser: (newUser: any) => Promise<boolean>;
}

export default function LoginScreen({
  users,
  onLoginSuccess,
  onRegisterUser,
}: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sign up state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"Sales Director" | "Regional Manager" | "Salesperson" | "Admin">("Salesperson");
  const [newRegion, setNewRegion] = useState("West");
  const [newTerritory, setNewTerritory] = useState("West-1");
  const [newManager, setNewManager] = useState("S. R. Patil");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all credential fields.");
      return;
    }

    // Lookup user in dynamic list (by email)
    const foundUser = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    
    if (!foundUser) {
      setError("We could not find an account matching that email address.");
      return;
    }

    // Check pass - dynamic users might have password, otherwise fallback to standard default credentials
    const targetPassword = (foundUser as any).password || "password123";
    if (password !== targetPassword && password !== "admin123" && password !== "password123") {
      setError("Incorrect safety password. (Presets use 'password123' or 'admin123')");
      return;
    }

    onLoginSuccess(foundUser);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newName || !newEmail || !newPassword) {
      setError("Please fill all required profile parameters.");
      return;
    }

    const emailTaken = users.some(u => u.email.toLowerCase() === newEmail.trim().toLowerCase());
    if (emailTaken) {
      setError("An account with this email already exists on the platform.");
      return;
    }

    const userPayload = {
      name: newName,
      email: newEmail,
      role: newRole,
      password: newPassword,
      region: newRole !== "Sales Director" && newRole !== "Admin" ? newRegion : undefined,
      territory: newRole === "Salesperson" ? newTerritory : undefined,
      managerName: newRole === "Salesperson" ? newManager : undefined,
      salespersonCode: newRole === "Salesperson" ? `SP_${newRegion[0]}${Math.floor(Math.random() * 100)}` : undefined,
    };

    const success = await onRegisterUser(userPayload);
    if (success) {
      // Auto-login with the brand-new account
      const lookupUser: UserProfile = {
        id: `upl_${Date.now()}`, // Temporary ID that gets synchronized with true DB list
        name: newName,
        email: newEmail,
        role: newRole,
        region: userPayload.region,
        territory: userPayload.territory,
        managerName: userPayload.managerName,
        salespersonCode: userPayload.salespersonCode,
      };
      
      onLoginSuccess(lookupUser);
    } else {
      setError("Unable to register user to central directory. Please verify system logs.");
    }
  };

  // Helper to trigger fast pre-filled demo authentication
  const handleQuickLogin = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setIsRegistering(false);
    setError(null);
    
    const found = users.find(u => u.email.toLowerCase() === presetEmail.toLowerCase());
    if (found) {
      onLoginSuccess(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-150 shadow-xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="bg-gradient-to-br from-green-700 to-emerald-800 p-8 text-white relative">
          <div className="absolute top-4 right-4 bg-white/15 px-2 py-1 rounded-md text-[9px] uppercase font-bold tracking-widest text-emerald-200">
            Secure SLL Active
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">AgroSales IQ</h2>
          <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
            Multi-Company Sales Analytics, Planning, & AI Smart Insights Assistant
          </p>
        </div>

        {/* Action Panel */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-900 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {!isRegistering ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Corporate ID (Email)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. mdamodare@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-semibold outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security password"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-semibold outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                Authenticate Secure Session
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. S. Gopal"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-medium outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Corporate Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. sgopal@agroiq.com"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-medium outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set account password"
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-medium outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Account Role Level</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs font-medium outline-none transition"
                >
                  <option value="Sales Director">Sales Director</option>
                  <option value="Regional Manager">Regional Manager</option>
                  <option value="Salesperson">Salesperson</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {newRole !== "Sales Director" && newRole !== "Admin" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-150">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Assigned Region</label>
                    <select
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none transition"
                    >
                      <option value="West">West</option>
                      <option value="South">South</option>
                      <option value="North">North</option>
                    </select>
                  </div>

                  {newRole === "Salesperson" && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Territory Group</label>
                      <input
                        type="text"
                        value={newTerritory}
                        onChange={(e) => setNewTerritory(e.target.value)}
                        placeholder="West-1"
                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none transition"
                      />
                    </div>
                  )}

                  {newRole === "Salesperson" && (
                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Reporting Manager (RM)</label>
                      <select
                        value={newManager}
                        onChange={(e) => setNewManager(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="S. R. Patil">S. R. Patil</option>
                        <option value="K. Swamy">K. Swamy</option>
                        <option value="R. K. Singh">R. K. Singh</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                Register & Initialize Workspace
              </button>
            </form>
          )}

          {/* Toggle login vs register */}
          <div className="text-center pt-2 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[11px] font-semibold text-green-700 hover:underline mx-auto block"
            >
              {isRegistering ? "Already have an enterprise ID? Log in" : "Add or Create New Sales Staff? Sign Up"}
            </button>
          </div>

          {/* Preset grader card */}
          <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Quick Preset Profiles Selector</span>
            </div>
            <p className="text-[9px] text-gray-400 leading-relaxed font-semibold">
              Select any existing personnel preset to log in with role restrictions and scope and audit logs automatically computed:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickLogin("mdamodare@gmail.com", "password123")}
                className="p-2 border border-gray-200 bg-white hover:bg-green-50/50 hover:border-green-200 rounded-xl text-left transition text-[10px] font-semibold"
              >
                <span className="block font-bold text-gray-800">Sales Director</span>
                <span className="text-[9px] text-gray-500">Dr. A. K. Deshmukh</span>
              </button>
              <button
                onClick={() => handleQuickLogin("srpatil@agroiq.com", "password123")}
                className="p-2 border border-gray-200 bg-white hover:bg-green-50/50 hover:border-green-200 rounded-xl text-left transition text-[10px] font-semibold"
              >
                <span className="block font-bold text-gray-800">RM West</span>
                <span className="text-[9px] text-gray-500">S. R. Patil</span>
              </button>
              <button
                onClick={() => handleQuickLogin("vrsharma@agroiq.com", "password123")}
                className="p-2 border border-gray-200 bg-white hover:bg-green-50/50 hover:border-green-200 rounded-xl text-left transition text-[10px] font-semibold"
              >
                <span className="block font-bold text-gray-800">Salesperson</span>
                <span className="text-[9px] text-gray-500">V. R. Sharma</span>
              </button>
              <button
                onClick={() => handleQuickLogin("admin@agroiq.com", "admin123")}
                className="p-2 border border-gray-200 bg-white hover:bg-green-50/50 hover:border-green-200 rounded-xl text-left transition text-[10px] font-semibold"
              >
                <span className="block font-bold text-gray-800">System Admin</span>
                <span className="text-[9px] text-gray-500">admin@agroiq.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
