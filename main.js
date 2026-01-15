// Simple HKU Biz Undergrad Simulator logic

const SCREENS = {
  intro: document.getElementById("intro-screen"),
  setup: document.getElementById("setup-screen"),
  game: document.getElementById("game-screen"),
  ending: document.getElementById("ending-screen"),
};

const introNextBtn = document.getElementById("intro-next-btn");
const setupForm = document.getElementById("setup-form");
const gameScreen = SCREENS.game;
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const typingIndicator = document.getElementById("typing-indicator");
const roundIndicator = document.getElementById("round-indicator");
const roundMax = document.getElementById("round-max");
const roundsLeftEl = document.getElementById("rounds-left");
const favorabilityBarInner = document.getElementById("favorability-bar-inner");
const favorabilityValue = document.getElementById("favorability-value");
const thoughtToggle = document.getElementById("thought-toggle");

// End conversation overlay
const endOverlay = document.getElementById("end-conversation-overlay");
const seeResultsBtn = document.getElementById("see-results-btn");

// Ending elements
const endingTitle = document.getElementById("ending-title");
const endingSummary = document.getElementById("ending-summary");
const finalFavorabilityEl = document.getElementById("final-favorability");
const finalOutcomeEl = document.getElementById("final-outcome");
const bonusOpportunityEl = document.getElementById("bonus-opportunity");
const letterText = document.getElementById("letter-text");
const copyLetterBtn = document.getElementById("copy-letter-btn");
const playAgainBtn = document.getElementById("play-again-btn");

// Audio
const bgMusic = document.getElementById("bg-music");
const sfxPositive = document.getElementById("sfx-positive");
const sfxNegative = document.getElementById("sfx-negative");
const sfxEnding = document.getElementById("sfx-ending");

// Sound toggle
const soundToggle = document.getElementById("sound-toggle");
let soundMuted = false;

// State
const MAX_ROUNDS = 10;
let currentRound = 1;
let favorability = 0; // 0 - 100
let studentConfig = null;
let language = "en"; // 'en' or 'zh'
let gameOver = false;

// Keep a simple conversation history for AI backend
// { role: "student" | "prof", content: string }
let history = [];

roundMax.textContent = MAX_ROUNDS.toString();
roundsLeftEl.textContent = MAX_ROUNDS.toString();

