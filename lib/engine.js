/**
 * Promptwright scoring + rewrite engine.
 *
 * Pure functions, no DOM, no network, no dependencies. This runs entirely in
 * the visitor's browser — prompts are never sent anywhere. Keep it that way:
 * it is what makes the free tier cost nothing to serve.
 */

/* ---------------------------------------------------------------- data */

const MODELS = [
  {
    id: "claude", name: "Claude", vendor: "Anthropic", confidence: "documented",
    bullets: [
      "<b>XML section tags.</b> Wrapping instructions, context and examples in their own tags is the house style and reduces misreading on long prompts.",
      "<b>Say why, not just what.</b> Giving the motivation behind a rule lets it generalise instead of following the rule literally.",
      "<b>3–5 examples in <code>&lt;example&gt;</code> tags.</b> Diverse ones, so it doesn't latch onto an accidental pattern.",
      "<b>Role in the system prompt.</b> One sentence measurably shifts tone and focus.",
      "<b>Ask for more than the minimum.</b> It follows scope literally, so 'go beyond the basics' has to be stated."
    ],
    shape: "<role> · <context> · <task> · <constraints> · <examples> · <output_format> · <success_criteria>"
  },
  {
    id: "gpt", name: "GPT", vendor: "OpenAI", confidence: "documented",
    bullets: [
      "<b>Developer message carries the rules.</b> Instructions there outrank anything in the user turn.",
      "<b>Markdown headers for sections, XML for quoted material.</b> The docs recommend both together, each for a different job.",
      "<b>Context goes last.</b> It changes per request, so it sits at the end of the message.",
      "<b>Spell out the logic.</b> Non-reasoning models need explicit steps; reasoning models do better with the goal and room to work.",
      "<b>JSON schema for anything machine-read.</b> Structured outputs instead of 'return JSON'."
    ],
    shape: "DEVELOPER: # Identity · # Instructions · # Output format · # Examples — USER: # Context (<reference>) · # Request"
  },
  {
    id: "gemini", name: "Gemini", vendor: "Google", confidence: "documented",
    bullets: [
      "<b>Always include few-shot examples.</b> The guidance treats them as standard, not optional, and says clear examples can replace written instructions.",
      "<b>Keep example formatting identical.</b> The format is learned from the examples, so inconsistency between them leaks into the output.",
      "<b>Output prefixes work.</b> Start the answer yourself and let it continue the pattern.",
      "<b>Constraints stated as do and don't.</b> Including an explicit length bound.",
      "<b>Split complex asks.</b> One instruction per prompt, chained, rather than one prompt doing five things."
    ],
    shape: "TASK · CONTEXT · EXAMPLES (uniform) · CONSTRAINTS · OUTPUT FORMAT · output prefix"
  },
  {
    id: "grok", name: "Grok", vendor: "xAI", confidence: "community",
    bullets: [
      "<b>Conversational beats scaffolded.</b> Community guidance is consistent that heavy XML scaffolding works against it.",
      "<b>Lean system prompt.</b> Persona, mode and output format in a few lines; length is reported to cost more than it buys.",
      "<b>System instructions carry weight.</b> Reported to outrank conflicting user text, so put the non-negotiables there.",
      "<b>Anchor anything time-sensitive.</b> Live-data answers need an explicit date and scope.",
      "<b>Be blunt.</b> Directness reportedly lands better than formal register."
    ],
    shape: "One tight persona line, the ask in plain prose, then a short must-have list"
  },
  {
    id: "open", name: "Open weights", vendor: "Llama · Mistral · Qwen", confidence: "community",
    bullets: [
      "<b>Rigid, repetitive structure.</b> Fixed <code>###</code> headers in the same order every time.",
      "<b>Restate the format at the end.</b> Instruction drift over long prompts is the common failure.",
      "<b>Shorter is safer.</b> Instruction-following degrades faster with prompt length than on frontier models.",
      "<b>Examples do the heavy lifting.</b> One or two concrete pairs outperform a paragraph of description.",
      "<b>Forbid the preamble explicitly.</b> Otherwise you get 'Sure! Here is…' in front of your JSON."
    ],
    shape: "### Instruction · ### Input · ### Constraints · ### Output format (restated last)"
  }
];

