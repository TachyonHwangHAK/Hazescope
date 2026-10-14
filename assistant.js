// On-device assistant: intent matching over live readings. No network calls, no LLM.
import { h, $, isNum, compassPoint, fmtTime } from './util.js';
import { t, getLang, listJoin, forecastText } from './i18n.js';
import { ADVISORY, NEA_REGIONS, CITIES } from './config.js';
import { psiBand, pmBand } from './analysis.js';

export const PERSONAS = {
  aetherguard: {
    id: 'aetherguard', name: { en: 'AetherGuard', zh: 'AetherGuard' }, spoken: { en: 'Aether Guard', zh: 'Aether Guard' }, icon: 'i-shield', gender: 'male',
    greet: {
      en: 'AetherGuard here. I keep watch over the air so you can plan with confidence. Ask me about the PSI, your plans outdoors, or where the haze is coming from.',
      zh: '我是AetherGuard，为您守护空气质量。可以问我PSI、户外安排，或者烟霾从哪里来。',
    },
    lead: { en: ['Here is the current picture.', 'Status report.', 'Here is what the latest readings show.'], zh: ['目前情况如下。', '状况报告。', '以下是最新读数显示的情况。'] },
    close: { en: 'Stay protected.', zh: '请做好防护。' },
  },
  breathenova: {
    id: 'breathenova', name: { en: 'BreatheNova', zh: 'BreatheNova' }, spoken: { en: 'Breathe Nova', zh: 'Breathe Nova' }, icon: 'i-sparkle', gender: 'female',
    greet: {
      en: 'Hi, I’m BreatheNova! Let’s make every breath a good one. Ask me anything about today’s air.',
      zh: '嗨，我是BreatheNova！一起好好呼吸吧。关于今天的空气，尽管问我。',
    },
    lead: { en: ['Okay, here’s the scoop!', 'Good question!', 'Let’s take a look!'], zh: ['好问题！', '来看看吧！', '告诉您哦！'] },
    close: { en: 'Breathe easy!', zh: '轻松呼吸哦！' },
  },
  qingfeng: {
    id: 'qingfeng', name: { en: '清风 Qingfeng', zh: '清风' }, spoken: { en: 'Qingfeng', zh: '清风' }, icon: 'i-swirl', gender: 'female',
    greet: {
      en: 'I am Qingfeng, the clear breeze. Ask how the air is today, and I will answer gently and honestly.',
      zh: '我是清风。想知道今天的空气如何，我会温和而如实地告诉您。',
    },
    lead: { en: ['Let me read the sky for you.', 'The air tells me this.', 'Here is what I see.'], zh: ['让我为您看看天色。', '空气是这样说的。', '我看到的是这样。'] },
    close: { en: 'Be gentle with yourself today.', zh: '今天也请善待自己。' },
  },
};

const CHIPS = {
  en: ['How’s the air now?', 'Can I go for a run?', 'Where is the haze coming from?', 'Is it safe for kids?', 'Should I wear a mask?', 'Weather forecast', 'How reliable is this?'],
  zh: ['现在空气怎样？', '可以去跑步吗？', '烟霾从哪里来？', '孩子外出安全吗？', '需要戴口罩吗？', '天气预报', '数据可靠吗？'],
};