function switchScreen(target) {
  Object.values(SCREENS).forEach((el) => el.classList.remove("active"));
  target.classList.add("active");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function detectLanguageFromText(text) {
  // Basic detection: if contains any CJK characters, treat as Chinese
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  return hasChinese ? "zh" : "en";
}

function showDeltaBadge(delta) {
  const badge = document.createElement("div");
  badge.className = `delta-badge ${delta >= 0 ? "positive" : "negative"}`;
  badge.textContent = delta >= 0 ? `+${Math.round(delta)}` : Math.round(delta).toString();
  
  // Position near the favorability bar
  const favBlock = document.querySelector(".favorability-block");
  if (favBlock) {
    const rect = favBlock.getBoundingClientRect();
    badge.style.position = "fixed";
    badge.style.left = `${rect.right - 60}px`;
    badge.style.top = `${rect.top}px`;
  }
  
  document.body.appendChild(badge);
  
  // Remove after animation
  setTimeout(() => badge.remove(), 1200);
}

function playSound(audioEl) {
  if (soundMuted || !audioEl) return;
  try {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  } catch {
    // ignore autoplay errors
  }
}

function updateFavorability(delta) {
  const old = favorability;
  favorability = clamp(favorability + delta, 0, 100);
  const newVal = favorability;

  favorabilityBarInner.style.width = `${newVal}%`;
  favorabilityBarInner.classList.remove("favorability-pulse");
  void favorabilityBarInner.offsetWidth; // force reflow
  favorabilityBarInner.classList.add("favorability-pulse");

  // Show delta badge
  if (delta !== 0) {
    showDeltaBadge(delta);
  }

  // Animate numeric change (simple timeout)
  const steps = 10;
  let step = 0;
  const diff = newVal - old;
  const interval = setInterval(() => {
    step += 1;
    const val = Math.round(old + (diff * step) / steps);
    favorabilityValue.textContent = val.toString();
    if (step >= steps) clearInterval(interval);
  }, 30);

  // Avatar mood based on favorability
  const profCard = document.querySelector(".prof-card");
  profCard.classList.remove("mood-happy", "mood-neutral", "mood-annoyed");
  if (newVal >= 70) {
    profCard.classList.add("mood-happy");
  } else if (newVal <= 35) {
    profCard.classList.add("mood-annoyed");
  } else {
    profCard.classList.add("mood-neutral");
  }

  // Sound
  if (delta > 0) {
    playSound(sfxPositive);
  } else if (delta < 0) {
    playSound(sfxNegative);
  }
}

function createMessageRow({ from, text, thought }) {
  const row = document.createElement("div");
  row.className = `message-row ${from === "student" ? "student" : "prof"}`;

  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.style.display = "flex";
  bubbleWrapper.style.flexDirection = "column";
  bubbleWrapper.style.alignItems = from === "student" ? "flex-start" : "flex-end";

  if (from === "prof" && thought && thoughtToggle.checked) {
    const thoughtEl = document.createElement("div");
    thoughtEl.className = "prof-thought";
    thoughtEl.textContent = thought;
    bubbleWrapper.appendChild(thoughtEl);
  }

  const bubble = document.createElement("div");
  bubble.className = `bubble ${from === "student" ? "student" : "prof"}`;
  bubble.textContent = text;
  bubbleWrapper.appendChild(bubble);

  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  const who =
    from === "student"
      ? studentConfig?.name || "You"
      : language === "zh"
      ? "羅賓教授"
      : "Prof Robin";
  meta.textContent = who;
  bubbleWrapper.appendChild(meta);

  row.appendChild(bubbleWrapper);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function resetGameState() {
  currentRound = 1;
  gameOver = false;
  favorability = initialFavorabilityFromStats(studentConfig);
  favorabilityBarInner.style.width = `${favorability}%`;
  favorabilityValue.textContent = Math.round(favorability).toString();
  roundIndicator.textContent = currentRound.toString();
  roundsLeftEl.textContent = (MAX_ROUNDS - currentRound + 1).toString();
  chatLog.innerHTML = "";
  chatInput.value = "";
  chatInput.disabled = false;
  chatSendBtn.disabled = false;
  history = [];
  if (typingIndicator) typingIndicator.classList.add("hidden");
  if (endOverlay) endOverlay.classList.add("hidden");

  const profCard = document.querySelector(".prof-card");
  profCard.classList.remove("mood-happy", "mood-neutral", "mood-annoyed");
  profCard.classList.add("mood-neutral");

  // Intro message from professor
  const greeting =
    language === "zh"
      ? `（敲門聲）請進。你好，我是羅賓教授。今天辦公時間只有一會，你有什麼事？`
      : `*knock knock* Come in. Hello, I'm Prof Robin. Office hour is short today — what can I help you with?`;
  const thought =
    language === "zh"
      ? `希望這位同學不是又臨急臨忙來要推薦信吧。`
      : `Please don't be another last‑minute recommendation letter panic...`;

  createMessageRow({ from: "prof", text: greeting, thought });
  history.push({ role: "prof", content: greeting });

  // Start background music if not muted
  if (!soundMuted) {
    try {
      bgMusic.volume = 0.4;
      bgMusic.play().catch(() => {});
    } catch {
      // ignore
    }
  }
}

function initialFavorabilityFromStats(config) {
  if (!config) return 40;
  const gpa = clamp(config.gpa, 0, 4.3);
  const att = clamp(config.attendance, 0, 100);
  let base = 35;
  base += (gpa - 2.7) * 6; // gentle effect
  base += (att - 60) * 0.15;
  // Add small random noise to make runs feel different
  base += (Math.random() - 0.5) * 6;
  return clamp(Math.round(base), 10, 80);
}

function analyzeMessageContent(text) {
  const lower = text.toLowerCase();

  const features = {
    mentionLetter: /letter|reference|recommend|推薦|referee/.test(lower),
    greeting: /hello|hi|good morning|good afternoon|prof|sir|教授|老師/.test(lower),
    thanks: /thank|appreciate|grateful|多謝|感謝/.test(lower),
    honesty: /honest|truth|frank|老實|坦白/.test(lower),
    flattery: /best professor|favorite professor|admire|respect|感激|敬佩|最.*教授/.test(
      lower
    ),
    effort:
      /worked hard|put in effort|study group|project|assignment|office hour|問問題|project|小組/.test(
        lower
      ),
    future:
      /master|postgraduate|graduate program|phd|mfin|meng|msc|研究生|碩士|pg|postgrad/.test(
        lower
      ),
    panic: /urgent|deadline|tomorrow|last minute|panic|急|死線|爆炸/.test(lower),
    apology: /sorry|apologise|apologize|不好意思|對不起/.test(lower),
    joke: /haha|lol|jk|just kidding|笑|哈哈/.test(lower),
    nonsense: /^[a-z0-9\s]*$/i.test(lower) && lower.trim().length <= 2,
  };

  return features;
}

function detectLying(text, config) {
  const lower = text.toLowerCase();
  if (!config) return false;

  // If student claims perfect attendance but self‑reported < 80
  if (
    /(every class|never miss|100% attendance|always attend|全勤|每一堂)/.test(lower) &&
    config.attendance < 80
  ) {
    return true;
  }

  // If they claim a very high GPA compared to reported one
  const gpaMatch = lower.match(/gpa\s*([0-4]\.\d{1,2})/);
  if (gpaMatch) {
    const claimed = parseFloat(gpaMatch[1]);
    if (!Number.isNaN(claimed) && claimed - config.gpa > 0.4) {
      return true;
    }
  }

  return false;
}

function getProfessorResponse(userText) {
  const features = analyzeMessageContent(userText);
  const lying = detectLying(userText, studentConfig);

  let delta = 0;
  let response = "";
  let thought = "";

  const politeOpening =
    language === "zh"
      ? `先自我介紹一下，讓我知道你是哪一位、上過哪一科。`
      : `Let's start with a quick self‑introduction and remind me which course you took with me.`;

  if (currentRound === 1 && !features.mentionLetter) {
    // They haven't directly asked for letter yet
    response =
      language === "zh"
        ? `好的，同學。${politeOpening}`
        : `Alright. ${politeOpening}`;
    thought =
      language === "zh"
        ? `至少有問候，比直接衝進來要推薦信好一點。`
        : `At least they didn't open with "please write me a letter" immediately.`;
    delta += features.greeting ? 5 : 2;
    if (features.thanks) delta += 3;
    return { response, thought, delta };
  }

  if (features.nonsense || userText.trim().length === 0) {
    response =
      language === "zh"
        ? `嗯？我猜這不是你平時在 tutorial 裡的表現吧。我們試試用完整句子，好嗎？`
        : `Hm? I assume that's not how you wrote answers in my tutorial. Let's try full sentences, shall we?`;
    thought =
      language === "zh"
        ? `還以為是 spam bot 進來了。`
        : `For a second I thought a spam bot somehow joined my office hour.`;
    delta -= 3;
    return { response, thought, delta };
  }

  if (lying) {
    // Random strictness: sometimes very harsh, sometimes joking
    const harsh = Math.random() < 0.6;
    if (harsh) {
      response =
        language === "zh"
          ? `同學，你說「幾乎每一堂都有來」，但我的出席紀錄好像不是這樣寫的喔。作為金融人，我們對數字應該誠實一點。`
          : `You mentioned you "almost never missed a class", but my attendance sheet tells a very different story. As finance people, we should at least be honest with numbers.`;
      thought =
        language === "zh"
          ? `誠信這一關都過不了，寫推薦信有點心虛。`
          : `If we can't clear the honesty bar, it's hard to write a convincing recommendation.`;
      delta -= 18 + Math.random() * 6;
    } else {
      response =
        language === "zh"
          ? `哈哈，我知道這門課九點鐘很痛苦，但我們不用把 60% 說成 100%。你可以直接坦白。`
          : `Haha, I know a 9am class is painful, but we don't have to turn 60% into 100%. You can just be frank with me.`;
      thought =
        language === "zh"
          ? `至少他/她願意聊，還有得救。`
          : `At least they're still here with some courage left. Could be saved.`;
      delta -= 8 + Math.random() * 6;
    }
    return { response, thought, delta };
  }

  // If they clearly mention the letter
  if (features.mentionLetter) {
    if (language === "zh") {
      response = `所以你今天是想談推薦信的事，對吧？在我答應之前，我想先了解幾件事：你在課堂上的表現、你真正想追求的方向，以及為什麼會找到我。可以多說一點嗎？`;
      thought = `又一位為了 exchange 或 IB 而出現的同學，不過至少他/她先講清楚目的。`;
    } else {
      response = `So you're here about a recommendation letter, right? Before I say yes or no, I need to know a few things: how you actually performed in my course, what you're truly aiming for, and why you think I'm the right person to write it. Tell me more.`;
      thought = `Another student chasing exchange or IB, but at least they're being upfront.`;
    }
    delta += 6;
    if (features.greeting) delta += 2;
    if (features.thanks) delta += 2;
  } else if (features.effort || features.future) {
    if (language === "zh") {
      response = `我欣賞你有認真想過自己的路向。你可以具體一點說，在我的課裡你做過哪一樣令你自己覺得「值得被寫進推薦信」的事嗎？`;
      thought = `有思考未來，不只是「我要高分」，這類學生寫起來比較有故事。`;
    } else {
      response = `I appreciate that you've thought about your path. Can you be concrete: what did you actually do in my course that you feel is "letter‑worthy"?`;
      thought = `At least they're not only here for the grade. Story potential detected.`;
    }
    delta += 8;
  } else if (features.panic) {
    if (language === "zh") {
      response = `臨急抱佛腳是 HKU 傳統文化之一，不過推薦信這種東西，通常需要時間累積。我想聽聽，你之前有沒有主動參與課堂、問問題、或者跟我談過？`;
      thought = `如果又是「deadline 明天才想起」，那就要看他/她說服力有多強了。`;
    } else {
      response = `Last‑minute panic is a proud HKU tradition, but recommendation letters usually rely on more than panic. Tell me: have you engaged in class, asked questions, or talked to me before this week?`;
      thought = `If this is another "deadline is tomorrow" case, let's see how persuasive they can be.`;
    }
    delta -= 2;
  } else if (features.apology) {
    if (language === "zh") {
      response = `知道自己來得晚，已經比很多人有自覺。重點是，你接下來想怎樣令我相信，你值得我花時間幫你寫一封有內容的信？`;
      thought = `有歉意總比理所當然好。看他/她怎樣補救。`;
    } else {
      response = `Recognizing you're a bit late is already more self‑aware than many. The real question is: how will you convince me you're worth the time for a meaningful letter?`;
      thought = `At least there's some humility. Let's see if they can back it up.`;
    }
    delta += 5;
  } else {
    // Generic but sensible response
    if (language === "zh") {
      response = `好，我大概明白你的情況。不過單靠一句話，很難判斷你是否適合拿到推薦信。你可以舉一兩個在我課堂或 project 裡的具體例子嗎？`;
      thought = `希望不是只在 Canvas 上存在的名字。`;
    } else {
      response = `Alright, I see. But from a couple of sentences it's hard to judge whether you're someone I can genuinely recommend. Could you give me one or two concrete examples from my class or the project?`;
      thought = `I wonder if they existed anywhere beyond the Canvas gradebook.`;
    }
    delta += 1;
  }

  // Flattery and thanks give small boosts, but not huge
  if (features.flattery) delta += 4;
  if (features.thanks) delta += 2;
  if (features.effort) delta += 3;

  // Talking clearly about future postgraduate study goals is usually positive
  if (features.future) delta += 2;

  // Tiny noise
  delta += (Math.random() - 0.5) * 2;

  return { response, thought, delta };
}

function handleUserSubmit() {
  if (gameOver) return;
  const text = chatInput.value.trim();
  if (!text) return;

  if (!studentConfig) return;

  // Detect language on first actual message
  if (currentRound === 1) {
    language = detectLanguageFromText(text);
  }

  createMessageRow({ from: "student", text });
  history.push({ role: "student", content: text });
  chatInput.value = "";

  if (typingIndicator) typingIndicator.classList.remove("hidden");

  // Prefer backend AI if available; fall back to local heuristic on failure.
  callProfessorAIForTurn(text)
    .then(({ response, thought, delta }) => {
      updateFavorability(delta);

      setTimeout(() => {
        if (typingIndicator) typingIndicator.classList.add("hidden");
        createMessageRow({ from: "prof", text: response, thought });
        history.push({ role: "prof", content: response });

        // Update rounds
        if (currentRound < MAX_ROUNDS) {
          currentRound += 1;
          roundIndicator.textContent = currentRound.toString();
          roundsLeftEl.textContent = (MAX_ROUNDS - currentRound + 1).toString();
        } else {
          showEndOverlay();
        }
      }, 450);
    })
    .catch(() => {
      // Graceful fallback: local heuristic behavior
      const { response, thought, delta } = getProfessorResponse(text);
      updateFavorability(delta);

      setTimeout(() => {
        if (typingIndicator) typingIndicator.classList.add("hidden");
        createMessageRow({ from: "prof", text: response, thought });
        history.push({ role: "prof", content: response });

        if (currentRound < MAX_ROUNDS) {
          currentRound += 1;
          roundIndicator.textContent = currentRound.toString();
          roundsLeftEl.textContent = (MAX_ROUNDS - currentRound + 1).toString();
        } else {
          showEndOverlay();
        }
      }, 450);
    });
}

async function callProfessorAIForTurn(latestUserText) {
  const body = {
    phase: "turn",
    language,
    studentConfig,
    favorability,
    round: currentRound,
    maxRounds: MAX_ROUNDS,
    history,
  };

  const res = await fetch("/api-professor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("AI backend unavailable");
  }

  const data = await res.json();

  const reply = data.reply || data.response || "";
  const thought = data.thought || "";
  const delta =
    typeof data.delta === "number"
      ? data.delta
      : getProfessorResponse(latestUserText).delta;

  return { response: reply, thought, delta };
}

function handleUserSubmitLegacy() {
  if (gameOver) return;
  const text = chatInput.value.trim();
  if (!text) return;

  if (!studentConfig) return;

  // Detect language on first actual message
  if (currentRound === 1) {
    language = detectLanguageFromText(text);
  }

  createMessageRow({ from: "student", text });
  chatInput.value = "";

  const { response, thought, delta } = getProfessorResponse(text);
  updateFavorability(delta);

  setTimeout(() => {
    createMessageRow({ from: "prof", text: response, thought });

    // Update rounds
    if (currentRound < MAX_ROUNDS) {
      currentRound += 1;
      roundIndicator.textContent = currentRound.toString();
      roundsLeftEl.textContent = (MAX_ROUNDS - currentRound + 1).toString();
    } else {
      showEndOverlay();
    }
  }, 450);
}

function showEndOverlay() {
  // Disable input but don't mark gameOver yet
  chatInput.disabled = true;
  chatSendBtn.disabled = true;
  
  // Update overlay text based on language
  const overlayTitle = endOverlay.querySelector(".end-overlay-title");
  const overlaySubtitle = endOverlay.querySelector(".end-overlay-subtitle");
  const resultsBtn = endOverlay.querySelector("#see-results-btn");
  
  if (language === "zh") {
    overlayTitle.textContent = "Office Hour 結束";
    overlaySubtitle.textContent = "羅賓教授準備好做出決定了...";
    resultsBtn.innerHTML = '<span class="btn-star">⭐</span> 查看結果 <span class="btn-star">⭐</span>';
  } else {
    overlayTitle.textContent = "Office Hour Ended";
    overlaySubtitle.textContent = "Prof Robin is ready to make his decision...";
    resultsBtn.innerHTML = '<span class="btn-star">⭐</span> See Your Results <span class="btn-star">⭐</span>';
  }
  
  // Show the overlay
  endOverlay.classList.remove("hidden");
}

function computeOutcome() {
  // Three outcomes:
  // 1) Reject: refuse letter
  // 2) High‑quality letter (very positive)
  // 3) Poor‑quality letter (negative tone)
  // Edge case: if favorability is VERY low (< 25), professor might promise letter but give bad one
  const f = favorability;
  if (f < 25) {
    // Very low: professor might promise but give terrible letter (evil trick)
    return Math.random() < 0.3 ? "poor" : "reject";
  }
  if (f < 38) {
    return "reject";
  }
  if (f >= 75) {
    return "high";
  }
  return "poor";
}

function randomBonusOpportunity(outcomeType) {
  if (outcomeType !== "high") return "";
  const optionsEn = [
    `Prof Robin quietly forwards your CV and transcript to a colleague coordinating a selective master's programme, adding that you "would probably thrive in a demanding cohort".`,
    `You are invited to be a part‑time research assistant on a small project about HK retail investors – a strong signal for future research or master's applications (plus free coffee in KKL).`,
    `At the end of the semester, Prof Robin nominates you for an internal scholarship and writes a short extra note to the master's admissions team highlighting your progress.`,
  ];
  const optionsZh = [
    `羅賓教授悄悄把你的 CV 和成績單轉給負責精選碩士課程的同事，還補上一句：「這位同學在嚴格環境裡應該會成長得不錯。」`,
    `你被邀請做一個關於香港散戶投資行為的小型 RA，這對將來申請研究型或授課型碩士都是一個很好的信號，還有 KKL 免費咖啡。`,
    `學期末時，羅賓教授提名你申請一個與碩士相關的獎學金，並額外寫了一段短評給招生團隊，強調你的進步。`,
  ];
  const list = language === "zh" ? optionsZh : optionsEn;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function generateLetter(outcomeType) {
  const name = studentConfig?.name || "the student";
  const gpaStr =
    typeof studentConfig?.gpa === "number"
      ? studentConfig.gpa.toFixed(2)
      : language === "zh"
      ? "約中上水平"
      : "around the upper‑middle range";
  const attStr =
    typeof studentConfig?.attendance === "number"
      ? `${studentConfig.attendance.toFixed(0)}%`
      : language === "zh"
      ? "大約中等"
      : "roughly average";

  if (language === "zh") {
    if (outcomeType === "reject") {
      return `致相關人士︰

在審慎考慮之後，我決定不為 ${name} 撰寫正式的推薦信。這並非完全否定該同學的所有優點，而是因為我在有限的互動和課堂觀察中，未能累積足夠具體而正面的事例，去支持一封我願意負責任地簽名的推薦信。

${name} 在我任教的高年級金融課程中，整體學業表現以及參與程度並不算突出，其自報的累積 GPA 約為 ${gpaStr}，在課堂的出席率約為 ${attStr}。無論是在課堂討論、作業準備，還是主動尋求學術交流方面，我都未能看到足以構成強而有力推薦理由的行為。相反，部分對話中流露出的臨急抱佛腳心態，令我擔心其長期規劃與自我要求仍有待提升。

在推薦信這類文件上，我一向採取謹慎而坦白的態度。與其寫一封含糊其辭、甚至可能對申請人最終發展造成誤導的信件，我認為清楚表達不適合撰寫，比勉強「幫忙」更為負責任。若閣下希望進一步了解本課程或一般評核標準，我樂意在適當情況下提供客觀資訊。

此致
敬禮
羅賓教授
HKU Business School
`;
    }

    if (outcomeType === "high") {
      return `致相關招生委員會︰

我謹此強烈推薦 ${name} 申請貴校的碩士課程。作為香港大學商學院高年級金融課程的授課教師，我在整個學期中觀察到這位同學的優秀表現。

在學術方面，${name} 的累積 GPA 約為 ${gpaStr}，在我任教的課程中表現穩定，在多個作業和小組 project 中展示出紮實的分析能力。他／她經常在課後主動發問，將課堂概念延伸到真實金融市場，這種主動性令我印象深刻。課堂出席率約為 ${attStr}，出席時的專注度與貢獻度都高於一般學生。

在團隊合作方面，${name} 能在小組討論中平衡領導與聆聽，願意承擔困難部分，也樂於幫助組員。他／她對自己優缺點有清晰的自覺，能坦誠面對不足並提出改善方法，這在本科生中並不常見。

綜合以上觀察，我毫不猶豫地推薦 ${name}。

此致
敬禮
羅賓教授
HKU Business School
`;
    }

    // poor‑quality letter
    return `致相關人士︰

我應 ${name} 的要求，為其申請撰寫這封推薦信。${name} 是我在香港大學商學院教授高年級金融課程時的學生，累積 GPA 約為 ${gpaStr}，出席率約為 ${attStr}。

在學術表現方面，${name} 大致能完成課程要求，整體水平屬於班上中間段。課堂參與度偶有起伏，部分情況下顯示出臨近期限才較為活躍的模式，這意味著其自我規劃和時間管理仍有改進空間。在小組 project 中，他／她能完成分配到的任務，但較少主動提出具突破性的想法。

在與我溝通的過程中，${name} 展現出一定程度的禮貌，但有時在表述自身優點時，略帶誇飾，與實際課堂紀錄存在差距。若貴機構尋求的是具頂尖主動性和長期穩定投入的候選人，${name} 可能尚未完全達到該水平。不過，在適當指導下，他／她仍有機會逐步成長。

此致
敬禮
羅賓教授
HKU Business School
`;
  }

  // English letters
  if (outcomeType === "reject") {
    return `To whom it may concern,

After careful consideration, I have decided not to write a formal letter of recommendation for ${name}. This is not a denial of every strength the student may possess; rather, it reflects that, based on our limited interaction and my classroom observations, I do not have sufficient concrete and strongly positive evidence to support a letter that I could comfortably sign with full professional responsibility.

In my upper‑year finance course, ${name}'s overall academic performance and engagement were not particularly distinctive. Their self‑reported cumulative GPA is around ${gpaStr}, and attendance in my course was roughly ${attStr}. In terms of class participation, assignment preparation, and initiative in seeking academic discussion, I did not observe behaviours that would normally justify a strong and enthusiastic recommendation. At times, the conversation with the student suggested a predominantly last‑minute, deadline‑driven mindset, which raises concerns about long‑term planning and consistency.

For recommendation letters, I maintain a cautious and transparent stance. Rather than producing a vague or lukewarm document—which could ultimately mislead both the applicant and the receiving institution—I believe it is more responsible to be explicit that I am not in a position to recommend this student at this time. If you require information about the course structure or assessment standards, I am happy to provide objective details separately where appropriate.

Sincerely,
Prof Robin
HKU Business School
`;
  }

  if (outcomeType === "high") {
    return `To the admissions committee,

I am pleased to write this letter in strong support of ${name}'s application for your master's programme. As a faculty member at the HKU Business School teaching an upper‑year finance course, I have observed this student throughout the semester and can offer a highly positive assessment.

Academically, ${name}'s cumulative GPA is around ${gpaStr}. In my course, they consistently delivered thoughtful work in assignments and group projects, demonstrating solid technical understanding and a sharp intuition for real‑world financial issues. Unlike many students who focus narrowly on examination scores, ${name} frequently extended class concepts to discussions about actual markets and career choices. Their attendance rate was approximately ${attStr}, but more importantly, they were engaged, prepared, and willing to contribute.

In group settings, ${name} strikes a healthy balance between leading and listening. They were willing to take on challenging components while also helping peers clarify complex ideas. In our interactions, I found them to be reflective and self‑aware about both strengths and weaknesses, which is rare at the undergraduate level. This combination of intellectual curiosity, maturity, and collaborative attitude will serve them well in graduate study.

I recommend ${name} without hesitation.

Sincerely,
Prof Robin
HKU Business School
`;
  }

  // poor‑quality / lukewarm letter in English
  return `To whom it may concern,

At the request of ${name}, I am providing this letter regarding their performance in my upper‑year finance course at the HKU Business School. ${name}'s self‑reported cumulative GPA is approximately ${gpaStr}, and their attendance was around ${attStr}.

In terms of academic results, ${name} generally met the basic expectations and performed at roughly the middle range of the class. Their engagement was somewhat inconsistent, with moments of participation interspersed with minimal involvement, particularly outside of deadline periods. In the group project, they completed assigned tasks but did not stand out as a source of new ideas.

In our conversations, ${name} was polite. However, there were occasions when their description of efforts and attendance did not fully align with my records, suggesting a tendency to present a more favourable narrative. While ambition is not negative, I would have welcomed a more consistent track record of proactive engagement.

Overall, ${name} has met the minimum requirements and may have potential to grow further in a structured environment. I hope these observations assist you in forming a balanced view.

Sincerely,
Prof Robin
HKU Business School
`;
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  chatInput.disabled = true;
  chatSendBtn.disabled = true;

  try {
    sfxEnding.currentTime = 0;
    sfxEnding.play().catch(() => {});
  } catch {
    // ignore
  }

  // Try AI-backed final outcome + letter; if fails, fall back to local logic.
  callProfessorAIForFinal()
    .then(({ outcomeType, letter }) => {
      renderEnding(outcomeType, letter);
    })
    .catch(() => {
      const outcomeType = computeOutcome();
      const letter = generateLetter(outcomeType);
      renderEnding(outcomeType, letter);
    });
}

async function callProfessorAIForFinal() {
  const body = {
    phase: "final",
    language,
    studentConfig,
    favorability,
    round: currentRound,
    maxRounds: MAX_ROUNDS,
    history,
  };

  const res = await fetch("/api-professor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("AI backend unavailable");
  }

  const data = await res.json();
  const outcomeType = data.outcome || computeOutcome();
  const letter = data.letter || generateLetter(outcomeType);

  return { outcomeType, letter };
}

function renderEnding(outcomeType, letter) {
  const letterSection = document.querySelector(".letter-section");

  // Trigger celebration or sad effects
  if (outcomeType === "high") {
    setTimeout(() => createConfetti(), 300);
  } else if (outcomeType === "reject") {
    setTimeout(() => createSadRain(), 300);
  }

  if (language === "zh") {
    if (outcomeType === "reject") {
      endingTitle.textContent = "結果：教授拒絕寫推薦信";
      endingSummary.textContent =
        "羅賓教授禮貌地但明確地拒絕了你的推薦信請求，理由主要是他對你在課程中的表現和互動了解不足。也許下次可以早一點出現在 KKL 1125。";
      finalOutcomeEl.textContent = "拒絕撰寫推薦信";
      letterSection.classList.add("hidden");
    } else if (outcomeType === "high") {
      endingTitle.textContent = "結果：獲得強力推薦信";
      endingSummary.textContent =
        "你的表現成功說服了羅賓教授，他不僅同意寫推薦信，而且願意在信中加入具體而正面的細節。之後，你還感覺到他在某些場合默默幫你一把。";
      finalOutcomeEl.textContent = "強而有力的推薦信（非常正面）";
      letterSection.classList.remove("hidden");
    } else {
      // Check if this is the "evil trick" case (very low favorability but got letter)
      if (favorability < 30) {
        endingTitle.textContent = "結果：教授答應了，但...";
        endingSummary.textContent =
          "羅賓教授答應為你寫推薦信，但你隱約覺得他的語氣有點奇怪。當你收到信件時，你發現這封信的內容... 嗯，可能還不如不寫。";
        finalOutcomeEl.textContent = "負面推薦信（教授的反擊）";
      } else {
        endingTitle.textContent = "結果：勉強同意，但信不太好看";
        endingSummary.textContent =
          "羅賓教授同意為你寫推薦信，但用詞十分克制，甚至略帶保留與冷淡。這封信可能幫到一點，但未必是你申請中的強項。";
        finalOutcomeEl.textContent = "比較冷淡／保留的推薦信";
      }
      letterSection.classList.remove("hidden");
    }
  } else {
    if (outcomeType === "reject") {
      endingTitle.textContent = "Outcome: No Letter";
      endingSummary.textContent =
        "Prof Robin politely but clearly declined to write you a recommendation letter, mainly because he does not feel he knows your work well enough to stand behind it. Maybe next time, visit KKL 1125 before week 13.";
      finalOutcomeEl.textContent = "Request rejected (no letter)";
      letterSection.classList.add("hidden");
    } else if (outcomeType === "high") {
      endingTitle.textContent = "Outcome: Strong Letter Secured";
      endingSummary.textContent =
        "You successfully convinced Prof Robin. He agrees not only to write the letter, but also to include concrete, positive details that make you stand out. You suspect he might quietly help you in other ways too.";
      finalOutcomeEl.textContent = "High‑quality recommendation letter";
      letterSection.classList.remove("hidden");
    } else {
      // Check if this is the "evil trick" case
      if (favorability < 30) {
        endingTitle.textContent = "Outcome: He Said Yes, But...";
        endingSummary.textContent =
          "Prof Robin agreed to write the letter, but something felt off about his tone. When you receive it, you realize... this letter might actually hurt more than help.";
        finalOutcomeEl.textContent = "Negative letter (professor's revenge)";
      } else {
        endingTitle.textContent = "Outcome: Lukewarm / Negative Letter";
        endingSummary.textContent =
          "Prof Robin agrees to write the letter, but the tone is cautious and somewhat distant. It may count as a reference, but it probably won't be the strongest asset in your application.";
        finalOutcomeEl.textContent = "Poor‑quality / lukewarm letter";
      }
      letterSection.classList.remove("hidden");
    }
  }

  finalFavorabilityEl.textContent = Math.round(favorability).toString();

  const bonus = randomBonusOpportunity(outcomeType);
  if (bonus) {
    bonusOpportunityEl.textContent = bonus;
    bonusOpportunityEl.classList.remove("hidden");
  } else {
    bonusOpportunityEl.classList.add("hidden");
  }

  // Use provided letter or generate one if not provided
  // Only set letter if outcome is not reject
  if (outcomeType !== "reject") {
    const finalLetter = letter || generateLetter(outcomeType);
    letterText.value = finalLetter;
  }

  switchScreen(SCREENS.ending);
}

// Event bindings

introNextBtn.addEventListener("click", () => {
  switchScreen(SCREENS.setup);
});

setupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nameEl = document.getElementById("student-name");
  const gpaEl = document.getElementById("student-gpa");
  const attEl = document.getElementById("student-attendance");

  const name = nameEl.value.trim() || "HKU Student";
  const gpa = parseFloat(gpaEl.value);
  const attendance = parseFloat(attEl.value);

  if (Number.isNaN(gpa) || Number.isNaN(attendance)) {
    alert("Please enter valid numbers for GPA and attendance.");
    return;
  }
  if (gpa < 0 || gpa > 4.3) {
    alert("GPA should be between 0.00 and 4.30.");
    return;
  }
  if (attendance < 0 || attendance > 100) {
    alert("Attendance should be between 0 and 100.");
    return;
  }

  studentConfig = {
    name,
    gpa,
    attendance,
  };

  language = "en"; // default, will adapt on first chat message

  switchScreen(SCREENS.game);
  resetGameState();
});

chatSendBtn.addEventListener("click", handleUserSubmit);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleUserSubmit();
  }
});

