import { useState, useEffect, useMemo } from "react";

const NO_LOCK_KEY = "valentine_no_lock_v1";
const RESET_QUERY_KEY = "__resetValentineLock";
const PHOTO_COUNT = 9;

const getRepoBasePath = () => {
  if (typeof window === "undefined") return "/";
  const { hostname, pathname } = window.location;
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (hostname.endsWith("github.io") && firstSegment) {
    return `/${firstSegment}/`;
  }
  return "/";
};

const getPhotoCandidates = (index) => {
  const fileName = `${index + 1}.jpeg`;
  const envBase = import.meta.env.BASE_URL || "/";
  const repoBase = getRepoBasePath();
  return Array.from(
    new Set([
      `${envBase}photos/${fileName}`,
      `${repoBase}photos/${fileName}`,
      `/photos/${fileName}`,
      `photos/${fileName}`,
      `./photos/${fileName}`,
    ]),
  );
};

const readNoLock = () => {
  try {
    return localStorage.getItem(NO_LOCK_KEY) === "1";
  } catch {
    return false;
  }
};

const hasResetQuery = () => {
  try {
    return new URLSearchParams(window.location.search).get(RESET_QUERY_KEY) === "1";
  } catch {
    return false;
  }
};

const writeNoLock = (locked) => {
  try {
    if (locked) {
      localStorage.setItem(NO_LOCK_KEY, "1");
    } else {
      localStorage.removeItem(NO_LOCK_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments.
  }
};

export default function SketchDrawApp() {
  const resetRequested = hasResetQuery();
  const [valentineAccepted, setValentineAccepted] = useState(false);
  const [yesScale, setYesScale] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isNoLocked, setIsNoLocked] = useState(() => (resetRequested ? false : readNoLock()));
  const [noCount, setNoCount] = useState(() => (resetRequested ? 0 : (readNoLock() ? 7 : 0)));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const photoCandidates = useMemo(() => getPhotoCandidates(currentImageIndex), [currentImageIndex]);
  const currentPhotoSrc = photoCandidates[Math.min(imageAttempt, photoCandidates.length - 1)];

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(RESET_QUERY_KEY) !== "1") return;

      writeNoLock(false);
      setIsNoLocked(false);
      setNoCount(0);
      setYesScale(1);
      setValentineAccepted(false);
    } catch {
      // Ignore URL/storage issues in restricted environments.
    }
  }, []);

  useEffect(() => {
    if (resetRequested) return;
    if (!isNoLocked && noCount < 7) return;
    writeNoLock(true);
    setIsNoLocked(true);
    setValentineAccepted(false);
    setNoCount(7);
  }, [isNoLocked, noCount, resetRequested]);

  useEffect(() => {
    setImageLoaded(false);
    setImageAttempt(0);
  }, [currentImageIndex]);

  const showShadowScreen = isNoLocked || (!valentineAccepted && noCount >= 7);
  const totalPhotos = PHOTO_COUNT;

  const changePhoto = (direction) => {
    setCurrentImageIndex((prev) => (prev + direction + totalPhotos) % totalPhotos);
  };

  const handleYesClick = () => {
    if (isNoLocked) return;
    setNoCount(0);
    setYesScale(1);
    setValentineAccepted(true);
  };

  const handleNoClick = () => {
    if (isNoLocked) return;
    setNoCount((prev) => {
      const next = Math.min(7, prev + 1);
      if (next >= 7) {
        writeNoLock(true);
        setIsNoLocked(true);
        setValentineAccepted(false);
      }
      return next;
    });
    setYesScale((prev) => Math.max(0.3, prev * 0.8));
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 968px) {
          .main-container {
            flex-direction: column !important;
          }
        }
        @media (max-width: 768px) {
          .app-shell {
            padding: 20px 12px !important;
            gap: 20px !important;
          }
          .main-container {
            gap: 24px !important;
          }
          .message-panel {
            width: min(560px, 94vw) !important;
            padding: 16px 10px !important;
            align-items: center !important;
          }
          .message-title {
            text-align: center !important;
            margin-bottom: 18px !important;
          }
          .message-copy {
            text-align: center !important;
          }
          .message-copy p {
            font-size: 1.04rem !important;
            line-height: 1.85 !important;
          }
          .carousel-controls {
            flex-wrap: wrap !important;
            justify-content: center !important;
            row-gap: 10px !important;
          }
          .shadow-card {
            width: min(680px, 98vw) !important;
            max-width: 98vw !important;
            padding: 30px 20px 34px !important;
          }
          .shadow-card p {
            font-size: 1.08rem !important;
            line-height: 2 !important;
          }
          .valentine-actions button {
            font-size: 0.95rem !important;
            letter-spacing: 1.4px !important;
          }
        }
        @media (max-width: 480px) {
          .question-card,
          .shadow-card {
            border-radius: 16px !important;
            padding: 24px 18px !important;
          }
          .valentine-actions {
            gap: 10px !important;
          }
          .valentine-actions button {
            min-width: 72px !important;
            min-height: 46px !important;
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          .shadow-card p {
            font-size: 1.12rem !important;
            line-height: 2.05 !important;
          }
        }
        .heart-firework {
          position: absolute;
          width: 34px;
          height: 34px;
          bottom: -36px;
          pointer-events: none;
          opacity: 0;
          animation: heart-burst 6.5s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
          will-change: transform, opacity;
        }
        .heart-firework::before {
          position: absolute;
          left: 0;
          top: 0;
          font-size: 32px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
        }
        .heart-firework--broken::before {
          content: "💔";
          font-size: 42px;
        }
        .heart-firework--love {
          animation-duration: 8.5s;
        }
        .heart-firework--love::before {
          content: "❤️";
          font-size: 36px;
        }
        @keyframes heart-burst {
          0% { transform: translate3d(0, 0, 0) scale(0.45); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate3d(0, -110vh, 0) scale(1.05); opacity: 0; }
        }
        .heart-firework:nth-child(1) { left: 8%; animation-delay: 0s; }
        .heart-firework:nth-child(2) { left: 16%; animation-delay: 0.5s; }
        .heart-firework:nth-child(3) { left: 24%; animation-delay: 1s; }
        .heart-firework:nth-child(4) { left: 32%; animation-delay: 1.5s; }
        .heart-firework:nth-child(5) { left: 40%; animation-delay: 2s; }
        .heart-firework:nth-child(6) { left: 48%; animation-delay: 2.5s; }
        .heart-firework:nth-child(7) { left: 56%; animation-delay: 3s; }
        .heart-firework:nth-child(8) { left: 64%; animation-delay: 3.5s; }
        .heart-firework:nth-child(9) { left: 72%; animation-delay: 4s; }
        .heart-firework:nth-child(10) { left: 80%; animation-delay: 4.5s; }
        .heart-firework:nth-child(11) { left: 88%; animation-delay: 5s; }
        .heart-firework:nth-child(12) { left: 20%; animation-delay: 5.5s; }
        .heart-firework:nth-child(13) { left: 50%; animation-delay: 6s; }
        .heart-firework:nth-child(14) { left: 78%; animation-delay: 6.5s; }
        .heart-firework:nth-child(15) { left: 10%; animation-delay: 0.25s; }
        .heart-firework:nth-child(16) { left: 30%; animation-delay: 0.9s; }
        .heart-firework:nth-child(17) { left: 46%; animation-delay: 1.7s; }
        .heart-firework:nth-child(18) { left: 62%; animation-delay: 2.2s; }
        .heart-firework:nth-child(19) { left: 74%; animation-delay: 2.9s; }
        .heart-firework:nth-child(20) { left: 86%; animation-delay: 3.4s; }
        .heart-firework:nth-child(21) { left: 14%; animation-delay: 4.1s; }
        .heart-firework:nth-child(22) { left: 36%; animation-delay: 4.7s; }
        .heart-firework:nth-child(23) { left: 6%; animation-delay: 0.35s; }
        .heart-firework:nth-child(24) { left: 18%; animation-delay: 1.15s; }
        .heart-firework:nth-child(25) { left: 28%; animation-delay: 1.95s; }
        .heart-firework:nth-child(26) { left: 44%; animation-delay: 2.75s; }
        .heart-firework:nth-child(27) { left: 58%; animation-delay: 3.55s; }
        .heart-firework:nth-child(28) { left: 70%; animation-delay: 4.35s; }
        .heart-firework:nth-child(29) { left: 84%; animation-delay: 5.15s; }
        .heart-firework:nth-child(30) { left: 94%; animation-delay: 5.95s; }
        @keyframes heart-card-pop {
          0% { transform: translate3d(0, 60px, 0) scale(0.85); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
        }
      `}</style>
      <div className="app-shell" style={{
        minHeight: "100dvh",
        background: "radial-gradient(circle at top, #ffd0df 0%, #ff5f9a 28%, #9b1248 62%, #2a0014 100%)",
        display: "flex",
        flexDirection: valentineAccepted ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        padding: "clamp(12px, 3.5vw, 24px) clamp(10px, 3vw, 16px)",
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
        gap: valentineAccepted ? "clamp(20px, 4vw, 40px)" : "0",
      }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 50%, rgba(255,196,219,0.26) 0%, transparent 62%), radial-gradient(ellipse at 80% 30%, rgba(255,120,170,0.22) 0%, transparent 56%)" }} />

      {(valentineAccepted || showShadowScreen) && (
        <div style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}>
          {Array.from({ length: showShadowScreen ? 30 : 22 }).map((_, i) => (
            <div
              key={i}
              className={`heart-firework ${showShadowScreen ? "heart-firework--broken" : "heart-firework--love"}`}
            />
          ))}
        </div>
      )}

      {showShadowScreen ? (
        <div style={{
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          width: "100%",
        }}>
          <div className="shadow-card" style={{
            maxWidth: "480px",
            width: "min(480px, 96vw)",
            background: "linear-gradient(145deg, rgba(78,6,27,0.98), rgba(148,20,63,0.98))",
            borderRadius: "26px",
            padding: "30px 26px 34px",
            boxShadow: "0 28px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,182,207,0.65)",
            border: "1px solid rgba(255,221,234,0.55)",
            textAlign: "center",
            animation: "heart-card-pop 0.6s ease-out forwards",
            position: "relative",
          }}>
            <p style={{
              color: "#ffdfe9",
              fontSize: "clamp(1.2rem, 2.6vw, 1.5rem)",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "18px",
            }}>
              From the shadows, with love
            </p>
            <p style={{
              color: "rgba(255,226,238,0.9)",
              fontSize: "clamp(1.02rem, 3.8vw, 1.12rem)",
              lineHeight: "1.95",
              margin: 0,
              fontStyle: "italic",
            }}>
              I’ll still pray for your happiness, even from the shadows.
              Even if my story with you ends here, I’m grateful my heart got to know you at all.
              Don’t worry about me, and congratulations on the love that’s waiting for you.
              Somewhere, quietly, I’ll always be wishing the softest, safest future for you. 💔
            </p>
          </div>
        </div>
      ) : !valentineAccepted ? (
        <div style={{
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          padding: "24px 20px",
        }}>
          <div className="question-card" style={{
            background: "linear-gradient(145deg, rgba(70,12,36,0.94), rgba(42,8,24,0.95))",
            borderRadius: "18px",
            padding: "26px 24px",
            boxShadow: "0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,166,201,0.62)",
            maxWidth: "420px",
            width: "min(420px, 94vw)",
            textAlign: "center",
            border: "1px solid rgba(255,186,214,0.7)",
          }}>
            <p style={{
              color: "#ffecef",
              fontSize: "clamp(1.4rem, 3.2vw, 1.8rem)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "18px",
            }}>
              Will you be my Valentine?
            </p>
            <p style={{
              color: "rgba(255,220,235,0.9)",
              fontSize: "clamp(1.02rem, 3.8vw, 1.12rem)",
              lineHeight: "1.8",
              margin: 0,
            }}>
              Take your time, Chhaba the Don... but choose wisely.
            </p>
            <div className="valentine-actions" style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "18px",
              marginTop: "26px",
            }}>
              {noCount < 7 && (
                <button
                  onClick={handleYesClick}
                  style={{
                    padding: "11px 32px",
                    background: "linear-gradient(135deg, #ff9fc2, #ff5f95)",
                    color: "#240714",
                    border: "none",
                    borderRadius: "999px",
                    fontSize: "0.8rem",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    boxShadow: "0 7px 24px rgba(255,118,168,0.5)",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    transform: `scale(${yesScale})`,
                    transformOrigin: "center",
                    transition: "transform 0.15s ease-out, box-shadow 0.2s ease-out, background 0.2s ease-out",
                    minWidth: "80px",
                    minHeight: "42px",
                  }}
                >
                  Yes
                </button>
              )}
              {noCount < 7 && (
                <button
                  onClick={handleNoClick}
                  style={{
                    padding: "10px 26px",
                    background: "rgba(115,20,49,0.72)",
                    color: "rgba(255,231,240,0.96)",
                    border: "1px solid rgba(255,160,192,0.72)",
                    borderRadius: "999px",
                    fontSize: "0.8rem",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    transition: "background 0.2s ease-out, border-color 0.2s ease-out",
                    minWidth: "80px",
                    minHeight: "42px",
                  }}
                >
                  No
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="main-container" style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(20px, 4vw, 40px)",
        width: "100%",
        maxWidth: "min(1200px, 100%)",
        flexWrap: "wrap",
        zIndex: 1,
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(12px, 2.6vw, 20px)",
        }}>
          <div style={{
            position: "relative",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
            zIndex: 1,
            width: "clamp(260px, 90vw, 440px)",
            aspectRatio: "1 / 1",
            background: "#eae2d6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <img
              src={currentPhotoSrc}
              alt={`Valentine photo ${currentImageIndex + 1}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                if (imageAttempt < photoCandidates.length - 1) {
                  setImageAttempt((prev) => prev + 1);
                  return;
                }
                setImageLoaded(false);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: imageLoaded ? 1 : 0,
                transition: "opacity 0.2s ease",
              }}
            />
            {!imageLoaded && (
              <span style={{
                position: "absolute",
                color: "rgba(80, 42, 56, 0.8)",
                fontSize: "0.8rem",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}>
                Loading photo...
              </span>
            )}
          </div>

          <div className="carousel-controls" style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px", zIndex: 1, width: "min(440px, 92vw)" }}>
            <button
              onClick={() => changePhoto(-1)}
              style={{
                padding: "8px 14px",
                background: "rgba(255,170,205,0.24)",
                color: "rgba(255,235,243,0.95)",
                border: "1px solid rgba(255,188,214,0.7)",
                borderRadius: "999px",
                fontSize: "0.72rem",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Prev
            </button>
            <span style={{ color: "rgba(255,215,230,0.86)", fontSize: "0.72rem", letterSpacing: "1.4px" }}>
              Photo {currentImageIndex + 1} / {totalPhotos}
            </span>
            <button
              onClick={() => changePhoto(1)}
              style={{
                padding: "8px 14px",
                background: "rgba(255,170,205,0.24)",
                color: "rgba(255,235,243,0.95)",
                border: "1px solid rgba(255,188,214,0.7)",
                borderRadius: "999px",
                fontSize: "0.72rem",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Next
            </button>
          </div>

          <p style={{ color: "rgba(255,201,222,0.55)", fontSize: "0.68rem", letterSpacing: "2.5px", textTransform: "uppercase", zIndex: 1 }}>
            Portrait Complete
          </p>
        </div>

        <div className="message-panel" style={{
          flex: "1 1 300px",
          minWidth: 0,
          width: "min(500px, 94vw)",
          maxWidth: "500px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "20px",
          animation: "fadeIn 0.8s ease-in",
        }}>
          <h2 className="message-title" style={{
            color: "#ffd6e7",
            fontSize: "clamp(2rem, 7vw, 2.7rem)",
            fontWeight: "400",
            letterSpacing: "clamp(2px, 1.2vw, 8px)",
            textTransform: "uppercase",
            marginBottom: "30px",
            textAlign: "left",
            zIndex: 1,
            textShadow: "0 3px 14px rgba(255,108,160,0.34)",
          }}>
            Happy Valentine's Day
          </h2>

          <div className="message-copy" style={{
            color: "rgba(255,223,236,0.92)",
            fontSize: "clamp(1.05rem, 3.4vw, 1.2rem)",
            lineHeight: "1.9",
            letterSpacing: "0.5px",
            textAlign: "left",
            fontStyle: "italic",
          }}>
            <p style={{ marginBottom: "20px", marginTop: "0" }}>
              Happy Valentine's Day, Chhaba the Don.
            </p>
            <p style={{ marginBottom: "20px", marginTop: "0" }}>
              There was a time I felt like my soulmate didn't exist… like maybe destiny forgot about me. Then I found you - and suddenly everything made sense, and love started to feel like home.
            </p>
            <p style={{ marginBottom: "20px", marginTop: "0" }}>
              You didn't just come into my life, you became my peace, my smile, my favorite feeling.
            </p>
            <p style={{ marginBottom: "20px", marginTop: "0" }}>
              On this Valentine's Day, I just want you to know how deeply loved you are and how grateful I am that my heart found you.
            </p>
            <p style={{ marginBottom: "20px", marginTop: "0" }}>
              May every day ahead feel a little softer, a little brighter, and a little more beautiful because we get to walk through it together❤️.
            </p>
          </div>

        </div>
      </div>
      </>
      )}
      </div>
    </>
  );
}
