// English (default) and 华语 (Simplified Chinese, Singapore usage).
import { $$ } from './util.js';

const en = {
  'a11y.skip': 'Skip to content',
  'brand.sub': 'Haze monitor for Singapore and the region',
  'nav.label': 'Sections', 'nav.now': 'Now', 'nav.map': 'Map', 'nav.trends': 'Trends', 'nav.xref': 'Cross-check', 'nav.xrefShort': 'Check', 'nav.region': 'Region', 'nav.advice': 'Advice',
  'top.lang': 'Switch to 华语', 'top.theme': 'Theme', 'top.voice': 'Voice on or off', 'top.settings': 'Settings',
  'theme.dark': 'Dark', 'theme.light': 'Light', 'theme.colourful': 'Colourful', 'theme.glass': 'Glass',
  'common.close': 'Close',

  'hero.title': 'Singapore air right now', 'hero.sgt': 'SGT',
  'hero.psi': '24-hour PSI', 'hero.psiHint': 'highest of 5 regions',
  'hero.pm': '1-hour PM2.5', 'hero.pmHint': 'µg/m³, for activities now',
  'hero.range': '{min} to {max} across regions, highest in the {region}',
  'hero.deltaUp': 'Up {n} from the hour before', 'hero.deltaDown': 'Down {n} from the hour before', 'hero.deltaFlat': 'Unchanged from the hour before',
  'hero.advice': 'For most people: {a}. Elderly, pregnant women and children: {b}.',
  'hero.adviceNone': 'Waiting for NEA readings.',
  'hero.meta': 'NEA reading for {time}, published {ago}.',
  'hero.metaCached': 'Saved NEA reading for {time}. Live data will replace it when the connection returns.',
  'time.justNow': 'just now', 'time.secAgo': '{n} s ago', 'time.minAgo': '{n} min ago', 'time.hAgo': '{n} h {m} min ago',

  'demo.banner': 'You are viewing demo data. These numbers are synthetic and not real air-quality readings.',
  'demo.exit': 'Switch to live data',
  'empty.title': 'Live readings could not be loaded',
  'empty.body': 'Check your connection. HazeScope tries again at the next update.',
  'empty.network': 'The browser could not reach data.gov.sg. A network filter or an offline connection is the usual cause.',
  'empty.rate': 'The data service is limiting requests. HazeScope will try again shortly.',
  'empty.retry': 'Try again', 'empty.demo': 'Preview with demo data',

  'map.title': 'Where the haze is', 'map.descSg': 'NEA’s measured 1-hour PM2.5 across the island, 24-hour PSI by region, and the MSS wind.',
  'map.descRegion': 'Modelled PM2.5 haze field from CAMS. The dashed wedge is upwind of Singapore.',
  'map.terrain': 'Terrain', 'map.satellite': 'Satellite', 'map.basemap': 'Basemap',
  'map.srcOnline': 'Online imagery', 'map.srcConnecting': 'Loading online imagery', 'map.srcOffline': 'Offline basemap',
  'map.play': 'Play the 24-hour forecast', 'map.pause': 'Pause', 'map.slider': 'Forecast hour',
  'map.now': 'Now', 'map.nowDetail': 'NEA measured over Singapore, CAMS model elsewhere',
  'map.ahead': '+{h} h, {time} SGT', 'map.aheadDetail': 'CAMS model forecast',
  'map.noGridTitle': 'Haze field unavailable', 'map.noGrid': 'The regional model couldn’t be loaded. NEA readings are still shown.',
  'map.haze': 'Haze layer', 'map.legendTitle': 'PM2.5 (µg/m³)',
  'map.legendSg': 'Lines mark NEA band edges. Labels show 24-hour PSI.', 'map.legendRegion': 'Lines mark NEA band edges. Dots are model values at cities.',
  'map.probeNea': 'NEA measured, 1-hour', 'map.probeModel': 'CAMS model, now', 'map.probeForecast': 'CAMS model, +{h} h',
  'map.view': 'Map view', 'map.sg': 'Singapore', 'map.region': 'Region', 'map.aria': 'Map of haze readings',
  'map.fallback': 'The map could not load. Readings are listed below.', 'map.windTip': 'Wind from the {dir}, {kt} knots',

  'region.north': 'North', 'region.south': 'South', 'region.east': 'East', 'region.west': 'West', 'region.central': 'Central',

  'wx.title': 'Weather that moves the haze', 'wx.desc': 'Island-wide averages from MSS stations.',
  'wx.temp': 'Temperature', 'wx.rh': 'Humidity', 'wx.rain': 'Rain now', 'wx.fc2': 'Next 2 hours', 'wx.fc24': '24-hour outlook',
  'wx.windFrom': 'From the {dir}', 'wx.windDetail': '{kt} knots ({kmh} km/h) averaged over {n} stations', 'wx.windVariable': 'Directions vary between stations',
  'wx.calm': 'Calm', 'wx.rainYes': '{n} of {total} stations', 'wx.rainNo': 'None reported',
  'wx.fc2Hazy': 'Haze in {n} of {total} areas', 'wx.fc2Most': 'Most of {total} areas',
  'wx.fc24Sub': '{lo} to {hi}°C, humidity {rlo} to {rhi}%, wind {dir} {wlo} to {whi} km/h',

  'trend.title': 'Last 24 hours', 'trend.descPsi': '24-hour PSI per region, hourly from NEA.', 'trend.descPm': '1-hour PM2.5 per region (µg/m³), hourly from NEA.',
  'trend.metric': 'Metric', 'trend.table': 'Show as table', 'trend.empty': 'No hourly readings yet.', 'trend.time': 'Time (SGT)', 'trend.aria': '{metric} for the five NEA regions over the last 24 hours',

  'xref.title': 'Cross-check', 'xref.desc': 'How NEA readings line up with MSS weather and the regional model.',
  'xref.note': 'These checks are rules of thumb, not a smoke-dispersion model. NEA readings remain the official reference.',
  'xref.na': 'Not enough data yet for this check.',
  'xref.status.ok': 'Consistent', 'xref.status.info': 'Note', 'xref.status.warn': 'Watch', 'xref.status.alert': 'Elevated', 'xref.status.na': 'No data',
  'xref.fresh.title': 'NEA data freshness',
  'xref.fresh.ok': 'The latest hourly reading is {min} min old, within NEA’s normal hourly cycle.',
  'xref.fresh.stale': 'The latest NEA reading is {min} min old. Publication may be delayed, so treat these numbers with care.',
  'xref.trend.title': 'Hourly vs 24-hour PM2.5',
  'xref.trend.up': '1-hour PM2.5 ({h1}) is {pct}% above the 24-hour average ({h24}). Air is getting worse and the 24-hour PSI usually follows.',
  'xref.trend.down': '1-hour PM2.5 ({h1}) is {pct}% below the 24-hour average ({h24}). Conditions are easing.',
  'xref.trend.flat': '1-hour PM2.5 ({h1}) is close to the 24-hour average ({h24}). Conditions are steady.',
  'xref.model.title': 'NEA stations vs regional model',
  'xref.model.agree': 'The model estimate for Singapore ({model} µg/m³) agrees with NEA’s average 1-hour PM2.5 ({nea}). The regional picture is likely reasonable.',
  'xref.model.over': 'The model reads {diff} µg/m³ higher than NEA ({model} vs {nea}). Treat regional figures as upper estimates.',
  'xref.model.under': 'The model reads {diff} µg/m³ lower than NEA ({model} vs {nea}). Regional haze may be worse than modelled.',
  'xref.wind.title': 'Wind vs regional sources',
  'xref.wind.upwind': 'Wind is from the {dirName} ({dir}°). Upwind, {cities} show elevated PM2.5 (up to {pm} µg/m³). Smoke from the region is a likely contributor.',
  'xref.wind.clear': 'Wind is from the {dirName} ({dir}°). No elevated PM2.5 is modelled upwind within {km} km.',
  'xref.wind.calm': 'Winds are calm, so smoke already over Singapore can linger.',
  'xref.fc.title': 'MSS forecast vs NEA readings',
  'xref.fc.both': 'MSS forecasts haze ({n} of {total} areas) and NEA readings are elevated. Both sources agree.',
  'xref.fc.hazyOnly': 'MSS forecasts haze in {n} of {total} areas, but NEA readings are not yet elevated. Watch for a rise.',
  'xref.fc.readingsOnly': 'NEA readings are elevated, but the current MSS forecast does not mention haze.',
  'xref.fc.clear': 'No haze in the MSS forecast, and NEA readings are within normal levels.',
  'xref.rain.title': 'Rain',
  'xref.rain.yes': 'Rain at {n} of {total} stations. Showers can briefly wash out particles.',
  'xref.rain.no': 'No rain at any of {total} stations right now.',

  'reg.title': 'Around the region', 'reg.desc': 'Modelled PM2.5 from CAMS via Open-Meteo. Estimates, not station measurements.',
  'reg.place': 'Place', 'reg.pm': 'PM2.5', 'reg.level': 'Level (indicative)', 'reg.aqi': 'US AQI', 'reg.dist': 'From SG', 'reg.next': 'Next 24 h',
  'reg.model': 'model', 'reg.upwind': 'Upwind', 'reg.empty': 'Regional model data is not available right now.', 'reg.sparkAria': 'Modelled PM2.5 for the next 24 hours, from {a} to {b}',

  'city.sg': 'Singapore (model)', 'city.jb': 'Johor Bahru', 'city.btm': 'Batam', 'city.mlk': 'Melaka', 'city.kl': 'Kuala Lumpur', 'city.pku': 'Pekanbaru',
  'city.jbi': 'Jambi', 'city.plm': 'Palembang', 'city.mdn': 'Medan', 'city.jkt': 'Jakarta', 'city.ptk': 'Pontianak', 'city.kch': 'Kuching', 'city.pky': 'Palangka Raya', 'city.bsb': 'Bandar Seri Begawan',
  'cc.SG': 'Singapore', 'cc.MY': 'Malaysia', 'cc.ID': 'Indonesia', 'cc.BN': 'Brunei',

  'band.good': 'Good', 'band.moderate': 'Moderate', 'band.unhealthy': 'Unhealthy', 'band.vunhealthy': 'Very unhealthy', 'band.hazardous': 'Hazardous',
  'pmband.normal': 'Normal', 'pmband.elevated': 'Elevated', 'pmband.high': 'High', 'pmband.vhigh': 'Very high',

  'adv.title': 'What to do', 'adv.desc': 'MOH and NEA guidance by 24-hour PSI. Your current band is highlighted.',
  'adv.psi': '24-hr PSI', 'adv.healthy': 'Healthy persons', 'adv.vulnerable': 'Elderly, pregnant women, children', 'adv.chronic': 'Chronic lung or heart disease',
  'adv.normal': 'Normal activities', 'adv.reduceStrenuous': 'Reduce prolonged or strenuous outdoor physical exertion',
  'adv.minimiseStrenuous': 'Minimise prolonged or strenuous outdoor physical exertion', 'adv.avoidStrenuous': 'Avoid prolonged or strenuous outdoor physical exertion',
  'adv.minimiseOutdoor': 'Minimise outdoor activity', 'adv.avoidOutdoor': 'Avoid outdoor activity', 'adv.now': 'Now',
  'adv.note1': 'Use the 1-hour PM2.5 reading for decisions right now, such as going for a run. Use the 24-hour PSI for planning the next day.',
  'adv.note2': 'N95 masks are not needed for short exposures such as walking to a bus stop. Healthy persons: consider one when PSI is forecast above 300; persons with chronic lung or heart disease: above 200.',
  'adv.note3': 'Seek medical attention if you feel unwell. In an emergency, call 995.',

  'foot.sources': 'Data sources', 'foot.about': 'About these numbers',
  'foot.disclaimer': 'HazeScope SG is an independent viewer of public data and is not affiliated with NEA or MSS. For official advisories, refer to haze.gov.sg and weather.gov.sg.',
  'foot.attrib': 'Air quality and weather: NEA &amp; MSS via <a href="https://data.gov.sg" target="_blank" rel="noopener">data.gov.sg</a> (Singapore Open Data Licence). Regional model: Copernicus Atmosphere Monitoring Service (CAMS) via <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. Map: Leaflet; offline imagery NASA Blue Marble and Natural Earth; online tiles Esri and OpenTopoMap (OpenStreetMap contributors, SRTM).',
  'foot.never': 'not yet loaded', 'foot.failed': 'failed: {why}',

  'src.psi': 'NEA PSI (today)', 'src.pm': 'NEA 1-hr PM2.5 (today)', 'src.psiPrev': 'NEA PSI (yesterday)', 'src.pmPrev': 'NEA PM2.5 (yesterday)',
  'src.regional': 'CAMS regional model (Open-Meteo)', 'src.grid': 'CAMS haze field grid (Open-Meteo)', 'src.windDirection': 'MSS wind direction', 'src.windSpeed': 'MSS wind speed',
  'src.airTemperature': 'MSS air temperature', 'src.humidity': 'MSS relative humidity', 'src.rainfall': 'MSS rainfall',
  'src.twoHr': 'MSS 2-hour forecast', 'src.twentyFourHr': 'MSS 24-hour forecast',
  'err.network': 'network or browser block', 'err.timeout': 'timed out', 'err.rate': 'rate limited', 'err.http': 'server error', 'err.payload': 'unexpected data', 'err.empty': 'no data', 'err.unknown': 'unknown error',

  'status.live': 'Live', 'status.loading': 'Updating', 'status.partial': 'Partly updated', 'status.offline': 'Offline', 'status.error': 'No connection to data', 'status.cached': 'Saved data', 'status.demo': 'Demo',
  'status.title': 'Next fetch in {cd}. Click to refresh now.',

  'toast.network': 'Couldn’t reach data.gov.sg. Showing the last saved readings.',
  'toast.partial': '{n} of {total} sources didn’t update. Details are in Settings, under Data.',
  'toast.offline': 'You’re offline. Readings will update when the connection returns.',
  'toast.online': 'Back online. Updating readings.',
  'toast.band': '{metric} is now {band} ({value}).',
  'toast.cooldown': 'Readings were updated a moment ago.',
  'toast.cleared': 'Saved readings cleared.',
  'toast.demoOn': 'Demo data is on. Numbers are synthetic.',
  'toast.demoOff': 'Switched to live data.',

  'set.title': 'Settings', 'set.lang': 'Language', 'set.theme': 'Theme', 'set.interval': 'Fetch new data every',
  'set.intervalOpt': '{n} min', 'set.intervalOpt1': '1 min', 'set.intervalOpt60': '1 hour',
  'set.intervalHelp': 'The clock and countdown update every second. NEA publishes PSI and PM2.5 hourly, so short intervals mostly refresh weather readings. The public API allows 6 requests per 10 seconds.',
  'set.persona': 'Assistant', 'set.voice': 'Voice', 'set.voiceOn': 'Speak replies and tour steps', 'set.female': 'Female', 'set.male': 'Male', 'set.rate': 'Speaking speed', 'set.test': 'Play a sample',
  'set.voiceOk': 'Using the voice “{name}” on this device.',
  'set.voiceApprox': 'This device has no {gender} voice for this language, so “{name}” is used with adjusted pitch.',
  'set.voiceNone': 'No voice for this language is installed on this device. Add one in your system’s speech settings.',
  'set.voiceUnsupported': 'This browser doesn’t support speech output.',
  'set.female.lc': 'female', 'set.male.lc': 'male',
  'set.alerts': 'Alerts', 'set.announce': 'Announce when the PSI or PM2.5 band changes',
  'set.data': 'Data', 'set.refresh': 'Refresh now', 'set.demoOn': 'Use demo data', 'set.demoOff': 'Use live data', 'set.clear': 'Clear saved readings',
  'set.help': 'Help', 'set.tour': 'Replay the guided tour',

  'persona.aetherguard.role': 'Calm, precise guardian', 'persona.breathenova.role': 'Upbeat breathing buddy', 'persona.qingfeng.role': 'Gentle, poetic companion',

  'asst.open': 'Open assistant', 'asst.choose': 'Choose assistant', 'asst.inputLabel': 'Ask about the haze', 'asst.placeholder': 'Ask about the haze…',
  'asst.mic': 'Speak your question', 'asst.send': 'Send', 'asst.listening': 'Listening…', 'asst.micDenied': 'Microphone access was blocked. Type your question instead.',
  'asst.disclaimer': 'Answers come from the live readings on this page and NEA/MOH guidance. Not medical advice.',
  'asst.replay': 'Play', 'asst.stop': 'Stop',

  'tour.skip': 'Skip tour', 'tour.back': 'Back', 'tour.next': 'Next', 'tour.done': 'Start exploring', 'tour.start': 'Show me around', 'tour.step': 'Step {i} of {n}',
  'tour.0.title': 'Welcome to HazeScope SG',
  'tour.0.body': 'Live haze readings for Singapore and the region, checked against weather data, with an assistant who can talk you through it. This tour takes about a minute.',
  'tour.0.lang': 'Language', 'tour.0.persona': 'Pick your assistant',
  'tour.1.title': 'The reading that matters now',
  'tour.1.body': 'The big number is the 24-hour PSI, the highest of NEA’s five regions. Beside it, the 1-hour PM2.5 tells you about the air this hour. The sky behind gets hazier as PM2.5 rises.',
  'tour.2.title': 'Always up to date',
  'tour.2.body': 'This shows the connection status and counts down every second to the next fetch. Tap it to refresh now. You can change how often data is fetched in Settings.',
  'tour.3.title': 'See where the haze is',
  'tour.3.body': 'The coloured haze field shows PM2.5 over Singapore and the region. Switch between Terrain and Satellite, press play to watch the next 24 hours of the model forecast, and hover or tap anywhere for a reading. The map works offline too.',
  'tour.4.title': 'Watch the trend',
  'tour.4.body': 'Hover or drag across the chart to read each hour. Switch between PSI and PM2.5, and tap a region in the legend to hide or show it.',
  'tour.5.title': 'Cross-checked, not just copied',
  'tour.5.body': 'HazeScope compares NEA readings with MSS wind, rain and forecasts and with a regional model, and tells you where they agree.',
  'tour.6.title': 'Around the region',
  'tour.6.body': 'Modelled PM2.5 for nearby cities. Places upwind of Singapore are flagged. Tap a row to find it on the map.',
  'tour.7.title': 'What to do',
  'tour.7.body': 'Official MOH and NEA guidance for each group of people. The row for the current PSI is highlighted.',
  'tour.8.title': 'Ask your assistant',
  'tour.8.body': 'Ask things like “Can I go jogging?” or “Where is the haze coming from?” in English or 华语. Replies can be read aloud.',
  'tour.9.title': 'Make it yours',
  'tour.9.body': 'Change the language, theme, voice, assistant and update interval here. You can replay this tour from Settings at any time.',

  'compass.N': 'north', 'compass.NNE': 'north-northeast', 'compass.NE': 'northeast', 'compass.ENE': 'east-northeast', 'compass.E': 'east', 'compass.ESE': 'east-southeast',
  'compass.SE': 'southeast', 'compass.SSE': 'south-southeast', 'compass.S': 'south', 'compass.SSW': 'south-southwest', 'compass.SW': 'southwest', 'compass.WSW': 'west-southwest',
  'compass.W': 'west', 'compass.WNW': 'west-northwest', 'compass.NW': 'northwest', 'compass.NNW': 'north-northwest',
};

