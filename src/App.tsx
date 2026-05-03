import { useState, useRef, useEffect, useCallback } from "react";

// No special types needed — uses MediaRecorder + Anthropic transcription

interface Story { id: string; cat: string; emoji: string; title: string; src: string; S: string; T: string; A: string; R: string; X: string; tags: string[]; }
interface QAItem { q: string; lead: string[]; alt?: string[]; note: string; }
interface Score { structure: number; specificity: number; conciseness: number; note: string; }
interface Message { who: "user" | "ai"; text: string; score?: Score; scoring?: boolean; elapsed?: number; }
interface HistoryItem { role: string; content: string; }
interface PrepStory { id: string; title: string; emoji: string; reason: string; rank: number; }
interface PrepResult { stories: PrepStory[]; questions: string[]; gaps: string; opener: string; }
interface SessionRecord { ts: number; question: string; storyId: string; storyTitle: string; answer: string; elapsed: number; score: Score; }

const STORIES: Story[] = [
  // ─────────────────────────────────────────────────────────────
  // Replace these placeholder stories with your own.
  // Each story follows the STAR format:
  //   S = Situation (context and background)
  //   T = Task (what you were responsible for)
  //   A = Action (specifically what YOU did)
  //   R = Result (measurable outcome)
  //   X = Reflection (what it demonstrates about you)
  // ─────────────────────────────────────────────────────────────
  {
    id: "example-migration",
    cat: "Change Mgmt",
    emoji: "🔄",
    title: "Example: Large-scale platform migration",
    src: "Company Name · Year–Year",
    S: "Describe the context. What was happening, why did it matter, how many people were affected?",
    T: "What were you specifically responsible for delivering? What made it challenging?",
    A: "What did YOU do? Be specific — tools used, decisions made, people involved, obstacles overcome.",
    R: "What was the measurable outcome? Include numbers where possible (%, time saved, users impacted).",
    X: "What does this story demonstrate about the way you work? What's the one thing you'd want an interviewer to take away?",
    tags: ["change management", "stakeholder management", "large-scale migrations"]
  },
  {
    id: "example-automation",
    cat: "Automation",
    emoji: "⚙️",
    title: "Example: Process automation project",
    src: "Company Name · Year–Year",
    S: "What manual process existed? What problem did it create — time waste, errors, compliance risk?",
    T: "What were you tasked with building or improving? What were the constraints?",
    A: "What did you build? What tools, languages, or systems did you use? What was hardest to solve?",
    R: "How much time did it save? What error rate dropped? What risk was eliminated?",
    X: "What principle about automation, systems, or reliability does this story illustrate?",
    tags: ["automation", "process improvement", "reducing toil"]
  },
  {
    id: "example-incident",
    cat: "Incident Response",
    emoji: "🚨",
    title: "Example: High-pressure incident or outage",
    src: "Company Name · Year–Year",
    S: "What broke, when, how bad was it? How many people were affected? What was the business impact?",
    T: "What was your role in the response? Were you the sole owner or part of a team?",
    A: "Walk through your actions step by step. How did you triage? How did you communicate? What decisions did you make under pressure?",
    R: "How was it resolved? How long did it take? What was the final impact vs. the potential impact?",
    X: "What does this story say about how you operate under pressure and communicate with stakeholders?",
    tags: ["incident response", "communication under pressure", "working independently"]
  },
  {
    id: "example-mentoring",
    cat: "Leadership",
    emoji: "👥",
    title: "Example: Mentoring or developing someone",
    src: "Company Name · Year–Year",
    S: "Who did you mentor? What was their starting point? Why did this matter?",
    T: "What were you trying to help them achieve? Was this formal or something you took on yourself?",
    A: "How did you approach it? What did you teach, model, or document? How did you make the knowledge transfer durable?",
    R: "What did they go on to do? What capability was built that outlasted your direct involvement?",
    X: "What does this show about how you invest in the people around you?",
    tags: ["mentoring", "knowledge transfer", "team development"]
  },
  {
    id: "example-exec",
    cat: "Exec Support",
    emoji: "⭐",
    title: "Example: High-stakes executive support",
    src: "Company Name · Year–Year",
    S: "What was the event or context? Who were the stakeholders? What was the margin for error?",
    T: "What did you need to deliver? What made it high-stakes?",
    A: "How did you prepare? What backup plans did you build? How did you handle it when something went wrong (or almost did)?",
    R: "What was the outcome? How did the executive or stakeholder respond?",
    X: "What does this story say about your approach to reliability and professional judgment?",
    tags: ["executive support", "high-stakes environments", "reliability under pressure"]
  },
];

