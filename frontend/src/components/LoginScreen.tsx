import { useState } from "react";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../store/auth";

export function LoginScreen() {
  const setToken = useAuthStore((s) => s.setToken);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Temporarily set to test auth
      sessionStorage.setItem("pt_token", password);
      await apiFetch("/auth/verify");
      setToken(password);
    } catch {
      sessionStorage.removeItem("pt_token");
      setError("Wrong password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📈</div>
          <h1 className="text-2xl font-bold text-white">Portfolio Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1d27] rounded-2xl p-6 border border-slate-700/50">
          <label className="block text-sm text-slate-400 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Verifying…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
