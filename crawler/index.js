const cloud = require("wx-server-sdk");
const https = require("https");
const { URL } = require("url");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); }
  catch { return null; }
}

function isOfficialDomain(url) {
  if (!url) return { official: false };
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [brand, domains] of Object.entries(OFFICIAL_DOMAINS)) {
      if (domains.some(d => hostname.includes(d))) return { brand, official: true };
    }
  } catch {}
  return { official: false };
}


const db = cloud.database();

const CANDIDATES = "milktea_candidates";

const SEARCH_TARGETS = [
  // 头部品牌 (5款)
  { brand: "蜜雪冰城", products: ["珍珠奶茶", "冰鲜柠檬水", "黑糖珍珠大圣", "摩天脆脆冰淇淋", "雪王草莓圣代"] },
  { brand: "CoCo都可", products: ["鲜芋奶茶", "三兄弟", "珍珠奶茶", "百香果双响炮", "鲜百香双响炮"] },
  { brand: "一点点", products: ["波霸奶茶", "红茶玛奇朵", "四季奶青", "冰淇淋红茶", "柠檬蜜"] },
  { brand: "古茗", products: ["珍珠奶茶", "芝士奶盖", "龙井香青", "杨枝甘露", "黑糖珍珠鲜奶"] },
  { brand: "茶百道", products: ["豆乳玉露", "茉莉奶绿", "招牌芋圆奶茶", "葡萄冻冻", "杨枝甘露"] },
  // 高端品牌 (5款)
  { brand: "喜茶", products: ["多肉葡萄", "芝芝莓莓", "椰椰芒芒", "芝芝桃桃", "多肉芒芒甘露"] },
  { brand: "奈雪的茶", products: ["霸气芝士草莓", "霸气橙子", "霸气玉油柑", "金色山脉宝藏茶", "霸气杨梅"] },
  { brand: "霸王茶姬", products: ["伯牙绝弦", "桂花龙井", "花田乌龙", "青青糯山", "春日桃桃"] },
  { brand: "沪上阿姨", products: ["血糯米奶茶", "杨枝甘露", "五谷奶茶", "厚芋泥啵啵奶茶", "桂花酒酿"] },
  { brand: "书亦烧仙草", products: ["烧仙草奶茶", "芋泥啵啵", "杨枝甘露", "葡萄冻冻", "黑糖珍珠鲜奶"] },
  // 腰部品牌 (3款)
  { brand: "瑞幸咖啡", products: ["生椰拿铁", "厚乳拿铁", "碧螺知春拿铁"] },
  { brand: "茶颜悦色", products: ["幽兰拿铁", "声声乌龙", "烟火易冷"] },
  { brand: "乐乐茶", products: ["草莓桃子酪酪", "脏脏茶", "黑糖珍珠鲜奶"] },
  { brand: "7分甜", products: ["杨枝甘露", "芒果爽", "榴莲芒芒"] },
  { brand: "益禾堂", products: ["烤奶", "益禾烤奶", "珍珠奶茶"] },
  // 新锐品牌 (3款)
  { brand: "茶话弄", products: ["桂花引", "梅占摇红", "南山烟雨"] },
  { brand: "阿嬷手作", products: ["黑糖珍珠厚奶", "芋泥啵啵鲜奶", "柠檬茶"] },
  { brand: "茶理宜世", products: ["玫瑰鲜奶", "茉莉鲜奶", "桂花鲜奶"] },
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

const AI_MODEL = "hy3";
const AI_PROVIDER = process.env.AI_PROVIDER || "cloudbase";

const CLOUDBASE_API_KEY = process.env.CLOUDBASE_API_KEY || "";
const CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID || "cloudbase-d7gy238nvf2d68d9b";

async function aiChatViaApiKey(messages, modelOverride, groupOverride) {
  if (!CLOUDBASE_API_KEY) throw new Error("CLOUDBASE_API_KEY 未设置");
  const body = JSON.stringify({ model: modelOverride || AI_MODEL, messages });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com`,
      path: `/v1/ai/${groupOverride || "cloudbase"}/chat/completions`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CLOUDBASE_API_KEY}` },
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

async function aiChat(messages) {
  try {
    const ai = cloud.ai();
    const model = ai.createModel(AI_PROVIDER);
    return await model.generateText({ model: AI_MODEL, messages });
  } catch (sdkError) {
      return await aiChatViaApiKey(messages);
  }
}

async function searchNutrition(brand, product) {
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

  let response;
  try {
    response = await aiChat([
      { role: "system", content: "你是一个营养数据搜索助手，负责搜索中国奶茶品牌的官方营养信息。只返回JSON格式结果。" },
      { role: "user", content: prompt },
    ]);
  } catch (error) {
    return { error: `AI 调用失败: ${error.message || "未知错误"}` };
  }

  console.log("AI Response:", JSON.stringify(response).substring(0, 500));

  let content = response?.text || "";
  if (!content && response?.choices?.[0]?.message?.content) {
    content = response.choices[0].message.content;
  }
  const parsed = extractJson(content);
  if (content.trim() === "null" || content.trim() === "Null" || !content.trim()) return { error: "AI 表示找不到可靠数据" };
  if (!parsed || !parsed.totalKcal) return { error: "AI_UNPARSED type:" + typeof content + " val:" + (content || "EMPTY").substring(0, 150) };

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
      name: item.name || "未知产品",
      brand: item.brand || "未知品牌",
      size: item.size || "中杯",
      volume: item.volume || 500,
      sugar: item.sugar || "标准糖",
      ice: item.ice || "正常冰",
      toppings: item.toppings || [],
      totalKcal: item.totalKcal,
      kcalPer100ml: item.kcalPer100ml || 0,
      baseKcal: item.totalKcal,
      toppingKcal: 0,
      sourceType: item.sourceType || "public_web",
      sourceUrl: item.sourceUrl || "",
      sourceProvider: item.sourceProvider || "",
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
  if (false) { // AI is now built-in via cloud.extend.AI
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


async function probeModels() {
  const results = {};
  const models = ["hunyuan-lite", "hunyuan", "deepseek-v3", "deepseek-r1", "hunyuan-turbo", "hunyuan-pro", "gpt-3.5-turbo"];
  for (const model of models) {
    try {
      const response = await aiChat([{ role: "user", content: "回复ok" }], model);
      results[model] = response?.choices ? "OK" : (response?.code || "unknown_error");
    } catch (error) {
      results[model] = error.message;
    }
  }
  return results;
}

exports.main = async (event = {}) => {
  try {
    if (event.action === "crawl" || event.Type === "Timer") {
      return await crawl(event);
    }
    if (event.action === "debugAI") {
      try {
        const res = await aiChatViaApiKey([{ role: "user", content: "回复ok" }]);
        return { success: true, raw: JSON.stringify(res).substring(0, 300) };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    if (event.action === "cleanup") {
      // Delete ALL crawled candidates to start fresh
      const allCrawled = await db.collection(CANDIDATES).where({ crawledBy: "milkTeaCrawler" }).get();
      let deleted = 0;
      for (const doc of allCrawled.data) {
        await db.collection(CANDIDATES).doc(doc._id).remove();
        deleted++;
      }
      return { success: true, deleted };
    }
    if (event.action === "status") {
      const count = await db.collection(CANDIDATES).where({ crawledBy: "milkTeaCrawler" }).count();
      return { success: true, crawledCount: count.total, aiConfigured: true, model: AI_MODEL, provider: AI_PROVIDER };
    }
    return { success: false, errMsg: "Unknown action. Use: crawl / status" };
  } catch (error) {
    return { success: false, errMsg: error.message || "奶茶数据自动采集失败" };
  }
};