const QA: QAItem[] = [
  // ─────────────────────────────────────────────────────────────
  // Map each common behavioral question to the story id(s) you'd
  // lead with. Update the ids to match your own STORIES above.
  // "lead" = your best story for this question
  // "alt"  = backup story if they want another example
  // "note" = coaching note to yourself on WHY this story fits
  // ─────────────────────────────────────────────────────────────
  { q: "Tell me about yourself", lead: ["example-migration", "example-automation"], note: "Use this to tell your career arc — where you started, what you built, where you're going." },
  { q: "Most impactful project", lead: ["example-automation"], alt: ["example-migration"], note: "Lead with the story that has the strongest measurable result." },
  { q: "Reduced costs or improved efficiency", lead: ["example-automation"], note: "Make sure to quantify — time saved, cost reduced, errors eliminated." },
  { q: "Automated something", lead: ["example-automation"], note: "Be specific about the tools and the compliance or reliability win." },
  { q: "Worked with executives", lead: ["example-exec"], note: "Lead with volume and consistency, not just one heroic moment." },
  { q: "Delivered under a tight deadline", lead: ["example-migration"], alt: ["example-incident"], note: "Emphasize what you controlled vs. what you couldn't, and how you tracked dependencies." },
  { q: "Improved a process", lead: ["example-automation"], alt: ["example-mentoring"], note: "The best process stories show durability — it kept working after you stepped away." },
  { q: "Trained or mentored someone", lead: ["example-mentoring"], note: "Focus on the capability you built in someone else, not just what you taught." },
  { q: "Dealt with pushback or a difficult stakeholder", lead: ["example-migration"], note: "Show that you distinguished legitimate concerns from resistance — and acted on the distinction." },
  { q: "Failed or made a mistake", lead: ["example-incident"], note: "Reframe as an inherited problem you diagnosed and fixed, or a risk you caught just in time." },
  { q: "Influenced without authority", lead: ["example-migration"], note: "You made the case with data before go-live — without having formal authority to make the call." },
  { q: "Worked independently or without direction", lead: ["example-incident"], alt: ["example-migration"], note: "Pick the story where you had the least support and the most ownership." },
  { q: "Handled a high-pressure situation or incident", lead: ["example-incident"], alt: ["example-exec"], note: "Walk through your triage logic and communication — not just the resolution." },
  { q: "Proactively identified a problem before it became one", lead: ["example-automation"], note: "The key is that no one assigned this to you — you saw the gap and acted." },
  { q: "Communicated technical concepts to non-technical stakeholders", lead: ["example-migration"], note: "Show how you translated complexity into a decision, not just an explanation." },
  { q: "What's your greatest strength", lead: ["example-automation"], note: "Lead with systems thinking — you don't just fix problems, you remove the conditions that cause them." },
  { q: "What's your greatest weakness", lead: [], note: "Answer directly. Pick something real, specific, and with a genuine mitigation. No 'I work too hard.'" },
  { q: "Why do you want this role / why are you leaving", lead: [], note: "Answer specifically to the company and role. Lead with what draws you forward, not what you're leaving behind." },
];

const CAT_COLORS: Record<string, string> = {
  "Change Mgmt": "#1a6b5c", "Infrastructure": "#1a4a7a", "Cost Reduction": "#5c3d9e",
  "Automation": "#7a3d1a", "Exec Support": "#8a1a4a", "Speed & Exec": "#1a5c3d",
  "Training": "#4a5c1a", "Foundation": "#3d3d3d", "Incident Response": "#7a1a1a",
};

const STORY_SUMMARIES = STORIES.map(s => ({
  id: s.id, emoji: s.emoji, title: s.title, cat: s.cat, tags: s.tags,
  result: s.R, src: s.src
}));

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TimerBadge({ sec }: { sec: number }) {
  const color = sec < 90 ? "#00e5a0" : sec < 120 ? "#f1c40f" : "#e74c3c";
  const label = sec < 90 ? "on pace" : sec < 120 ? "wrapping up" : "too long";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: `${color}15`, border: `1px solid ${color}40` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />
      <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color, fontWeight: 500 }}>{fmt(sec)}</span>
      <span style={{ fontSize: 10, color: `${color}99` }}>{label}</span>
    </div>
  );
}

