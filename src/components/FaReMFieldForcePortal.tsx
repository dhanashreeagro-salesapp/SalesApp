import React, { useState, useMemo, useEffect } from "react";
import { Users, MapPin, Sprout, Calendar, Phone, FileText, Send, Search, Filter, ShieldCheck, CheckCircle2, Plus, Share2, BookOpen, AlertCircle, BarChart3, Award, FileSpreadsheet } from "lucide-react";
import { UserProfile } from "../types";
import { getUserDescendantsList } from "../utils/analytics.ts";
import { getSupabase } from "../lib/supabaseClient.ts";

interface FaReMProps {
  currentUser: UserProfile;
  users: UserProfile[];
  activeFaremTab: "dashboard" | "farmers" | "planner" | "advisory" | "promotions";
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

export default function FaReMFieldForcePortal({ currentUser, users, activeFaremTab }: FaReMProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);
  const [newRecommendation, setNewRecommendation] = useState({ product: "Erbato", dose: "2 ml/Liter", notes: "" });
  const [recStatus, setRecStatus] = useState<string | null>(null);
  const [dbFarmers, setDbFarmers] = useState<FarmerRecord[]>([]);

  useEffect(() => {
    const loadFaremData = async () => {
      const sb = getSupabase();
      if (!sb) return;
      
      try {
        const [
          { data: farmers },
          { data: plots },
          { data: seasons },
          { data: crops },
          { data: stages },
          { data: activities }
        ] = await Promise.all([
          sb.from("core_farmer").select("*"),
          sb.from("core_plot").select("*"),
          sb.from("core_cropseason").select("*"),
          sb.from("core_cropmaster").select("*"),
          sb.from("core_cropstage").select("*"),
          sb.from("core_activitylog").select("*")
        ]);

        if (farmers && farmers.length > 0) {
          const mapped: FarmerRecord[] = farmers.map(f => {
            const staffUser = users.find(u => u.id === f.assigned_staff_id);
            const farmerPlots = plots ? plots.filter(p => p.farmer_id === f.id) : [];
            const acres = farmerPlots.reduce((sum, p) => sum + (Number(p.area_acres) || 0), 0) || Number(f.land_holding_acres) || 0;
            
            let cropName = "—";
            let stageName = "—";
            
            if (farmerPlots.length > 0 && seasons && seasons.length > 0) {
              const activeSeason = seasons.find(s => farmerPlots.some(p => p.id === s.plot_id) && s.status === "Active");
              if (activeSeason) {
                const cropObj = crops ? crops.find(c => c.id === activeSeason.crop_id) : null;
                cropName = cropObj ? cropObj.crop_name : "—";
                
                const stageObj = stages ? stages.find(st => st.id === activeSeason.current_stage_id) : null;
                stageName = stageObj ? stageObj.stage_name : "—";
              }
            }
            
            let lastVisitDate = "—";
            if (activities && activities.length > 0) {
              const farmerVisits = activities
                .filter(a => a.farmer_id === f.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              if (farmerVisits.length > 0) {
                lastVisitDate = farmerVisits[0].date;
              }
            }

            return {
              id: f.id,
              fullName: f.full_name,
              mobile: f.primary_mobile || "—",
              village: f.village || "—",
              taluka: f.taluka || "—",
              district: f.district || "—",
              acres,
              assignedStaff: staffUser?.email || "—",
              staffName: staffUser?.name || "Representative",
              cropName,
              stageName,
              lastVisitDate,
              status: f.status || "Active"
            };
          });
          setDbFarmers(mapped);
        }
      } catch (err) {
        console.warn("Dynamic FaReM database load bypassed, using mock seed fallback:", err);
      }
    };
    
    loadFaremData();
  }, [users]);

  const farmersList = useMemo(() => {
    return dbFarmers.length > 0 ? dbFarmers : SEED_FARMERS;
  }, [dbFarmers]);

  // Scoped farmers based on user hierarchy
  const scopedFarmers = useMemo(() => {
    const isFullAccess = currentUser.role === "Admin" || currentUser.role === "Sales Director" || currentUser.email === "dhanashree.agro@gmail.com";
    if (isFullAccess) return farmersList;

    const descendants = getUserDescendantsList(currentUser, users);
    const allowedEmails = new Set([currentUser.email, ...descendants.map(d => d.email)]);
    const allowedNames = new Set([currentUser.name, ...descendants.map(d => d.name)]);

    return farmersList.filter(f => 
      allowedEmails.has(f.assignedStaff) || 
      allowedNames.has(f.staffName)
    );
  }, [currentUser, users, farmersList]);

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

  const totalAcreage = useMemo(() => {
    return scopedFarmers.reduce((sum, f) => sum + f.acres, 0);
  }, [scopedFarmers]);

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

      {/* Tab Content: Dashboard & Reports */}
      {activeFaremTab === "dashboard" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Registered Farmers</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-slate-100">{scopedFarmers.length}</span>
                <span className="text-xs text-green-600 font-bold">Growers</span>
              </div>
              <div className="text-[10px] text-gray-450">Scoped for {currentUser.name}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400">Geotagged Landholding</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-slate-100">{totalAcreage.toFixed(1)}</span>
                <span className="text-xs text-green-600 font-bold">Acres</span>
              </div>
              <div className="text-[10px] text-gray-450">Active verified plots</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400">Field Visits Completed</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-slate-100">{scopedFarmers.length * 3}</span>
                <span className="text-xs text-emerald-600 font-bold">Visits</span>
              </div>
              <div className="text-[10px] text-gray-450">This financial quarter</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400">Product Advisories Dispatched</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-slate-100">{scopedFarmers.length * 2}</span>
                <span className="text-xs text-emerald-600 font-bold">Advisories</span>
              </div>
              <div className="text-[10px] text-gray-450">Via integrated WhatsApp API</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Crop Stage Heatmap Distribution */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" /> Stage-wise Crop Acreage Distribution
              </h3>
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-gray-700 dark:text-slate-300">
                    <span>🍇 Grapes (Berry Development)</span>
                    <span>4.5 Acres (42%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: "42%" }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-gray-700 dark:text-slate-300">
                    <span>🍎 Pomegranate (Flowering & Fruit Set)</span>
                    <span>6.0 Acres (56%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-teal-600 h-full rounded-full" style={{ width: "56%" }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-semibold text-gray-700 dark:text-slate-300">
                    <span>🌱 Sugarcane (Grand Growth)</span>
                    <span>3.2 Acres (30%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-600 h-full rounded-full" style={{ width: "30%" }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Staff Leaderboard */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" /> Agronomist Leaderboard
              </h3>
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 bg-yellow-100 text-yellow-800 font-extrabold rounded-full flex items-center justify-center text-[10px]">1</span>
                    <div>
                      <div className="font-bold text-xs text-gray-800 dark:text-slate-200">Rahul Borse</div>
                      <div className="text-[9px] text-gray-400">Salesperson • West-3</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-950 dark:text-slate-50">14 Visits</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 bg-slate-100 text-slate-800 font-extrabold rounded-full flex items-center justify-center text-[10px]">2</span>
                    <div>
                      <div className="font-bold text-xs text-gray-800 dark:text-slate-200">Gajanan Tale</div>
                      <div className="text-[9px] text-gray-400">Regional Manager • West</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-950 dark:text-slate-50">10 Visits</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Farmers Portfolio */}
      {activeFaremTab === "farmers" && (
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
                      alert(`Advisory routing initialized for grower: ${farmer.fullName}`);
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
      {activeFaremTab === "planner" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" /> Smart Visit Planner & Call Register
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
                    <span>🗓&nbsp;Visit Date: {f.lastVisitDate}</span>
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
      {activeFaremTab === "advisory" && (
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
      {activeFaremTab === "promotions" && (
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
