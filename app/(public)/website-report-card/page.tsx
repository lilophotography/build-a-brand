"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import confetti from "canvas-confetti";

import {
  MAX_FOLLOWUP_USER_MESSAGES,
  MAX_FREEFORM_QUESTIONS,
} from "@/lib/report-card-prompt";

type Tone = "big-sister" | "all-business";
type ChatMessage = { role: "user" | "assistant"; content: string };

const COACHING_MODE_ENABLED =
  process.env.NEXT_PUBLIC_REPORT_CARD_FEATURE_COACHING_MODE === "1" ||
  process.env.NEXT_PUBLIC_REPORT_CARD_FEATURE_COACHING_MODE === "true";
const COACHING_MAX_USER_MESSAGES = 6;

export default function WebsiteReportCardPage() {
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<Tone>("big-sister");
  const [stage, setStage] = useState<"intro" | "loading" | "report">("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasteFallback, setPasteFallback] = useState<string | null>(null);
  const [pastedCopy, setPastedCopy] = useState("");
  const [reportText, setReportText] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [scanSteps, setScanSteps] = useState<string[]>([]);
  const [headlineRewrite, setHeadlineRewrite] = useState<string>("");
  const [rewritingHeadline, setRewritingHeadline] = useState(false);

  const reportEndRef = useRef<HTMLDivElement>(null);
  const aGradesFiredRef = useRef<number>(0);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ kind: "ok" | "warn" | "error"; msg: string } | null>(null);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [coachingFocus, setCoachingFocus] = useState("");
  const [coachingChat, setCoachingChat] = useState<ChatMessage[]>([]);
  const [coachingInput, setCoachingInput] = useState("");
  const [coachingStreaming, setCoachingStreaming] = useState(false);
  const [igHandle, setIgHandle] = useState("");
  const [igPastedBio, setIgPastedBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinPastedBio, setLinkedinPastedBio] = useState("");
  const [socialCritiques, setSocialCritiques] = useState<{ ig: string; li: string }>({ ig: "", li: "" });
  const [socialLoading, setSocialLoading] = useState<{ ig: boolean; li: boolean }>({ ig: false, li: false });
  const [socialError, setSocialError] = useState<{ ig: string | null; li: string | null }>({ ig: null, li: null });
  const [igFallbackVisible, setIgFallbackVisible] = useState(false);
  const [linkedinFallbackVisible, setLinkedinFallbackVisible] = useState(false);
  // Funnel stages, in Lisa's order:
  // Step 2: Focus suggestions (AI stream, picks one weakest category)
  // Step 3: Tagline rewrite (AI stream)
  // Step 4: Instagram critique (reveal input; user-driven)
  // After Step 4: Lisa's bio + offers + email-the-report block all reveal.
  const [focusDone, setFocusDone] = useState(false);
  const [focusEngaged, setFocusEngaged] = useState(false); // true only if AI was actually called
  const [taglineDone, setTaglineDone] = useState(false);
  const [socialRevealed, setSocialRevealed] = useState(false);

  // Total user messages used (focus click + work-with-me click + free-form Qs).
  // Server-side hard cap is MAX_FOLLOWUP_USER_MESSAGES.
  const followupCount = chat.filter((m) => m.role === "user").length - 1;
  // Free-form questions used = total user messages minus AI-streaming funnel
  // clicks. Only the focus suggestions step calls the AI (work-with-me no
  // longer streams). Skipped steps don't count.
  const funnelClicksConsumed = focusEngaged ? 1 : 0;
  const freeformAsked = Math.max(0, followupCount - funnelClicksConsumed);
  const freeformRemaining = Math.max(0, MAX_FREEFORM_QUESTIONS - freeformAsked);
  const isLocked = followupCount >= MAX_FOLLOWUP_USER_MESSAGES || freeformAsked >= MAX_FREEFORM_QUESTIONS;

  useEffect(() => {
    if (reportEndRef.current && stage === "report") {
      reportEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [reportText, chat, stage]);

  // Post our content height to the parent window (Showit) when embedded as an
  // iframe, so the iframe can grow/shrink with the content. The parent page
  // needs a small listener (provided in the launch checklist embed code).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.parent || window.parent === window) return;

    const postHeight = () => {
      const h = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      window.parent.postMessage({ type: "lilo-rc-resize", height: h }, "*");
    };

    postHeight();
    const ro = new ResizeObserver(postHeight);
    ro.observe(document.body);
    window.addEventListener("resize", postHeight);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", postHeight);
    };
  }, []);

  // Fire confetti once per new A grade detected in the streamed report text.
  useEffect(() => {
    if (stage !== "report" || !reportText) return;
    // Match grade cells like "A", "A+", or "A-" inside markdown table rows.
    const matches = reportText.match(/\|\s*A[+\-]?\s*\|/g) || [];
    const newACount = matches.length;
    if (newACount > aGradesFiredRef.current) {
      const burstsToFire = newACount - aGradesFiredRef.current;
      aGradesFiredRef.current = newACount;
      for (let i = 0; i < burstsToFire; i += 1) {
        setTimeout(() => fireConfetti(), i * 220);
      }
    }
  }, [reportText, stage]);

  function handleStep2Focus() {
    setFocusDone(true);
    setFocusEngaged(true);
    handleSendFollowup("Show me where to focus first.");
  }

  function handleStep2Skip() {
    setFocusDone(true);
  }

  function handleStep3Tagline() {
    setTaglineDone(true);
    handleRewriteHeadline();
  }

  function handleStep3Skip() {
    setTaglineDone(true);
  }

  function handleStep4Social() {
    setSocialRevealed(true);
  }

  function handleStep4Skip() {
    setSocialRevealed(true);
  }

  async function handleStart(opts?: { useFallbackCopy?: boolean }) {
    setErrorMsg(null);
    if (!url.trim()) {
      setErrorMsg("Please paste your website URL to get started.");
      return;
    }
    if (opts?.useFallbackCopy && !pastedCopy.trim()) {
      setErrorMsg("Paste your homepage copy in the box so I have something to read.");
      return;
    }

    setStage("loading");
    setScanSteps([]);
    setScreenshotUrl(null);

    const scanSequence = [
      "Loading your website...",
      "Reading your hero copy...",
      "Counting your images...",
      "Looking at your headlines...",
      "Checking your About page...",
      "Scanning for contact info...",
      "Evaluating your visual style...",
      "Drafting your report card...",
    ];
    let scanIndex = 0;
    const scanTimer = setInterval(() => {
      if (scanIndex < scanSequence.length) {
        setScanSteps((prev) => [...prev, scanSequence[scanIndex]]);
        scanIndex += 1;
      } else {
        clearInterval(scanTimer);
      }
    }, 1100);

    const requestBody: Record<string, unknown> = { url, tone };
    if (opts?.useFallbackCopy) {
      requestBody.pastedCopy = pastedCopy;
    }

    try {
      const res = await fetch("/api/report-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        clearInterval(scanTimer);
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.status === 429) {
          setErrorMsg(
            (data.message as string) ||
              "Looks like you have already pulled a Report Card recently. Try again tomorrow."
          );
          setStage("intro");
          return;
        }
        if (res.status === 422 && data.error === "thin_content") {
          setPasteFallback((data.message as string) || null);
          setStage("intro");
          return;
        }
        setErrorMsg(
          (data.message as string) ||
            "Something went wrong reading that site. Double-check the URL and try again."
        );
        setStage("intro");
        return;
      }

      const shotUrl = res.headers.get("x-screenshot-url");
      if (shotUrl) setScreenshotUrl(shotUrl);

      setStage("report");
      setStreaming(true);
      await consumeStream(res, (delta) => setReportText((t) => t + delta));
      setStreaming(false);
      clearInterval(scanTimer);
    } catch {
      clearInterval(scanTimer);
      setErrorMsg("Network error. Please try again.");
      setStage("intro");
    }
  }

  async function handleSendFollowup(predefinedText?: string) {
    const text = (predefinedText ?? chatInput).trim();
    if (!text || streaming || isLocked) return;
    setChatInput("");
    setErrorMsg(null);

    const newChat: ChatMessage[] = [
      ...chat.length === 0
        ? [
            { role: "user" as const, content: "(initial report request)" },
            { role: "assistant" as const, content: reportText },
          ]
        : chat,
      { role: "user" as const, content: text },
    ];
    setChat(newChat);

    setStreaming(true);
    let assistantSoFar = "";
    setChat((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/report-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          tone,
          messages: newChat,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        setErrorMsg((data.message as string) || "Something went wrong.");
        setStreaming(false);
        return;
      }

      await consumeStream(res, (delta) => {
        assistantSoFar += delta;
        setChat((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: assistantSoFar };
          return next;
        });
      });
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function handleCoachingSend(messageText: string) {
    if (coachingStreaming) return;
    const text = messageText.trim();
    if (!text) return;

    const isFirst = coachingChat.length === 0;
    const newChat: ChatMessage[] = [...coachingChat, { role: "user", content: text }];
    setCoachingChat(newChat);
    setCoachingInput("");
    setCoachingStreaming(true);
    setCoachingChat((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/report-card/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newChat,
          tone,
          focusArea: isFirst ? coachingFocus : undefined,
        }),
      });
      if (!res.ok) {
        setCoachingStreaming(false);
        return;
      }
      let acc = "";
      await consumeStream(res, (delta) => {
        acc += delta;
        setCoachingChat((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      });
    } catch {
      // ignore
    } finally {
      setCoachingStreaming(false);
    }
  }

  function handleStartCoaching(focus: string) {
    setCoachingOpen(true);
    setCoachingFocus(focus);
    setCoachingChat([]);
    handleCoachingSend(`I want to work on this. Where should I start?`);
  }

  async function handleSocialCritique(
    platform: "instagram" | "linkedin",
    opts?: { usePastedBio?: boolean }
  ) {
    const key = platform === "instagram" ? "ig" : "li";
    if (socialLoading[key]) return;

    setSocialLoading((s) => ({ ...s, [key]: true }));
    setSocialError((s) => ({ ...s, [key]: null }));
    setSocialCritiques((s) => ({ ...s, [key]: "" }));

    const pastedBio = platform === "instagram" ? igPastedBio.trim() : linkedinPastedBio.trim();
    const reqBody =
      platform === "instagram"
        ? {
            platform,
            handle: igHandle.trim(),
            tone,
            ...(opts?.usePastedBio ? { pastedBio } : {}),
          }
        : {
            platform,
            url: linkedinUrl.trim(),
            tone,
            ...(opts?.usePastedBio ? { pastedBio } : {}),
          };

    try {
      const res = await fetch("/api/report-card/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        const errorCode = data.error as string | undefined;
        setSocialError((s) => ({
          ...s,
          [key]: (data.message as string) || "Couldn't load that critique. Try again.",
        }));
        // When scraping fails for either platform, surface the pasted-bio
        // textarea so the user has a working path forward.
        if (
          errorCode === "ig_not_configured" ||
          errorCode === "ig_fetch_failed" ||
          errorCode === "li_blocked" ||
          errorCode === "li_fetch_failed"
        ) {
          if (platform === "instagram") setIgFallbackVisible(true);
          else setLinkedinFallbackVisible(true);
        }
        return;
      }
      await consumeStream(res, (delta) => {
        setSocialCritiques((s) => ({ ...s, [key]: s[key] + delta }));
      });
    } catch {
      setSocialError((s) => ({ ...s, [key]: "Network hiccup. Try again." }));
    } finally {
      setSocialLoading((s) => ({ ...s, [key]: false }));
    }
  }

  async function handleEmailReport() {
    if (sendingEmail) return;
    setEmailStatus(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInput.trim())) {
      setEmailStatus({ kind: "error", msg: "Please enter a valid email address." });
      return;
    }
    setSendingEmail(true);
    try {
      // Build a clean chat transcript: skip the synthetic placeholders, label
      // each turn as user or Lisa.
      const transcript = chat
        .slice(2)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/report-card/email-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          url,
          tone,
          reportMarkdown: reportText,
          transcript,
          headlineRewrite: headlineRewrite || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setEmailStatus({
          kind: "error",
          msg: (data.message as string) || "Couldn't send right now. Try again in a moment.",
        });
        return;
      }
      if (data.warning === "email_not_configured") {
        setEmailStatus({ kind: "warn", msg: data.message as string });
        return;
      }
      setEmailStatus({
        kind: "ok",
        msg: "Sent! Heads up: my domain is brand new, so this email might land in your spam or promotions folder. If you find it there, please mark it 'Not Spam' so I can keep reaching you.",
      });
    } catch {
      setEmailStatus({ kind: "error", msg: "Network hiccup. Try again." });
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleRewriteHeadline() {
    if (rewritingHeadline) return;
    setRewritingHeadline(true);
    setHeadlineRewrite("");
    try {
      const res = await fetch("/api/report-card/headline-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        setHeadlineRewrite(
          (data.message as string) ||
            "I couldn't pull your headline this time. Try again in a moment."
        );
        setRewritingHeadline(false);
        return;
      }
      await consumeStream(res, (delta) => setHeadlineRewrite((t) => t + delta));
    } catch {
      setHeadlineRewrite("Network error. Try again in a moment.");
    } finally {
      setRewritingHeadline(false);
    }
  }

  function handleReset() {
    setUrl("");
    setTone("big-sister");
    setStage("intro");
    setErrorMsg(null);
    setPasteFallback(null);
    setPastedCopy("");
    setReportText("");
    setChat([]);
    setChatInput("");
    setStreaming(false);
    setScreenshotUrl(null);
    setScanSteps([]);
    setHeadlineRewrite("");
    setRewritingHeadline(false);
    aGradesFiredRef.current = 0;
    setCoachingOpen(false);
    setCoachingFocus("");
    setCoachingChat([]);
    setCoachingInput("");
    setCoachingStreaming(false);
    setIgHandle("");
    setIgPastedBio("");
    setLinkedinUrl("");
    setLinkedinPastedBio("");
    setSocialCritiques({ ig: "", li: "" });
    setSocialError({ ig: null, li: null });
    setIgFallbackVisible(false);
    setLinkedinFallbackVisible(false);
    setEmailInput("");
    setEmailStatus(null);
    setStep1Done(false);
    setStep2Done(false);
    setSocialRevealed(false);
    setFocusEngaged(false);
  }

  return (
    <main className="rc-container">
      {stage === "intro" && (
        <>
          <header className="rc-hero">
            <p className="rc-eyebrow">Free Tool from LiLo</p>
            <h1>
              Your Website,
              <br />
              <em>Honestly Reviewed.</em>
            </h1>
            <p className="rc-hero-sub">
              Paste your website URL below. I'll read it like a fresh visitor and
              give you a real, encouraging report card on what's working and
              what could be stronger.
            </p>
          </header>

          <div className="rc-form">
            <label className="rc-label" htmlFor="rc-url">
              Your Website URL
            </label>
            <input
              id="rc-url"
              className="rc-input"
              type="url"
              placeholder="yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="url"
              inputMode="url"
            />

            <div style={{ marginTop: 22 }}>
              <p className="rc-label" style={{ marginBottom: 10 }}>
                What kind of report do you want?
              </p>
              <div className="rc-tone-row">
                <button
                  type="button"
                  className={`rc-tone-option ${tone === "big-sister" ? "selected" : ""}`}
                  onClick={() => setTone("big-sister")}
                >
                  <p className="rc-tone-name">Big Sister</p>
                  <p className="rc-tone-desc">
                    Encouraging, kind, cheerleader energy. Like a trusted friend.
                  </p>
                </button>
                <button
                  type="button"
                  className={`rc-tone-option ${tone === "all-business" ? "selected" : ""}`}
                  onClick={() => setTone("all-business")}
                >
                  <p className="rc-tone-name">All Business</p>
                  <p className="rc-tone-desc">
                    Direct, strategic, business-coach feedback that moves the needle.
                  </p>
                </button>
              </div>
            </div>

            {pasteFallback && (
              <div className="rc-error" style={{ marginBottom: 16 }}>
                {pasteFallback}
              </div>
            )}

            {pasteFallback && (
              <textarea
                className="rc-fallback-textarea"
                placeholder="Paste your homepage copy here..."
                value={pastedCopy}
                onChange={(e) => setPastedCopy(e.target.value)}
              />
            )}

            {errorMsg && <div className="rc-error">{errorMsg}</div>}

            <button
              type="button"
              className="rc-button"
              onClick={() => handleStart({ useFallbackCopy: !!pasteFallback })}
              disabled={!url.trim()}
            >
              Get My Report Card
            </button>
          </div>

        </>
      )}

      {stage === "loading" && (
        <div className="rc-loading">
          <p className="rc-eyebrow">Reading Your Site</p>
          <h2 style={{ fontSize: 26, marginTop: 12, marginBottom: 24 }}>
            Looking at your website now...
          </h2>
          <ul className="rc-scan-feed">
            {scanSteps.map((step, i) => (
              <li key={i} className="rc-scan-step">
                <span className="rc-scan-check">✓</span> {step}
              </li>
            ))}
            {scanSteps.length < 8 && (
              <li className="rc-scan-step rc-scan-step-active">
                <span className="rc-loading-pulse" />
                <span className="rc-loading-pulse" />
                <span className="rc-loading-pulse" />
              </li>
            )}
          </ul>
          <p style={{ color: "var(--rc-gray)", marginTop: 24, fontSize: 13 }}>
            This usually takes 10 to 30 seconds.
          </p>
        </div>
      )}

      {stage === "report" && (
        <>
          <header style={{ marginBottom: 12 }}>
            <p className="rc-eyebrow">Your Report Card</p>
            <h1 style={{ fontSize: 32, marginBottom: 4 }}>
              Here's what I see.
            </h1>
            <p style={{ color: "var(--rc-gray)", margin: 0, fontSize: 14 }}>
              Reviewing: <strong>{url}</strong> · Tone:{" "}
              <strong>{tone === "big-sister" ? "Big Sister" : "All Business"}</strong>
            </p>
          </header>

          {screenshotUrl && (
            <figure className="rc-screenshot">
              <img src={screenshotUrl} alt="Live preview of your website" />
              <figcaption>Live preview of your site, exactly as I'm reading it.</figcaption>
            </figure>
          )}

          {reportText && (() => {
            // Populate the big grade cards in real time as the AI streams the
            // table rows in. This makes the cards the first prominent thing
            // the user sees, not something that appears only after the full
            // report finishes streaming.
            const grades = parseGradeTable(reportText);
            if (grades.length === 0) return null;
            return (
              <section className="rc-grade-grid" aria-label="Grade summary">
                {grades.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    className="rc-grade-card"
                    onClick={() => {
                      const target = document.getElementById(`category-${g.slug}`);
                      if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                  >
                    <p className="rc-grade-category">{g.category}</p>
                    <p
                      className="rc-grade-letter"
                      style={{ color: gradeColor(g.grade) }}
                    >
                      {g.grade}
                    </p>
                    <p className="rc-grade-note">{g.note}</p>
                  </button>
                ))}
              </section>
            );
          })()}

          <article className="rc-report">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: (props) => {
                  const text = extractText(props.children);
                  return <h2 id={`category-${slugify(text)}`}>{props.children}</h2>;
                },
                h3: (props) => {
                  const text = extractText(props.children);
                  return <h3 id={`category-${slugify(text)}`}>{props.children}</h3>;
                },
              }}
            >
              {reportText || "_Generating your report..._"}
            </ReactMarkdown>
          </article>

          {/* Funnel chat: stays visible even while streaming, so the user
              always sees what they just clicked + the "Lisa is writing..."
              indicator while she works. NOT gated on !streaming. */}
          {reportText && chat.length > 2 && (
            <div className="rc-funnel-chat">
              {chat.slice(2).map((m, idx) => {
                if (m.role === "assistant" && !m.content) {
                  return (
                    <div key={idx} className="rc-chat-msg rc-chat-msg-assistant rc-thinking">
                      <p className="rc-thinking-label">Lisa is writing...</p>
                      <div className="rc-thinking-dots">
                        <span className="rc-loading-pulse" />
                        <span className="rc-loading-pulse" />
                        <span className="rc-loading-pulse" />
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={idx}
                    className={`rc-chat-msg ${
                      m.role === "user" ? "rc-chat-msg-user" : "rc-chat-msg-assistant"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!streaming && reportText && (
            <>
              {/* Step 2: Focus suggestions */}
              {!focusDone && (
                <div className="rc-funnel-card">
                  <p className="rc-rewrite-eyebrow">Step 2 of 5</p>
                  <h2 className="rc-funnel-title">Ready to focus your improvements?</h2>
                  <p className="rc-funnel-body">
                    I'll walk you through what to focus on first in each area of your report, with the why behind it. Real, specific, and actionable.
                  </p>
                  <div className="rc-step-branch">
                    <button
                      type="button"
                      className="rc-button rc-button-secondary"
                      onClick={handleStep2Skip}
                    >
                      Skip This Step
                    </button>
                    <button
                      type="button"
                      className="rc-button"
                      onClick={handleStep2Focus}
                    >
                      Yes, Show Me Where to Focus
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Tagline rewrite */}
              {focusDone && !taglineDone && !rewritingHeadline && !headlineRewrite && (
                <div className="rc-funnel-card">
                  <p className="rc-rewrite-eyebrow">Step 3 of 5</p>
                  <h2 className="rc-funnel-title">Want a stronger headline for your site?</h2>
                  <p className="rc-funnel-body">
                    Let me rewrite your homepage headline in Lisa's voice. A tiny taste of what working on your messaging together looks like.
                  </p>
                  <div className="rc-step-branch">
                    <button
                      type="button"
                      className="rc-button rc-button-secondary"
                      onClick={handleStep3Skip}
                      disabled={rewritingHeadline}
                    >
                      Skip This Step
                    </button>
                    <button
                      type="button"
                      className="rc-button"
                      onClick={handleStep3Tagline}
                      disabled={rewritingHeadline}
                    >
                      Rewrite My Headline
                    </button>
                  </div>
                </div>
              )}

              {(headlineRewrite || rewritingHeadline) && (
                <article className="rc-rewrite-output">
                  <p className="rc-eyebrow">A Stronger Headline</p>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {headlineRewrite || "_Writing..._"}
                  </ReactMarkdown>
                </article>
              )}

              {/* Step 4: Instagram critique reveal */}
              {taglineDone && !rewritingHeadline && !socialRevealed && (
                <div className="rc-funnel-card">
                  <p className="rc-rewrite-eyebrow">Step 4 of 5</p>
                  <h2 className="rc-funnel-title">Want me to look at your Instagram too?</h2>
                  <p className="rc-funnel-body">
                    Your Instagram is often the first place a potential client checks before they buy. If your IG and your website don't match, that disconnect costs you trust. Drop your handle and I'll critique it.
                  </p>
                  <div className="rc-step-branch">
                    <button
                      type="button"
                      className="rc-button rc-button-secondary"
                      onClick={handleStep4Skip}
                    >
                      Skip This Step
                    </button>
                    <button
                      type="button"
                      className="rc-button"
                      onClick={handleStep4Social}
                    >
                      Yes, Critique My Instagram
                    </button>
                  </div>
                </div>
              )}

              {socialRevealed && (
                <section className="rc-social-section">
                  <p className="rc-rewrite-eyebrow">Step 4: Instagram Critique</p>
                  <h2 style={{ fontSize: 22, marginTop: 6 }}>
                    Drop your handle, get a quick read.
                  </h2>
                  <p style={{ color: "var(--rc-gray)", margin: "8px 0 20px", fontSize: 14 }}>
                    Just the @ handle, no need for the full URL.
                  </p>

                  <div className="rc-social-platform">
                    <label className="rc-label">Instagram Handle</label>
                    <div className="rc-email-row">
                      <input
                        className="rc-input"
                        type="text"
                        placeholder="@yourhandle"
                        value={igHandle}
                        onChange={(e) => setIgHandle(e.target.value)}
                        disabled={socialLoading.ig}
                      />
                      <button
                        type="button"
                        className="rc-button"
                        style={{ width: "auto", padding: "14px 22px" }}
                        onClick={() => handleSocialCritique("instagram")}
                        disabled={socialLoading.ig || !igHandle.trim()}
                      >
                        {socialLoading.ig ? "Reading..." : "Critique My Instagram"}
                      </button>
                    </div>
                    {socialError.ig && <p className="rc-error">{socialError.ig}</p>}
                    {igFallbackVisible && (
                      <div style={{ marginTop: 12 }}>
                        <label className="rc-label">Or paste your Instagram bio</label>
                        <textarea
                          className="rc-fallback-textarea"
                          placeholder="Paste your IG bio here. (Name, bio text, link, anything you'd want a stranger to see.)"
                          value={igPastedBio}
                          onChange={(e) => setIgPastedBio(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rc-button rc-button-secondary"
                          style={{ width: "auto", padding: "12px 22px" }}
                          onClick={() => handleSocialCritique("instagram", { usePastedBio: true })}
                          disabled={socialLoading.ig || !igPastedBio.trim()}
                        >
                          {socialLoading.ig ? "Reading..." : "Critique This Bio"}
                        </button>
                      </div>
                    )}
                    {socialCritiques.ig && (
                      <article className="rc-social-output">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {socialCritiques.ig}
                        </ReactMarkdown>
                      </article>
                    )}
                  </div>
                </section>
              )}

              {/* After Step 4 (social revealed/skipped), the closing of the
                  experience: Lisa's bio first, then offers, then email. No
                  more steps to click through. */}
              {socialRevealed && <LisaBioBlock />}

              {socialRevealed && <OfferGrid />}


              {socialRevealed && (
                <section className="rc-email-block rc-email-block-final">
                  <p className="rc-rewrite-eyebrow">Save Everything</p>
                  <h2 className="rc-funnel-title">
                    Want all of this emailed to you?
                  </h2>
                  <p className="rc-funnel-body">
                    Pop in your email and I'll send your full report, the focus suggestions, your headline rewrite, and your Instagram critique if you got one. All in one keeper email.
                  </p>
                  <div className="rc-email-row">
                    <input
                      className="rc-input"
                      type="email"
                      placeholder="you@yourbusiness.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      disabled={sendingEmail}
                      autoComplete="email"
                    />
                    <button
                      type="button"
                      className="rc-button"
                      style={{ width: "auto", padding: "14px 22px" }}
                      onClick={handleEmailReport}
                      disabled={sendingEmail || !emailInput.trim()}
                    >
                      {sendingEmail ? "Sending..." : "Email Me Everything"}
                    </button>
                  </div>
                  {emailStatus && (
                    <p
                      className={
                        emailStatus.kind === "ok"
                          ? "rc-email-success"
                          : emailStatus.kind === "warn"
                          ? "rc-email-warn"
                          : "rc-error"
                      }
                    >
                      {emailStatus.msg}
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {errorMsg && <div className="rc-error">{errorMsg}</div>}
        </>
      )}
    </main>
  );
}

/* The four ways Lisa works with clients. URLs link to her services page or
   her Honeybook booking flow; specific course/photo URLs can be wired in later
   without touching this component. */
const OFFERS = [
  {
    name: "Build a Brand Course",
    price: "$250",
    bestFor: "Doing the foundation work yourself, on your own schedule.",
    desc: "5 AI-guided workshops covering the 5 V's: Vision, Value, Voice, Visuals, Visibility. Walk out with a downloadable Brand Guide.",
    cta: "Start the Course",
    href: "https://photolilo.com/services",
  },
  {
    name: "1:1 Strategy Call",
    price: "$300",
    bestFor: "One specific brand problem you want to solve fast.",
    desc: "60 minutes, just you and Lisa. Bring your stuck point, leave with a clear plan you can act on this week.",
    cta: "Book a Call",
    href: "https://lilophotography.hbportal.co/public/65abf3aff8ee2603601c6158",
  },
  {
    name: "Brand Photography",
    price: "From $2,500",
    bestFor: "You have your messaging dialed but your visuals are holding you back.",
    desc: "A professional brand photo session aligned to your strategy, so every visual on your site, social, and ads pulls its weight.",
    cta: "See the Sessions",
    href: "https://photolilo.com/services",
  },
  {
    name: "The Full Brand Experience",
    price: "From $7,500",
    bestFor: "You're ready to rebuild it ALL with one partner, end to end.",
    desc: "Strategy plus voice plus visuals plus website plus photography. One cohesive brand, done with you, all in one package.",
    cta: "Explore the Full Brand",
    href: "https://photolilo.com/services",
  },
];

function OfferGrid() {
  return (
    <section className="rc-offer-grid" aria-label="All ways to work with Lisa">
      <header className="rc-offer-grid-header">
        <p className="rc-rewrite-eyebrow">Ways To Work Together</p>
        <h2 className="rc-funnel-title" style={{ marginBottom: 4 }}>
          Whatever stage you're in, I have a way to meet you there.
        </h2>
      </header>
      <div className="rc-offer-cards">
        {OFFERS.map((o) => (
          <article key={o.name} className="rc-offer-card">
            <div className="rc-offer-card-top">
              <h3 className="rc-offer-name">{o.name}</h3>
            </div>
            <p className="rc-offer-best-for">
              <strong>Best for:</strong> {o.bestFor}
            </p>
            <p className="rc-offer-desc">{o.desc}</p>
            <a
              href={o.href}
              target="_blank"
              rel="noreferrer"
              className="rc-offer-cta"
            >
              {o.cta} &rarr;
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function LisaBioBlock() {
  return (
    <section className="rc-bio-block">
      <p className="rc-rewrite-eyebrow">About Lisa</p>
      <h2 className="rc-funnel-title">
        Hey, I'm Lisa, also known as LiLo.
      </h2>
      <p className="rc-bio-body">
        My whole goal is to help business owners build their brand and grow
        their business, taking it from DIY to CEO. I work in a framework I call
        the <strong>5 V's of branding</strong>: Vision, Value, Voice, Visuals, and
        Visibility. Get clarity on those five and your brand stops feeling like
        a side hustle. That's exactly what I do for my clients through strategy,
        voice work, photography, and full brand experiences. Whatever stage
        you're at, I have a way to meet you there.
      </p>
      <div className="rc-bio-cta-row">
        <a
          href="https://photolilo.com/services"
          target="_blank"
          rel="noreferrer"
          className="rc-button"
          style={{ width: "auto", padding: "14px 28px" }}
        >
          See How I Can Help You
        </a>
        <a
          href="https://lilophotography.hbportal.co/public/65abf3aff8ee2603601c6158"
          target="_blank"
          rel="noreferrer"
          className="rc-button rc-button-secondary"
          style={{ width: "auto", padding: "14px 28px" }}
        >
          Book a Free Consult Call
        </a>
      </div>
    </section>
  );
}

async function consumeStream(
  res: Response,
  onChunk: (text: string) => void
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

type ParsedGrade = {
  category: string;
  grade: string;
  note: string;
  slug: string;
};

function parseGradeTable(markdown: string): ParsedGrade[] {
  // Find the first markdown table that looks like a grade chart.
  const lines = markdown.split("\n");
  const grades: ParsedGrade[] = [];
  let inTable = false;
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    if (/^\|[\s\-:|]+\|$/.test(line)) {
      headerSeen = true;
      inTable = true;
      continue;
    }
    if (!headerSeen) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    const category = cells[0].replace(/\*\*/g, "").trim();
    const grade = cells[1].replace(/\*\*/g, "").trim();
    const note = (cells[2] || "").replace(/\*\*/g, "").trim();
    if (!/^[A-F][+\-]?$/i.test(grade) && !/^N\/?A$/i.test(grade)) continue;
    grades.push({
      category,
      grade,
      note,
      slug: slugify(category),
    });
  }
  return grades;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function extractText(node: React.ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children: React.ReactNode } }).props.children);
  }
  return "";
}

function pickWeakest(grades: ParsedGrade[]): ParsedGrade {
  const order: Record<string, number> = {
    "A+": 1, A: 2, "A-": 3,
    "B+": 4, B: 5, "B-": 6,
    "C+": 7, C: 8, "C-": 9,
    "D+": 10, D: 11, "D-": 12,
    F: 13,
  };
  return [...grades].sort((a, b) => {
    const ax = order[a.grade.toUpperCase()] ?? 99;
    const bx = order[b.grade.toUpperCase()] ?? 99;
    return bx - ax;
  })[0];
}

function gradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "#af493b"; // red, the strongest
  if (g.startsWith("B")) return "#000000"; // black
  if (g.startsWith("C")) return "#747474"; // gray
  if (g.startsWith("D") || g.startsWith("F")) return "#747474";
  return "#747474";
}

function fireConfetti() {
  if (typeof window === "undefined") return;
  const palette = ["#af493b", "#e8bb5c", "#000000"];
  confetti({
    particleCount: 36,
    spread: 70,
    startVelocity: 28,
    origin: { x: 0.5, y: 0.35 },
    colors: palette,
    scalar: 0.85,
    ticks: 120,
  });
}
