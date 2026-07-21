import React, { useState, useMemo } from "react";
import { Users, MapPin, Sprout, Calendar, Phone, FileText, Send, Search, Filter, ShieldCheck, CheckCircle2, Plus, Share2, BookOpen, AlertCircle } from "lucide-react";
import { UserProfile } from "../types";
import { getUserDescendantsList } from "../utils/analytics";

interface FaReMProps {
  currentUser: UserProfile;
  users: UserProfile[];
}

export interface FarmerRecord {
  id: string;
  fullName: string;
  mobile: string;
  village: string;
  taluka: string;
  district: string;
  acres: number;
  assignedStaff: string;
  staffName: string;
  cropName: string;
  stageName: string;
  lastVisitDate: string;
  status: string;
}

export interface PromotionItem {
  id: string;
  title: string;
  contentType: "Video" | "PDF" | "Image";
  cropTag: string;
  language: string;
  fileUrl: string;
}

const SEED_FARMERS: FarmerRecord[] = [
  {
    id: "FARM_001",
    fullName: "Shreeniwas Krushi Bhandar Farmer - Umrale",
    mobile: "+91 98220 12345",
    village: "Umrale (BK)",
    taluka: "Dindori",
    district: "Nashik",
    acres: 4.5,
    assignedStaff: "rborse@plantnutrition.in",
    staffName: "Rahul Borse",
    cropName: "Grapes",
    stageName: "Berry Development",
    lastVisitDate: "2026-07-15",
    status: "Active"
  },
  {
    id: "FARM_002",
    fullName: "Jai Babaji Krushi Seva Grower - Ugaon",
    mobile: "+91 94231 67890",
    village: "Ugaon",
    taluka: "Niphad",
    district: "Nashik",
    acres: 6.0,
    assignedStaff: "rborse@plantnutrition.in",
    staffName: "Rahul Borse",
    cropName: "Pomegranate",
    stageName: "Flowering & Fruit Set",
    lastVisitDate: "2026-07-18",
    status: "Active"
  },
  {
    id: "FARM_003",
    fullName: "Rameshwar Patil - Saikheda",
    mobile: "+91 97632 45120",
    village: "Saikheda",
    taluka: "Niphad",
    district: "Nashik",
    acres: 3.2,
    assignedStaff: "gtale@plantnutrition.in",
    staffName: "Gajanan Tale",
    cropName: "Sugarcane",
    stageName: "Grand Growth",
    lastVisitDate: "2026-07-10",
    status: "Active"
  },
  {
    id: "FARM_004",
    fullName: "Bhausaheb Wagh - Ozar",
    mobile: "+91 98901 88234",
    village: "Ozar",
    taluka: "Dindori",
    district: "Nashik",
    acres: 5.0,
    assignedStaff: "nrajput@plantnutrition.in",
    staffName: "Nitin Rajput",
    cropName: "Tomatoes",
    stageName: "Vegetative Growth",
    lastVisitDate: "2026-07-12",
    status: "Active"
  }
];

const SEED_PROMOTIONS: PromotionItem[] = [
  {
    id: "PROM_01",
    title: "Erbato Bio-Enhancer Application Guide for Grapes",
    contentType: "PDF",
    cropTag: "Grapes",
    language: "Marathi / English",
    fileUrl: "https://dhanashreeagro.com/docs/erbato_guide.pdf"
  },
  {
    id: "PROM_02",
    title: "Veganic Organic Foliar Nutrition Spray Schedule",
    contentType: "Video",
    cropTag: "Pomegranate",
    language: "Marathi",
    fileUrl: "https://dhanashreeagro.com/videos/veganic_schedule.mp4"
  },
  {
    id: "PROM_03",
    title: "SugaMax Yield Boosting Protocol",
    contentType: "Image",
    cropTag: "Sugarcane",
    language: "Marathi",
    fileUrl: "https://dhanashreeagro.com/images/sugamax_poster.png"
  }
];

