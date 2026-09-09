const cloud = require("wx-server-sdk");
const https = require("https");
const { URL } = require("url");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CANDIDATES = "milktea_candidates";

const SEARCH_TARGETS = [
  { brand: "蜜雪冰城", products: ["珍珠奶茶", "柠檬水", "冰淇淋红茶"] },
  { brand: "CoCo都可", products: ["鲜芋奶茶", "珍珠奶茶", "三兄弟"] },
  { brand: "一点点", products: ["波霸奶茶", "红茶玛奇朵", "四季奶青"] },
  { brand: "古茗", products: ["珍珠奶茶", "龙井香青", "芝士奶盖"] },
  { brand: "茶百道", products: ["豆乳玉露", "茉莉奶绿", "招牌芋圆奶茶"] },
  { brand: "喜茶", products: ["多肉葡萄", "芝芝莓莓", "椰椰芒芒"] },
  { brand: "奈雪的茶", products: ["霸气芝士草莓", "霸气橙子", "金色山脉宝藏茶"] },
  { brand: "霸王茶姬", products: ["伯牙绝弦", "桂花龙井", "花田乌龙"] },
  { brand: "沪上阿姨", products: ["血糯米奶茶", "杨枝甘露", "五谷奶茶"] },
  { brand: "书亦烧仙草", products: ["烧仙草奶茶", "芋泥啵啵", "杨枝甘露"] },
];

const OFFICIAL_DOMAINS = {
  "蜜雪冰城": ["mixue.com", "mixuebingcheng.com"],
  "CoCo都可": ["coco.com", "coco-tea.com", "coco1.com"],
  "一点点": ["alittletea.com", "1dot.com"],
  "喜茶": ["heytea.com", "heyteagood.com"],
  "奈雪的茶": ["nayuki.com", "nayutea.com"],
  "霸王茶姬": ["chagee.com", "bawangchaji.com", "chaji.com"],
  "古茗": ["guming.com", "gumingnv.com", "goodme.com"],
  "茶百道": ["chabaidao.com", "3tb.com"],
  "沪上阿姨": ["hushangayi.com", "aye-tea.com"],
  "书亦烧仙草": ["shuyi.com", "shuyitea.com"],
};

const CLOUDBASE_API_KEY = process.env.CLOUDBASE_API_KEY || "";
const CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID || "cloudbase-d7gy238nvf2d68d9b";
const AI_MODEL = process.env.AI_MODEL || "hunyuan-lite";

