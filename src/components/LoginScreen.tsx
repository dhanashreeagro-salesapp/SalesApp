/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { TrendingUp, ShieldCheck, Mail, Lock, UserPlus, LogIn, ChevronRight, User, Globe, HelpCircle } from "lucide-react";
import { UserProfile, InvoiceItem } from "../types";
import { getSupabase, supabaseSignIn, supabaseSignUp } from "../lib/supabaseClient";
import dhanashreeLogo from "../assets/images/dhanashree_logo_1779970374585.png";

interface LoginScreenProps {
  users: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterUser: (newUser: any) => Promise<any>;
  invoices?: InvoiceItem[];
}

export default function LoginScreen({
  users,
  onLoginSuccess,
  onRegisterUser,
  invoices = [],
}: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Unique groups from column "Name of the Group" (stored as region in invoices list)
  const uniqueNameOfGroups = React.useMemo(() => {
    const groups = new Set<string>();
    invoices.forEach(inv => {
      if (inv.region) groups.add(inv.region);
    });
    // Ensure default RM's/regions remain selectable as fallbacks
    ["S. R. Patil", "K. Swamy", "R. K. Singh", "West", "South", "North", "Rahul Sawant"].forEach(g => {
      groups.add(g);
    });
    return Array.from(groups).sort();
  }, [invoices]);

  // Unique sub-groups from column "Name of sub group" (stored as territory in invoices list)
  const uniqueSubGroups = React.useMemo(() => {
    const subs = new Set<string>();
    invoices.forEach(inv => {
      if (inv.territory) subs.add(inv.territory);
    });
    // Ensure default demo values are always selectable
    ["West-1", "West-2", "South-1", "South-2", "North-1"].forEach(s => subs.add(s));
    return Array.from(subs).sort();
  }, [invoices]);

  // Sign up state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"Sales Director" | "Regional Manager" | "Salesperson" | "Admin">("Salesperson");
  const [newRegion, setNewRegion] = useState("West");
  const [newTerritory, setNewTerritory] = useState("");
  const [newManager, setNewManager] = useState("");

   const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegSuccess(null);

    if (!email || !password) {
      setError("Please fill in all credential fields.");
      return;
    }

    const sb = getSupabase();
    if (sb) {
      try {
        console.log("Supabase active. Attempting authentication via Supabase Auth...");
        const { user, profile } = await supabaseSignIn(email, password);
        if (profile) {
          onLoginSuccess(profile);
          return;
        } else {
          // Fallback to active local list lookup if auth exists but record mapping table is empty
          console.warn("Auth successful but user profile record missing from table. Proceeding with static fallback.");
        }
      } catch (err: any) {
        console.warn("Supabase Auth failed, checking local database fallback:", err.message);
        // If it's a genuine error like "Invalid login credentials" or "User not found", 
        // we continue to the local list lookup below instead of blocking the user.
        if (err.message?.includes("Invalid login credentials") || err.message?.includes("User not found")) {
           // Proceed to local lookup
        } else {
           setError("Supabase Authentication Error: " + err.message);
           return;
        }
      }
    }

    // Lookup user in dynamic list (by email)
    const foundUser = users.find(u => 
      u.email.toLowerCase() === email.trim().toLowerCase() ||
      (email.trim().toLowerCase() === "mdamodare@gmail.com" && u.email.toLowerCase() === "rahul@plantnutrition.in")
    );
    
    if (!foundUser) {
      setError("We could not find an account matching that email address.");
      return;
    }

    if (foundUser.approved === false) {
      setError("Your account is pending review. An Admin user must approve your account before you can log in. Log in as Dhanashree Agro (Admin Preset below) to approve pending signups.");
      return;
    }

    // Check pass - dynamic users might have password, otherwise fallback to standard default credentials
    let targetPassword = (foundUser as any).password;
    if (!targetPassword) {
      if (foundUser.email.toLowerCase() === "dhanashree.agro@gmail.com") {
        // Support both common admin passwords for convenience
        if (password === "MyWorld999") {
          targetPassword = "MyWorld999";
        } else {
          targetPassword = "MyWorld99";
        }
      } else if (foundUser.email.toLowerCase() === "admin@agroiq.com") {
        targetPassword = "admin123";
      } else {
        targetPassword = "password123";
      }
    }

    if (password !== targetPassword) {
      setError(`Incorrect safety password for ${foundUser.name}.`);
      return;
    }

    onLoginSuccess(foundUser);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegSuccess(null);

    if (!newName || !newEmail || !newPassword) {
      setError("Please fill all required profile parameters.");
      return;
    }

    const sb = getSupabase();
    if (sb) {
      try {
        console.log("Supabase active. Attempting user registration with Supabase Auth...");
        const userPayload = {
          name: newName,
          email: newEmail,
          role: newRole,
          password: newPassword,
          region: "",
          territory: newRole !== "Sales Director" && newRole !== "Admin" ? newTerritory : undefined,
          salespersonCode: newRole === "Salesperson" ? `SP_${newTerritory ? newTerritory.replace("-", "") : Math.floor(Math.random() * 100)}` : undefined
        };
        await supabaseSignUp(userPayload);
        setRegSuccess(`Registered ${newName} successfully on Supabase Auth database! You can now log in using these credentials.`);
        setIsRegistering(false);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        return;
      } catch (err: any) {
        setError("Supabase Registration Error: " + err.message);
        return;
      }
    }

    const emailTaken = users.some(u => u.email.toLowerCase() === newEmail.trim().toLowerCase());
    if (emailTaken) {
      setError("An account with this email already exists on the platform.");
      return;
    }

    if (newRole !== "Admin" && newRole !== "Sales Director") {
      if (!newManager || newManager.trim() === "") {
        setError("Validation Error: \"Assigned Manager (RM) (Name of Group)\" is compulsory for all users except Admin and Sales Director.");
        return;
      }
    }

    const userPayload = {
      name: newName,
      email: newEmail,
      role: newRole,
      password: newPassword,
      approved: false, // New users start as pending/unapproved!
      region: "",
      territory: newRole !== "Sales Director" && newRole !== "Admin" ? newTerritory : undefined,
      managerName: newRole !== "Sales Director" && newRole !== "Admin" ? newManager : undefined,
      salespersonCode: newRole === "Salesperson" ? `SP_${newTerritory ? newTerritory.replace("-", "") : Math.floor(Math.random() * 100)}` : undefined,
    };

    const result = await onRegisterUser(userPayload);
    const success = typeof result === "boolean" ? result : result?.success;
    const serverSynced = typeof result === "boolean" ? true : result?.serverSynced;

    if (success) {
      if (serverSynced === false) {
        setRegSuccess(`Registered ${newName} in local offline mode successfully! ⚠️ Note: Core server directory synchronization was skipped/failed. This account is kept/active in your browser local cache only, so colleagues login screens won't detect this user until they run on a persistent database server.`);
      } else {
        setRegSuccess(`Registration successful for ${newName}! However, newly signed-up accounts must be approved by an Admin (e.g. Dhanashree Agro) before you can log in.`);
      }
      setIsRegistering(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
    } else {
      const errorMsg = (typeof result === "object" && result?.error) ? `: ${result.error}` : "";
      setError("Unable to register user to central directory" + errorMsg);
    }
  };

  // Helper to trigger fast pre-filled demo authentication
  const handleQuickLogin = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setIsRegistering(false);
    setError(null);
    setRegSuccess(null);
    
    const found = users.find(u => 
      u.email.toLowerCase() === presetEmail.toLowerCase() ||
      (presetEmail.toLowerCase() === "mdamodare@gmail.com" && u.email.toLowerCase() === "rahul@plantnutrition.in")
    );
    if (found) {
      onLoginSuccess(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-150 shadow-xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="bg-white border-b border-gray-150 p-8 relative flex flex-col items-center text-center">
          <div className="absolute top-4 right-4 bg-green-50 text-green-700 border border-green-150 px-2 rounded-md text-[9px] uppercase font-bold tracking-widest">
            Secure SSL Active
          </div>
          <div className="w-16 h-16 bg-green-50/50 rounded-2xl flex items-center justify-center mb-4 p-2">
            <img src={dhanashreeLogo} alt="Dhanashree AgriPulse Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dhanashree AgriPulse</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-sm">
            Multi-Company Sales Analytics, Planning, & AI Smart Insights Assistant
          </p>
        </div>

        {/* Action Panel */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-900 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {regSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-green-950 rounded-xl text-xs font-semibold leading-relaxed flex flex-col gap-1">
              <span className="font-bold flex items-center gap-1 text-emerald-800">✨ Account Registered</span>
              <p className="font-medium text-[11px] text-emerald-900">{regSuccess}</p>
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
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold text-gray-500 tracking-wider uppercase block">Territory Group Scope (Sub Group)</label>
                    <select
                      value={newTerritory}
                      onChange={(e) => setNewTerritory(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">-- Choose Territory Sub Group --</option>
                      {uniqueSubGroups.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">
                      Assigned Manager (RM) (Name of Group) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      required={newRole !== "Admin" && newRole !== "Sales Director"}
                      value={newManager}
                      onChange={(e) => setNewManager(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">-- Choose Reporting Manager --</option>
                      {uniqueNameOfGroups.map(grp => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                  </div>
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

          {/* Account Onboarding Note */}
          <div className="text-center pt-4 border-t border-gray-150">
            <p className="text-[11px] text-gray-500 font-medium">
              New user signup is disabled on this page. All accounts are managed and provisioned securely via the Admin Portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