const zh = {
  'a11y.skip': '跳至内容',
  'brand.sub': '新加坡及区域烟霾监测',
  'nav.label': '页面区块', 'nav.now': '实时', 'nav.map': '地图', 'nav.trends': '趋势', 'nav.xref': '交叉核对', 'nav.xrefShort': '核对', 'nav.region': '区域', 'nav.advice': '建议',
  'top.lang': 'Switch to English', 'top.theme': '主题', 'top.voice': '开关语音', 'top.settings': '设置',
  'theme.dark': '深色', 'theme.light': '浅色', 'theme.colourful': '缤纷', 'theme.glass': '玻璃',
  'common.close': '关闭',

  'hero.title': '新加坡此刻的空气', 'hero.sgt': '新加坡时间',
  'hero.psi': '24小时PSI', 'hero.psiHint': '五个区域中的最高值',
  'hero.pm': '1小时PM2.5', 'hero.pmHint': '微克/立方米，适用于当下活动',
  'hero.range': '各区域介于 {min} 至 {max}，最高在{region}',
  'hero.deltaUp': '比前一小时上升 {n}', 'hero.deltaDown': '比前一小时下降 {n}', 'hero.deltaFlat': '与前一小时持平',
  'hero.advice': '一般人士：{a}。年长者、孕妇和儿童：{b}。',
  'hero.adviceNone': '正在等待NEA读数。',
  'hero.meta': 'NEA {time} 的读数，于{ago}发布。',
  'hero.metaCached': '已保存的NEA {time} 读数。恢复连接后将更新为实时数据。',
  'time.justNow': '刚刚', 'time.secAgo': '{n}秒前', 'time.minAgo': '{n}分钟前', 'time.hAgo': '{n}小时{m}分钟前',

  'demo.banner': '您正在查看演示数据。这些数字是模拟的，并非真实空气质量读数。',
  'demo.exit': '切换至实时数据',
  'empty.title': '无法加载实时读数',
  'empty.body': '请检查网络连接。HazeScope会在下次更新时自动重试。',
  'empty.network': '浏览器无法连接 data.gov.sg，通常是网络过滤或离线所致。',
  'empty.rate': '数据服务正在限制请求，HazeScope稍后会重试。',
  'empty.retry': '重试', 'empty.demo': '使用演示数据预览',

  'map.title': '烟霾分布', 'map.descSg': 'NEA全岛实测1小时PM2.5、各区域24小时PSI，以及MSS风向。',
  'map.descRegion': 'CAMS模型的PM2.5烟霾分布。虚线扇形为新加坡的上风方向。',
  'map.terrain': '地形', 'map.satellite': '卫星', 'map.basemap': '底图',
  'map.srcOnline': '在线影像', 'map.srcConnecting': '正在加载在线影像', 'map.srcOffline': '离线底图',
  'map.play': '播放未来24小时预报', 'map.pause': '暂停', 'map.slider': '预报时间',
  'map.now': '现在', 'map.nowDetail': '新加坡为NEA实测，其他地区为CAMS模型',
  'map.ahead': '+{h}小时，新加坡时间{time}', 'map.aheadDetail': 'CAMS模型预报',
  'map.noGridTitle': '烟霾分布不可用', 'map.noGrid': '区域模型无法加载，仍显示NEA读数。',
  'map.haze': '烟霾图层', 'map.legendTitle': 'PM2.5（微克/立方米）',
  'map.legendSg': '线条为NEA级别分界，标签为24小时PSI。', 'map.legendRegion': '线条为NEA级别分界，圆点为各城市模型值。',
  'map.probeNea': 'NEA实测，1小时', 'map.probeModel': 'CAMS模型，现在', 'map.probeForecast': 'CAMS模型，+{h}小时',
  'map.view': '地图视图', 'map.sg': '新加坡', 'map.region': '区域', 'map.aria': '烟霾读数地图',
  'map.fallback': '地图无法加载，读数列于下方。', 'map.windTip': '风来自{dir}，{kt}节',

  'region.north': '北部', 'region.south': '南部', 'region.east': '东部', 'region.west': '西部', 'region.central': '中部',

  'wx.title': '影响烟霾的天气', 'wx.desc': 'MSS气象站的全岛平均值。',
  'wx.temp': '气温', 'wx.rh': '湿度', 'wx.rain': '当前降雨', 'wx.fc2': '未来2小时', 'wx.fc24': '24小时展望',
  'wx.windFrom': '风来自{dir}', 'wx.windDetail': '{kt}节（{kmh}公里/小时），{n}个气象站平均', 'wx.windVariable': '各站风向不一',
  'wx.calm': '无风', 'wx.rainYes': '{total}个站中有{n}个', 'wx.rainNo': '无降雨报告',
  'wx.fc2Hazy': '{total}个地区中有{n}个有烟霾', 'wx.fc2Most': '{total}个地区中的大部分',
  'wx.fc24Sub': '{lo}至{hi}°C，湿度{rlo}至{rhi}%，{dir}风 {wlo}至{whi}公里/小时',

  'trend.title': '过去24小时', 'trend.descPsi': 'NEA各区域每小时的24小时PSI。', 'trend.descPm': 'NEA各区域每小时的1小时PM2.5（微克/立方米）。',
  'trend.metric': '指标', 'trend.table': '以表格显示', 'trend.empty': '暂无每小时读数。', 'trend.time': '时间（新加坡）', 'trend.aria': '过去24小时五个NEA区域的{metric}',

  'xref.title': '交叉核对', 'xref.desc': 'NEA读数与MSS天气及区域模型的对照。',
  'xref.note': '这些核对属经验法则，并非烟雾扩散模型。官方参考仍以NEA读数为准。',
  'xref.na': '数据不足，暂无法核对。',
  'xref.status.ok': '一致', 'xref.status.info': '提示', 'xref.status.warn': '留意', 'xref.status.alert': '偏高', 'xref.status.na': '无数据',
  'xref.fresh.title': 'NEA数据时效',
  'xref.fresh.ok': '最新每小时读数为{min}分钟前，属NEA正常更新周期。',
  'xref.fresh.stale': '最新NEA读数已是{min}分钟前，发布可能延迟，请审慎参考。',
  'xref.trend.title': '1小时与24小时PM2.5',
  'xref.trend.up': '1小时PM2.5（{h1}）比24小时平均（{h24}）高{pct}%。空气正在变差，24小时PSI通常会随之上升。',
  'xref.trend.down': '1小时PM2.5（{h1}）比24小时平均（{h24}）低{pct}%。情况正在缓解。',
  'xref.trend.flat': '1小时PM2.5（{h1}）接近24小时平均（{h24}）。情况平稳。',
  'xref.model.title': 'NEA测站与区域模型',
  'xref.model.agree': '模型对新加坡的估算（{model}微克/立方米）与NEA的1小时PM2.5平均（{nea}）相符，区域情况大致可信。',
  'xref.model.over': '模型比NEA高{diff}微克/立方米（{model}对{nea}），区域数值宜视为上限估算。',
  'xref.model.under': '模型比NEA低{diff}微克/立方米（{model}对{nea}），区域烟霾可能比模型更严重。',
  'xref.wind.title': '风向与区域烟源',
  'xref.wind.upwind': '风来自{dirName}（{dir}°）。上风处的{cities}PM2.5偏高（最高{pm}微克/立方米），区域烟雾很可能是成因之一。',
  'xref.wind.clear': '风来自{dirName}（{dir}°）。上风{km}公里内的模型未显示PM2.5偏高。',
  'xref.wind.calm': '风力微弱，已飘至新加坡的烟雾可能滞留。',
  'xref.fc.title': 'MSS预报与NEA读数',
  'xref.fc.both': 'MSS预报有烟霾（{total}个地区中有{n}个），NEA读数也偏高，两者一致。',
  'xref.fc.hazyOnly': 'MSS预报{total}个地区中有{n}个有烟霾，但NEA读数尚未偏高，请留意上升。',
  'xref.fc.readingsOnly': 'NEA读数偏高，但目前MSS预报未提及烟霾。',
  'xref.fc.clear': 'MSS预报无烟霾，NEA读数也在正常范围。',
  'xref.rain.title': '降雨',
  'xref.rain.yes': '{total}个气象站中有{n}个正在下雨，阵雨可短暂冲刷微粒。',
  'xref.rain.no': '目前{total}个气象站均无降雨。',

  'reg.title': '区域概况', 'reg.desc': 'CAMS模型经Open-Meteo提供的PM2.5估算，并非测站实测。',
  'reg.place': '地点', 'reg.pm': 'PM2.5', 'reg.level': '级别（参考）', 'reg.aqi': '美国AQI', 'reg.dist': '距新加坡', 'reg.next': '未来24小时',
  'reg.model': '模型', 'reg.upwind': '上风', 'reg.empty': '目前无法取得区域模型数据。', 'reg.sparkAria': '未来24小时PM2.5模型估算，由{a}至{b}',

  'city.sg': '新加坡（模型）', 'city.jb': '新山', 'city.btm': '巴淡岛', 'city.mlk': '马六甲', 'city.kl': '吉隆坡', 'city.pku': '北干巴鲁',
  'city.jbi': '占碑', 'city.plm': '巨港', 'city.mdn': '棉兰', 'city.jkt': '雅加达', 'city.ptk': '坤甸', 'city.kch': '古晋', 'city.pky': '帕朗卡拉亚', 'city.bsb': '斯里巴加湾市',
  'cc.SG': '新加坡', 'cc.MY': '马来西亚', 'cc.ID': '印度尼西亚', 'cc.BN': '文莱',

  'band.good': '良好', 'band.moderate': '中等', 'band.unhealthy': '不健康', 'band.vunhealthy': '非常不健康', 'band.hazardous': '危险',
  'pmband.normal': '正常', 'pmband.elevated': '偏高', 'pmband.high': '高', 'pmband.vhigh': '非常高',

  'adv.title': '应对建议', 'adv.desc': '卫生部与NEA按24小时PSI发出的指引，当前级别已标示。',
  'adv.psi': '24小时PSI', 'adv.healthy': '健康人士', 'adv.vulnerable': '年长者、孕妇、儿童', 'adv.chronic': '慢性肺病或心脏病患者',
  'adv.normal': '正常活动', 'adv.reduceStrenuous': '减少长时间或剧烈的户外体力活动',
  'adv.minimiseStrenuous': '尽量避免长时间或剧烈的户外体力活动', 'adv.avoidStrenuous': '避免长时间或剧烈的户外体力活动',
  'adv.minimiseOutdoor': '尽量减少户外活动', 'adv.avoidOutdoor': '避免户外活动', 'adv.now': '当前',
  'adv.note1': '当下的决定（例如是否去跑步）请参考1小时PM2.5；规划第二天的活动请参考24小时PSI。',
  'adv.note2': '短时间外出（例如步行到巴士站）无须佩戴N95口罩。健康人士在PSI预测超过300时可考虑佩戴；慢性肺病或心脏病患者在超过200时可考虑佩戴。',
  'adv.note3': '如感到不适，请尽快就医。紧急情况请拨打995。',

  'foot.sources': '数据来源', 'foot.about': '关于这些数字',
  'foot.disclaimer': 'HazeScope SG是独立的公共数据查看器，与NEA或MSS并无关联。官方公告请参阅 haze.gov.sg 及 weather.gov.sg。',
  'foot.attrib': '空气质量与天气：NEA及MSS，经 <a href="https://data.gov.sg" target="_blank" rel="noopener">data.gov.sg</a> 提供（新加坡开放数据许可）。区域模型：哥白尼大气监测服务（CAMS），经 <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> 提供。地图：Leaflet；离线影像为NASA Blue Marble与Natural Earth；在线图块来自Esri与OpenTopoMap（OpenStreetMap贡献者、SRTM）。',
  'foot.never': '尚未加载', 'foot.failed': '失败：{why}',

  'src.psi': 'NEA PSI（今日）', 'src.pm': 'NEA 1小时PM2.5（今日）', 'src.psiPrev': 'NEA PSI（昨日）', 'src.pmPrev': 'NEA PM2.5（昨日）',
  'src.regional': 'CAMS区域模型（Open-Meteo）', 'src.grid': 'CAMS烟霾分布网格（Open-Meteo）', 'src.windDirection': 'MSS风向', 'src.windSpeed': 'MSS风速',
  'src.airTemperature': 'MSS气温', 'src.humidity': 'MSS相对湿度', 'src.rainfall': 'MSS降雨量',
  'src.twoHr': 'MSS 2小时预报', 'src.twentyFourHr': 'MSS 24小时预报',
  'err.network': '网络或浏览器拦截', 'err.timeout': '请求超时', 'err.rate': '请求受限', 'err.http': '服务器错误', 'err.payload': '数据格式异常', 'err.empty': '无数据', 'err.unknown': '未知错误',

  'status.live': '实时', 'status.loading': '更新中', 'status.partial': '部分已更新', 'status.offline': '离线', 'status.error': '无法连接数据', 'status.cached': '已保存数据', 'status.demo': '演示',
  'status.title': '{cd}后获取新数据。点击立即刷新。',

  'toast.network': '无法连接 data.gov.sg，正显示上次保存的读数。',
  'toast.partial': '{total}个来源中有{n}个未能更新，详情见“设置”中的“数据”。',
  'toast.offline': '您已离线，恢复连接后会更新读数。',
  'toast.online': '已恢复连接，正在更新读数。',
  'toast.band': '{metric}现为{band}（{value}）。',
  'toast.cooldown': '读数刚刚更新过。',
  'toast.cleared': '已清除保存的读数。',
  'toast.demoOn': '已开启演示数据，数字为模拟值。',
  'toast.demoOff': '已切换至实时数据。',

  'set.title': '设置', 'set.lang': '语言', 'set.theme': '主题', 'set.interval': '获取新数据的间隔',
  'set.intervalOpt': '{n}分钟', 'set.intervalOpt1': '1分钟', 'set.intervalOpt60': '1小时',
  'set.intervalHelp': '时钟和倒计时每秒更新。NEA每小时发布PSI和PM2.5，因此较短间隔主要更新天气读数。公共API限制为每10秒6次请求。',
  'set.persona': '助理', 'set.voice': '语音', 'set.voiceOn': '朗读回复和导览步骤', 'set.female': '女声', 'set.male': '男声', 'set.rate': '语速', 'set.test': '试听',
  'set.voiceOk': '本设备使用语音“{name}”。',
  'set.voiceApprox': '本设备没有此语言的{gender}，将以调整音调的“{name}”代替。',
  'set.voiceNone': '本设备未安装此语言的语音，可在系统语音设置中添加。',
  'set.voiceUnsupported': '此浏览器不支持语音输出。',
  'set.female.lc': '女声', 'set.male.lc': '男声',
  'set.alerts': '提醒', 'set.announce': 'PSI或PM2.5级别变化时播报',
  'set.data': '数据', 'set.refresh': '立即刷新', 'set.demoOn': '使用演示数据', 'set.demoOff': '使用实时数据', 'set.clear': '清除保存的读数',
  'set.help': '帮助', 'set.tour': '重新播放导览',

  'persona.aetherguard.role': '沉稳精准的守护者', 'persona.breathenova.role': '开朗的呼吸伙伴', 'persona.qingfeng.role': '温柔诗意的同伴',

  'asst.open': '打开助理', 'asst.choose': '选择助理', 'asst.inputLabel': '询问烟霾情况', 'asst.placeholder': '问问烟霾情况…',
  'asst.mic': '语音提问', 'asst.send': '发送', 'asst.listening': '正在聆听…', 'asst.micDenied': '麦克风权限被拒绝，请改用文字输入。',
  'asst.disclaimer': '回答基于本页实时读数及NEA/卫生部指引，并非医疗建议。',
  'asst.replay': '播放', 'asst.stop': '停止',

  'tour.skip': '跳过导览', 'tour.back': '上一步', 'tour.next': '下一步', 'tour.done': '开始使用', 'tour.start': '带我看看', 'tour.step': '第{i}步，共{n}步',
  'tour.0.title': '欢迎使用 HazeScope SG',
  'tour.0.body': '新加坡及区域的实时烟霾读数，与天气数据交叉核对，还有助理为您讲解。导览约需一分钟。',
  'tour.0.lang': '语言', 'tour.0.persona': '选择您的助理',
  'tour.1.title': '此刻最重要的读数',
  'tour.1.body': '大数字是24小时PSI，取NEA五个区域中的最高值。旁边的1小时PM2.5反映这一小时的空气。PM2.5越高，背景天空越朦胧。',
  'tour.2.title': '随时保持最新',
  'tour.2.body': '这里显示连接状态，并每秒倒数至下一次获取数据。点击可立即刷新。获取频率可在设置中更改。',
  'tour.3.title': '查看烟霾在哪里',
  'tour.3.body': '彩色烟霾分布显示新加坡及区域的PM2.5。可切换地形与卫星底图，按播放查看未来24小时的模型预报，移动或点按任意位置即可读数。地图在离线时也能使用。',
  'tour.4.title': '观察趋势',
  'tour.4.body': '在图表上移动或拖动即可查看每小时读数。可切换PSI与PM2.5，点按图例中的区域可隐藏或显示。',
  'tour.5.title': '交叉核对，而非照搬',
  'tour.5.body': 'HazeScope把NEA读数与MSS的风、雨、预报以及区域模型对照，并告诉您哪些相符。',
  'tour.6.title': '区域概况',
  'tour.6.body': '邻近城市的PM2.5模型估算，位于新加坡上风处的地点会被标示。点按一行即可在地图上找到它。',
  'tour.7.title': '应对建议',
  'tour.7.body': '卫生部与NEA针对不同人群的官方指引，当前PSI所在的一行已标示。',
  'tour.8.title': '问问您的助理',
  'tour.8.body': '可用英语或华语提问，例如“可以去跑步吗？”或“烟霾从哪里来？”。回复可朗读出来。',
  'tour.9.title': '个性化设置',
  'tour.9.body': '在这里更改语言、主题、语音、助理和更新间隔。导览可随时在设置中重新播放。',

  'compass.N': '北方', 'compass.NNE': '北偏东北', 'compass.NE': '东北方', 'compass.ENE': '东偏东北', 'compass.E': '东方', 'compass.ESE': '东偏东南',
  'compass.SE': '东南方', 'compass.SSE': '南偏东南', 'compass.S': '南方', 'compass.SSW': '南偏西南', 'compass.SW': '西南方', 'compass.WSW': '西偏西南',
  'compass.W': '西方', 'compass.WNW': '西偏西北', 'compass.NW': '西北方', 'compass.NNW': '北偏西北',
};