// CloudBase AI endpoint (OpenAI-compatible)
const AI_ENDPOINT = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/ai/chat/completions`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function httpRequest(url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Request timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); }
  catch { return null; }
}

function isOfficialDomain(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [brand, domains] of Object.entries(OFFICIAL_DOMAINS)) {
      if (domains.some(d => hostname.includes(d))) return { brand, official: true };
    }
  } catch {}
  return { official: false };
}

async function aiChat(messages) {
  if (!CLOUDBASE_API_KEY) {
    throw new Error("请在云函数环境变量中设置 CLOUDBASE_API_KEY（小程序成长计划 → 云开发服务端密钥）");
  }

  const body = JSON.stringify({
    model: AI_MODEL,
    messages,
    enable_search: true,
    temperature: 0.1,
  });

  return new Promise((resolve, reject) => {
    const parsed = new URL(AI_ENDPOINT);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CLOUDBASE_API_KEY}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("AI 请求超时")); });
    req.write(body);
    req.end();
  });
}

async function searchNutrition(brand, product) {
  if (!CLOUDBASE_API_KEY) {
    return { error: "请在云函数环境变量中设置 CLOUDBASE_API_KEY" };
  }

  const prompt = `请搜索"${brand}"的"${product}"的营养成分/热量信息（大卡/kcal/卡路里）。优先找品牌官方公布的数据。返回JSON格式：
{
  "name": "产品名",
  "brand": "品牌名",
  "size": "杯型(中杯/大杯/超大杯)",
  "volume": 500,
  "sugar": "糖度(无糖/三分糖/五分糖/七分糖/标准糖)",
  "ice": "冰量(去冰/少冰/正常冰)",
  "toppings": ["配料1","配料2"],
  "totalKcal": 380,
  "kcalPer100ml": 76,
  "sourceUrl": "https://来源网址",
  "sourceProvider": "来源名称"
}
如果确实找不到可靠数据，返回 null。只返回JSON，不要多余文字。`;

  const response = await aiChat([
    { role: "system", content: "你是一个营养数据搜索助手，负责搜索中国奶茶品牌的官方营养信息。只返回JSON格式结果。" },
    { role: "user", content: prompt },
  ]);

  const content = response?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);
  if (!parsed || !parsed.totalKcal) return { error: "AI 未返回有效数据" };

  const domainCheck = isOfficialDomain(parsed.sourceUrl);
  const sourceType = domainCheck.official ? "official" : "public_web";

  return {
    name: String(parsed.name || product).trim(),
    brand: String(parsed.brand || brand).trim(),
    size: String(parsed.size || "中杯").trim(),
    volume: Number(parsed.volume) || 500,
    sugar: String(parsed.sugar || "标准糖").trim(),
    ice: String(parsed.ice || "正常冰").trim(),
    toppings: Array.isArray(parsed.toppings) ? parsed.toppings : [],
    totalKcal: Number(parsed.totalKcal),
    kcalPer100ml: Number(parsed.kcalPer100ml) || Math.round(parsed.totalKcal / (parsed.volume || 500) * 100),
    sourceUrl: String(parsed.sourceUrl || "").trim(),
    sourceProvider: String(parsed.sourceProvider || brand).trim(),
    sourceType,
    capturedAt: new Date().toISOString().slice(0, 10),
  };
}

async function writeCandidate(item) {
  const now = Date.now();
  return await db.collection(CANDIDATES).add({
    data: {
      ...item,
      baseKcal: item.totalKcal,
      toppingKcal: 0,
      status: "pending",
      createdAt: now,
      ingestedAt: now,
      crawledBy: "milkTeaCrawler",
      crawlModel: AI_MODEL,
    },
  });
}

async function triggerReview() {
  try {
    const result = await cloud.callFunction({
      name: "milkTeaAgent",
      data: { action: "run" },
    });
    return result.result;
  } catch (error) {
    return { success: false, errMsg: error.message || "触发审核失败" };
  }
}

async function crawl(event = {}) {
  const now = Date.now();
  if (!AI_API_KEY) {
    return { success: false, errMsg: "请在云函数「环境变量」中设置 CLOUDBASE_API_KEY" };
  }

  const summary = { searched: 0, found: 0, official: 0, public_web: 0, errors: [], startTime: now };

  // Allow crawling a single brand or product for testing
  const targets = event.brand
    ? SEARCH_TARGETS.filter(t => t.brand === event.brand)
    : SEARCH_TARGETS;

  for (const target of targets) {
    for (const product of target.products) {
      summary.searched += 1;
      try {
        const item = await searchNutrition(target.brand, product);
        if (item.error) {
          summary.errors.push(`${target.brand}·${product}: ${item.error}`);
        } else {
          await writeCandidate(item);
          summary.found += 1;
          if (item.sourceType === "official") summary.official += 1;
          else summary.public_web += 1;
        }
      } catch (error) {
        summary.errors.push(`${target.brand}·${product}: ${error.message || "未知错误"}`);
      }
      await delay(1500);
    }
  }

  summary.endTime = Date.now();
  summary.durationMs = summary.endTime - now;

  // Trigger review if we found anything
  let reviewResult = null;
  if (summary.found > 0) {
    reviewResult = await triggerReview();
  }

  return { success: true, summary, reviewResult };
}

exports.main = async (event = {}) => {
  try {
    if (event.action === "crawl" || event.Type === "Timer") {
      return await crawl(event);
    }
    if (event.action === "status") {
      const count = await db.collection(CANDIDATES).where({ crawledBy: "milkTeaCrawler" }).count();
      return { success: true, crawledCount: count.total, aiConfigured: !!CLOUDBASE_API_KEY, model: AI_MODEL };
    }
    return { success: false, errMsg: "Unknown action. Use: crawl / status" };
  } catch (error) {
    return { success: false, errMsg: error.message || "奶茶数据自动采集失败" };
  }
};