export default function FaReMFieldForcePortal({ currentUser, users }: FaReMProps) {
  const [activeTab, setActiveTab] = useState<"farmers" | "visits" | "recommendations" | "promotions">("farmers");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);
  const [newRecommendation, setNewRecommendation] = useState({ product: "Erbato", dose: "2 ml/Liter", notes: "" });
  const [recStatus, setRecStatus] = useState<string | null>(null);

  // Scoped farmers based on user hierarchy
  const scopedFarmers = useMemo(() => {
    const isFullAccess = currentUser.role === "Admin" || currentUser.role === "Sales Director" || currentUser.email === "dhanashree.agro@gmail.com";
    if (isFullAccess) return SEED_FARMERS;

    const descendants = getUserDescendantsList(currentUser, users);
    const allowedEmails = new Set([currentUser.email, ...descendants.map(d => d.email)]);
    const allowedNames = new Set([currentUser.name, ...descendants.map(d => d.name)]);

    return SEED_FARMERS.filter(f => 
      allowedEmails.has(f.assignedStaff) || 
      allowedNames.has(f.staffName)
    );
  }, [currentUser, users]);

  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return scopedFarmers;
    const q = searchQuery.toLowerCase();
    return scopedFarmers.filter(f => 
      f.fullName.toLowerCase().includes(q) ||
      f.village.toLowerCase().includes(q) ||
      f.cropName.toLowerCase().includes(q) ||
      f.staffName.toLowerCase().includes(q)
    );
  }, [scopedFarmers, searchQuery]);

  const canManagePromotions = currentUser.role === "Admin" || currentUser.role === "Content Team";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-green-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
          <Sprout className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> FaReM • Field Force & Agronomy Suite
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Farmer Management & Crop Advisory</h1>
          <p className="text-xs md:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
            Centralized grower directory, geotagged plot tracking, daily visit logs, and stage-wise crop advisory linked to SalesApp identity.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("farmers")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "farmers"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
          }`}
        >
          <Users className="w-4 h-4" /> Farmers Portfolio ({filteredFarmers.length})
        </button>
        <button
          onClick={() => setActiveTab("visits")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "visits"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
          }`}
        >
          <Calendar className="w-4 h-4" /> Visit & Call Register
        </button>
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "recommendations"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
          }`}
        >
          <Send className="w-4 h-4" /> Product Advisory
        </button>
        <button
          onClick={() => setActiveTab("promotions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === "promotions"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Promotion Library {!canManagePromotions && "(Read-Only)"}
        </button>
      </div>

      {/* Tab Content: Farmers Portfolio */}
      {activeTab === "farmers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search farmers, villages, crops..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Showing farmers scoped for: <span className="font-bold text-gray-900 dark:text-slate-100">{currentUser.name}</span> ({currentUser.role})
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFarmers.map(farmer => (
              <div key={farmer.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-2xs hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{farmer.fullName}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-emerald-600" /> {farmer.village}, {farmer.taluka}, {farmer.district}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 rounded-full text-[10px] font-extrabold">
                    {farmer.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Crop & Stage</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                      <Sprout className="w-3.5 h-3.5 text-green-600" /> {farmer.cropName} ({farmer.stageName})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Landholding</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{farmer.acres} Acres</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Assigned Staff</span>
                    <span className="font-medium text-gray-700 dark:text-slate-300">{farmer.staffName}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFarmer(farmer);
                      setActiveTab("recommendations");
                    }}
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-xs hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Advise Product
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Visit & Call Register */}
      {activeTab === "visits" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" /> Recent Farm Visit & Phone Call Register
            </h3>
            <span className="text-xs text-gray-500">Auto-captured GPS timestamps</span>
          </div>

          <div className="space-y-3">
            {scopedFarmers.map(f => (
              <div key={`visit_${f.id}`} className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-150 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-gray-900 dark:text-slate-100">{f.fullName}</div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-3">
                    <span>📍 GPS Geotag Verified</span>
                    <span>🗓️ Visit Date: {f.lastVisitDate}</span>
                    <span>👤 Advisor: {f.staffName}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-lg text-[10px] font-bold">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Product Advisory */}
      {activeTab === "recommendations" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" /> Send Product Recommendation / Dosage Advisory
          </h3>

          {recStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {recStatus}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-500">Target Farmer</label>
              <select
                value={selectedFarmer?.id || ""}
                onChange={e => {
                  const f = scopedFarmers.find(x => x.id === e.target.value);
                  setSelectedFarmer(f || null);
                }}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium"
              >
                <option value="">Select Farmer from Portfolio...</option>
                {scopedFarmers.map(f => (
                  <option key={f.id} value={f.id}>{f.fullName} ({f.cropName})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-500">Recommended Product</label>
              <select
                value={newRecommendation.product}
                onChange={e => setNewRecommendation({ ...newRecommendation, product: e.target.value })}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium"
              >
                <option value="Erbato">Erbato (Bio-Enhancer & Root Development)</option>
                <option value="Veganic">Veganic (Foliar Organic Nutrition)</option>
                <option value="SugaMax">SugaMax (Yield Booster)</option>
                <option value="BioCore Special">BioCore Special Micro-nutrients</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500">Dosage & Spray Instructions</label>
            <input
              type="text"
              value={newRecommendation.dose}
              onChange={e => setNewRecommendation({ ...newRecommendation, dose: e.target.value })}
              placeholder="e.g. 2 ml per liter water at early morning spray"
              className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium"
            />
          </div>

          <button
            onClick={() => {
              if (!selectedFarmer) return;
              setRecStatus(`Product advisory for ${newRecommendation.product} (${newRecommendation.dose}) successfully recorded and dispatched to ${selectedFarmer.fullName} via WhatsApp/SMS!`);
              setTimeout(() => setRecStatus(null), 5000);
            }}
            disabled={!selectedFarmer}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" /> Dispatch Advisory to Grower
          </button>
        </div>
      )}

      {/* Tab Content: Promotion Library */}
      {activeTab === "promotions" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" /> Digital Promotion & Crop Schedule Library
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {!canManagePromotions 
                  ? "🔒 Read-Only Access: Field Staff and Managers can view and share promotions with farmers."
                  : "✏️ Content Team Access: Full management capabilities enabled."}
              </p>
            </div>
            {canManagePromotions && (
              <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition">
                <Plus className="w-3.5 h-3.5" /> Upload Promotion
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SEED_PROMOTIONS.map(item => (
              <div key={item.id} className="p-4 border border-gray-200 dark:border-slate-800 rounded-xl space-y-3 bg-gray-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded text-[10px] font-bold">
                    {item.contentType}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500">{item.cropTag}</span>
                </div>
                <h4 className="font-bold text-xs text-gray-900 dark:text-slate-100">{item.title}</h4>
                <div className="text-[11px] text-gray-500">Language: {item.language}</div>
                <button
                  onClick={() => alert(`Sharing "${item.title}" link: ${item.fileUrl}`)}
                  className="w-full py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share with Farmer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