function ScoreDot({ val }: { val: number }) {
  const colors = ["#555", "#c0392b", "#e67e22", "#f1c40f", "#2ecc71", "#00e5a0"];
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i <= val ? colors[val] : "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

function ScoreCard({ score }: { score: Score }) {
  const border = "rgba(255,255,255,0.08)", muted = "rgba(255,255,255,0.4)";
  const avg = Math.round((score.structure + score.specificity + score.conciseness) / 3);
  const label = ["", "Needs work", "Developing", "Solid", "Strong", "Excellent"][avg] || "";
  return (
    <div style={{ marginTop: 6, background: "#141414", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", maxWidth: "88%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".05em" }}>Score</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: avg >= 4 ? "#00e5a0" : avg >= 3 ? "#f1c40f" : "#e67e22" }}>{label}</span>
      </div>
      {([ ["Structure", score.structure], ["Specificity", score.specificity], ["Conciseness", score.conciseness] ] as [string, number][]).map(([l, v]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: muted }}>{l}</span>
          <ScoreDot val={v} />
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}`, fontSize: 12, lineHeight: "1.5", color: "rgba(255,255,255,0.6)" }}>{score.note}</div>
    </div>
  );
}

export default function StoryBank() {
  const [tab, setTab] = useState("stories");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [qaOpen, setQaOpen] = useState<number | null>(null);
  const [selQ, setSelQ] = useState(0);
  const [selS, setSelS] = useState("zoom");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [coldOpen, setColdOpen] = useState(false);
  const [coldReveal, setColdReveal] = useState<string | null>(null);

  // Session history
  const [sessions, setSessions] = useState<SessionRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("rl_sessions") || "[]"); } catch { return []; }
  });

  // Mic / STT
  const [micOn, setMicOn] = useState(false);
  const [micErr, setMicErr] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // API keys
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem("rl_api_key") || ""; } catch { return ""; } });
  const [groqKey, setGroqKey] = useState(() => { try { return localStorage.getItem("rl_groq_key") || ""; } catch { return ""; } });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [groqDraft, setGroqDraft] = useState("");

  // Talk-time tracker
  const [talkSec, setTalkSec] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Company prep
  const [prepCompany, setPrepCompany] = useState("");
  const [prepTitle, setPrepTitle] = useState("");
  const [prepJD, setPrepJD] = useState("");
  const [prepUrl, setPrepUrl] = useState("");
  const [prepUrlLoading, setPrepUrlLoading] = useState(false);
  const [prepUrlErr, setPrepUrlErr] = useState("");
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepResult, setPrepResult] = useState<PrepResult | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const activeStoryRef = useRef<Story | null>(null);
  const activeQRef = useRef<QAItem | null>(null);

  function saveKey() {
    const k = keyDraft.trim();
    try { localStorage.setItem("rl_api_key", k); } catch {}
    setApiKey(k); setKeyDraft(""); setShowKeyInput(false);
  }

  function saveGroqKey() {
    const k = groqDraft.trim();
    try { localStorage.setItem("rl_groq_key", k); } catch {}
    setGroqKey(k); setGroqDraft("");
  }

  async function fetchJobUrl() {
    if (!prepUrl.trim()) return;
    setPrepUrlLoading(true); setPrepUrlErr(""); setPrepJD("");
    try {
      const res = await fetch(`/api/fetch-job?url=${encodeURIComponent(prepUrl.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not fetch page.");
      const trimmed = (data.text || "").slice(0, 3000);
      setPrepJD(trimmed);
      // Auto-fill company from API response (most reliable) — falls back to URL
      if (!prepCompany.trim()) {
        if (data.company) {
          setPrepCompany(data.company);
        } else {
          try {
            const hostname = new URL(prepUrl.trim()).hostname.replace("www.", "");
            const co = hostname.split(".")[0];
            setPrepCompany(co.charAt(0).toUpperCase() + co.slice(1));
          } catch {}
        }
      }
      // Auto-fill role title from API response
      if (!prepTitle.trim() && data.title) {
        setPrepTitle(data.title);
      }
    } catch (e: unknown) {
      setPrepUrlErr(e instanceof Error ? e.message : "Failed to fetch URL. Try pasting the job description manually.");
    }
    setPrepUrlLoading(false);
  }

  function apiHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
  }

  async function startMic() {
    setMicErr("");
    if (!groqKey) { setMicErr("Add your Groq key first — tap 🔑 in the header."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const audioMime = mimeType.split(";")[0] || "audio/webm";
      const ext = audioMime.includes("mp4") ? "mp4" : "webm";

      // rolling buffer — we accumulate ALL chunks and re-transcribe on each tick
      // so Whisper always has full context and words don't get cut at boundaries
      const allChunks: BlobPart[] = [];

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      let transcribing = false;
      let pendingTranscribe = false;

      async function transcribeLatest() {
        if (transcribing) { pendingTranscribe = true; return; }
        if (allChunks.length === 0) return;
        transcribing = true;
        pendingTranscribe = false;
        try {
          const blob = new Blob([...allChunks], { type: audioMime });
          if (blob.size < 1000) { transcribing = false; return; } // skip tiny chunks
          const formData = new FormData();
          formData.append("file", blob, `audio.${ext}`);
          formData.append("model", "whisper-large-v3-turbo");
          formData.append("language", "en");
          const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}` },
            body: formData
          });
          const data = await resp.json();
          if (data.error) throw new Error(data.error.message);
          const transcript: string = (data.text || "").trim();
          // Replace the current interim text with the fresh full transcription
          setInput(prev => {
            const base = prev.replace(/​.*$/s, "").trimEnd(); // strip previous interim
            return (base ? base + " " : "") + transcript + "​";
          });
        } catch { /* silent — will retry on next chunk */ }
        transcribing = false;
        if (pendingTranscribe) transcribeLatest();
      }

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          allChunks.push(e.data);
          setTranscribing(true);
          await transcribeLatest();
          setTranscribing(false);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setMicOn(false);
        // Final pass — strip the zero-width marker and clean up
        setInput(prev => prev.replace(/​.*$/s, "").trim());
      };

      recorder.start(4000); // send a chunk every 4 seconds
      recorderRef.current = recorder;
      setMicOn(true);
      startTimer();
    } catch {
      setMicErr("Microphone access denied. Check browser permissions.");
    }
  }

  function stopMic() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function toggleMic() { micOn ? stopMic() : startMic(); }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    setTimerOn(true);
    timerRef.current = setInterval(() => setTalkSec(s => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerOn(false);
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer(); setTalkSec(0);
  }, [stopTimer]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const story = (id: string): Story | undefined => STORIES.find(s => s.id === id);

  async function startPractice() {
    let q = QA[selQ], s = story(selS);
    if (coldOpen) {
      const valid = QA.filter(i => i.lead.length > 0);
      q = valid[Math.floor(Math.random() * valid.length)];
      s = story(q.lead[Math.floor(Math.random() * q.lead.length)]);
      setColdReveal(null);
    }
    if (!s || !q) return;
    activeStoryRef.current = s; activeQRef.current = q;
    historyRef.current = []; setMessages([]); setStarted(false); setLoading(true); resetTimer();

    const sys = coldOpen
      ? `You are a senior tech hiring manager interviewing Robin Letim, Senior IT Engineer. Ask the question naturally — no preamble, no hints about which story to use. After Robin answers, give 2-3 sentences of honest coaching feedback, then ask ONE targeted follow-up.`
      : `You are a senior tech hiring manager interviewing Robin Letim, Senior IT Engineer.\nStory: ${s.title} | S: ${s.S} | T: ${s.T} | A: ${s.A} | R: ${s.R}\nYou are asking: "${q.q}"\nOpen by asking naturally — no preamble. After Robin answers, give 2-3 sentences of coaching feedback, then ONE targeted follow-up. Be direct and IT/engineering-specific.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: apiHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, system: sys, messages: [{ role: "user", content: `[Begin. Ask me: "${q.q}"]` }] }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const txt: string = data.content?.[0]?.text || "Error starting session.";
      historyRef.current = [{ role: "user", content: `[Begin. Ask me: "${q.q}"]` }, { role: "assistant", content: txt }];
      setMessages([{ who: "ai", text: txt }]);
      setStarted(true);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      const msg = !apiKey
        ? "⚠️ No API key set. Tap the 🔑 icon to add your Anthropic API key."
        : `⚠️ API error: ${err}`;
      setMessages([{ who: "ai", text: msg }]); setStarted(true);
    }
    setLoading(false);
  }

  async function sendMsg() {
    if (!input.trim() || loading) return;
    if (micOn) stopMic();
    const text = input.trim(), elapsed = talkSec;
    setInput(""); resetTimer();
    setMessages(m => [...m, { who: "user" as const, text, elapsed }]);
    setLoading(true);
    const s = activeStoryRef.current; if (!s) return;
    const sys = `You are a senior tech hiring manager interviewing Robin Letim (Senior IT Engineer).\nStory: ${s.title} | S: ${s.S} | T: ${s.T} | A: ${s.A} | R: ${s.R}\nGive 2-3 sentences of specific coaching feedback on Robin's last answer, then ask one targeted follow-up. Be direct and concrete.`;
    historyRef.current.push({ role: "user", content: text });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: apiHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, system: sys, messages: historyRef.current.slice(-8) }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const txt: string = data.content?.[0]?.text || "Error.";
      historyRef.current.push({ role: "assistant", content: txt });
      setMessages(m => [...m, { who: "ai" as const, text: txt }]);
      if (coldOpen && !coldReveal && activeStoryRef.current) setColdReveal(activeStoryRef.current.id);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setMessages(m => [...m, { who: "ai" as const, text: `⚠️ Error: ${err}` }]);
    }
    setLoading(false);
  }

  async function scoreMessage(idx: number, answerText: string) {
    setMessages(m => m.map((msg, i) => i === idx ? { ...msg, scoring: true } : msg));
    const q = activeQRef.current, s = activeStoryRef.current;
    const sys = `You are an IT interview coach. Score this behavioral answer on three dimensions each 1-5:\n- structure: STAR clarity\n- specificity: concrete details/numbers/actions\n- conciseness: appropriate length, not rambling (target 90-120 sec spoken)\n\nAlso write ONE coaching sentence (most important thing to fix or reinforce).\nQuestion: "${q?.q || "behavioral"}"\n${s ? `Ideal story: ${s.title}` : ""}\n\nRespond ONLY with valid JSON, no markdown:\n{"structure":N,"specificity":N,"conciseness":N,"note":"..."}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: apiHeaders(),
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 200, system: sys, messages: [{ role: "user", content: `Score: "${answerText}". JSON only.` }] }) });
      const data = await res.json();
      const parsed: Score = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
      setMessages(m => m.map((msg, i) => i === idx ? { ...msg, scoring: false, score: parsed } : msg));
      // Save session to history
      const msg = messages[idx];
      const q = activeQRef.current;
      const s = activeStoryRef.current;
      if (msg && q && s && parsed.structure > 0) {
        const record: SessionRecord = {
          ts: Date.now(),
          question: q.q,
          storyId: s.id,
          storyTitle: s.title,
          answer: answerText,
          elapsed: msg.elapsed || 0,
          score: parsed
        };
        setSessions(prev => {
          const next = [record, ...prev].slice(0, 200); // cap at 200 sessions
          try { localStorage.setItem("rl_sessions", JSON.stringify(next)); } catch {}
          return next;
        });
      }
    } catch {
      setMessages(m => m.map((msg, i) => i === idx ? { ...msg, scoring: false, score: { structure: 0, specificity: 0, conciseness: 0, note: "Scoring failed — try again." } } : msg));
    }
  }

  async function runCompanyPrep() {
    if (!prepCompany.trim()) return;
    setPrepLoading(true); setPrepResult(null);
    const sys = `You are an interview coach for Robin Letim, Senior IT Engineer. Given a target company and role, analyze Robin's story bank and return a prep plan as JSON.

Robin's stories:
${STORY_SUMMARIES.map(s => `- id:${s.id} | ${s.emoji} ${s.title} | cat:${s.cat} | tags:${s.tags.join(", ")} | result:${s.result}`).join("\n")}

Return ONLY valid JSON (no markdown):
{
  "stories": [{"id":"...","title":"...","emoji":"...","rank":1,"reason":"1 sentence why this story fits this company/role"},
               ... (top 4-5 stories ranked by fit)],
  "questions": ["5-6 specific behavioral questions this company/role is likely to ask"],
  "gaps": "1-2 sentences on any gaps or weaknesses to prepare for given this company",
  "opener": "1 sentence positioning advice — how Robin should frame their background for this specific role"
}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800, system: sys,
          messages: [{ role: "user", content: `Company: ${prepCompany}\nRole: ${prepTitle || "Senior IT Engineer"}\n${prepJD ? `Job description excerpt:\n${prepJD.slice(0, 1000)}` : ""}` }] }) });
      const data = await res.json();
      const raw = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
      setPrepResult(JSON.parse(raw));
    } catch { setPrepResult(null); }
    setPrepLoading(false);
  }

  function handleQASelect(i: number) {
    const q = QA[i]; setSelQ(i);
    if (q.lead?.[0]) setSelS(q.lead[0]);
    setTab("practice"); setMessages([]); setStarted(false); historyRef.current = []; setColdReveal(null); resetTimer();
  }

  const bg = "#0a0a0a", surface = "#141414", border = "rgba(255,255,255,0.08)", muted = "rgba(255,255,255,0.4)", textColor = "#f0ede8";

  return (
    <div style={{ background: bg, minHeight: "100dvh", maxHeight: "100dvh", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: textColor, maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar { width:0; }
        textarea:focus { outline:none; }
        textarea { resize:none; }
        .rip:active { background:rgba(255,255,255,0.05)!important; }
        .tag-pill { display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.45);margin:2px;white-space:nowrap; }
        .toggle { position:relative;width:36px;height:20px;flex-shrink:0; }
        .toggle input { opacity:0;width:0;height:0; }
        .slider { position:absolute;inset:0;background:rgba(255,255,255,0.12);border-radius:20px;cursor:pointer;transition:.2s; }
        .slider:before { content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s; }
        input:checked+.slider { background:#00e5a0; }
        input:checked+.slider:before { transform:translateX(16px);background:#000; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        html, body { height: 100%; height: 100dvh; overflow: hidden; }
        #root { height: 100%; height: 100dvh; overflow: hidden; display: flex; flex-direction: column; }
        input, select, textarea { font-size: 16px !important; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>YN</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Your Name</div>
            <div style={{ fontSize: 11, color: muted }}>{STORIES.length} stories · your name here</div>
          </div>
          <button onClick={() => { setKeyDraft(apiKey); setGroqDraft(groqKey); setShowKeyInput(v => !v); }} title="API Keys" style={{ background: "transparent", border: `1px solid ${apiKey && groqKey ? "rgba(0,229,160,0.4)" : apiKey ? "rgba(241,196,15,0.4)" : border}`, borderRadius: 8, color: apiKey && groqKey ? "#00e5a0" : apiKey ? "#f1c40f" : muted, width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🔑</button>
        </div>
        {showKeyInput && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "14px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>Anthropic key — <span style={{ color: textColor }}>console.anthropic.com</span></div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={keyDraft} onChange={e => setKeyDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && saveKey()} placeholder="sk-ant-..." type="password" style={{ flex: 1, background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 8, color: textColor, fontFamily: "inherit", fontSize: 12, padding: "8px 10px" }} />
              <button onClick={saveKey} style={{ background: "rgba(255,255,255,0.1)", border: `1px solid ${border}`, borderRadius: 8, color: textColor, fontFamily: "inherit", fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>Save</button>
            </div>
            {apiKey && <div style={{ fontSize: 11, color: "#00e5a0", marginBottom: 10 }}>✓ Anthropic key saved</div>}
            <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>Groq key (for voice) — <span style={{ color: textColor }}>console.groq.com</span> · free</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={groqDraft} onChange={e => setGroqDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && saveGroqKey()} placeholder="gsk_..." type="password" style={{ flex: 1, background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 8, color: textColor, fontFamily: "inherit", fontSize: 12, padding: "8px 10px" }} />
              <button onClick={saveGroqKey} style={{ background: "rgba(255,255,255,0.1)", border: `1px solid ${border}`, borderRadius: 8, color: textColor, fontFamily: "inherit", fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>Save</button>
            </div>
            {groqKey && <div style={{ fontSize: 11, color: "#00e5a0", marginTop: 6 }}>✓ Groq key saved</div>}
          </div>
        )}
        <div style={{ display: "flex" }}>
          {([ ["stories","Stories"], ["qa","Q&A"], ["practice","Practice"], ["prep","Prep"], ["stats","Stats"] ] as [string,string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "transparent", border: "none", color: tab === id ? textColor : muted, fontFamily: "inherit", fontSize: 11, fontWeight: tab === id ? 500 : 400, padding: "10px 0", borderBottom: `2px solid ${tab === id ? "rgba(255,255,255,0.7)" : "transparent"}`, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STORIES ── */}
      {tab === "stories" && (
        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {STORIES.map(s => {
            const open = expanded === s.id, cc = CAT_COLORS[s.cat] ?? "#444";
            return (
              <div key={s.id} style={{ background: surface, border: `1px solid ${open ? "rgba(255,255,255,0.15)" : border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                <div className="rip" onClick={() => setExpanded(open ? null : s.id)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 20, lineHeight: "1", marginTop: 1, flexShrink: 0 }}>{s.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, background: `${cc}22`, color: cc, border: `1px solid ${cc}44`, display: "inline-block", marginBottom: 5 }}>{s.cat}</span>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: "1.4" }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{s.src}</div>
                  </div>
                  <div style={{ color: muted, fontSize: 16, flexShrink: 0, marginTop: 2 }}>{open ? "↑" : "↓"}</div>
                </div>
                {open && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${border}` }}>
                    {([ ["S","Situation"], ["T","Task"], ["A","Action"], ["R","Result"] ] as [keyof Story, string][]).map(([k, l]) => (
                      <div key={k} style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: muted, minWidth: 14, paddingTop: 2 }}>{k}</span>
                        <div><div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{l}</div>
                          <div style={{ fontSize: 13, lineHeight: "1.65", color: "rgba(255,255,255,0.85)" }}>{s[k] as string}</div></div>
                      </div>
                    ))}
                    <div style={{ marginTop: 14, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", borderLeft: "2px solid rgba(255,255,255,0.2)" }}>
                      <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Reflection</div>
                      <div style={{ fontSize: 13, lineHeight: "1.65", color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>{s.X}</div>
                    </div>
                    <div style={{ marginTop: 12 }}>{s.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}</div>
                    <button onClick={() => { setSelS(s.id); setColdOpen(false); setTab("practice"); setMessages([]); setStarted(false); resetTimer(); }} style={{ marginTop: 14, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "10px", cursor: "pointer" }}>
                      Practice this story ↗
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Q&A ── */}
      {tab === "qa" && (
        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 14, lineHeight: "1.5" }}>Tap any question to see which story to lead with and why.</div>
          {QA.map((item, i) => {
            const open = qaOpen === i;
            return (
              <div key={i} style={{ background: surface, border: `1px solid ${open ? "rgba(255,255,255,0.15)" : border}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                <div className="rip" onClick={() => setQaOpen(open ? null : i)} style={{ padding: "13px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, lineHeight: "1.4", flex: 1 }}>"{item.q}"</span>
                  <span style={{ color: muted, fontSize: 14, flexShrink: 0 }}>{open ? "↑" : "↓"}</span>
                </div>
                {open && (
                  <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${border}` }}>
                    {item.lead.length > 0 && <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Lead with</div>
                      {item.lead.map(id => { const s = story(id); if (!s) return null; return <div key={id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "7px 10px", marginBottom: 5, fontSize: 12 }}>{s.emoji} {s.title}</div>; })}
                    </div>}
                    {(item.alt?.length ?? 0) > 0 && <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Backup</div>
                      {item.alt!.map(id => { const s = story(id); if (!s) return null; return <div key={id} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", marginBottom: 5, fontSize: 12, color: muted }}>{s.emoji} {s.title}</div>; })}
                    </div>}
                    <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "9px 11px", fontSize: 12, lineHeight: "1.6", color: "rgba(255,255,255,0.6)" }}>{item.note}</div>
                    <button onClick={() => handleQASelect(i)} style={{ marginTop: 12, width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "9px", cursor: "pointer" }}>
                      Practice this question ↗
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PRACTICE ── */}
      {tab === "practice" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {!started ? (
            <div style={{ padding: "16px", overflowY: "auto" }}>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: coldOpen ? 10 : 0 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>🎯 Cold open mode</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Random question, no story hint</div></div>
                  <label className="toggle"><input type="checkbox" checked={coldOpen} onChange={e => setColdOpen(e.target.checked)} /><span className="slider" /></label>
                </div>
                {coldOpen && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: "1.5", paddingTop: 10, borderTop: `1px solid ${border}` }}>A random question fires. Answer from memory. Story reveal appears after your first response.</div>}
              </div>
              {!coldOpen && (<>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Interview question</div>
                  <select value={selQ} onChange={e => { const i = parseInt(e.target.value); setSelQ(i); const q = QA[i]; if (q.lead?.[0]) setSelS(q.lead[0]); }} style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px", appearance: "none" }}>
                    {QA.map((q, i) => <option key={i} value={i}>"{q.q}"</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Story to use</div>
                  <select value={selS} onChange={e => setSelS(e.target.value)} style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px", appearance: "none" }}>
                    {STORIES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.title}</option>)}
                  </select>
                </div>
              </>)}
              <button onClick={startPractice} disabled={loading} style={{ width: "100%", background: loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)", border: `1px solid ${loading ? border : "rgba(255,255,255,0.2)"}`, borderRadius: 12, color: loading ? muted : textColor, fontFamily: "inherit", fontSize: 14, fontWeight: 500, padding: "13px", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Starting..." : coldOpen ? "Fire random question ↗" : "Start practice session ↗"}
              </button>
              <div style={{ marginTop: 16, background: surface, borderRadius: 12, padding: "13px 14px", border: `1px solid ${border}` }}>
                <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Tips</div>
                <div style={{ fontSize: 12, lineHeight: "1.7", color: "rgba(255,255,255,0.5)" }}>• Timer starts when you tap the answer box — target 90–120 sec<br />• Tap <strong style={{ color: "rgba(255,255,255,0.7)" }}>Score ↗</strong> after any answer for structure/specificity/conciseness ratings</div>
              </div>
            </div>
          ) : (
            <>
              <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px", minHeight: 0 }}>
                {coldOpen && coldReveal && (() => { const s = story(coldReveal), q = activeQRef.current; return s ? (
                  <div style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#00e5a0", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Intended story</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{s.emoji} {s.title}</div>
                    {q && <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>Question: "{q.q}"</div>}
                  </div>) : null; })()}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.who === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: muted, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{m.who === "user" ? "You" : "Interviewer"}</span>
                      {m.who === "user" && m.elapsed !== undefined && <span style={{ fontFamily: "'DM Mono',monospace", color: m.elapsed < 90 ? "#00e5a0" : m.elapsed < 120 ? "#f1c40f" : "#e74c3c" }}>{fmt(m.elapsed)}</span>}
                    </div>
                    <div style={{ maxWidth: "88%", background: m.who === "user" ? "rgba(255,255,255,0.08)" : surface, border: `1px solid ${border}`, borderRadius: m.who === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 13px", fontSize: 13, lineHeight: "1.65", whiteSpace: "pre-wrap", color: m.who === "user" ? "rgba(255,255,255,0.8)" : textColor }}>{m.text}</div>
                    {m.who === "user" && !m.score && !m.scoring && <button onClick={() => scoreMessage(i, m.text)} style={{ marginTop: 5, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-end" }}>Score ↗</button>}
                    {m.who === "user" && m.scoring && <div style={{ fontSize: 11, color: muted, marginTop: 5, alignSelf: "flex-end" }}>Scoring...</div>}
                    {m.who === "user" && m.score && <div style={{ alignSelf: "flex-end" }}><ScoreCard score={m.score} /></div>}
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Interviewer</div>
                    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: "14px 14px 14px 4px", padding: "10px 13px", fontSize: 13, color: muted }}>Thinking...</div>
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 16px env(safe-area-inset-bottom, 16px)", borderTop: `1px solid ${border}`, background: bg, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: timerOn || micOn || micErr ? 8 : 0, minHeight: timerOn || micOn || micErr ? 24 : 0 }}>
                  {timerOn && <TimerBadge sec={talkSec} />}
                  {micOn && <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.3)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e53935", animation: "pulse 0.8s infinite" }} />
                    <span style={{ fontSize: 11, color: "#e53935" }}>{transcribing ? "Transcribing..." : "Listening — tap ⏹ to finish"}</span>
                  </div>}
                  {micErr && <span style={{ fontSize: 11, color: "#e67e22" }}>{micErr}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea value={input} onChange={e => setInput(e.target.value)}
                    onFocus={startTimer}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder="Your answer... (timer starts on focus)" rows={3}
                    style={{ flex: 1, background: surface, border: `1px solid ${timerOn ? (talkSec < 90 ? "rgba(0,229,160,0.3)" : talkSec < 120 ? "rgba(241,196,15,0.3)" : "rgba(231,76,60,0.3)") : border}`, borderRadius: 12, color: textColor, fontFamily: "inherit", fontSize: 16, padding: "10px 12px", lineHeight: "1.5", caretColor: textColor, transition: "border-color .3s" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button onClick={sendMsg} disabled={loading || !input.trim()} style={{ background: input.trim() && !loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, color: input.trim() && !loading ? bg : muted, fontFamily: "inherit", fontSize: 13, fontWeight: 600, width: 44, height: 44, cursor: input.trim() && !loading ? "pointer" : "not-allowed" }}>↑</button>
                    <button onClick={toggleMic} disabled={transcribing} style={{ background: micOn ? "rgba(229,57,53,0.15)" : transcribing ? "rgba(255,255,255,0.03)" : "transparent", border: `1px solid ${micOn ? "rgba(229,57,53,0.5)" : transcribing ? border : border}`, borderRadius: 10, color: micOn ? "#e53935" : transcribing ? muted : muted, fontFamily: "inherit", fontSize: 16, width: 44, height: 44, cursor: transcribing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {transcribing ? "⏳" : micOn ? "⏹" : "🎤"}
                    </button>
                    <button onClick={() => { if (micOn) stopMic(); setMessages([]); setStarted(false); historyRef.current = []; setColdReveal(null); resetTimer(); setTranscribing(false); setMicErr(""); }} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 10, color: muted, fontFamily: "inherit", fontSize: 10, width: 44, height: 30, cursor: "pointer" }}>reset</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── COMPANY PREP ── */}
      {tab === "prep" && (
        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 16, lineHeight: "1.6" }}>Enter the company and role you're interviewing for. Get ranked story recommendations, likely questions, and positioning advice.</div>

          {/* URL fetch */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Job posting URL <span style={{ textTransform: "none", color: "rgba(255,255,255,0.25)" }}>— auto-fills description</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={prepUrl} onChange={e => { setPrepUrl(e.target.value); setPrepUrlErr(""); }} onKeyDown={e => e.key === "Enter" && fetchJobUrl()} placeholder="https://jobs.company.com/..." style={{ flex: 1, background: "#1a1a1a", border: `1px solid ${prepUrlErr ? "rgba(231,76,60,0.4)" : border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px" }} />
              <button onClick={fetchJobUrl} disabled={prepUrlLoading || !prepUrl.trim()} style={{ background: prepUrlLoading || !prepUrl.trim() ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)", border: `1px solid ${border}`, borderRadius: 10, color: prepUrlLoading || !prepUrl.trim() ? muted : textColor, fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "0 14px", cursor: prepUrlLoading || !prepUrl.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {prepUrlLoading ? "Fetching..." : "Fetch ↗"}
              </button>
            </div>
            {prepUrlErr && <div style={{ fontSize: 11, color: "#e74c3c", marginTop: 5 }}>{prepUrlErr}</div>}
            {prepJD && !prepUrlErr && prepUrl && <div style={{ fontSize: 11, color: "#00e5a0", marginTop: 5 }}>✓ Job description loaded</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: "1px", background: border }} />
            <span style={{ fontSize: 11, color: muted }}>or enter manually</span>
            <div style={{ flex: 1, height: "1px", background: border }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Company *</div>
            <input value={prepCompany} onChange={e => setPrepCompany(e.target.value)} placeholder="e.g. Stripe, Notion, Figma" style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Role / Job title</div>
            <input value={prepTitle} onChange={e => setPrepTitle(e.target.value)} placeholder="e.g. Senior IT Engineer, IT Manager" style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Job description <span style={{ textTransform: "none", color: "rgba(255,255,255,0.25)" }}>(paste key parts or auto-filled above)</span></div>
            <textarea value={prepJD} onChange={e => setPrepJD(e.target.value)} placeholder="Paste requirements, responsibilities, or anything relevant..." rows={4} style={{ width: "100%", background: "#1a1a1a", border: `1px solid ${border}`, borderRadius: 10, color: textColor, fontFamily: "inherit", fontSize: 13, padding: "11px 12px", lineHeight: "1.5" }} />
          </div>
          <button onClick={runCompanyPrep} disabled={prepLoading || !prepCompany.trim()} style={{ width: "100%", background: prepLoading || !prepCompany.trim() ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)", border: `1px solid ${prepLoading || !prepCompany.trim() ? border : "rgba(255,255,255,0.2)"}`, borderRadius: 12, color: prepLoading || !prepCompany.trim() ? muted : textColor, fontFamily: "inherit", fontSize: 14, fontWeight: 500, padding: "13px", cursor: prepLoading || !prepCompany.trim() ? "not-allowed" : "pointer" }}>
            {prepLoading ? "Analyzing..." : "Generate prep plan ↗"}
          </button>

          {prepResult && (
            <div style={{ marginTop: 20 }}>
              {/* Opener */}
              <div style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#00e5a0", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Positioning</div>
                <div style={{ fontSize: 13, lineHeight: "1.6", color: textColor }}>{prepResult.opener}</div>
              </div>

              {/* Story rankings */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Recommended stories for {prepCompany}</div>
                {prepResult.stories.map((ps, i) => {
                  const s = story(ps.id);
                  return (
                    <div key={ps.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${i === 0 ? "rgba(0,229,160,0.4)" : border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: i === 0 ? "#00e5a0" : muted, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{ps.emoji} {ps.title}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: "1.5" }}>{ps.reason}</div>
                        {s && <button onClick={() => { setSelS(s.id); setColdOpen(false); setTab("practice"); setMessages([]); setStarted(false); resetTimer(); }} style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontFamily: "inherit" }}>Practice ↗</button>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Likely questions */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Likely questions at {prepCompany}</div>
                {prepResult.questions.map((q, i) => (
                  <div key={i} className="rip" onClick={() => {
                    const match = QA.findIndex(qa => qa.q.toLowerCase().split(" ").some(w => w.length > 4 && q.toLowerCase().includes(w)));
                    if (match >= 0) handleQASelect(match);
                  }} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "11px 13px", marginBottom: 7, fontSize: 13, lineHeight: "1.4", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span>"{q}"</span>
                    <span style={{ color: muted, fontSize: 13, flexShrink: 0 }}>→</span>
                  </div>
                ))}
              </div>

              {/* Gaps */}
              <div style={{ background: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.2)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#e74c3c", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Watch out for</div>
                <div style={{ fontSize: 13, lineHeight: "1.6", color: "rgba(255,255,255,0.7)" }}>{prepResult.gaps}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      {tab === "stats" && (() => {
        const totalSessions = sessions.length;
        if (totalSessions === 0) {
          return (
            <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No practice history yet</div>
                <div style={{ fontSize: 12, color: muted, lineHeight: "1.6" }}>Score your answers in the Practice tab to start building stats. They're saved automatically and persist across sessions.</div>
              </div>
            </div>
          );
        }

        const avg = (key: keyof Score) => {
          const nums = sessions.map(s => s.score[key]).filter((n): n is number => typeof n === "number");
          return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
        };
        const avgStruct = avg("structure"), avgSpec = avg("specificity"), avgCon = avg("conciseness");
        const avgOverall = Math.round(((avgStruct + avgSpec + avgCon) / 3) * 10) / 10;
        const avgElapsed = Math.round(sessions.reduce((a, s) => a + s.elapsed, 0) / totalSessions);

        // Per-story stats
        const byStory: Record<string, { count: number; sumScore: number; title: string; emoji: string }> = {};
        sessions.forEach(s => {
          if (!byStory[s.storyId]) {
            const st = story(s.storyId);
            byStory[s.storyId] = { count: 0, sumScore: 0, title: st?.title || s.storyTitle, emoji: st?.emoji || "•" };
          }
          byStory[s.storyId].count++;
          byStory[s.storyId].sumScore += (s.score.structure + s.score.specificity + s.score.conciseness) / 3;
        });

        const storyStats = Object.entries(byStory).map(([id, v]) => ({
          id, title: v.title, emoji: v.emoji, count: v.count,
          avg: Math.round((v.sumScore / v.count) * 10) / 10
        })).sort((a, b) => a.avg - b.avg); // weakest first

        // Identify weakest dimension
        const dims = [
          { name: "Structure", val: avgStruct, key: "structure" as const },
          { name: "Specificity", val: avgSpec, key: "specificity" as const },
          { name: "Conciseness", val: avgCon, key: "conciseness" as const },
        ];
        const weakest = dims.reduce((min, d) => d.val < min.val ? d : min);
        const weakestStory = storyStats[0];
        const unpracticedStories = STORIES.filter(s => !byStory[s.id]);

        // Color helper
        const scoreColor = (n: number) => n >= 4 ? "#00e5a0" : n >= 3 ? "#f1c40f" : "#e67e22";
        const elapsedColor = (sec: number) => sec < 90 ? "#00e5a0" : sec < 120 ? "#f1c40f" : "#e74c3c";

        return (
          <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
            {/* Top stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Sessions</div>
                <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>{totalSessions}</div>
              </div>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Avg score</div>
                <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono',monospace", color: scoreColor(avgOverall) }}>{avgOverall}</div>
              </div>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Avg time</div>
                <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono',monospace", color: elapsedColor(avgElapsed) }}>{fmt(avgElapsed)}</div>
              </div>
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Stories</div>
                <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>{Object.keys(byStory).length}<span style={{ fontSize: 13, color: muted }}>/{STORIES.length}</span></div>
              </div>
            </div>

            {/* Weak spot callout */}
            <div style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#00e5a0", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Focus next</div>
              <div style={{ fontSize: 13, lineHeight: "1.6", color: textColor }}>
                Your weakest dimension is <strong>{weakest.name}</strong> ({weakest.val}/5).
                {weakestStory && weakestStory.avg < 4 && <> The story that needs the most work is <strong>{weakestStory.emoji} {weakestStory.title}</strong> (avg {weakestStory.avg}).</>}
                {unpracticedStories.length > 0 && <> You haven't practiced {unpracticedStories.length} {unpracticedStories.length === 1 ? "story" : "stories"} yet.</>}
              </div>
            </div>

            {/* Dimension breakdown */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>Dimensions</div>
              {dims.map(d => (
                <div key={d.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: textColor }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: scoreColor(d.val) }}>{d.val}/5</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.val / 5) * 100}%`, background: scoreColor(d.val), transition: "width .3s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Per-story breakdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Stories — weakest first</div>
              {storyStats.map(s => (
                <div key={s.id} className="rip" onClick={() => { setSelS(s.id); setColdOpen(false); setTab("practice"); setMessages([]); setStarted(false); resetTimer(); }} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{s.count} {s.count === 1 ? "practice" : "practices"}</div>
                  </div>
                  <div style={{ fontSize: 13, fontFamily: "'DM Mono',monospace", color: scoreColor(s.avg), fontWeight: 500, flexShrink: 0 }}>{s.avg}</div>
                </div>
              ))}
              {unpracticedStories.length > 0 && unpracticedStories.map(s => (
                <div key={s.id} className="rip" onClick={() => { setSelS(s.id); setColdOpen(false); setTab("practice"); setMessages([]); setStarted(false); resetTimer(); }} style={{ background: "transparent", border: `1px dashed ${border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", opacity: 0.6 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Not yet practiced</div>
                  </div>
                  <div style={{ fontSize: 11, color: muted, flexShrink: 0 }}>—</div>
                </div>
              ))}
            </div>

            {/* Recent sessions */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Recent sessions</div>
              {sessions.slice(0, 10).map((s, i) => {
                const overall = Math.round(((s.score.structure + s.score.specificity + s.score.conciseness) / 3) * 10) / 10;
                const date = new Date(s.ts);
                const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                return (
                  <div key={i} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
                      <span style={{ fontSize: 12, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>"{s.question}"</span>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: scoreColor(overall), fontWeight: 500, flexShrink: 0 }}>{overall}</span>
                    </div>
                    <div style={{ fontSize: 10, color: muted, display: "flex", gap: 8 }}>
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", color: elapsedColor(s.elapsed) }}>{fmt(s.elapsed)}</span>
                      <span>·</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{s.storyTitle}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clear history */}
            <button onClick={() => {
              if (confirm("Clear all practice history? This can't be undone.")) {
                setSessions([]);
                try { localStorage.removeItem("rl_sessions"); } catch {}
              }
            }} style={{ width: "100%", background: "transparent", border: `1px solid ${border}`, borderRadius: 10, color: muted, fontFamily: "inherit", fontSize: 11, padding: "8px", cursor: "pointer", marginTop: 4 }}>
              Clear all history
            </button>
          </div>
        );
      })()}
    </div>
  );
}