// Character counter
const charCounter = document.getElementById("char-counter");
chatInput.addEventListener("input", () => {
  const len = chatInput.value.length;
  const max = 300;
  charCounter.textContent = `${len}/${max}`;
  
  charCounter.classList.remove("warning", "danger");
  if (len >= max) {
    charCounter.classList.add("danger");
  } else if (len >= max * 0.8) {
    charCounter.classList.add("warning");
  }
});

thoughtToggle.addEventListener("change", () => {
  // No need to recompute; new messages will respect toggle
});

copyLetterBtn.addEventListener("click", () => {
  const text = letterText.value;
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(
          language === "zh"
            ? "推薦信內容已複製到剪貼簿。"
            : "Letter text copied to clipboard."
        );
      })
      .catch(() => {
        alert(
          language === "zh"
            ? "無法使用剪貼簿功能，請手動複製文字。"
            : "Clipboard is not available. Please copy the text manually."
        );
      });
  } else {
    alert(
      language === "zh"
        ? "瀏覽器不支援直接複製，請手動選取文字。"
        : "Your browser does not support direct copying. Please select and copy manually."
    );
  }
});

playAgainBtn.addEventListener("click", () => {
  switchScreen(SCREENS.game);
  resetGameState();
});

// See results button (end overlay)
seeResultsBtn.addEventListener("click", () => {
  endOverlay.classList.add("hidden");
  endGame();
});