const TASK_TYPES = [
  { id: "general",    label: "General / anything",        bias: {} },
  { id: "writing",    label: "Writing & content",         bias: { audience: 1.5, format: 1.3, examples: 1.3, constraints: 1.2, criteria: 0.8 } },
  { id: "code",       label: "Code & engineering",        bias: { constraints: 1.6, criteria: 1.5, format: 1.3, role: 0.5, examples: 0.9 } },
  { id: "research",   label: "Research & analysis",       bias: { context: 1.5, criteria: 1.5, constraints: 1.4, examples: 0.6 } },
  { id: "extraction", label: "Data extraction / JSON",    bias: { format: 2.0, examples: 1.8, constraints: 1.3, role: 0.3, audience: 0.3 } }
];

const SAMPLES = [
  {
    task: "writing",
    text: "write me a good blog post about AI for my company website, make it engaging and SEO friendly"
  },
  {
    task: "code",
    text: "fix my python script, it keeps crashing when I run it on the big csv file. make it faster too"
  },
  {
    task: "research",
    text: "Compare the top project management tools and tell me which one is best. I need to decide soon."
  },
  {
    task: "writing",
    text: "You are a senior technical writer. Write a 600-word onboarding guide for our REST API, aimed at backend developers who have never used OAuth. The goal is to cut support tickets about authentication, which are currently 40% of our volume. Use numbered steps with a runnable curl example per step. Do not use marketing language and do not mention competitors. A good guide lets a developer make their first authenticated call without asking us anything."
  },
  {
    task: "writing",
    text: "Write a brief but comprehensive guide to our pricing changes. Summarize this email thread, draft the customer FAQ, and also create a short video script. Keep it simple but technical."
  }
];

/* ------------------------------------------------------------ detection */

