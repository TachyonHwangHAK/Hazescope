// Speech output via the browser's Web Speech API. Voice availability varies by device;
// we pick the best match for language + gender and soften pitch/rate.
const FEMALE = /(female|woman|samantha|karen|moira|tessa|victoria|allison|ava|susan|zira|aria|jenny|libby|sonia|natasha|emma|serena|fiona|kate|nicky|joanna|salli|kimberly|ivy|clara|michelle|luna|xiaoxiao|xiaoyi|xiaohan|xiaomo|xiaoxuan|xiaorui|huihui|yaoyao|ting-?ting|mei-?jia|sin-?ji|lili|yating|hanhan|hiumaan|xiaochen|xiaoshuang|google 普通话|google 國語|google 粤語)/i;
const MALE = /(\bmale\b|\bman\b|daniel|alex\b|fred|aaron|arthur|oliver|tom\b|guy|david|mark|ryan|thomas|george|james|rishi|gordon|lee\b|matthew|joey|justin|brian|christopher|eric|roger|steffan|yunxi|yunyang|yunjian|yunze|yunhao|yunfeng|yunxia|kangkang|li-?mu|zhiwei|danny|wanlung|yunjhe)/i;

export class Voice {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    this.voices = [];
    this.enabled = true; this.gender = 'female'; this.lang = 'en'; this.rate = 1;
    this.unlocked = false; this.onState = null; this.queueId = 0;
    if (this.supported) {
      const load = () => { this.voices = window.speechSynthesis.getVoices() || []; };
      load();
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
      if (!window.speechSynthesis.addEventListener) window.speechSynthesis.onvoiceschanged = load;
    }
  }

  // Browsers (iOS Safari in particular) only allow speech after a user gesture.
  unlock() {
    if (!this.supported || this.unlocked) return;
    try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ }
    this.unlocked = true;
  }

  pick() {
    const want = this.lang === 'zh' ? /^(zh|cmn)/i : /^en/i;
    let list = this.voices.filter((v) => want.test(v.lang || ''));
    if (this.lang === 'zh') {
      // Prefer Mandarin (CN/SG/TW) over Cantonese for 华语
      const mandarin = list.filter((v) => !/HK|yue/i.test(v.lang) && !/粤|粵|cantonese|hiumaan|wanlung/i.test(v.name));
      if (mandarin.length) list = mandarin;
    } else {
      const pref = ['en-SG', 'en-GB', 'en-AU', 'en-US'];
      const rank = (v) => { const i = pref.indexOf((v.lang || '').replace('_', '-')); return i < 0 ? 99 : i; };
      list.sort((a, b) => rank(a) - rank(b));
    }
    const re = this.gender === 'female' ? FEMALE : MALE;
    const quality = (v) => (/(natural|neural|premium|enhanced|online)/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    const gendered = list.filter((v) => re.test(v.name)).sort((a, b) => quality(b) - quality(a));
    if (gendered.length) return { voice: gendered[0], matched: true };
    const other = this.gender === 'female' ? MALE : FEMALE;
    const neutral = list.filter((v) => !other.test(v.name)).sort((a, b) => quality(b) - quality(a));
    return { voice: neutral[0] || list[0] || null, matched: false };
  }

  describe() {
    if (!this.supported) return { status: 'unsupported' };
    const { voice, matched } = this.pick();
    if (!voice) return { status: 'none' };
    return { status: matched ? 'ok' : 'approx', name: voice.name };
  }

  stop() {
    if (!this.supported) return;
    this.queueId++;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    this.onState && this.onState(false);
  }

  speak(text, { force = false } = {}) {
    if (!this.supported || (!this.enabled && !force) || !text) return;
    this.stop();
    const id = this.queueId;
    const { voice, matched } = this.pick();
    // Strip characters TTS reads badly; split into short chunks (Chrome cuts long utterances).
    const clean = String(text).replace(/[•·→←↑↓★✦]/g, ' ').replace(/µg\/m³/g, this.lang === 'zh' ? '微克每立方米' : 'micrograms per cubic metre')
      .replace(/PM2\.5/g, this.lang === 'zh' ? 'PM 2.5' : 'P M 2.5').replace(/\s+/g, ' ').trim();
    const parts = clean.match(this.lang === 'zh' ? /[^。！？；\n]+[。！？；]?/g : /[^.!?;\n]+[.!?;]?/g) || [clean];
    const chunks = [];
    for (const p of parts) {
      const last = chunks[chunks.length - 1];
      if (last && (last + p).length < 160) chunks[chunks.length - 1] = last + ' ' + p; else chunks.push(p.trim());
    }
    const basePitch = this.gender === 'female' ? (matched ? 1.12 : 1.3) : (matched ? 0.95 : 0.78);
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = this.lang === 'zh' ? 'zh-CN' : 'en-SG';
      u.pitch = basePitch; u.rate = Math.max(0.6, Math.min(1.4, this.rate * (this.lang === 'zh' ? 0.95 : 0.97)));
      u.volume = 1;
      if (i === 0) u.onstart = () => { if (id === this.queueId) this.onState && this.onState(true); };
      if (i === chunks.length - 1) {
        u.onend = () => { if (id === this.queueId) this.onState && this.onState(false); };
        u.onerror = u.onend;
      }
      window.speechSynthesis.speak(u);
    });
    // Chrome desktop can pause long queues; resume periodically while speaking.
    clearInterval(this._keep);
    this._keep = setInterval(() => {
      if (id !== this.queueId || !window.speechSynthesis.speaking) { clearInterval(this._keep); return; }
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 4000);
  }
}
