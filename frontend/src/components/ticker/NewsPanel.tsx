import { useEffect, useState } from "react";
import { fetchNews } from "../../api/stocks";
import type { NewsItem } from "../../types";

function timeAgo(raw: string | number): string {
  const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
  if (!ts || isNaN(ts)) return "";
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNews(ticker)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <p className="text-slate-500 text-sm py-2">Loading news…</p>;
  if (news.length === 0) return <p className="text-slate-500 text-sm py-2">No recent news.</p>;

  return (
    <div className="space-y-3">
      {news.map((item, i) => (
        <a
          key={i}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-[#0f1117] hover:bg-[#1a1d27] border border-slate-700/40 rounded-xl p-3 transition-colors"
        >
          <p className="text-sm text-white leading-snug mb-1.5">{item.title}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {item.source && <span>{item.source}</span>}
            {item.published_at && <span>• {timeAgo(item.published_at)}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}
