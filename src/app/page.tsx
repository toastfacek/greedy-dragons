"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Player {
  id: string;
  display_name: string;
  gold_count: number;
  social_link?: string | null;
}

const DRAGON_ART = `
    ⠀⠀⠀⠀⠀⢀⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⣴⣿⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⢀⣾⣿⡿⠛⠛⢿⣿⣿⣷⡀⠀⣀⣤⣤⡀⠀
    ⠀⠀⣾⣿⣿⣤⣤⣤⣤⣿⣿⣿⣷⣾⣿⣿⣿⣷⠀
    ⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄
    ⠀⢸⣿⣿⡏⠉⠉⠉⠉⣿⣿⡿⠿⣿⣿⡿⠟⠛⠁
    ⠀⠈⣿⣿⣧⣤⣤⣴⣾⣿⣿⣷⣤⣽⡟⠀⠀⠀⠀
    ⠀⠀⠈⠻⣿⣿⣿⣿⣿⡿⠿⠛⠋⠁⠀⠀⠀⠀⠀
`;

const RANK_MEDALS = ["👑", "🥈", "🥉"];

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editingSocialLink, setEditingSocialLink] = useState(false);
  const [socialLinkInput, setSocialLinkInput] = useState("");
  const [socialLinkLoading, setSocialLinkLoading] = useState(false);
  const [socialLinkError, setSocialLinkError] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      if (data.players) setPlayers(data.players);
    } catch {
      // silently fail, will retry
    }
  }, []);

  // Load player from localStorage on mount
  useEffect(() => {
    const playerId = localStorage.getItem("greedy_dragons_player_id");
    if (playerId) {
      fetch(`/api/players?id=${playerId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.player) setCurrentPlayer(data.player);
          else setShowNameModal(true);
        })
        .catch(() => setShowNameModal(true))
        .finally(() => setLoading(false));
    } else {
      setShowNameModal(true);
      setLoading(false);
    }
  }, []);

  // Fetch leaderboard on mount and poll every 10s
  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  // Check for success redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setShowSuccess(true);
      // Clean URL
      window.history.replaceState({}, "", "/");
      // Refresh leaderboard and player
      fetchLeaderboard();
      const playerId = localStorage.getItem("greedy_dragons_player_id");
      if (playerId) {
        fetch(`/api/players?id=${playerId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.player) setCurrentPlayer(data.player);
          });
      }
      setTimeout(() => setShowSuccess(false), 4000);
    }
  }, [fetchLeaderboard]);

  const handleCreatePlayer = async () => {
    if (!nameInput.trim()) return;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      const data = await res.json();
      if (data.player) {
        localStorage.setItem("greedy_dragons_player_id", data.player.id);
        setCurrentPlayer(data.player);
        setShowNameModal(false);
      }
    } catch {
      alert("Failed to create player. Try again!");
    }
  };

  const handleBuyGold = async () => {
    if (!currentPlayer) return;
    setBuyLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          quantity,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to start checkout. Try again!");
    } finally {
      setBuyLoading(false);
    }
  };

  const currentRank = currentPlayer
    ? players.findIndex((p) => p.id === currentPlayer.id) + 1
    : null;

  const isCurrentPlayerTop5 =
    currentRank !== null && currentRank > 0 && currentRank <= 5;

  const handleSaveSocialLink = async () => {
    if (!currentPlayer) return;
    setSocialLinkLoading(true);
    setSocialLinkError("");

    try {
      const res = await fetch("/api/players/social-link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          socialLink: socialLinkInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSocialLinkError(data.error || "Failed to save link");
        return;
      }

      if (data.player) {
        setCurrentPlayer(data.player);
      }
      setEditingSocialLink(false);
      fetchLeaderboard();
    } catch {
      setSocialLinkError("Failed to save link. Try again!");
    } finally {
      setSocialLinkLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 relative overflow-hidden">
      {/* Background fire particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl animate-float"
            style={{
              left: `${8 + i * 8}%`,
              top: `${60 + Math.random() * 30}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
              opacity: 0.3,
            }}
          >
            ✨
          </div>
        ))}
      </div>

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pixel-border-gold bg-bg-card px-6 py-4 animate-coin-drop">
          <p className="text-gold text-xs text-center">
            💰 GOLD ADDED TO YOUR HOARD! 💰
          </p>
        </div>
      )}

      {/* Header */}
      <header className="text-center mb-8 mt-4">
        <pre className="text-gold text-[10px] leading-tight hidden sm:block mb-4 animate-pulse-gold select-none">
          {DRAGON_ART}
        </pre>
        <h1 className="text-2xl sm:text-4xl text-gold animate-pulse-gold mb-2">
          GREEDY
        </h1>
        <h1 className="text-2xl sm:text-4xl text-gold animate-pulse-gold mb-4">
          DRAGONS
        </h1>
        <p className="text-text-dim text-[8px] sm:text-[10px] leading-relaxed max-w-md">
          HOARD GOLD. CLIMB THE RANKS. BECOME THE GREEDIEST.
        </p>
      </header>

      {/* Player status bar */}
      {currentPlayer && !loading && (
        <div className="pixel-border bg-bg-card px-6 py-4 mb-8 text-center w-full max-w-md">
          <p className="text-[8px] text-text-dim mb-2">YOUR HOARD</p>
          <p className="text-gold text-lg mb-1">
            🐉 {currentPlayer.display_name}
          </p>
          <p className="text-gold-light text-2xl">
            💰 {currentPlayer.gold_count}
          </p>
          {currentRank && currentRank > 0 && (
            <p className="text-[8px] text-text-dim mt-2">
              RANK #{currentRank}
            </p>
          )}
          {isCurrentPlayerTop5 && (
            <div className="mt-3 pt-3 border-t border-gold-dark/30">
              {editingSocialLink ? (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={socialLinkInput}
                    onChange={(e) => setSocialLinkInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSaveSocialLink()
                    }
                    placeholder="https://twitter.com/you"
                    maxLength={512}
                    className="w-full bg-bg-dark text-gold text-[8px] px-3 py-2 outline-none border-2 border-gold-dark focus:border-gold placeholder:text-text-dim/50 font-pixel"
                  />
                  {socialLinkError && (
                    <p className="text-[7px] text-red-400">
                      {socialLinkError}
                    </p>
                  )}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleSaveSocialLink}
                      disabled={socialLinkLoading}
                      className="text-[7px] px-3 py-1 bg-gold text-bg-dark hover:bg-gold-light disabled:opacity-50"
                    >
                      {socialLinkLoading ? "SAVING..." : "SAVE"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingSocialLink(false);
                        setSocialLinkError("");
                      }}
                      className="text-[7px] px-3 py-1 bg-bg-dark text-text-dim hover:text-gold"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSocialLinkInput(currentPlayer?.social_link || "");
                    setEditingSocialLink(true);
                  }}
                  className="text-[7px] text-text-dim hover:text-gold transition-colors"
                >
                  {currentPlayer?.social_link
                    ? "EDIT SOCIAL LINK"
                    : "ADD SOCIAL LINK"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buy Gold section */}
      {currentPlayer && !loading && (
        <div className="pixel-border bg-bg-card px-6 py-6 mb-8 text-center w-full max-w-md">
          <p className="text-[10px] text-gold mb-4">FEED YOUR GREED</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="text-gold text-lg hover:text-gold-light active:scale-95 transition-transform"
            >
              ◄
            </button>
            <div className="text-center">
              <p className="text-3xl text-gold-light">{quantity.toLocaleString()}</p>
              <p className="text-[8px] text-text-dim mt-1">
                GOLD (${quantity.toLocaleString()}.00)
              </p>
            </div>
            <button
              onClick={() => setQuantity(Math.min(10000, quantity + 1))}
              className="text-gold text-lg hover:text-gold-light active:scale-95 transition-transform"
            >
              ►
            </button>
          </div>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 25, 50, 100, 1000, 10000].map((n) => (
              <button
                key={n}
                onClick={() => setQuantity(n)}
                className={`text-[8px] px-3 py-2 transition-colors ${
                  quantity === n
                    ? "bg-gold text-bg-dark"
                    : "bg-bg-dark text-gold hover:bg-gold/20"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleBuyGold}
            disabled={buyLoading}
            className="w-full bg-gold text-bg-dark py-4 text-sm hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed pixel-border-gold"
          >
            {buyLoading ? "OPENING CHEST..." : `BUY ${quantity} GOLD 💰`}
          </button>
        </div>
      )}

      {/* Leaderboard */}
      <div className="w-full max-w-lg pixel-border bg-bg-card px-4 sm:px-6 py-6 mb-8">
        <h2 className="text-sm text-gold text-center mb-6">
          ⚔️ LEADERBOARD ⚔️
        </h2>
        {players.length === 0 ? (
          <p className="text-center text-text-dim text-[8px] py-8">
            NO DRAGONS YET... BE THE FIRST TO HOARD!
          </p>
        ) : (
          <div className="space-y-2">
            {players.map((player, i) => {
              const isCurrentPlayer = currentPlayer?.id === player.id;
              const medal = RANK_MEDALS[i];
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-3 py-3 transition-colors ${
                    isCurrentPlayer
                      ? "bg-gold/10 border-l-4 border-gold"
                      : i === 0
                      ? "bg-gold/5"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-sm w-8 text-center flex-shrink-0 ${
                        i === 0
                          ? "text-gold text-lg"
                          : i < 3
                          ? "text-gold-dark"
                          : "text-text-dim"
                      }`}
                    >
                      {medal || `#${i + 1}`}
                    </span>
                    <span
                      className={`text-[10px] truncate ${
                        isCurrentPlayer ? "text-gold" : "text-text-main"
                      }`}
                    >
                      🐉 {player.display_name}
                    </span>
                    {i < 5 && player.social_link && (
                      <a
                        href={player.social_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] text-text-dim hover:text-gold transition-colors shrink-0"
                        title={player.social_link}
                      >
                        🔗
                      </a>
                    )}
                  </div>
                  <span
                    className={`text-[10px] flex-shrink-0 ml-2 ${
                      i === 0
                        ? "text-gold animate-shimmer"
                        : i < 3
                        ? "text-gold-dark"
                        : "text-text-dim"
                    }`}
                  >
                    💰 {player.gold_count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-[7px] text-text-dim pb-8 max-w-sm leading-relaxed">
        <p className="mb-2">$1 = 1 GOLD. NO REFUNDS. NO MERCY.</p>
        <p>GREEDY DRAGONS © {new Date().getFullYear()}</p>
      </footer>

      {/* Name entry modal */}
      {showNameModal && !loading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
          <div className="pixel-border-gold bg-bg-card p-8 max-w-sm w-full text-center">
            <p className="text-4xl mb-4">🐉</p>
            <h2 className="text-sm text-gold mb-2">ENTER THE</h2>
            <h2 className="text-sm text-gold mb-6">DRAGON&apos;S LAIR</h2>
            <p className="text-[8px] text-text-dim mb-6 leading-relaxed">
              CHOOSE A NAME FOR YOUR DRAGON.
              <br />
              THIS WILL BE YOUR IDENTITY ON THE LEADERBOARD.
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.slice(0, 20))}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlayer()}
              placeholder="DRAGON NAME..."
              maxLength={20}
              autoFocus
              className="w-full bg-bg-dark text-gold text-xs px-4 py-3 mb-2 outline-none border-2 border-gold-dark focus:border-gold placeholder:text-text-dim/50 font-[family-name:var(--font-pixel)]"
            />
            <p className="text-[7px] text-text-dim mb-4">
              {nameInput.length}/20 CHARACTERS
            </p>
            <button
              onClick={handleCreatePlayer}
              disabled={!nameInput.trim()}
              className="w-full bg-gold text-bg-dark py-3 text-xs hover:bg-gold-light active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              BEGIN HOARDING
            </button>
          </div>
        </div>
      )}

      {/* Hidden audio for future coin sound */}
      <audio ref={audioRef} preload="none" />
    </div>
  );
}
