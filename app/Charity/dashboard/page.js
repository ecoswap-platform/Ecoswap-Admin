"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function CharityDashboard() {
  const router = useRouter();

  const [charityId, setCharityId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState("");

  // -------- AUTH + FETCH CHARITY ID --------
  useEffect(() => {
    const init = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/charity/login");
        return;
      }

      const { data: charity } = await supabase
        .from("charities")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!charity) {
        await supabase.auth.signOut();
        router.push("/charity/login");
        return;
      }

      setCharityId(charity.id);
    };

    init();
  }, [router]);

  // -------- FETCH ANALYTICS --------
  useEffect(() => {
    if (!charityId) return;

    fetch(`/api/charity-analytics?charityId=${charityId}&year=${year}${month ? `&month=${month}` : ""}`)
      .then(res => res.json())
      .then(setAnalytics);

    fetch(`/api/predict-donations?charityId=${charityId}`)
      .then(res => res.json())
      .then(setPrediction);

  }, [charityId, year, month]);

  return (
    <div style={{ padding: "32px", background: "#f4f6f8", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "24px" }}>
        Charity Analytics Dashboard
      </h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          {[2022, 2023, 2024, 2025].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
            .map((m,i)=>(
              <option key={m} value={i+1}>{m}</option>
            ))}
        </select>
      </div>

      {!analytics ? (
        <p>Loading analytics...</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
            <Stat label="Total Donations" value={analytics.totalDonations} />
            <Stat label="Total Items" value={analytics.totalItems} />
            <Stat label="Approval Ratio" value={`${analytics.approvalRatio}%`} />
            <Stat label="Trust Score" value={analytics.trustScore} />
          </div>

          <div style={{ marginTop: "32px" }}>
            <Bar
              data={{
                labels: Object.keys(analytics.categoryCount || {}),
                datasets: [{
                  label: "Category-wise Donations",
                  data: Object.values(analytics.categoryCount || {})
                }]
              }}
            />
          </div>

          <div style={{ marginTop: "32px" }}>
            <Line
              data={{
                labels: Object.keys(analytics.monthlyTrend || {}),
                datasets: [{
                  label: "Monthly Donation Trend",
                  data: Object.values(analytics.monthlyTrend || {})
                }]
              }}
            />
          </div>

          {prediction && (
            <div style={{ marginTop: "40px" }}>
              <h3>Predicted Donations (Next Months)</h3>
              <Line
                data={{
                  labels: prediction.futureMonths.map(m => `Month ${m}`),
                  datasets: [{
                    label: "Predicted Donations",
                    data: prediction.predictedCounts,
                    borderDash: [5,5]
                  }]
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