const RX = {
  role:       /\b(you are|you'?re an?|act as|acting as|assume the role|your role is|as an? (expert|experienced|senior|professional|certified))\b/i,
  audience:   /\b(audience|readers?|aimed at|written for|targeted at|intended for|for (beginners|executives|engineers|developers|designers|students|kids|children|managers|clients|customers|laypeople|a general audience)|for (a|an) [a-z]+ (audience|reader|developer|engineer|manager|executive|beginner|team)|non[- ]?technical|lay ?(person|people)|who (are|have) (new|never)|assume (the reader|they (know|have)))\b/i,
  format:     /\b(bullet(ed)? (point|list)|numbered (list|steps)|table|json|yaml|xml|csv|markdown|outline|headings?|sections?|format|structured? (as|like)|in the form of|one per line|code block)\b/i,
  length:     /\b(\d+\s*[-–]?\s*\d*\s*(words?|sentences?|paragraphs?|bullets?|items?|pages?|lines?|chars?|characters?)|no more than|at most|under \d+|about \d+|roughly \d+|keep it (short|brief)|one page|tl;?dr)\b/i,
  examples:   /\b(for example|for instance|e\.g\.|example:|examples:|here'?s an example|sample (input|output|response)|like this:|<example|few[- ]shot)\b/i,
  constraints:/\b(do not|don'?t|avoid|never|must not|exclude|without|only (use|include|return)|limited to|refrain|no (jargon|fluff|preamble|marketing|filler))\b/i,
  context:    /\b(because|since|the (goal|purpose|reason|context|background) is|background:|context:|i'?m (working|building|writing|trying|launching)|we'?re (working|building|launching)|our (team|company|product|users|customers)|so that|in order to|currently|i need to|we need to|help me (decide|choose)|trying to decide)\b/i,
  criteria:   /\b(success|criteria|a good \w+ (is|means|looks|lets|should|does)|a good (answer|output|result|one)|should (include|cover|contain|mention)|make sure (it|to|you)|requirements?|checklist|(done|correct|right|finished|working|good) when|it (is|'?s) (correct|right|done) (when|if)|acceptance|i'?ll know|must pass)\b/i,
  imperative: /^\s*(write|create|draft|build|make|generate|summari[sz]e|analy[sz]e|explain|compare|list|review|rewrite|translate|classify|extract|design|plan|fix|debug|refactor|optimi[sz]e|evaluate|outline|critique|convert|get|pull|identify|find|parse|turn|map|give me|help me|tell me|suggest|recommend|propose|draw|calculate)\b/i,
  steps:      /(\n\s*[-*•]|\n\s*\d+[.)]\s|\bstep \d|numbered (list|steps)|\bfirst,|\bthen,|\bfinally,)/i,
  // Partial-credit signals: weaker than an explicit statement, but not nothing.
  deliverable:/\b(blog post|article|email|essay|report|summary|script|function|class|query|tweet|thread|landing page|proposal|memo|guide|tutorial|outline|plan|readme|documentation|slide|deck|caption|headline|cover letter|resume)\b/i,
  topic:      /\b(about|regarding|on the topic of|covering|for (my|our|the) [a-z]+)\b/i
};

const HEDGES = /\b(good|nice|better|best|great|amazing|awesome|stuff|things?|etc\.?|some|a few|appropriate|relevant|engaging|compelling|high[- ]quality|professional[- ]looking|optimi[sz]ed?|improve|interesting|creative|modern|clean|robust|proper|suitable|effective|powerful|seamless)\b/gi;

const DIMS = [
  { key: "role",        label: "Role & expertise",     w: 10 },
  { key: "task",        label: "Task specificity",     w: 16 },
  { key: "context",     label: "Context & purpose",    w: 15 },
  { key: "audience",    label: "Audience",             w: 9  },
  { key: "format",      label: "Output format",        w: 14 },
  { key: "length",      label: "Length & scope",       w: 9  },
  { key: "constraints", label: "Constraints",          w: 10 },
  { key: "examples",    label: "Examples",             w: 8  },
  { key: "criteria",    label: "Definition of done",   w: 9  }
];

const ADVICE = {
  role:        { t: "Name the expertise you want", y: "A single role sentence shifts vocabulary, depth and what gets assumed. Without one you get a generalist answer.", add: "You are a ⟦ seniority + discipline, e.g. senior data engineer ⟧." },
  task:        { t: "Replace the hedge words with measurable ones", y: "Words like <code>good</code> and <code>engaging</code> make the model guess your taste. Name the observable property instead.", add: null },
  context:     { t: "Say why you need this", y: "Stated purpose is the highest-leverage addition in every vendor's guidance — it lets the model generalise to decisions you didn't anticipate.", add: "Context: ⟦ what you're working on and why this output matters ⟧." },
  audience:    { t: "Name who reads the output", y: "Reading level and assumed knowledge are unguessable, and getting them wrong makes the output unusable even when it's correct.", add: "Audience: ⟦ who reads this and what they already know ⟧." },
  format:      { t: "Specify the shape of the answer", y: "Table, numbered list, JSON, prose. Unspecified format means you get the model's default, which changes between versions.", add: "Format: ⟦ table / numbered list / JSON matching this schema ⟧." },
  length:      { t: "Put a bound on the length", y: "No bound means verbosity drift. A number is better than 'concise', which every model reads differently.", add: "Keep it to ⟦ number ⟧ ⟦ words / bullets / paragraphs ⟧." },
  constraints: { t: "List what to avoid", y: "Negative constraints prevent the three failure modes you already know about — and they're the cheapest thing in the prompt.", add: "Do not: ⟦ thing to avoid ⟧. Do not: ⟦ second thing ⟧." },
  examples:    { t: "Show one worked example", y: "Examples steer format and tone more reliably than any description of them. One good pair beats a paragraph of instructions.", add: "Example of what I want:\n⟦ short input ⟧ → ⟦ the ideal output ⟧" },
  criteria:    { t: "Define what a correct answer looks like", y: "Without a definition of done, neither you nor the model can tell a good attempt from a bad one — and you can't A/B two prompts.", add: "This is right when ⟦ the observable test you'd apply ⟧." }
};

/* ------------------------------------------------------------- warnings */
/* The channels above score what's ABSENT. These find what's PRESENT and wrong —
   the failures that make a prompt actively misfire rather than merely vague. */

const CONTRADICTIONS = [
  { a: /\b(brief|short|concise|succinct|quick|tl;?dr|punchy)\b/i,
    b: /\b(detailed|comprehensive|in[- ]depth|thorough|exhaustive|complete|extensive)\b/i,
    t: "You asked for it short and detailed",
    y: "Pick one, or bound them separately — \"three paragraphs, but go deep on the second\". Otherwise the model splits the difference and satisfies neither." },
  { a: /\b(simple|basic|beginner|plain english|eli5|non[- ]?technical|layman)\b/i,
    b: /\b(technical|advanced|rigorous|expert[- ]level|academic|in the weeds)\b/i,
    t: "Simple and technical are both being asked for",
    y: "Say which audience wins. What you probably want is technical accuracy in plain language — but that's a third instruction, and you have to write it." },
  { a: /\b(formal|professional|corporate|academic|buttoned)\b/i,
    b: /\b(casual|conversational|informal|friendly|fun|witty|playful|chatty)\b/i,
    t: "The tone instructions conflict",
    y: "Formal and casual are being requested together. Name one register, or say explicitly where each one applies." },
  { a: /\b(creative|imaginative|original|invent|novel)\b/i,
    b: /\b(factual|accurate|cite|sourced|no speculation|evidence|verifiable)\b/i,
    t: "Creative and strictly factual are pulling apart",
    y: "Say which constraint is hard. \"Inventive framing, every fact checkable\" is a different and much better instruction than \"be creative\"." }
];

const REFERENT = /\b(this|these|the following|my|our|attached|the)\s+(text|article|code|script|data|csv|file|document|doc|email|post|list|table|json|paragraph|essay|content|transcript|notes|spreadsheet|draft|resume|report|logs?|error)\b/i;

const ASK_VERB = "write|create|draft|make|build|generate|summari[sz]e|analy[sz]e|explain|compare|list|review|rewrite|translate|classify|extract|design|plan|fix|debug|refactor|optimi[sz]e|evaluate|outline|critique|convert|add|include|suggest|recommend|research|calculate|identify|turn|map";

function countAsks(text) {
  let n = 0;
  for (const s of splitSentences(text)) {
    const bare = s.replace(/^\s*([-*•]|\d+[.)])\s*/, "");
    if (RX.imperative.test(bare)) n++;
    const more = bare.match(new RegExp("(?:\\b(?:and|also|then|plus)|[,;])\\s+(?:" + ASK_VERB + ")\\b", "gi"));
    if (more) n += more.length;
  }
  return n;
}

function findWarnings(text) {
  const out = [];
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Refers to material the model cannot see.
  const bulk = words > 140 || /```|\n-{3,}|\n={3,}/.test(text) || text.split("\n").some(l => l.length > 220);
  const ref = text.match(REFERENT);
  if (ref && !bulk) out.push({
    t: "You refer to “" + ref[0] + "” but didn't include it",
    y: "The model can't see your files, your screen, or your last conversation. Paste the content in, or it will quietly invent something to work on."
  });

  // Several unrelated jobs crammed into one turn.
  const n = countAsks(text);
  if (n >= 4) out.push({
    t: "That's " + n + " separate requests in one prompt",
    y: "Every vendor's guidance says to split these. You'll get the first done well and the rest done briefly. Chain them instead, feeding each answer into the next."
  });

  for (const c of CONTRADICTIONS) if (c.a.test(text) && c.b.test(text)) out.push({ t: c.t, y: c.y });

  // "list all the X" with no bound.
  if (/\b(list|give me|provide|name|generate)\b[^.?!]{0,40}\b(all|every|as many as)\b/i.test(text) && !RX.length.test(text)) out.push({
    t: "You asked for “all” of something with no limit",
    y: "An unbounded list stops where the model runs out of momentum, which is not the same as finished. Give it a number."
  });

  return out;
}

/* -------------------------------------------------------------- parsing */

function splitSentences(text) {
  const parts = [];
  text.split(/\n+/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    if (/^\s*([-*•]|\d+[.)])\s/.test(line)) { parts.push(t); return; }
    (t.match(/[^.!?]+[.!?]*/g) || [t]).forEach(s => { if (s.trim()) parts.push(s.trim()); });
  });
  return parts;
}

function parse(text) {
  const out = { role: [], context: [], audience: [], task: [], constraints: [], format: [], examples: [], criteria: [] };
  splitSentences(text).forEach(s => {
    const bare = s.replace(/^\s*([-*•]|\d+[.)])\s*/, "");
    // A sentence that opens with an imperative verb is the ask, whatever else it mentions.
    if (RX.imperative.test(bare))        out.task.push(bare);
    else if (RX.role.test(bare))         out.role.push(bare);
    else if (RX.examples.test(bare))     out.examples.push(bare);
    else if (RX.criteria.test(bare))     out.criteria.push(bare);
    else if (RX.constraints.test(bare))  out.constraints.push(bare);
    else if (RX.format.test(bare) || RX.length.test(bare)) out.format.push(bare);
    else if (RX.audience.test(bare))     out.audience.push(bare);
    else if (RX.context.test(bare))      out.context.push(bare);
    else                                 out.task.push(bare);
  });
  // Never leave the task empty: promote the longest sentence we parked elsewhere.
  if (!out.task.length) {
    for (const pool of ["context", "audience", "format", "criteria", "role"]) {
      if (!out[pool].length) continue;
      const longest = out[pool].reduce((a, b) => (b.length > a.length ? b : a));
      out[pool] = out[pool].filter(s => s !== longest);
      out.task.push(longest);
      break;
    }
  }
  return out;
}

/* ------------------------------------------------------------- analysis */

function analyze(text, taskTypeId) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hedges = [...new Set((text.match(HEDGES) || []).map(h => h.toLowerCase()))];
  const bias = (TASK_TYPES.find(t => t.id === taskTypeId) || TASK_TYPES[0]).bias;

  const parsed = parse(text);
  const raw = {};
  raw.role        = RX.role.test(text) ? 100 : 0;
  // Partial credit where the prompt implies something without stating it: a named
  // deliverable half-specifies the format, a topic phrase gives the model some ground.
  raw.context     = RX.context.test(text) ? (words > 45 ? 100 : 70) : (RX.topic.test(text) ? 35 : 0);
  raw.audience    = RX.audience.test(text) ? 100 : 0;
  raw.format      = RX.format.test(text) ? 100 : (RX.deliverable.test(text) ? 40 : 0);
  raw.length      = RX.length.test(text) ? 100 : 0;
  raw.constraints = RX.constraints.test(text) ? 100 : 0;
  raw.examples    = RX.examples.test(text) ? 100 : 0;
  raw.criteria    = RX.criteria.test(text) ? 100 : 0;

  // Task specificity: a real imperative ask, enough substance, structure, and few hedges.
  // Hedges are scored by density, so one "good" in a long brief isn't treated like
  // two in a one-line request.
  let task = 0;
  if (parsed.task.some(s => RX.imperative.test(s))) task += 38;
  else if (/\b(write|create|make|build|help|explain|give|tell|find|do)\b/i.test(text)) task += 16;
  task += Math.min(34, Math.round(words / 3.2));
  if (RX.steps.test(text)) task += 10;
  if (/\?/.test(text)) task += 5;
  // Concrete particulars — versions, measurements, quoted strings, code — are the
  // strongest signal that an ask is specific rather than merely long.
  if (/(\b\d+(?:\.\d+)?[-\s]*(?:gb|mb|kb|ms|px|words?|lines?|rows?|items?)\b|\b\d+\s*%|\bv?\d+\.\d+\b|```|\bdef \w+|\w+\(\)|"[^"]{3,}")/i.test(text)) task += 10;
  task -= Math.min(24, Math.round((hedges.length / Math.max(12, words)) * 300));
  raw.task = Math.max(0, Math.min(100, task));

  let totalW = 0, got = 0;
  const dims = DIMS.map(d => {
    const w = +(d.w * (bias[d.key] ?? 1)).toFixed(2);
    totalW += w; got += raw[d.key] * w;
    return { ...d, w, score: raw[d.key], state: raw[d.key] >= 70 ? "ok" : raw[d.key] >= 35 ? "mid" : "low" };
  });
  dims.sort((a, b) => b.w - a.w);

  const warnings = findWarnings(text);
  // A contradiction or a dangling reference actively degrades a prompt, so it costs
  // score on top of whatever is missing. The cost is proportional: a contradiction
  // inside an otherwise complete prompt IS the problem, while in an empty one it is
  // the least of them — and a flat penalty just pins bad prompts to zero.
  const base = Math.round(got / totalW);
  const total = Math.max(0, Math.min(100, base - Math.round(base * Math.min(0.45, warnings.length * 0.15))));
  const dm = text.match(RX.deliverable);

  return {
    total, dims, hedges, words, parsed, warnings,
    taskId: taskTypeId,
    deliverable: dm ? dm[0].toLowerCase() : null
  };
}

/* Generic advice is what makes every prompt tool feel the same. Where the prompt
   tells us enough, say something only this prompt could prompt. */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function specialize(key, a) {
  const base = ADVICE[key];
  const d = a.deliverable;
  const S = (t, y) => ({ t, y, add: base.add });

  if (key === "format" && d)
    return S("You asked for a " + d + " but not what it should look like",
      "Name the structure: headings, numbered steps, a table, a word count. Without it you get whatever shape that model defaults to this month.");
  if (key === "length" && d)
    return S("No length on the " + d,
      "“" + cap(d) + "” means 200 words to one model and 2,000 to another. A number removes the guess entirely.");
  if (key === "audience" && d)
    return S("Who is this " + d + " for?",
      "Reading level and assumed knowledge change almost every sentence. Unsaid, the model aims at a general reader — which is usually nobody.");
  if (key === "constraints" && d)
    return S("Name what would make the " + d + " wrong",
      "The two or three things you already know you don't want. Cheapest tokens in the prompt, and they prevent the most rework.");
  if (key === "examples" && a.taskId === "extraction")
    return S("Show one input and its exact output",
      "For extraction this matters more than anything else here — one worked pair pins the schema down better than a paragraph describing it.");
  if (key === "criteria" && a.taskId === "code")
    return S("Say how you'll know the code is right",
      "The test that has to pass, the input that breaks today, the behaviour you expect. Without it you get code that looks plausible and was never checked.");
  if (key === "context" && a.taskId === "research")
    return S("Say what decision this feeds",
      "A comparison for someone choosing this week reads nothing like a market overview. State the decision and the constraints around it.");
  if (key === "task" && !a.hedges.length)
    return S("Make the ask itself more concrete",
      "The instruction is clear but thin. Name the thing to produce, the input it works from, and the one decision you'd otherwise have to make yourself.");
  if (key === "role" && a.taskId === "code")
    return S("Name the stack, not just the language",
      "“Senior Python engineer” is weaker than “Python 3.12, FastAPI, no external deps”. Version and library constraints change the answer more than seniority does.");
  return base;
}

function gradeFor(score, words) {
  if (!words) return ["Waiting for a prompt", "Paste a prompt on the left, or load one of the samples."];
  if (score >= 85) return ["Ready to send", "Nothing material is missing. The rewrite below just normalises it to your target model's shape."];
  if (score >= 65) return ["Workable, under-specified", "This will get a reasonable answer, but a few additions would remove the guesswork."];
  if (score >= 40) return ["Will need two or three rounds", "Enough is missing that the model has to invent your intent — which is where results drift from the goal."];
  return ["Mostly guesswork for the model", "Almost every decision has been left open. Expect an answer aimed at the average user, not you."];
}

/* ------------------------------------------------------------- rewrites */

const SLOT = s => "⟦ " + s + " ⟧";
const join = (arr, fb) => arr.length ? arr.join(" ") : SLOT(fb);
const bullets = (arr, fb) => arr.length
  ? arr.map(s => "- " + s.replace(/^(do not|don'?t|avoid)\s*/i, m => m.toLowerCase() === "avoid " ? "Avoid " : "Do not ")).join("\n")
  : "- " + SLOT(fb);

function buildRewrite(a, modelId, taskTypeId) {
  const p = a.parsed;
  const task = join(p.task, "the task, as one imperative sentence");
  const ctx = join(p.context, "what you're working on and why this output matters");
  const aud = join(p.audience, "who reads this and what they already know");
  const fmt = join(p.format, "table / numbered list / JSON schema — and a length bound");
  const cons = bullets(p.constraints, "the failure mode you most want to avoid");
  const crit = join(p.criteria, "the observable test that makes this answer correct");
  const role = p.role.length ? p.role.join(" ") : "You are " + SLOT("seniority + discipline") + ".";
  const exIn = p.examples.length ? p.examples.join(" ") : null;
  const strictJson = taskTypeId === "extraction";

  if (modelId === "claude") {
    return [
      "────── SYSTEM PROMPT ──────",
      role + " " + SLOT("one line on the standard you hold yourself to"),
      "",
      "────── USER MESSAGE ──────",
      "<context>",
      ctx,
      "Audience: " + aud,
      "</context>",
      "",
      "<task>",
      task,
      "</task>",
      "",
      "<constraints>",
      cons,
      "</constraints>",
      "",
      "<examples>",
      "<example>",
      exIn ? "Note: " + exIn : "Input: " + SLOT("a short, realistic input"),
      "Output: " + SLOT("the ideal output, written exactly as you want it"),
      "</example>",
      "<!-- 3-5 diverse examples work best; add two more covering edge cases -->",
      "</examples>",
      "",
      "<output_format>",
      fmt,
      "</output_format>",
      "",
      "<success_criteria>",
      crit,
      "</success_criteria>",
      "",
      "Go beyond the minimum the task strictly requires. If anything above is ambiguous, ask me before you start."
    ].join("\n");
  }

  if (modelId === "gpt") {
    return [
      "────── DEVELOPER MESSAGE ──────",
      "# Identity",
      role,
      "",
      "# Instructions",
      "1. " + task,
      "2. Follow the output format exactly; it is not a suggestion.",
      "3. Where the context is silent, state your assumption rather than inventing a fact.",
      "",
      "## Do not",
      cons,
      "",
      "# Output format",
      fmt,
      strictJson ? "Return only valid JSON conforming to the schema. No prose, no code fences." : "Return only the deliverable — no preamble, no summary of what you did.",
      "",
      "# Examples",
      "<example>",
      exIn ? "<note>" + exIn + "</note>" : "<input>" + SLOT("a short, realistic input") + "</input>",
      "<output>" + SLOT("the ideal output") + "</output>",
      "</example>",
      "",
      "────── USER MESSAGE ──────",
      "# Request",
      task,
      "",
      "# Context",
      "<reference audience=\"" + aud.replace(/"/g, "'") + "\">",
      ctx,
      "</reference>",
      "",
      "# Definition of done",
      crit
    ].join("\n");
  }

  if (modelId === "gemini") {
    return [
      role,
      "",
      "TASK",
      task,
      "",
      "CONTEXT",
      ctx,
      "Audience: " + aud,
      "",
      "EXAMPLES",
      "Input: " + SLOT("a short, realistic input"),
      "Output: " + SLOT("the ideal output"),
      "",
      "Input: " + SLOT("a second input covering a different case"),
      "Output: " + SLOT("the ideal output, formatted identically to the first"),
      exIn ? "\n(From your original prompt: " + exIn + ")" : null,
      "",
      "CONSTRAINTS",
      cons,
      "",
      "OUTPUT FORMAT",
      fmt,
      "",
      "SUCCESS CRITERIA",
      crit,
      "",
      "Begin your response with:",
      SLOT("the first line of the output you want, so the pattern continues")
    ].filter(l => l !== null).join("\n");
  }

  if (modelId === "grok") {
    return [
      "────── SYSTEM ──────",
      role.replace(/\.$/, "") + ". Be direct, skip the preamble, and say so plainly when something in the request doesn't hold up.",
      "",
      "────── USER ──────",
      task + " " + ctx,
      "",
      "It's for " + aud.replace(/^Audience:\s*/i, "") + ".",
      "",
      "Must-haves:",
      cons,
      "- Format: " + fmt,
      "- " + crit,
      "",
      "Current as of " + SLOT("today's date") + " — flag anything you're reasoning about from stale information."
    ].join("\n");
  }

  // open weights
  return [
    "### Instruction",
    role,
    task,
    "",
    "### Input",
    ctx,
    "Audience: " + aud,
    "",
    "### Example",
    "Input: " + SLOT("a short, realistic input"),
    "Output: " + SLOT("the ideal output"),
    "",
    "### Constraints",
    cons,
    "- Do not add any preamble, apology, or explanation of what you are about to do.",
    "",
    "### Output format",
    fmt,
    "",
    "### Reminder",
    "Respond with only the output described under 'Output format' above. " + crit
  ].join("\n");
}

const MODEL_NOTES = {
  claude: [
    "Wrapped each part in its own XML tag — the structure Anthropic's guide recommends when a prompt mixes instructions, context and examples.",
    "Moved the role into a separate system prompt and left per-request detail in the user turn.",
    "Added an explicit 'go beyond the minimum', because Claude reads scope literally.",
    "Left a comment to grow the example set to 3–5 diverse cases."
  ],
  gpt: [
    "Split into a developer message (rules that persist) and a user message (this request's data), matching OpenAI's instruction hierarchy.",
    "Markdown headers mark the sections; XML marks the quoted reference material — the combination the docs recommend.",
    "Context sits at the end, since it's the part that changes between requests.",
    "Numbered the instructions so step order is unambiguous for non-reasoning models."
  ],
  gemini: [
    "Promoted examples to a first-class block with two uniformly formatted pairs — Google's guidance treats few-shot as standard.",
    "Added an output prefix line so the model continues your pattern rather than inventing one.",
    "Stated constraints as explicit do/don't lines with a length bound.",
    "Kept each labelled block short; split this into chained prompts if the task grows past one deliverable."
  ],
  grok: [
    "Deliberately did not use XML scaffolding — community guidance is that it works against Grok.",
    "Kept the system line to one sentence; the non-negotiables go there because system text reportedly outranks user text.",
    "Rewrote the ask as plain prose with a short must-have list underneath.",
    "Added a date anchor, which matters for anything touching live data."
  ],
  open: [
    "Fixed `###` headers in a constant order — smaller models follow rigid templates far better than prose.",
    "Restated the output format at the very end to counter instruction drift.",
    "Added an explicit ban on preambles, the most common failure with open-weight instruct models.",
    "Kept it short; instruction-following degrades faster with length here than on frontier models."
  ]
};


export {
  MODELS,
  TASK_TYPES,
  SAMPLES,
  DIMS,
  ADVICE,
  MODEL_NOTES,
  analyze,
  specialize,
  gradeFor,
  buildRewrite,
  findWarnings,
  parse,
};