// Keyword sets match in either language, whatever the UI language is.
const INTENTS = [
  ['cmdTheme', [/\b(dark|light|glass|colou?rful)\b.*\b(theme|mode)\b|\b(theme|mode)\b.*\b(dark|light|glass|colou?rful)\b|switch to (dark|light|glass|colou?rful)/, /(深色|浅色|玻璃|缤纷|多彩).*(主题|模式)|(主题|模式).*(深色|浅色|玻璃|缤纷|多彩)|切换.*(深色|浅色|玻璃|缤纷)/]],
  ['cmdLang', [/\b(english|chinese|mandarin|华语)\b.*\b(switch|change|use|speak|language)\b|\b(switch|change|use|speak)\b.*\b(english|chinese|mandarin)\b/, /(说|讲|用|切换|换成).*(英文|英语|华语|中文)|(英文|英语)(模式|界面)/]],
  ['cmdRefresh', [/\b(refresh|reload|update now|fetch)\b/, /(刷新|更新一下|重新获取)/]],
  ['cmdTour', [/\b(tour|tutorial|walkthrough|guide me)\b/, /(导览|教程|引导)/]],
  ['help', [/\b(how (do i|to) use|help|what can you do|features?)\b/, /(怎么用|如何使用|帮助|你能做什么|功能)/]],
  ['greet', [/^(hi|hello|hey|good (morning|afternoon|evening))\b/, /^(你好|您好|嗨|哈喽|早上好|晚上好)/]],
  ['thanks', [/\b(thanks|thank you|cheers)\b/, /(谢谢|多谢|感谢)/]],
  ['mask', [/\b(mask|n95|respirator)\b/, /(口罩|N95)/i]],
  ['vulnerable', [/\b(kids?|child(ren)?|baby|babies|infant|elderly|old(er)? (people|folks)|grand(ma|pa|parents?)|pregnan\w*|asthma|heart|lung|copd|sensitive|sick)\b/, /(孩子|小孩|儿童|婴儿|宝宝|老人|年长|长者|孕妇|怀孕|哮喘|心脏|肺|敏感)/]],
  ['exercise', [/\b(run|running|jog\w*|exercis\w*|workout|cycl\w*|bike|sports?|outdoor|outside|walk(ing)?|hike|swim\w*|picnic|play outside|go out)\b/, /(跑步|运动|锻炼|户外|出门|外出|散步|骑车|游泳|爬山|打球)/]],
  ['indoor', [/\b(indoors?|home|window|purifier|air cleaner|hepa|aircon)\b/, /(室内|在家|窗|空气净化|净化器|冷气)/]],
  ['reliability', [/\b(reliable|accurate|accuracy|trust|cross.?check|model|data sources?|where.*data)\b/, /(可靠|准确|可信|交叉核对|模型|数据来源)/]],
  ['wind', [/\b(wind|source|coming from|where.*from|indonesia|sumatra|kalimantan|borneo|fires?|hotspots?|transboundary|smoke)\b/, /(风|来源|从哪|哪里来|印尼|苏门答腊|加里曼丹|婆罗洲|火|热点|跨境|烟雾)/]],
  ['regional', [/\b(region|regional|malaysia|neighbou?r\w*|johor|batam|kl|kuala lumpur|asean|nearby)\b/, /(区域|马来西亚|邻国|周边|附近|东盟)/]],
  ['explainPsi', [/\b(what is|what's|explain|meaning).*\bpsi\b|\bpsi\b.*\b(mean|stand)/, /(什么是|解释|意思).*PSI|PSI.*(是什么|意思)/i]],
  ['explainPm', [/\b(what is|what's|explain|meaning).*pm ?2\.?5|pm ?2\.?5.*\b(mean|stand)/, /(什么是|解释|意思).*PM ?2\.?5|PM ?2\.?5.*(是什么|意思)/i]],
  ['trend', [/\b(trend|getting (worse|better)|improv\w*|worsen\w*|rising|falling|later|tonight|tomorrow|last 24)\b/, /(趋势|变好|变差|改善|恶化|上升|下降|晚些|今晚|明天)/]],
  ['weather', [/\b(weather|rain\w*|forecast|temperature|hot|humid\w*|thunder\w*|showers?)\b/, /(天气|下雨|雨|预报|气温|温度|热|湿度|雷)/]],
  ['pm', [/pm ?2\.?5|\bhourly\b|\b1.?h(ou)?r\b|particles?/, /PM ?2\.?5|1小时|一小时|微粒|颗粒/i]],
  ['now', [/\b(psi|air quality|aqi|haze|hazy|air|now|today|current\w*|status|safe|how bad|level)\b/, /(PSI|空气|烟霾|霾|现在|今天|目前|指数|安全|严重)/i]],
];

const REGION_WORDS = {
  north: [/\bnorth(ern)?\b/, /(北部|北区|北边)/], south: [/\bsouth(ern)?\b/, /(南部|南区|南边)/], east: [/\beast(ern)?\b/, /(东部|东区|东边)/], west: [/\bwest(ern)?\b/, /(西部|西区|西边)/], central: [/\b(central|centre|center|city|town)\b/, /(中部|市区|市中心)/],
};
const CITY_WORDS = {
  jb: [/johor/, /新山|柔佛/], btm: [/batam/, /巴淡/], mlk: [/mel?aka|malacca/, /马六甲/], kl: [/\bkl\b|kuala lumpur/, /吉隆坡/], pku: [/pekanbaru|riau/, /北干巴鲁|廖内/],
  jbi: [/jambi/, /占碑/], plm: [/palembang|south sumatra/, /巨港|南苏门答腊/], mdn: [/medan/, /棉兰/], jkt: [/jakarta/, /雅加达/], ptk: [/pontianak|west kalimantan/, /坤甸|西加里曼丹/],
  kch: [/kuching|sarawak/, /古晋|砂拉越/], pky: [/palangka|central kalimantan/, /帕朗卡拉亚|中加里曼丹/], bsb: [/brunei|bandar seri/, /文莱|斯里巴加湾/],
};

function matchAny(text, pair) { return pair.some((re) => re.test(text)); }

export function detectIntent(raw) {
  const text = raw.toLowerCase().trim();
  const found = INTENTS.find(([, pats]) => matchAny(text, pats));
  let region = null;
  // Region words only count when the question mentions Singapore regions, not compass talk about wind.
  const windy = /\b(wind|from)\b|风/.test(text);
  if (!windy) for (const [r, pats] of Object.entries(REGION_WORDS)) if (matchAny(text, pats)) { region = r; break; }
  let city = null;
  for (const [c, pats] of Object.entries(CITY_WORDS)) if (matchAny(text, pats)) { city = c; break; }
  const chronic = /\b(asthma|heart|lung|copd)\b|哮喘|心脏|肺/.test(text);
  let theme = null;
  const tm = text.match(/\b(dark|light|glass|colou?rful)\b|(深色|浅色|玻璃|缤纷|多彩)/);
  if (tm) theme = ({ 深色: 'dark', 浅色: 'light', 玻璃: 'glass', 缤纷: 'colourful', 多彩: 'colourful', colorful: 'colourful' })[tm[0]] || tm[0];
  const lang = /english|英文|英语/.test(text) ? 'en' : (/chinese|mandarin|华语|中文/.test(text) ? 'zh' : null);
  let intent = found ? found[0] : 'fallback';
  if (city && ['now', 'fallback', 'pm', 'regional'].includes(intent)) intent = 'regional';
  else if (region && ['now', 'fallback', 'pm'].includes(intent)) intent = 'region';
  return { intent, region, city, chronic, theme, lang };
}

// --------------------------------------------------------------------------------------------
export class Assistant {
  constructor({ voice, getCtx, actions, getPersona, setPersona }) {
    this.voice = voice; this.getCtx = getCtx; this.actions = actions; this.getPersona = getPersona; this.setPersona = setPersona;
    this.el = $('#assistant'); this.chat = $('#chat'); this.chips = $('#chips'); this.input = $('#chat-input'); this.form = $('#composer');
    this.open = false; this.greeted = false; this.leadIdx = 0;
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.ask(this.input.value); });
    $('#asst-close').addEventListener('click', () => this.hide());
    this._setupMic();
    this.renderChips();
  }

  persona() { return PERSONAS[this.getPersona()] || PERSONAS.aetherguard; }

  renderChips() {
    const lang = getLang();
    this.chips.replaceChildren(...CHIPS[lang].map((c) => h('button', { type: 'button', onclick: () => this.ask(c) }, c)));
    this.input.placeholder = t('asst.placeholder');
  }

  greet(force) {
    if (this.greeted && !force) return;
    this.greeted = true;
    const p = this.persona(); const lang = getLang();
    this.say(p.greet[lang]);
  }

  ask(q) {
    const text = String(q || '').trim();
    if (!text) return;
    this.input.value = '';
    this.voice.unlock();
    this._bubble(text, 'user');
    const typing = h('div', { class: 'msg msg-bot msg-typing', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'));
    this.chat.append(typing); this._scroll();
    const reply = this.answer(text);
    setTimeout(() => { typing.remove(); this.say(reply.text, reply.action); }, 380 + Math.min(700, reply.text.length * 3));
  }

  say(text, action) {
    const bubble = this._bubble(text, 'bot');
    const actions = h('div', { class: 'msg-actions' });
    if (this.voice.supported) {
      actions.append(h('button', { type: 'button', onclick: () => { this.voice.unlock(); this.voice.speak(text, { force: true }); } }, h('span', { html: '<svg><use href="#i-play"/></svg>' }), t('asst.replay')));
    }
    if (action) actions.append(h('button', { type: 'button', onclick: action.run }, action.label));
    if (actions.childElementCount) bubble.append(actions);
    if (this.open) this.voice.speak(text);
  }

  _bubble(text, who) {
    const b = h('div', { class: `msg msg-${who}` }, h('span', { text }));
    this.chat.append(b); this._scroll();
    return b;
  }
  _scroll() { requestAnimationFrame(() => { this.chat.scrollTop = this.chat.scrollHeight; }); }

  _setupMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = $('#mic-btn');
    if (!SR) return;
    btn.hidden = false;
    let rec = null;
    btn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      try {
        this.voice.stop();
        rec = new SR();
        rec.lang = getLang() === 'zh' ? 'zh-CN' : 'en-SG';
        rec.interimResults = false; rec.maxAlternatives = 1;
        rec.onresult = (e) => { const said = e.results?.[0]?.[0]?.transcript; if (said) this.ask(said); };
        rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.say(t('asst.micDenied')); };
        rec.onend = () => { rec = null; btn.classList.remove('is-listening'); this.input.placeholder = t('asst.placeholder'); };
        rec.start(); btn.classList.add('is-listening'); this.input.placeholder = t('asst.listening');
      } catch { rec = null; btn.classList.remove('is-listening'); }
    });
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.el.hidden = false; this.el.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.remove('is-entering')));
    $('#assistant-fab').classList.add('is-hidden');
    $('#assistant-fab').setAttribute('aria-expanded', 'true');
    this.greet();
    setTimeout(() => { if (!window.matchMedia('(pointer: coarse)').matches) this.input.focus({ preventScroll: true }); }, 60);
  }
  hide() {
    if (!this.open) return;
    this.open = false; this.voice.stop();
    this.el.classList.add('is-leaving');
    setTimeout(() => { this.el.hidden = true; this.el.classList.remove('is-leaving'); }, 300);
    $('#assistant-fab').classList.remove('is-hidden');
    $('#assistant-fab').setAttribute('aria-expanded', 'false');
    $('#assistant-fab').focus({ preventScroll: true });
  }
  toggle() { this.open ? this.hide() : this.show(); }

  // ------------------------------------------------------------------------------------------
  answer(text) {
    const lang = getLang(); const zh = lang === 'zh';
    const p = this.persona();
    const q = detectIntent(text);
    const C = this.getCtx(); const S = C.S;
    const lead = () => p.lead[lang][(this.leadIdx++) % p.lead[lang].length];
    const noData = zh ? '我还没有取得NEA的读数。请稍候片刻，或在设置中点“立即刷新”。' : 'I don’t have NEA readings yet. Give it a moment, or choose Refresh now in Settings.';
    const band = S?.psi?.band; const pmb = S?.pm?.band; const hasPsi = !!band;
    const adv = (group, b = band) => (b ? t(ADVISORY[b.id][group]) : '');
    const lower = (s) => (zh ? s : s.charAt(0).toLowerCase() + s.slice(1));
    const regionName = (r) => t('region.' + r);
    const psiLine = () => zh
      ? `24小时PSI为${Math.round(S.psi.max)}（${t('band.' + band.id)}），最高在${regionName(S.psi.maxRegion)}，全岛介于${Math.round(S.psi.min)}至${Math.round(S.psi.max)}。`
      : `The 24-hour PSI is ${Math.round(S.psi.max)} (${t('band.' + band.id).toLowerCase()}), highest in the ${regionName(S.psi.maxRegion).toLowerCase()}, and ranges from ${Math.round(S.psi.min)} to ${Math.round(S.psi.max)} across Singapore.`;
    const pmLine = () => (S.pm && pmb ? (zh
      ? `1小时PM2.5最高为${Math.round(S.pm.max)}微克/立方米（${t('pmband.' + pmb.id)}）。`
      : `The 1-hour PM2.5 peaks at ${Math.round(S.pm.max)} µg/m³ (${t('pmband.' + pmb.id).toLowerCase()}).`) : '');
    const trendCheck = C.checks.find((c) => c.id === 'trend');
    const trendLine = () => {
      if (!trendCheck || trendCheck.status === 'na') return '';
      const k = trendCheck.key;
      if (k.endsWith('.up')) return zh ? '这一小时空气正在变差。' : 'This hour, the air is getting worse.';
      if (k.endsWith('.down')) return zh ? '这一小时情况正在缓解。' : 'This hour, conditions are easing.';
      return zh ? '这一小时情况大致平稳。' : 'This hour, conditions are steady.';
    };
    const join = (...parts) => parts.filter(Boolean).join(zh ? '' : ' ');

    switch (q.intent) {
      case 'cmdTheme': {
        const th = q.theme || 'dark';
        this.actions.setTheme(th);
        return { text: zh ? `已切换至${t('theme.' + th)}主题。` : `Switched to the ${t('theme.' + th).toLowerCase()} theme.` };
      }
      case 'cmdLang': {
        const target = q.lang || (zh ? 'en' : 'zh');
        this.actions.setLang(target);
        return { text: target === 'zh' ? '好的，我现在用华语和您交谈。' : 'Sure, I’ll speak English now.' };
      }
      case 'cmdRefresh':
        this.actions.refresh();
        return { text: zh ? '正在获取最新读数，几秒钟后就会更新。' : 'Fetching the latest readings now. They’ll update in a few seconds.' };
      case 'cmdTour':
        return { text: zh ? '好的，我们从头看一遍。' : 'Sure, let’s walk through it.', action: { label: t('tour.start'), run: () => { this.hide(); this.actions.startTour(); } } };
      case 'help':
        return {
          text: zh
            ? '我可以告诉您现在的PSI和PM2.5、各区域情况、能否进行户外运动、孩子和年长者的注意事项、是否需要口罩、天气预报、烟霾来源，以及数据是否可靠。也可以帮您切换主题或语言。'
            : 'I can tell you the current PSI and PM2.5, readings by region, whether outdoor exercise is a good idea, advice for children, older people and anyone with heart or lung conditions, mask guidance, the weather forecast, where the haze is coming from, and how reliable the data is. I can also switch the theme or language for you.',
          action: { label: t('tour.start'), run: () => { this.hide(); this.actions.startTour(); } },
        };
      case 'greet':
        return { text: p.greet[lang] };
      case 'thanks':
        return { text: zh ? `不客气。${p.close.zh}` : `You’re welcome. ${p.close.en}` };
      case 'explainPsi':
        return { text: zh
          ? 'PSI（污染物标准指数）综合了PM2.5、PM10、二氧化硫、一氧化碳、臭氧和二氧化氮六种污染物，取其中最高的分指数。NEA公布24小时PSI：0至50良好，51至100中等，101至200不健康，201至300非常不健康，300以上危险。烟霾期间，PSI通常由PM2.5主导。'
          : 'The PSI, or Pollutant Standards Index, combines six pollutants: PM2.5, PM10, sulphur dioxide, carbon monoxide, ozone and nitrogen dioxide, and reports the highest sub-index. NEA publishes a 24-hour PSI: 0 to 50 is good, 51 to 100 moderate, 101 to 200 unhealthy, 201 to 300 very unhealthy, and above 300 hazardous. During haze, PM2.5 usually drives the PSI.' };
      case 'explainPm':
        return { text: join(zh
          ? 'PM2.5是直径2.5微米或以下的细微颗粒，能深入肺部，是烟霾的主要成分。NEA的1小时PM2.5分为四级：0至55正常，56至150偏高，151至250高，251以上非常高。它反映当下的空气，适合用来决定是否马上进行户外活动。'
          : 'PM2.5 means fine particles 2.5 micrometres across or smaller. They reach deep into the lungs and are the main ingredient of haze. NEA’s 1-hour PM2.5 has four bands: 0 to 55 normal, 56 to 150 elevated, 151 to 250 high, and 251 or above very high. It reflects the air right now, so it’s the one to check before heading out.', pmLine()) };
      case 'reliability': {
        const ok = C.checks.filter((c) => c.status === 'ok').length; const avail = C.checks.filter((c) => c.status !== 'na').length;
        const model = C.checks.find((c) => c.id === 'model');
        const modelLine = model && model.status !== 'na' ? t(model.key, model.vars) : '';
        return { text: join(zh
          ? `新加坡的读数直接来自NEA和MSS（经data.gov.sg），属官方数据。区域数值来自CAMS模型，是估算而非实测。在${avail}项交叉核对中，有${ok}项结果一致。`
          : `Singapore readings come straight from NEA and MSS via data.gov.sg, so they are official. Regional figures come from the CAMS model and are estimates, not measurements. Of ${avail} cross-checks available right now, ${ok} came back consistent.`, modelLine) };
      }
      case 'weather': {
        if (!S) return { text: noData };
        const parts = [];
        if (S.twoHr) parts.push(zh ? `未来两小时，大部分地区${forecastText(S.twoHr.dominant)}。` : `For the next two hours, most areas can expect: ${forecastText(S.twoHr.dominant).toLowerCase()}.`);
        if (S.twoHr?.hazyCount) parts.push(zh ? `${S.twoHr.total}个地区中有${S.twoHr.hazyCount}个预报有烟霾。` : `Haze is forecast in ${S.twoHr.hazyCount} of ${S.twoHr.total} areas.`);
        if (S.day) parts.push(zh ? `24小时展望：${forecastText(S.day.text)}，气温${S.day.tempLow ?? '—'}至${S.day.tempHigh ?? '—'}°C。` : `The 24-hour outlook is ${forecastText(S.day.text).toLowerCase()}, with ${S.day.tempLow ?? '—'} to ${S.day.tempHigh ?? '—'}°C.`);
        if (isNum(S.temp?.mean)) parts.push(zh ? `目前平均气温${S.temp.mean.toFixed(1)}°C，湿度${Math.round(S.rh?.mean ?? 0)}%。` : `It’s ${S.temp.mean.toFixed(1)}°C now with ${Math.round(S.rh?.mean ?? 0)}% humidity.`);
        if (S.rain) parts.push(S.rain.raining ? (zh ? `${S.rain.total}个气象站中有${S.rain.raining}个正在下雨。` : `Rain is falling at ${S.rain.raining} of ${S.rain.total} stations.`) : (zh ? '目前没有气象站报告降雨。' : 'No stations are reporting rain.'));
        return { text: parts.length ? join(lead(), ...parts) : (zh ? '天气数据还在加载中。' : 'Weather data is still loading.') };
      }
      case 'wind': {
        if (!S?.wind) return { text: zh ? '风向数据还在加载中。' : 'Wind data is still loading.' };
        const dir = t('compass.' + compassPoint(S.wind.fromDeg));
        const ups = S.regional.filter((r) => r.upwind && isNum(r.pm25) && r.pm25 > 55).sort((a, b) => b.pm25 - a.pm25);
        const base = S.wind.calm
          ? (zh ? '目前风力微弱，烟雾容易滞留。' : 'Winds are calm right now, so smoke tends to linger.')
          : (zh ? `风来自${dir}，平均${S.wind.knots?.toFixed(1) ?? '—'}节。` : `The wind is blowing from the ${dir} at about ${S.wind.knots?.toFixed(1) ?? '—'} knots.`);
        const src = !S.wind.calm && ups.length
          ? (zh ? `上风处的${listJoin(ups.slice(0, 3).map((u) => t('city.' + u.id)))}模型显示PM2.5偏高，区域烟雾很可能正被吹来。`
                : `Upwind, the model shows elevated PM2.5 over ${listJoin(ups.slice(0, 3).map((u) => t('city.' + u.id)))}, so smoke from the region is likely being carried here.`)
          : (!S.wind.calm ? (zh ? '上风处的模型未显示明显烟霾。' : 'The model doesn’t show significant haze upwind.') : '');
        const caveat = zh ? '这是根据风向与模型的经验判断，并非烟雾轨迹模拟。' : 'This is a rule of thumb from wind direction and the model, not a smoke trajectory simulation.';
        return { text: join(lead(), base, src, caveat) };
      }
      case 'regional': {
        if (!S?.regional?.length) return { text: t('reg.empty') };
        if (q.city) {
          const c = S.regional.find((r) => r.id === q.city);
          if (c && isNum(c.pm25)) {
            this.actions.focusCity(c.id);
            const b = c.band ? t('pmband.' + c.band.id) : '';
            return { text: zh
              ? `${t('city.' + c.id)}目前的模型PM2.5约为${Math.round(c.pm25)}微克/立方米（参考级别：${b}），距新加坡约${Math.round(c.dist)}公里。${c.upwind ? '它位于新加坡的上风处。' : ''}请注意这是模型估算。`
              : `${t('city.' + c.id)} has modelled PM2.5 of about ${Math.round(c.pm25)} µg/m³ (indicatively ${b.toLowerCase()}), about ${Math.round(c.dist)} km from Singapore.${c.upwind ? ' It is upwind of Singapore right now.' : ''} Keep in mind this is a model estimate.` };
          }
        }
        const top = S.regional.filter((r) => r.id !== 'sg' && isNum(r.pm25)).sort((a, b) => b.pm25 - a.pm25).slice(0, 3);
        const list = listJoin(top.map((r) => `${t('city.' + r.id)} (${Math.round(r.pm25)})`));
        return { text: join(lead(), zh ? `区域内模型PM2.5最高的是${list}（微克/立方米）。` : `The highest modelled PM2.5 in the region is in ${list} µg/m³.`, zh ? '这些是模型估算。' : 'These are model estimates.') };
      }
      case 'trend': {
        if (!hasPsi) return { text: noData };
        const items = S.psiItems; const now = items[items.length - 1]; const ago = items[Math.max(0, items.length - 7)];
        const mx = (it) => Math.max(...NEA_REGIONS.map((r) => it?.psi24?.[r]).filter(isNum));
        const d = isNum(mx(now)) && isNum(mx(ago)) ? Math.round(mx(now) - mx(ago)) : null;
        const hrs = Math.round((now.t - ago.t) / 3600_000);
        const line = d == null ? '' : (zh
          ? (d > 0 ? `过去${hrs}小时，PSI上升了${d}。` : d < 0 ? `过去${hrs}小时，PSI下降了${-d}。` : `过去${hrs}小时，PSI没有变化。`)
          : (d > 0 ? `Over the past ${hrs} hours the PSI has risen by ${d}.` : d < 0 ? `Over the past ${hrs} hours the PSI has fallen by ${-d}.` : `The PSI is unchanged over the past ${hrs} hours.`));
        const fc = S.twoHr?.hazyCount ? (zh ? 'MSS预报未来两小时仍有烟霾。' : 'MSS still forecasts haze for the next two hours.') : '';
        return { text: join(lead(), line, trendLine(), fc) };
      }
      case 'mask': {
        if (!hasPsi) return { text: zh ? '短时间外出无须N95口罩。健康人士在PSI预测超过300时可考虑佩戴；慢性心肺病患者在超过200时可考虑。' : 'N95 masks aren’t needed for short trips. Healthy persons should consider one when PSI is forecast above 300, and people with chronic heart or lung disease above 200.' };
        const v = S.psi.max;
        const msg = v > 300
          ? (zh ? `PSI为${Math.round(v)}，属危险级别。如需在户外停留较长时间，建议佩戴贴合良好的N95口罩。` : `With the PSI at ${Math.round(v)}, which is hazardous, wear a well-fitted N95 mask if you must spend longer periods outdoors.`)
          : v > 200
            ? (zh ? `PSI为${Math.round(v)}。健康人士一般无须N95口罩，但慢性心肺病患者在户外停留较久时可考虑佩戴。` : `With the PSI at ${Math.round(v)}, healthy people generally don’t need an N95 mask, but anyone with a chronic heart or lung condition should consider one for longer periods outdoors.`)
            : (zh ? `PSI为${Math.round(v)}，一般无须佩戴N95口罩。普通外科口罩无法有效过滤细微颗粒。` : `With the PSI at ${Math.round(v)}, you don’t need an N95 mask. Ordinary surgical masks don’t filter fine particles well anyway.`);
        const fit = zh ? '若戴口罩感到呼吸困难，请取下休息。' : 'If a mask makes breathing uncomfortable, take it off and rest.';
        return { text: join(lead(), msg, fit) };
      }
      case 'vulnerable': {
        if (!hasPsi) return { text: noData };
        const group = q.chronic ? 'chronic' : 'vulnerable';
        const who = q.chronic ? (zh ? '慢性肺病或心脏病患者' : 'For people with chronic lung or heart disease') : (zh ? '年长者、孕妇和儿童' : 'For older people, pregnant women and children');
        const a = adv(group);
        const pmNote = pmb && pmb.id !== 'normal'
          ? (zh ? `此刻1小时PM2.5为${t('pmband.' + pmb.id)}（${Math.round(S.pm.max)}），短时间的户外活动也宜尽量减少。` : `Right now the 1-hour PM2.5 is ${t('pmband.' + pmb.id).toLowerCase()} (${Math.round(S.pm.max)}), so it’s worth keeping even short outdoor activities light.`)
          : '';
        const care = zh ? '如有不适，请尽快就医；紧急情况请拨打995。' : 'If anyone feels unwell, seek medical attention. In an emergency, call 995.';
        return { text: join(lead(), psiLine(), zh ? `${who}：${a}。` : `${who}: ${lower(a)}.`, pmNote, care, p.close[lang]) };
      }
      case 'exercise': {
        if (!hasPsi || !pmb) return { text: noData };
        const pmId = pmb?.id; const v = S.psi.max;
        let verdict;
        if ((pmId === 'normal') && v <= 100) verdict = zh ? '可以，空气适合户外运动。' : 'Yes, the air is fine for exercising outdoors.';
        else if ((pmId === 'high' || pmId === 'vhigh') || v > 200) verdict = zh ? '今天最好改在室内运动。' : 'It’s better to move your workout indoors today.';
        else verdict = zh ? '可以，但请缩短时间、降低强度。' : 'You can, but keep it shorter and easier.';
        const detail = zh
          ? `1小时PM2.5为${Math.round(S.pm.max)}（${t('pmband.' + pmId)}），24小时PSI为${Math.round(v)}（${t('band.' + band.id)}）。健康人士：${adv('healthy')}。`
          : `The 1-hour PM2.5 is ${Math.round(S.pm.max)} (${t('pmband.' + pmId).toLowerCase()}) and the 24-hour PSI is ${Math.round(v)} (${t('band.' + band.id).toLowerCase()}). For healthy people: ${lower(adv('healthy'))}.`;
        const sens = v > 100 ? (zh ? `如有哮喘或心肺疾病：${adv('chronic')}。` : `If you have asthma or a heart or lung condition: ${lower(adv('chronic'))}.`) : '';
        return { text: join(verdict, detail, sens, p.close[lang]) };
      }
      case 'indoor':
        return { text: join(lead(), zh
          ? '空气不健康时，请关闭门窗，减少室外空气进入。使用带HEPA滤网的空气净化器，并按房间大小选择合适型号。开冷气时可使用内循环。如感到不适，请就医。'
          : 'When the air is unhealthy, keep windows and doors closed to limit outdoor air coming in. An air purifier with a HEPA filter, sized for the room, helps. If you use air-conditioning, set it to recirculate. Seek medical help if you feel unwell.', hasPsi ? psiLine() : '') };
      case 'region': {
        if (!hasPsi) return { text: noData };
        const r = q.region; const psiItem = S.psiItems[S.psiItems.length - 1]; const pmItem = S.pmItems[S.pmItems.length - 1];
        const v = psiItem?.psi24?.[r]; const pm = pmItem?.pm25_1h?.[r]; const b = psiBand(v); const pb = pmBand(pm);
        this.actions.focusRegion(r);
        return { text: zh
          ? `${regionName(r)}的24小时PSI为${isNum(v) ? Math.round(v) : '—'}（${b ? t('band.' + b.id) : '—'}），1小时PM2.5为${isNum(pm) ? Math.round(pm) : '—'}微克/立方米（${pb ? t('pmband.' + pb.id) : '—'}）。`
          : `In the ${regionName(r).toLowerCase()}, the 24-hour PSI is ${isNum(v) ? Math.round(v) : '—'} (${b ? t('band.' + b.id).toLowerCase() : '—'}) and the 1-hour PM2.5 is ${isNum(pm) ? Math.round(pm) : '—'} µg/m³ (${pb ? t('pmband.' + pb.id).toLowerCase() : '—'}).` };
      }
      case 'pm':
        if (!S?.pm) return { text: noData };
        return { text: join(lead(), pmLine(), trendLine(), zh ? '1小时PM2.5适合用来决定当下是否外出活动。' : 'Use the 1-hour PM2.5 to decide on activities right now.') };
      case 'now': {
        if (!hasPsi) return { text: noData };
        const when = S.psi.t ? (zh ? `NEA最新读数时间为${fmtTime(S.psi.t, lang)}。` : `NEA’s latest reading is for ${fmtTime(S.psi.t, lang)}.`) : '';
        return { text: join(lead(), when, psiLine(), pmLine(), trendLine(), zh ? `一般人士：${adv('healthy')}。` : `For most people: ${lower(adv('healthy'))}.`) };
      }
      default: {
        const hint = zh
          ? '这个问题我不太确定。我可以回答空气质量、户外活动、口罩、天气、烟霾来源和数据可靠性等问题，试试下面的建议吧。'
          : 'I’m not sure about that one. I can help with air quality, outdoor plans, masks, the weather, where the haze is coming from, and how reliable the data is. Try one of the suggestions below.';
        return { text: hint };
      }
    }
  }
}

export function personaIds() { return Object.keys(PERSONAS); }
export { CITIES };
