import { useState, useEffect, useRef, useCallback } from "react";

const NO_LOCK_KEY = "valentine_no_lock_v1";
const RESET_QUERY_KEY = "__resetValentineLock";
const PHOTO_URLS = [
  "/photos/1.jpeg",
  "/photos/2.jpeg",
  "/photos/3.jpeg",
  "/photos/4.jpeg",
  "/photos/5.jpeg",
  "/photos/6.jpeg",
  "/photos/7.jpeg",
  "/photos/8.jpeg",
  "/photos/9.jpeg",
];

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
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const animRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const [handPosition, setHandPosition] = useState({ x: 0, y: 0, visible: false });
  const [valentineAccepted, setValentineAccepted] = useState(false);
  const [yesScale, setYesScale] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isNoLocked, setIsNoLocked] = useState(() => (resetRequested ? false : readNoLock()));
  const [noCount, setNoCount] = useState(() => (resetRequested ? 0 : (readNoLock() ? 7 : 0)));

  // Preload the image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
    img.onerror = () => {
      setImgReady(false);
    };
    setImgReady(false);
    img.src = PHOTO_URLS[currentImageIndex];
  }, [currentImageIndex]);

  useEffect(() => {
    if (!imgReady || !imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f3d9e3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    setPhase("done");
    setProgress(100);
    setHandPosition({ x: 0, y: 0, visible: false });
  }, [imgReady, currentImageIndex, valentineAccepted]);

  const startDrawing = useCallback(() => {
    if (!imgRef.current) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;

    const W = canvas.width;
    const H = canvas.height;

    setPhase("drawing");
    setProgress(0);
    setHandPosition({ x: W / 2, y: 0, visible: true });

    // Clear canvas to paper color
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#eae2d6";
    ctx.fillRect(0, 0, W, H);

    // Create offscreen canvas with the full image
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext("2d");
    octx.drawImage(img, 0, 0, W, H);

    // Create a mask canvas to track what's been drawn
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = W;
    maskCanvas.height = H;
    const maskCtx = maskCanvas.getContext("2d");
    // Start with transparent (nothing drawn)
    maskCtx.clearRect(0, 0, W, H);
    maskCtx.fillStyle = "rgba(0, 0, 0, 0)";
    maskCtx.fillRect(0, 0, W, H);

    // Generate random stroke paths across the canvas
    // Each stroke is a curved path that will be drawn
    const generateStrokes = () => {
      const strokes = [];
      const numStrokes = 1200; // Total number of strokes (more strokes = better coverage)
      
      for (let i = 0; i < numStrokes; i++) {
        // Random start and end points
        const startX = Math.random() * W;
        const startY = Math.random() * H;
        const endX = Math.random() * W;
        const endY = Math.random() * H;
        
        // Create a curved path with control points
        const cp1X = startX + (Math.random() - 0.5) * (W * 0.3);
        const cp1Y = startY + (Math.random() - 0.5) * (H * 0.3);
        const cp2X = endX + (Math.random() - 0.5) * (W * 0.3);
        const cp2Y = endY + (Math.random() - 0.5) * (H * 0.3);
        
        // Calculate approximate length for progress tracking
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        strokes.push({
          startX, startY, endX, endY,
          cp1X, cp1Y, cp2X, cp2Y,
          length,
          progress: 0, // How much of this stroke is drawn (0-1)
          width: 3 + Math.random() * 3 // Variable stroke width (thicker strokes)
        });
      }
      
      // Sort strokes by a random order to draw them randomly
      strokes.sort(() => Math.random() - 0.5);
      
      return strokes;
    };

    const strokes = generateStrokes();
    let currentStrokeIndex = 0;
    let currentStrokeProgress = 0;
    
    const totalPixels = W * H;
    let drawnPixels = 0;

    const FPS = 60;
    const DURATION_MS = 5500; // 5.5 seconds (middle of 5-6 second range)
    const pixelsPerFrame = totalPixels / (DURATION_MS / (1000 / FPS));
    
    // Calculate stroke speed to complete all strokes within 5-6 seconds
    // Target: complete all strokes in DURATION_MS
    // At 60 FPS, we have approximately (DURATION_MS / 1000) * 60 frames
    // Each stroke should complete in: totalFrames / numStrokes frames
    const totalFrames = (DURATION_MS / 1000) * FPS; // ~330 frames for 5.5 seconds
    const framesPerStroke = totalFrames / strokes.length;
    const STROKE_SPEED = 1.0 / framesPerStroke; // Progress per frame to complete stroke in time

    let lastTime = performance.now();

    const animate = (now) => {
      const dt = now - lastTime;
      lastTime = now;

      // Draw strokes
      const progressStep = STROKE_SPEED * (dt / (1000 / FPS));
      let pixelsDrawnThisFrame = 0;
      let currentHandX = W / 2;
      let currentHandY = H / 2;

      while (currentStrokeIndex < strokes.length && pixelsDrawnThisFrame < pixelsPerFrame * (dt / (1000 / FPS))) {
        const stroke = strokes[currentStrokeIndex];
        
        // Advance progress on current stroke
        currentStrokeProgress += progressStep;
        
        if (currentStrokeProgress >= 1) {
          // Complete this stroke
          currentStrokeProgress = 1;
          
          // Draw the complete stroke on mask (white = visible)
          maskCtx.strokeStyle = "rgba(255, 255, 255, 1)";
          maskCtx.lineWidth = stroke.width;
          maskCtx.lineCap = "round";
          maskCtx.lineJoin = "round";
          maskCtx.beginPath();
          maskCtx.moveTo(stroke.startX, stroke.startY);
          maskCtx.bezierCurveTo(
            stroke.cp1X, stroke.cp1Y,
            stroke.cp2X, stroke.cp2Y,
            stroke.endX, stroke.endY
          );
          maskCtx.stroke();
          
          pixelsDrawnThisFrame += stroke.length * stroke.width;
          drawnPixels += stroke.length * stroke.width;
          
          // Update hand to end of completed stroke
          currentHandX = stroke.endX;
          currentHandY = stroke.endY;
          
          // Move to next stroke
          currentStrokeIndex++;
          currentStrokeProgress = 0;
        } else {
          // Draw partial stroke
          const t = currentStrokeProgress;
          const t2 = t * t;
          const t3 = t2 * t;
          const mt = 1 - t;
          const mt2 = mt * mt;
          const mt3 = mt2 * mt;
          
          // Bezier curve point calculation
          const currentX = mt3 * stroke.startX + 3 * mt2 * t * stroke.cp1X + 3 * mt * t2 * stroke.cp2X + t3 * stroke.endX;
          const currentY = mt3 * stroke.startY + 3 * mt2 * t * stroke.cp1Y + 3 * mt * t2 * stroke.cp2Y + t3 * stroke.endY;
          
          // Draw up to current point (white = visible)
          maskCtx.strokeStyle = "rgba(255, 255, 255, 1)";
          maskCtx.lineWidth = stroke.width;
          maskCtx.lineCap = "round";
          maskCtx.lineJoin = "round";
          maskCtx.beginPath();
          maskCtx.moveTo(stroke.startX, stroke.startY);
          maskCtx.bezierCurveTo(
            stroke.cp1X, stroke.cp1Y,
            stroke.cp2X, stroke.cp2Y,
            currentX, currentY
          );
          maskCtx.stroke();
          
          pixelsDrawnThisFrame += stroke.length * stroke.width * progressStep;
          drawnPixels += stroke.length * stroke.width * progressStep;
          
          // Update hand position to follow current drawing point
          currentHandX = currentX;
          currentHandY = currentY;
          
          // Continue to next iteration to draw more strokes if time allows
          // This allows multiple strokes per frame to complete in 5-6 seconds
        }
      }
      
      // Update hand position (always, even if no stroke drawn this frame)
      if (currentStrokeIndex < strokes.length) {
        setHandPosition({ 
          x: Math.max(20, Math.min(W - 20, currentHandX)), 
          y: Math.max(0, Math.min(H - 20, currentHandY)), 
          visible: true 
        });
      }

      // Clear canvas and apply the mask to reveal only drawn parts
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#eae2d6";
      ctx.fillRect(0, 0, W, H);
      
      // Draw the image, but only where the mask has white strokes (drawn areas)
      // destination-in keeps only parts where mask has non-zero alpha
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(offscreen, 0, 0, W, H);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0, W, H);
      ctx.restore();

      // Add pencil scratch effects near the hand position
      if (currentStrokeIndex < strokes.length) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        
        // Add scratches near the drawing point
        for (let i = 0; i < 3; i++) {
          const sx = currentHandX + (Math.random() - 0.5) * 15;
          const sy = currentHandY + (Math.random() - 0.5) * 15;
          const len = 3 + Math.random() * 8;
          const alpha = 0.02 + Math.random() * 0.04;
          ctx.strokeStyle = `rgba(50,45,40,${alpha})`;
          ctx.lineWidth = 0.3 + Math.random() * 0.3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          const angle = Math.random() * Math.PI * 2;
          ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
          ctx.stroke();
        }
        ctx.restore();
      }

      const pct = Math.min(100, (drawnPixels / totalPixels) * 100);
      setProgress(Math.round(pct));

      if (currentStrokeIndex < strokes.length || currentStrokeProgress > 0) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Final: draw the complete image
        ctx.drawImage(offscreen, 0, 0, W, H);
        setPhase("done");
        setHandPosition({ x: 0, y: 0, visible: false });
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

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
  }, [isNoLocked, noCount]);

  const canvasSize = 500;
  const showShadowScreen = isNoLocked || (!valentineAccepted && noCount >= 7);
  const totalPhotos = PHOTO_URLS.length;
  const changePhoto = (direction) => {
    setCurrentImageIndex((prev) => (prev + direction + totalPhotos) % totalPhotos);
    setPhase("done");
    setProgress(100);
    setHandPosition({ x: 0, y: 0, visible: false });
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
          .carousel-controls {
            flex-wrap: wrap !important;
            justify-content: center !important;
            row-gap: 10px !important;
          }
        }
        @media (max-width: 480px) {
          .question-card,
          .shadow-card {
            border-radius: 16px !important;
            padding: 20px 14px !important;
          }
          .valentine-actions {
            gap: 10px !important;
          }
          .valentine-actions button {
            min-width: 72px !important;
            padding-left: 18px !important;
            padding-right: 18px !important;
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
        flexDirection: valentineAccepted && phase === "done" ? "row" : "column", 
        alignItems: "center", 
        justifyContent: "center",
        fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        padding: "clamp(12px, 3.5vw, 24px) clamp(10px, 3vw, 16px)", 
        position: "relative", 
        overflowX: "hidden",
        overflowY: "auto",
        gap: valentineAccepted && phase === "done" ? "clamp(20px, 4vw, 40px)" : "0",
      }}>
      {/* Ambient glow */}
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
        // Final "no" – everything disappears, show heart container with message
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
              fontSize: "0.98rem",
              lineHeight: "1.9",
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
        // Initial Valentine question view
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
              fontSize: "0.95rem",
              lineHeight: "1.7",
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
      {/* Main content container */}
      <div className="main-container" style={{
        display: "flex",
        flexDirection: phase === "done" ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: phase === "done" ? "clamp(20px, 4vw, 40px)" : "0",
        width: "100%",
        maxWidth: phase === "done" ? "min(1200px, 100%)" : "100%",
        flexWrap: "wrap",
        zIndex: 1,
      }}>
        {/* Left side - Canvas */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(12px, 2.6vw, 20px)",
        }}>
      {/* Canvas */}
      <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)", zIndex: 1 }}>
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{ display: "block", width: "clamp(260px, 90vw, 440px)", height: "auto", background: "#eae2d6" }}
        />
      </div>

      {/* Carousel controls */}
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

          {/* Portrait Complete text - only show when done */}
      {phase === "done" && (
            <p style={{ color: "rgba(255,201,222,0.55)", fontSize: "0.68rem", letterSpacing: "2.5px", textTransform: "uppercase", zIndex: 1 }}>
            Portrait Complete
          </p>
          )}
        </div>

        {/* Right side - Birthday Message (only when done) */}
        {phase === "done" && (
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
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)", 
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
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              lineHeight: "1.8",
              letterSpacing: "0.5px",
              textAlign: "left",
              fontStyle: "italic",
            }}>
              <p style={{ marginBottom: "20px", marginTop: "0" }}>
                Happy Valentine's Day, Chhaba the Don.
              </p>
              <p style={{ marginBottom: "20px", marginTop: "0" }}>
                There was a time I felt like my soulmate didn't exist… like maybe destiny forgot about me. Then I found you — and suddenly everything made sense, and love started to feel like home.
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
      )}
      </div>
      </>
      )}
      </div>
    </>
  );
}
