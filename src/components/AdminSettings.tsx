/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Shield, Terminal, Library, AlertCircle, RefreshCw, Layers, CheckCircle, Users, UserPlus, Trash2, Edit3, Key, Mail, MapPin } from "lucide-react";
import { AuditLog, UserProfile } from "../types";

interface AdminSettingsProps {
  auditLogs: AuditLog[];
  onResetDatabase: () => void;
  currentUser: UserProfile;
  users: UserProfile[];
  onSaveUser: (user: any) => Promise<boolean>;
  onDeleteUser: (userId: string) => Promise<boolean>;
}

export default function AdminSettings({
  auditLogs,
  onResetDatabase,
  currentUser,
  users,
  onSaveUser,
  onDeleteUser,
}: AdminSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<"standard" | "users">("standard");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for creating / editing user
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"Sales Director" | "Regional Manager" | "Salesperson" | "Admin">("Salesperson");
  const [formRegion, setFormRegion] = useState("West");
  const [formTerritory, setFormTerritory] = useState("West-1");
  const [formManager, setFormManager] = useState("S. R. Patil");

  const triggerReset = () => {
    onResetDatabase();
    setSuccessMsg("System successfully restored to production master seed data (Company A & B + Budgets).");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleEditUserClick = (u: any) => {
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(u.password || "password123");
    setFormRole(u.role);
    setFormRegion(u.region || "West");
    setFormTerritory(u.territory || "West-1");
    setFormManager(u.managerName || "S. R. Patil");
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("Salesperson");
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      alert("Please fill in Name and Email");
      return;
    }

    const payload = {
      id: editingUserId || undefined,
      name: formName,
      email: formEmail,
      password: formPassword || "password123",
      role: formRole,
      region: formRole !== "Sales Director" && formRole !== "Admin" ? formRegion : undefined,
      territory: formRole === "Salesperson" ? formTerritory : undefined,
      managerName: formRole === "Salesperson" ? formManager : undefined,
      salespersonCode: formRole === "Salesperson" ? `SP_${formRegion[0]}${Math.floor(Math.random() * 100)}` : undefined,
    };

    const success = await onSaveUser(payload);
    if (success) {
      setSuccessMsg(editingUserId ? `Updated profile for "${formName}" successfully.` : `Successfully created login credentials for "${formName}".`);
      handleCancelEdit();
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      alert("Error saving profile parameters.");
    }
  };

  const handleDeleteUserClick = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to completely suspend and revoke database access for "${userName}"?`)) {
      const success = await onDeleteUser(userId);
      if (success) {
        setSuccessMsg(`Suspended database credentials for "${userName}".`);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    }
  };

  const standardSpellings = [
    { original: "pune fert", standardized: "Mahalaxmi Fertilizers Pune" },
    { original: "balaji satara", standardized: "Balaji Agro Services Satara" },
    { original: "krishna agency nasik", standardized: "Krishna Agro Agency Nashik" },
    { original: "malhar seeds", standardized: "Jai Malhar Seeds Kolhapur" },
    { original: "saraswathi solapur", standardized: "Saraswati Agro Solapur" },
    { original: "SugaMax Bio Boost", standardized: "SugaMax Bio Enhancer" },
    { original: "rhizo active", standardized: "RhizoActive Soil Pro" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Intro */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-450" />
            Admin & Standardisation Settings
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure system operational parameters, standardizations, regional hierarchies, and authorized user credentials.
          </p>
        </div>
        
        {/* Subtabs Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab("standard")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "standard" ? "bg-white text-green-700 shadow-xs" : "text-gray-550 hover:text-gray-900"
            }`}
          >
            Dictionary & Logs
          </button>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "users" ? "bg-white text-green-700 shadow-xs" : "text-gray-550 hover:text-gray-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            User directory ({users.length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-150 text-green-900 p-4 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeSubTab === "standard" ? (
        /* Standard Tab */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Spelling standardisation dictionary mapping tables */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-1 space-y-4">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Library className="w-4 h-4 text-gray-400" />
              Brand spelling mapping indices
            </h3>

            <div className="space-y-3">
              <div className="text-[10px] text-gray-500">
                Matches irregular spreadsheet names (e.g., from small local franchise agents) and resolves duplicates during upload:
              </div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {standardSpellings.map((sp, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] flex justify-between items-center">
                    <div>
                      <span className="text-gray-450 uppercase font-semibold">Incoming:</span>
                      <div className="font-bold text-red-500 mt-0.5">"{sp.original}"</div>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-450 uppercase font-semibold">Map to:</span>
                      <div className="font-bold text-green-600 mt-0.5">"{sp.standardized.split(" ")[0]}..."</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit logging trail */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              System Transactional Audit Trail
            </h3>

            <div className="overflow-x-auto">
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-semibold">
                      <th className="py-2">Time</th>
                      <th className="py-2">Initiator</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Details Summary</th>
                      <th className="py-2 text-right">Maturity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-700">
                    {auditLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/30">
                        <td className="py-2.5 font-medium text-gray-400 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 font-bold">{log.user}</td>
                        <td className="py-2.5 text-gray-900 font-semibold">{log.action}</td>
                        <td className="py-2.5 max-w-[200px] truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2.5 text-right font-semibold">
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] ${
                            log.status === "Success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Users Dynamic Management Directory Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User accounts list directory table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Registered Employee Directory</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage regional boundaries, supervisor chains, and credentials.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-450 uppercase text-[9px] font-bold">
                    <td className="py-2">Name & Email</td>
                    <td className="py-2">Security Role</td>
                    <td className="py-2">Territory Scope</td>
                    <td className="py-2">Manager (RM)</td>
                    <td className="py-2 text-right">Operations</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {users.map((u) => {
                    const isCurrentUser = currentUser.id === u.id;
                    const uPass = (u as any).password || "password123";
                    
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/20">
                        <td className="py-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            {u.name}
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-bold rounded-md">YOU</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {u.email}
                          </div>
                        </td>
                        <td className="py-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                            u.role === "Sales Director" ? "bg-purple-50 text-purple-700" :
                            u.role === "Regional Manager" ? "bg-blue-50 text-blue-700" :
                            u.role === "Admin" ? "bg-orange-50 text-orange-700" :
                            "bg-green-50 text-green-700"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 font-medium">
                          {u.region ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span>{u.region} {u.territory ? `(${u.territory})` : ""}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unlimited Global</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-500 font-medium">
                          {u.managerName || (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-1 shrink-0">
                          <button
                            onClick={() => handleEditUserClick(u)}
                            className="p-1 px-2 hover:bg-gray-100 rounded-md text-[10px] text-blue-600 font-bold hover:text-blue-700 inline-flex items-center gap-1"
                            title="Edit Credentials"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDeleteUserClick(u.id, u.name)}
                              className="p-1 px-2 hover:bg-red-50 rounded-md text-[10px] text-red-600 font-bold hover:text-red-700 inline-flex items-center gap-1"
                              title="Delete security credentials"
                            >
                              <Trash2 className="w-3 h-3" />
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl flex items-start gap-2.5 text-[10px] text-gray-500">
              <Key className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-gray-700">Account Security Notes</span>
                <p className="mt-0.5">
                  Users use their respective corporate emails to log in. Default passwords is set to <span className="font-mono bg-white px-1 py-0.5 border rounded">password123</span> (or <span className="font-mono bg-white px-1 py-0.5 border rounded">admin123</span> for Admins). You can customize user passwords directly using the form editor on the right.
                </p>
              </div>
            </div>
          </div>

          {/* User creation / editing panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
                {editingUserId ? "Edit Account Profile" : "Register Sales Team Member"}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">Provide corporate parameters to write secure database parameters dynamically.</p>
            </div>

            <form onSubmit={handleUserFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">User Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. S. Gopal"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sgopal@agroiq.com"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Set Security Password</label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Clearance Role Level</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                >
                  <option value="Sales Director">Sales Director</option>
                  <option value="Regional Manager">Regional Manager</option>
                  <option value="Salesperson">Salesperson</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {formRole !== "Sales Director" && formRole !== "Admin" && (
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase block">Operating Region</label>
                    <select
                      value={formRegion}
                      onChange={(e) => setFormRegion(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="West">West</option>
                      <option value="South">South</option>
                      <option value="North">North</option>
                    </select>
                  </div>

                  {formRole === "Salesperson" && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase block">Territory Group Scope</label>
                      <input
                        type="text"
                        value={formTerritory}
                        onChange={(e) => setFormTerritory(e.target.value)}
                        placeholder="West-1"
                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                      />
                    </div>
                  )}

                  {formRole === "Salesperson" && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase block">Assigned Manager (RM)</label>
                      <select
                        value={formManager}
                        onChange={(e) => setFormManager(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                      >
                        <option value="S. R. Patil">S. R. Patil</option>
                        <option value="K. Swamy">K. Swamy</option>
                        <option value="R. K. Singh">R. K. Singh</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {editingUserId ? "Update Credentials" : "Save Credentials"}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

        </div>
      )}

      {/* Extreme administrative resets block */}
      <div className="p-6 bg-red-50/50 rounded-2xl border border-red-105 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5 uppercase tracking-wider">
            Danger Operations Zone
          </h4>
          <p className="text-[10px] text-red-700 mt-1 max-w-xl leading-relaxed">
            Restoring standard seed database removes any custom spreadsheet invoice records uploaded during live execution session, returning parameters to pre-existing standard regional balances.
          </p>
        </div>
        <button
          onClick={triggerReset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Factory Format Reset
        </button>
      </div>

    </div>
  );
}