// Sound toggle
soundToggle.addEventListener("click", () => {
  soundMuted = !soundMuted;
  soundToggle.classList.toggle("muted", soundMuted);
  soundToggle.querySelector(".sound-icon").textContent = soundMuted ? "🔇" : "🔊";
  
  if (soundMuted) {
    bgMusic.pause();
  } else {
    bgMusic.play().catch(() => {});
  }
});

// Confetti effect for celebrations
function createConfetti() {
  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);
  
  const colors = ["#ffd93d", "#ff6b6b", "#74b9ff", "#6bcb77", "#a8e6cf"];
  
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(confetti);
  }
  
  // Remove container after animations complete
  setTimeout(() => container.remove(), 5000);
}

// Sad rain effect for rejection
function createSadRain() {
  const container = document.createElement("div");
  container.className = "confetti-container";
  container.style.background = "rgba(0, 0, 0, 0.1)";
  document.body.appendChild(container);
  
  for (let i = 0; i < 30; i++) {
    const drop = document.createElement("div");
    drop.className = "confetti";
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    drop.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
    drop.style.background = "#aaa";
    drop.style.opacity = "0.5";
    drop.style.borderRadius = "50%";
    drop.style.width = "8px";
    drop.style.height = "8px";
    container.appendChild(drop);
  }
  
  setTimeout(() => container.remove(), 4000);
}