// NEA/MSS forecast phrases → 华语
const FORECAST_ZH = {
  'fair': '天晴', 'fair (day)': '天晴（白天）', 'fair (night)': '天晴（夜间）', 'fair and warm': '晴朗温暖', 'fair & warm': '晴朗温暖',
  'partly cloudy': '局部多云', 'partly cloudy (day)': '局部多云（白天）', 'partly cloudy (night)': '局部多云（夜间）',
  'cloudy': '多云', 'hazy': '有烟霾', 'slightly hazy': '轻微烟霾', 'windy': '有风', 'mist': '薄雾', 'fog': '雾',
  'light rain': '小雨', 'moderate rain': '中雨', 'heavy rain': '大雨', 'passing showers': '短暂阵雨', 'light showers': '小阵雨',
  'showers': '阵雨', 'heavy showers': '大阵雨', 'thundery showers': '雷阵雨', 'heavy thundery showers': '强雷阵雨',
  'heavy thundery showers with gusty winds': '强雷阵雨伴有阵风', 'drizzle': '毛毛雨', 'snow': '雪',
  'windy, cloudy': '有风，多云', 'windy, fair': '有风，天晴', 'windy, rain': '有风，下雨', 'windy, showers': '有风，阵雨',
  'thundery showers in the afternoon': '午后雷阵雨', 'afternoon thundery showers': '午后雷阵雨',
};
const WIND_ZH = { N: '北', NNE: '北东北', NE: '东北', ENE: '东东北', E: '东', ESE: '东东南', SE: '东南', SSE: '南东南', S: '南', SSW: '南西南', SW: '西南', WSW: '西西南', W: '西', WNW: '西西北', NW: '西北', NNW: '北西北', VARIABLE: '风向不定' };

const DICTS = { en, zh };
let current = 'en';
const listeners = new Set();

export function getLang() { return current; }
export function onLangChange(fn) { listeners.add(fn); }
export function setLang(lang) {
  current = lang === 'zh' ? 'zh' : 'en';
  document.documentElement.setAttribute('lang', current === 'zh' ? 'zh-Hans-SG' : 'en-SG');
  applyDom();
  for (const fn of listeners) fn(current);
}

export function t(key, vars) {
  let str = DICTS[current][key] ?? en[key] ?? key;
  if (vars) str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return str;
}

export function listJoin(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (current === 'zh') return items.slice(0, -1).join('、') + '和' + items[items.length - 1];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

export function forecastText(text) {
  if (!text) return '—';
  if (current !== 'zh') return text;
  const k = text.trim().toLowerCase();
  return FORECAST_ZH[k] || text;
}
export function windDirText(code) {
  if (!code) return '';
  return current === 'zh' ? (WIND_ZH[code.toUpperCase()] || code) : code;
}

export function applyDom(root = document) {
  for (const el of $$('[data-i18n]', root)) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-html]', root)) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of $$('[data-i18n-attr]', root)) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    }
  }
}
