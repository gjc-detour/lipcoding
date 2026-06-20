import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("Enter your access token");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await login(trimmedToken);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid token");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-white px-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-indigo-100/40">
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl" aria-hidden="true">
            🧠
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">LipCoding</h1>
          <p className="mt-2 text-sm text-gray-500">Enter your access token to continue.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Access Token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your token"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Entering..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
