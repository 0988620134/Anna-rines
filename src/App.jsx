import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';

const colors = {
  bg: '#F3EFE9',          
  textMain: '#333333',    
  textMuted: '#8B8276',   
  accent: '#5C544D',      
  border: '#E8E4DD'       
};

// ===== GitHub Pages / Vite 公開部署設定 =====
// Firebase 的前端設定本身不是密碼；真正的資料安全請以 Firestore Rules 控制。
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let auth = null;
let db = null;

if (firebaseEnabled) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

const appId = import.meta.env.VITE_FIREBASE_COLLECTION_ID || 'rines-charm-app';

// Google Apps Script Web App：同時負責 Gemini AI 與 Google Sheet 儲存。
// 這個網址可以公開；Gemini API Key 必須只存放在 Apps Script 的 Script Properties。
const BACKEND_WEBAPP_URL = import.meta.env.VITE_GOOGLE_SHEET_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyjrlbdjrjGxzA-kAUNEsWBDBiQIhVCDAI0rJ4PPcjoXJG4qhvkmDb5v4HmDz3J-iRP7Q/exec';

const scoringMap = {
  3:  { A: 'Warmth', B: 'Freedom', C: 'Power' },
  4:  { A: 'Freedom', B: 'Power', C: 'Warmth' },
  5:  { A: 'Power', B: 'Warmth', C: 'Freedom' },
  6:  { A: 'Freedom', B: 'Power', C: 'Warmth' },
  7:  { A: 'Warmth', B: 'Freedom', C: 'Power' },
  8:  { A: 'Power', B: 'Warmth', C: 'Freedom' },
  9:  { A: 'Power', B: 'Freedom', C: 'Warmth' },
  10: { A: 'Freedom', B: 'Warmth', C: 'Power' },
  11: { A: 'Warmth', B: 'Power', C: 'Freedom' },
  12: { A: 'Warmth', B: 'Power', C: 'Freedom' },
  13: { A: 'Freedom', B: 'Warmth', C: 'Power' },
  14: { A: 'Power', B: 'Freedom', C: 'Warmth' },
  15: { A: 'Power', B: 'Freedom', C: 'Warmth' },
  16: { A: 'Warmth', B: 'Power', C: 'Freedom' },
  17: { A: 'Power', B: 'Warmth', C: 'Freedom' },
  18: { A: 'Power', B: 'Warmth', C: 'Freedom' },
  19: { A: 'Power', B: 'Freedom', C: 'Warmth' }
};

const IMAGE_BASE = `${import.meta.env.BASE_URL}images/`;
const questions = [
  { id: 1, type: 'multiple', text: "你今天來做這份測驗，最希望得到什麼？ [多選題] *", options: { A: "更了解自己的個人魅力", B: "找到適合自己的風格", C: "提升自己的自信", D: "單純好奇" } },
  { id: 2, type: 'ranking', text: "如果這份測驗結果讓你很有共鳴，你會最想進一步獲得什麼？ [排序題] *", options: { A: "查看完整魅力報告", B: "查看適合自己的飾品推薦", C: "查看穿搭風格建議", D: "還好，沒有特別想看" } },
  { id: 3, type: 'single', text: "當一件事有很多方案，但大家遲遲無法決定時，你最自然會：", options: { A: "先確認每個人最在意什麼，避免有人被忽略", B: "先思考是否還有其他沒被提出的選項", C: "先判斷哪個方案最可行，推動大家做出選擇" } },
  { id: 4, type: 'single', text: "當時間、預算或資源有限，不可能全部兼顧時，你會：", options: { A: "選擇最有彈性、未來還能調整的部分", B: "選擇最能達成目標的部分", C: "選擇對大家影響最大的部分" } },
  { id: 5, type: 'single', text: "同時有好幾件重要的事情需要處理，但你只能先做一件：", options: { A: "先處理影響最大的事情", B: "先處理最需要回應他人的事情", C: "先處理最符合自己目前想投入的事情" } },
  { id: 6, type: 'single', text: "第一次參加一個新的活動，大部分的人你都不認識，你會：", options: { A: "先自然展現自己的樣子，吸引理念相近的人交流", B: "主動帶領大家開始互動，讓現場更快進入狀況", C: "主動認識不同的人，了解彼此、建立連結" } },
  { id: 7, type: 'single', text: "和一個人開始有較多互動後，你認為最容易建立信任的方式是：", options: { A: "持續理解對方、信守承諾，讓對方感受到安心", B: "真誠做自己，不刻意迎合，讓對方認識真正的你", C: "展現自己的能力與判斷，讓對方相信你值得依靠" } },
  { id: 8, type: 'single', text: "如果希望一段重要的關係能夠長久維持，你最重視的是：", options: { A: "彼此都有明確的界線與尊重，遇到問題能坦率溝通", B: "持續關心彼此的感受，願意互相支持與陪伴", C: "彼此都保有自己的空間，不需要勉強改變對方" } },
  { id: 9, type: 'single', text: "第一次接觸一件完全陌生的新事物時，你會：", options: { A: "查詢客觀資訊，了解它的功能、成果或實際價值，再判斷是否值得投入", B: "先自己親自接觸或體驗，再看看還有哪些有趣的可能性", C: "先聽聽別人的使用經驗或心得，再決定是否深入了解" } },
  { id: 10, type: 'single', text: "當你決定開始接觸一個新的領域後：", options: { A: "直接動手嘗試不同的方法，在過程中慢慢找到適合自己的方式", B: "在學習過程中，不斷和他人交流、討論，透過互動加深理解", C: "先整理一套自己的學習步驟，按計畫逐步執行" } },
  { id: 11, type: 'single', text: "每當你願意投入時間探索新的事物時，你最希望最後能：", options: { A: "理解更多不同的人與觀點", B: "找到真正有價值，能實際運用的收穫", C: "發現新的可能性，拓展自己的視野" } },
  { id: 12, type: 'single', text: "當需要自己想出一個新的方法或解決方案時：", options: { A: "先思考使用的人真正需要什麼", B: "先釐清最重要的目標，再開始思考做法", C: "先發想各種不同切入點，再慢慢整理方向" } },
  { id: 13, type: 'single', text: "當一個想法逐漸成形時：", options: { A: "自由組合不同元素，慢慢發展出新的做法", B: "整合不同人的意見，讓成果兼顧各方需求", C: "建立清楚的架構，整合完整方案" } },
  { id: 14, type: 'single', text: "當你完成一個作品、企劃或解決方案時，你通常會在什麼情況下，認為它已經可以告一段落？", options: { A: "當整體架構清楚、邏輯完整時", B: "當它已經完整呈現自己原本的想法時", C: "當它真正符合使用者或他人的需求時" } },
  { id: 15, type: 'single', text: "完成一件自己投入很多心力的事情後，你最傾向用什麼標準判斷它是否成功？", options: { A: "是否達成原本想做到的事", B: "是否發展出創新的事物時", C: "是否真正帶給他人正面的影響" } },
  { id: 16, type: 'single', text: "一件事情完成後，最讓你有成就感的是：", options: { A: "自己的努力對別人有所幫助", B: "嘗試不同以往的方式，也看見了新的可能性", C: "透過努力，真正達成原本設定的目標" } },
  { id: 17, type: 'single', text: "回顧那些你真正重視的成果時，你最容易覺得它們代表你是：", options: { A: "更相信自己是能承擔責任、完成目標的人", B: "更相信自己是能帶給別人正面影響的人", C: "更相信自己是願意忠於自己、走出自己道路的人" } },
  { id: 18, type: 'single', text: "當別人第一次認識你時，你最希望對方先感受到的是：", options: { A: "是一個有影響力、值得重視的人", B: "是一個讓人感到安心、容易親近的人", C: "是一個千變萬化、不容易被定義的人" } },
  { id: 19, type: 'single', text: "如果你發現自己的表達方式，不符合身邊大多數人的期待，你通常會：", options: { A: "如果改變會失去自己的特色，通常不會因為他人的期待而調整", B: "只要能維持自己想傳達的核心訊息，可以調整表達方式", C: "會優先調整表達方式，希望彼此都能自在地交流" } },
  { id: 20, type: 'single', text: "下面哪一種飾品線條最吸引你？", image: `${IMAGE_BASE}20.png`, options: { A: "幾何俐落（直線、結構感、現代感）", B: "圓潤柔和（圓潤、流動感、柔美）", C: "自然不規則（不規則、自然感、自由）" } },
  { id: 21, type: 'single', text: "下面哪一種材質氛圍最符合你的喜好？",image:  `${IMAGE_BASE}21.png`, options: { A: "金屬光澤、質感簡約", B: "珍珠柔和、溫潤優雅", C: "個性有設計感、時尚有型" } },
  { id: 22, type: 'single', text: "你更偏好哪種飾品存在感？", image:  `${IMAGE_BASE}22.png`,options: { A: "小巧細緻、低調優雅", B: "適中平衡、日常百搭", C: "吸睛亮點、風格突出" } },
  { id: 23, type: 'single', text: "如果第一次見面，你希望飾品讓別人留下什麼樣的印象？", image:  `${IMAGE_BASE}23.png`,options: { A: "質感、精緻有型，展現專業與品味", B: "自然、舒服親切，給人溫暖好感", C: "獨特個性、有記憶點，讓人印象深刻" } },
  { id: 24, type: 'single', text: "當兩件飾品都很喜歡，只能選一件時，你通常最容易因為哪個原因做決定？", options: { A: "它的設計最吸引我，看到就很喜歡", B: "它的品質、材質或做工，更讓我放心", C: "它的價格現在買最划算" } },
  { id: 25, type: 'single', text: "你覺得一件飾品「值得買」，通常是因為：", options: { A: "戴很多年仍然會喜歡，不容易退流行", B: "它能表現自己的風格，很有特色", C: "價格和品質都有達到你的標準" } },
  { id: 26, type: 'single', text: "即使很喜歡一件飾品，但最後沒有買，最常是因為：", options: { A: "不知道是不是值得這個價格", B: "不確定自己平常有沒有機會戴", C: "擔心買了之後，很快就不喜歡" } },
  { id: 27, type: 'single', text: "下面哪一種方式，比較符合你購買飾品的習慣？", options: { A: "買得少，但希望每一件都能戴很久", B: "遇到真正喜歡的，就值得收藏", C: "喜歡依照不同穿搭，擁有各種不同款式" } },
  { id: 28, type: 'single', text: "你最常在哪一種情境下佩戴飾品？", options: { A: "每天都會配戴，已經是日常習慣", B: "外出、聚會或重要場合才會特別配戴", C: "依照當天心情或穿搭決定是否佩戴" } },
  { id: 29, type: 'single', text: "當佩戴飾品時，你通常比較喜歡：", options: { A: "固定戴幾件熟悉、最適合自己的飾品", B: "同一套穿搭用同一組飾品", C: "嘗試不同組合，享受搭配的樂趣" } },
  { id: 30, type: 'scale', text: "這份測驗的題目整體來說容易理解", options: { 1: "非常不同意", 2: "不太同意", 3: "普通", 4: "同意", 5: "非常同意" } },
  { id: 31, type: 'scale', text: "大多數題目中，我都能直覺選出最接近自己的答案", options: { 1: "非常不同意", 2: "不太同意", 3: "普通", 4: "同意", 5: "非常同意" } },
  { id: 32, type: 'scale', text: "這些題目描述的情境，和我平常生活或思考方式有關聯", options: { 1: "非常不同意", 2: "不太同意", 3: "普通", 4: "同意", 5: "非常同意" } },
  { id: 33, type: 'scale', text: "做完這份測驗後，我會想知道自己的核心魅力分析結果", options: { 1: "非常不同意", 2: "不太同意", 3: "普通", 4: "同意", 5: "非常同意" } },
  { id: 34, type: 'text', text: "恭喜你完成問卷~對於問卷有建議或其他想法歡迎留言！" }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('home'); // 'home', 'intro', 'quiz', 'analyzing', 'result'
  const [userName, setUserName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState({ Warmth: 0, Freedom: 0, Power: 0 });
  const [finalProfile, setFinalProfile] = useState(null);
  const [aiError, setAiError] = useState(null);
  
  // 問卷輸入狀態
  const [multiSelectValues, setMultiSelectValues] = useState([]);
  const [rankingValues, setRankingValues] = useState({});
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    if (!firebaseEnabled || !auth) return;

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleStartIntro = () => setAppState('intro');

  const handleStartQuiz = () => {
    if (!userName.trim()) return;
    setAppState('quiz');
    setCurrentQuestion(0);
    setAnswers({});
    setScores({ Warmth: 0, Freedom: 0, Power: 0 });
    setMultiSelectValues([]);
    setRankingValues({});
    setTextInput('');
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      triggerAnalysis();
    }
  };

  const handleSingleAnswer = (option) => {
    const qId = questions[currentQuestion].id;
    if (scoringMap[qId]) {
      const trait = scoringMap[qId][option];
      setScores(prev => ({ ...prev, [trait]: prev[trait] + 1 }));
    }
    setAnswers(prev => ({ ...prev, [qId]: option }));
    setTimeout(() => { handleNextQuestion(); }, 150);
  };

  const handleMultiSelectToggle = (option) => {
    setMultiSelectValues(prev => 
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  };

  const submitMultiSelect = () => {
    if (multiSelectValues.length === 0) return; 
    const qId = questions[currentQuestion].id;
    setAnswers(prev => ({ ...prev, [qId]: multiSelectValues.join(', ') }));
    handleNextQuestion();
  };

  const handleRankingChange = (option, val) => {
    setRankingValues(prev => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach(k => {
        if (newValues[k] === val) {
          delete newValues[k];
        }
      });
      if (prev[option] === val) {
        delete newValues[option];
      } else {
        newValues[option] = val;
      }
      return newValues;
    });
  };

  const submitRanking = () => {
    const qId = questions[currentQuestion].id;
    const formattedRanking = Object.entries(rankingValues)
      .filter(([_, val]) => val)
      .map(([opt, val]) => `[${val}] ${opt}`)
      .join(', ');
    setAnswers(prev => ({ ...prev, [qId]: formattedRanking || '未填寫' }));
    handleNextQuestion();
  };

  const submitText = () => {
    const qId = questions[currentQuestion].id;
    const finalText = textInput || '未填寫';
    const nextAnswers = { ...answers, [qId]: finalText };
    setAnswers(nextAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      triggerAnalysis(nextAnswers);
    }
  };

  const buildSheetPayload = (profileName = '', answerSource = answers) => {
    const payload = {
      userName,
      resultProfile: profileName,
      warmth: scores.Warmth,
      freedom: scores.Freedom,
      power: scores.Power
    };

    questions.forEach(q => {
      const ansKey = answerSource[q.id];
      if (!ansKey) {
        payload['q' + q.id] = '';
      } else if (q.type === 'single') {
        payload['q' + q.id] = q.options?.[ansKey] ? `${ansKey}: ${q.options[ansKey]}` : String(ansKey);
      } else if (q.type === 'multiple') {
        const keys = String(ansKey).split(',').map(x => x.trim()).filter(Boolean);
        payload['q' + q.id] = keys.map(k => q.options?.[k] ? `${k}: ${q.options[k]}` : k).join(' | ');
      } else {
        payload['q' + q.id] = String(ansKey);
      }
    });

    return payload;
  };

  const postToAppsScript = (payload, timeoutMs = 300000) => {
    return new Promise((resolve, reject) => {
      if (!BACKEND_WEBAPP_URL || !BACKEND_WEBAPP_URL.startsWith('https://script.google.com/')) {
        reject(new Error('尚未設定 Apps Script Web App 網址'));
        return;
      }

      const requestId = (globalThis.crypto?.randomUUID?.() || `wrines-${Date.now()}-${Math.random()}`);
      const iframeName = `wrines_backend_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement('iframe');
      const form = document.createElement('form');
      const startedAt = Date.now();
      let stopped = false;
      let pollTimer = null;
      let lastPollError = '';

      const cleanup = () => {
        stopped = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      const fail = (message) => {
        if (stopped) return;
        cleanup();
        reject(new Error(message));
      };

      const jsonpStatus = () => new Promise((res, rej) => {
        const cbName = `__wrines_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_$]/g, '_');
        const script = document.createElement('script');
        let done = false;

        const finish = () => {
          if (done) return;
          done = true;
          try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
          if (script.parentNode) script.parentNode.removeChild(script);
        };

        const t = setTimeout(() => {
          finish();
          rej(new Error('狀態查詢逾時'));
        }, 12000);

        window[cbName] = (data) => {
          clearTimeout(t);
          finish();
          res(data);
        };

        script.onerror = () => {
          clearTimeout(t);
          finish();
          rej(new Error('無法讀取 Apps Script 狀態'));
        };

        const sep = BACKEND_WEBAPP_URL.includes('?') ? '&' : '?';
        script.src = `${BACKEND_WEBAPP_URL}${sep}action=status&requestId=${encodeURIComponent(requestId)}&prefix=${encodeURIComponent(cbName)}&_=${Date.now()}`;
        document.head.appendChild(script);
      });

      const poll = async () => {
        if (stopped) return;
        if (Date.now() - startedAt > timeoutMs) {
          fail(`Apps Script 回應逾時${lastPollError ? `（最後錯誤：${lastPollError}）` : ''}`);
          return;
        }

        try {
          const data = await jsonpStatus();
          if (data && data.source === 'WRINES_BACKEND' && data.requestId === requestId && !data.pending) {
            cleanup();
            if (data.ok) resolve(data);
            else reject(new Error(data.error || '後端處理失敗'));
            return;
          }
        } catch (err) {
          lastPollError = err?.message || String(err);
        }

        pollTimer = setTimeout(poll, 1500);
      };

      iframe.name = iframeName;
      iframe.id = iframeName;
      Object.assign(iframe.style, {
        position: 'absolute', width: '1px', height: '1px', left: '-9999px', top: '-9999px',
        border: '0', opacity: '0', pointerEvents: 'none'
      });
      document.body.appendChild(iframe);

      form.method = 'POST';
      form.action = BACKEND_WEBAPP_URL;
      form.target = iframeName;
      form.style.display = 'none';

      const fullPayload = { ...payload, requestId };
      Object.entries(fullPayload).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value == null ? '' : String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      pollTimer = setTimeout(poll, 1200);
    });
  };
  const saveResultToFirestore = async (profileToSave) => {
    if (user && db) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quizResults'), {
          timestamp: serverTimestamp(),
          userName,
          scores,
          resultProfile: profileToSave.charmName,
          answers
        });
      } catch (e) {
        console.error('Error saving result to Firestore:', e);
      }
    }
  };

  const triggerAnalysis = async (answerSource = answers) => {
    setAppState('analyzing');
    setAiError(null);

    const answerDetails = questions.map(q => {
      if (q.id >= 20 && q.id <= 29 && answerSource[q.id]) {
        return `Q: ${q.text} A: ${q.options ? q.options[answerSource[q.id]] : answerSource[q.id]}`;
      }
      return null;
    }).filter(Boolean).join('\n');

    const prompt = `
你現在是一個名為 "W.RINES" 的高級珠寶品牌的魅力分析師。
請根據以下使用者的測驗數據，生成一份符合我們品牌調性 (溫潤、簡約、充滿自信、高級感) 的個人魅力分析報告。

【使用者數據】
姓名: ${userName}
核心特質分數: Power: ${scores.Power}, Freedom: ${scores.Freedom}, Warmth: ${scores.Warmth} (滿分17，分數最高的為主導特質)
使用者關於飾品偏好的回答:
${answerDetails}

【你的任務】
請根據他的主導特質與飾品偏好，回傳一個符合下列格式的 JSON 物件。不要包含任何其他文字或 markdown 標記。

【JSON 格式要求】
{
  "charmName": "請為他創造一個 2 字的中文魅力代號 (如: 開界、柔風、原石)",
  "charmTitle": "對應上方中文的 1 個英文單字 (如: VANGUARD, BREEZE)",
  "charmDesc": "一段約 50 字的描述，解讀這個名稱，並說明他在關係或工作中的獨特魅力。",
  "aboutYou": "一段約 80 字的分析，結合他最高分的兩項特質，用溫柔但有力量的語氣給予肯定。",
  "tags": ["3個描述他的形容詞，如: 開創", "果斷", "獨立"],
  "jewelry": {
    "line": "適合他的飾品線條描述 (如: 幾何俐落、圓潤流動)",
    "size": "適合的尺寸 (如: 小型、中大型)",
    "weight": "適合的視覺重量 (如: 輕盈、具份量感)",
    "shine": "適合的光澤 (如: 乾淨亮面、仿舊霧面)",
    "testMatch": ["推薦單品1", "推薦單品2", "推薦單品3"],
    "avoid": ["不建議的款式1", "不建議的款式2", "不建議的款式3"],
    "stylingSuggestion": "一段約 50 字的穿搭建議，結合他回答的佩戴習慣。"
  }
}
`;

    try {
      const response = await postToAppsScript({
        action: 'analyze',
        prompt,
        ...buildSheetPayload('', answerSource)
      });

      const parsedProfile = response.profile;
      if (!parsedProfile?.charmName || !parsedProfile?.jewelry) {
        throw new Error('Gemini 回傳格式不完整');
      }

      parsedProfile.finalScores = scores;
      parsedProfile.traits = {
        top1: Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0],
        top2: Object.keys(scores).sort((a, b) => scores[b] - scores[a])[1]
      };

      setFinalProfile(parsedProfile);
      setAppState('result');
      saveResultToFirestore(parsedProfile);
    } catch (error) {
      console.error('AI / Google Sheet 後端呼叫失敗，啟用備用方案:', error);
      setAiError(`AI 連線失敗：${error?.message || '未知錯誤'}；已切換至標準分析模式。`);
      calculateResultFallback();
    }
  };

  const calculateResultFallback = () => {
    const scoreEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top1 = scoreEntries[0][0];
    const top2 = scoreEntries[1][0];

    const fallbackProfile = {
      charmName: top1 === 'Power' ? '開界' : top1 === 'Warmth' ? '柔風' : '原石',
      charmTitle: top1 === 'Power' ? 'VANGUARD' : top1 === 'Warmth' ? 'BREEZE' : 'ESSENCE',
      charmDesc: '你的魅力常在有主見卻不僵化的選擇中展現，既保有自己的方向，也能為新的可能留下空間。',
      aboutYou: `你的 ${top1} 與 ${top2} 形成穩定的雙核心。你願意親自嘗試、尋找新方法，也能建立架構、承擔責任並推進成果。這是一份溫柔而堅定的力量。`,
      tags: ['獨特', '真誠', '有風格'],
      jewelry: {
        line: '幾何俐落、精簡結構',
        size: '中小型',
        weight: '輕至中等',
        shine: '乾淨金屬光澤',
        testMatch: ['小型幾何金屬耳環', '結構俐落的細鍊墜飾', '有細節特色的簡約戒指'],
        avoid: ['線條過度柔弱的款式', '只追求吸睛難以長期配戴的設計', '價格與材質不相稱的流行單品'],
        stylingSuggestion: '你適合小巧、俐落且帶有設計辨識度的金屬飾品。外出可固定以一件熟悉的單品作為重點，選購時兼顧材質與做工會更符合你的習慣。'
      },
      finalScores: scores,
      traits: { top1, top2 }
    };

    setFinalProfile(fallbackProfile);
    setAppState('result');
    saveResultToFirestore(fallbackProfile);
  };


  if (appState === 'home') {
    return (
      <div className="min-h-screen text-[#333333] font-sans flex flex-col items-center justify-center px-4 py-8 sm:p-6 relative overflow-x-hidden" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-md w-full bg-white p-6 sm:p-8 md:p-12 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] text-center border" style={{ borderColor: colors.border }}>
          <div className="text-xs tracking-[0.3em] mb-4 uppercase" style={{ color: colors.textMuted }}>Discover Your Essence</div>
          <h1 className="text-3xl font-light mb-8 tracking-[0.2em]" style={{ color: colors.textMain }}>W.RINES</h1>
          <h2 className="text-lg mb-6 font-medium tracking-[0.2em]">魅力探索測驗</h2>
          <div className="w-8 h-[1px] mx-auto mb-8" style={{ backgroundColor: colors.accent }}></div>
          <p className="text-sm leading-loose text-justify mb-12" style={{ color: colors.textMuted }}>
            透過 34 個情境問題，探索你內在的 Power、Freedom 與 Warmth，尋找最適合你的專屬珠寶語言。
          </p>
          <button onClick={handleStartIntro} className="w-full py-4 text-white rounded-none transition-opacity hover:opacity-90 flex items-center justify-center tracking-[0.2em] text-sm" style={{ backgroundColor: colors.accent }}>
            開始探索 <ChevronRight size={16} className="ml-2" />
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'intro') {
    return (
      <div className="min-h-screen text-[#333333] font-sans flex flex-col items-center justify-center px-4 py-8 sm:p-6" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-2xl w-full bg-white p-6 sm:p-8 md:p-14 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
          <h1 className="text-2xl font-medium mb-8 tracking-widest" style={{ color: colors.textMain }}>歡迎你開始這份測驗！</h1>
          <div className="space-y-6 text-sm leading-loose tracking-wide mb-12 text-justify" style={{ color: colors.textMuted }}>
            <p>每個人都有屬於自己的魅力。</p>
            <p>有些人自然展現影響力，有些人擅長建立連結，也有人總能保持獨特與自由。</p>
            <p>這份測驗希望了解面對選擇時，你最自然的思考方式、與他人互動時，最自然的建立關係方式，以及面對未知、創造、成果與自我表達時，最傾向採取的心理策略。</p>
            <p>請依照平常「直覺」作答，每一個選項都有不同魅力的表現方式，測驗時間約為 10 分鐘。</p>
            <p className="font-medium text-base mt-8" style={{ color: colors.textMain }}>真正的魅力，不是變成別人眼中的完美。<br/>而是讓獨一無二的自己被看見。</p>
          </div>
          <div className="mb-8 border-t pt-8" style={{ borderColor: colors.border }}>
            <label className="block text-sm font-medium mb-4 tracking-widest" style={{ color: colors.textMain }}>
              你的姓名或暱稱 <span className="text-red-500">*</span>
            </label>
            <input type="text" className="w-full p-4 border focus:outline-none transition-colors tracking-widest text-sm" style={{ borderColor: colors.border, color: colors.textMain, backgroundColor: '#faf9f7' }} placeholder="請輸入姓名或暱稱..." value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
          <button onClick={handleStartQuiz} disabled={!userName.trim()} className="w-full py-4 text-white text-sm tracking-[0.2em] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center" style={{ backgroundColor: colors.accent }}>
            進入測驗 <ChevronRight size={16} className="ml-2" />
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'analyzing') {
    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:p-6 overflow-x-hidden" style={{ backgroundColor: colors.bg, color: colors.textMain }}>
        <div className="text-center animate-pulse">
           <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-8" style={{ borderColor: colors.border, borderTopColor: colors.accent }}></div>
           <h2 className="text-lg tracking-[0.2em] font-light">正在為您生成專屬魅力報告...</h2>
           <p className="text-sm mt-4 tracking-widest" style={{ color: colors.textMuted }}>W.RINES AI 正在結合您的答案進行分析</p>
        </div>
      </div>
    );
  }

  if (appState === 'quiz') {
    const q = questions[currentQuestion];
    
    if (!q) {
        return null; // Or some fallback UI, but it should transition away quickly
    }

    const progress = ((currentQuestion) / questions.length) * 100;

    const renderQuestionOptions = () => {
      if (q.type === 'single' || q.type === 'scale') {
        return (
          <div className="space-y-3 w-full">
            {Object.entries(q.options).map(([key, value]) => (
              <button key={key} onClick={() => handleSingleAnswer(key)} className="w-full p-5 border text-left bg-white transition-all text-sm tracking-[0.1em]" style={{ borderColor: colors.border, color: colors.textMain }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.backgroundColor = '#faf9f7'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = 'white'; }}>
                <span className="font-medium mr-2">{q.type === 'single' ? `${key}.` : ''}</span> {value}
              </button>
            ))}
          </div>
        );
      }
      if (q.type === 'multiple') {
        return (
          <div className="space-y-3 w-full">
             {Object.entries(q.options).map(([key, value]) => (
              <label key={key} className="flex items-center w-full p-5 border bg-white cursor-pointer transition-all" style={{ borderColor: multiSelectValues.includes(key) ? colors.accent : colors.border }}>
                <input type="checkbox" className="mr-4 accent-[#5C544D] w-4 h-4" checked={multiSelectValues.includes(key)} onChange={() => handleMultiSelectToggle(key)} />
                <span className="text-sm tracking-[0.1em]" style={{ color: colors.textMain }}>{key}. {value}</span>
              </label>
            ))}
            <button onClick={submitMultiSelect} className="w-full py-4 mt-6 text-white text-sm tracking-[0.2em] transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: colors.accent }} disabled={multiSelectValues.length === 0}>下一題 NEXT</button>
          </div>
        );
      }
      if (q.type === 'ranking') {
        return (
          <div className="space-y-3 w-full">
            <p className="text-xs mb-4" style={{ color: colors.textMuted }}>*請點擊數字 1、2、3、4 為下列選項排序 (1 為最想，4 為最不想)</p>
             {Object.entries(q.options).map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row items-start sm:items-center w-full p-4 border bg-white" style={{ borderColor: colors.border }}>
                <span className="text-sm tracking-[0.1em] mb-4 sm:mb-0 sm:flex-1" style={{ color: colors.textMain }}>{key}. {value}</span>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4].map(num => (
                    <button key={num} onClick={() => handleRankingChange(key, num)} className="w-10 h-10 flex items-center justify-center border text-sm transition-colors rounded-sm" style={{ borderColor: rankingValues[key] === num ? colors.accent : colors.border, backgroundColor: rankingValues[key] === num ? colors.accent : 'transparent', color: rankingValues[key] === num ? 'white' : colors.textMuted }}>{num}</button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={submitRanking} className="w-full py-4 mt-6 text-white text-sm tracking-[0.2em] transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: colors.accent }} disabled={Object.keys(rankingValues).length < 4}>下一題 NEXT</button>
          </div>
        );
      }
      if (q.type === 'text') {
        return (
          <div className="space-y-4 w-full">
             <textarea className="w-full h-32 p-4 border focus:outline-none resize-none text-sm tracking-wide" style={{ borderColor: colors.border, color: colors.textMain }} placeholder="請輸入您的建議或想法..." value={textInput} onChange={(e) => setTextInput(e.target.value)} />
             <button onClick={submitText} className="w-full py-4 text-white text-sm tracking-[0.2em] transition-opacity hover:opacity-90" style={{ backgroundColor: colors.accent }}>完成測驗 SUBMIT</button>
          </div>
        );
      }
    };

    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:p-6 overflow-x-hidden" style={{ backgroundColor: colors.bg, color: colors.textMain }}>
        <div className="max-w-xl w-full flex flex-col items-center">
          <div className="text-center mb-10 w-full max-w-md">
            <h1 className="text-xl font-light tracking-[0.2em]">W.RINES</h1>
            <div className="mt-6 w-full h-[2px]" style={{ backgroundColor: colors.border }}>
              <div className="h-[2px] transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: colors.accent }}></div>
            </div>
            <div className="text-xs mt-3 tracking-widest" style={{ color: colors.textMuted }}>{currentQuestion + 1} / {questions.length}</div>
          </div>
          <div className="bg-white p-5 sm:p-8 md:p-10 w-full rounded-2xl shadow-sm border mb-8 min-h-[160px] flex flex-col items-center justify-center text-center" style={{ borderColor: colors.border }}>
            <h2 className="text-base leading-loose tracking-[0.1em]" style={{ color: colors.textMain, marginBottom: q.image ? '1.5rem' : '0' }}>{q.text}</h2>
            {q.image && (
              <img src={q.image} alt="飾品參考圖" className="w-full max-w-lg max-h-[240px] sm:max-h-[340px] md:max-h-[420px] rounded-sm object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x260/faf9f7/8b8276?text=圖片載入失敗，請參考文字選項'; }} />
            )}
          </div>
          <div className="w-full max-w-md">{renderQuestionOptions()}</div>
        </div>
      </div>
    );
  }

  if (appState === 'result' && finalProfile) {
    const totalCore = 17;
    const pW = Math.round((finalProfile.finalScores.Warmth / totalCore) * 100) || 0;
    const pF = Math.round((finalProfile.finalScores.Freedom / totalCore) * 100) || 0;
    const pP = Math.round((finalProfile.finalScores.Power / totalCore) * 100) || 0;

    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-center py-12 px-4 sm:px-6" style={{ backgroundColor: colors.bg }}>
        {aiError && <div className="mb-4 text-xs text-red-500 tracking-widest">{aiError}</div>}
        
        <div className="max-w-[700px] w-full bg-[#F9F8F6] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] border" style={{ borderColor: colors.border }}>
          
          {/* ==================== PAGE 1 ==================== */}
          <div className="p-6 sm:p-8 md:p-16">
            <div className="text-center mb-16">
              <h1 className="text-3xl font-light tracking-[0.3em] mb-4">W.RINES</h1>
              <h2 className="text-xs tracking-[0.4em] uppercase" style={{ color: colors.textMuted }}>PERSONAL CHARM PROFILE</h2>
              <div className="mt-6 text-sm tracking-[0.2em] font-medium border-t inline-block pt-6" style={{ borderColor: colors.border }}>
                <span style={{ color: colors.textMuted }}>FOR</span> <span className="uppercase ml-2">{userName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
              <div>
                <h3 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-t pt-4" style={{ color: colors.textMuted, borderColor: colors.border }}>NAME STORY<br/>名稱解讀</h3>
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: colors.textMuted }}>YOUR CHARM NAME</div>
                  <h4 className="text-4xl sm:text-5xl font-light mb-2">{finalProfile.charmName}</h4>
                  <div className="text-sm tracking-[0.3em] uppercase" style={{ color: colors.textMuted }}>{finalProfile.charmTitle}</div>
                </div>
                <div className="text-xs tracking-[0.2em] mb-6 font-medium uppercase" style={{ color: colors.accent }}>
                  {finalProfile.traits.top1} • {finalProfile.traits.top2}
                </div>
                <p className="text-sm leading-loose text-justify" style={{ color: colors.textMain }}>{finalProfile.charmDesc}</p>
              </div>

              <div>
                <h3 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-t pt-4" style={{ color: colors.textMuted, borderColor: colors.border }}>CHARM DISTRIBUTION<br/>分佈佔比</h3>
                <div className="space-y-6 mb-12">
                  <div>
                    <div className="flex justify-between text-xs mb-2 tracking-wider">
                      <span style={{ color: colors.textMain }}>POWER</span>
                      <span style={{ color: colors.textMuted }}>{pP}%</span>
                    </div>
                    <div className="w-full h-[1px]" style={{ backgroundColor: colors.border }}>
                      <div className="h-[2px]" style={{ width: `${pP}%`, backgroundColor: colors.accent, marginTop: '-0.5px' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-2 tracking-wider">
                      <span style={{ color: colors.textMain }}>FREEDOM</span>
                      <span style={{ color: colors.textMuted }}>{pF}%</span>
                    </div>
                    <div className="w-full h-[1px]" style={{ backgroundColor: colors.border }}>
                      <div className="h-[2px]" style={{ width: `${pF}%`, backgroundColor: colors.accent, marginTop: '-0.5px' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-2 tracking-wider">
                      <span style={{ color: colors.textMain }}>WARMTH</span>
                      <span style={{ color: colors.textMuted }}>{pW}%</span>
                    </div>
                    <div className="w-full h-[1px]" style={{ backgroundColor: colors.border }}>
                      <div className="h-[2px]" style={{ width: `${pW}%`, backgroundColor: colors.accent, marginTop: '-0.5px' }}></div>
                    </div>
                  </div>
                </div>

                <h3 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-t pt-4" style={{ color: colors.textMuted, borderColor: colors.border }}>ABOUT YOU<br/>核心特質</h3>
                <p className="text-sm leading-loose text-justify mb-6" style={{ color: colors.textMain }}>{finalProfile.aboutYou}</p>
                <div className="flex flex-wrap gap-2">
                  {finalProfile.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs px-3 py-1 border rounded-full tracking-widest" style={{ borderColor: colors.border, color: colors.accent }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-4 bg-[#EAE7E0] shadow-inner"></div>

          {/* ==================== PAGE 2 ==================== */}
          <div className="p-6 sm:p-8 md:p-16">
            <h3 className="text-[10px] font-medium tracking-[0.2em] mb-10 text-center uppercase border-t border-b py-4" style={{ color: colors.textMuted, borderColor: colors.border }}>YOUR JEWELRY LANGUAGE</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-sm text-center mb-16">
              <div>
                <span className="block text-[10px] tracking-[0.2em] mb-3 uppercase" style={{ color: colors.textMuted }}>LINE</span>
                <span className="tracking-wide">{finalProfile.jewelry.line}</span>
              </div>
              <div>
                <span className="block text-[10px] tracking-[0.2em] mb-3 uppercase" style={{ color: colors.textMuted }}>SIZE</span>
                <span className="tracking-wide">{finalProfile.jewelry.size}</span>
              </div>
              <div>
                <span className="block text-[10px] tracking-[0.2em] mb-3 uppercase" style={{ color: colors.textMuted }}>WEIGHT</span>
                <span className="tracking-wide">{finalProfile.jewelry.weight}</span>
              </div>
              <div>
                <span className="block text-[10px] tracking-[0.2em] mb-3 uppercase" style={{ color: colors.textMuted }}>SHINE</span>
                <span className="tracking-wide">{finalProfile.jewelry.shine}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
              <div>
                <h4 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-b border-dashed pb-2" style={{ color: colors.textMuted, borderColor: colors.border }}>TEST MATCH</h4>
                <ul className="space-y-3">
                  {finalProfile.jewelry.testMatch.map((item, idx) => (
                    <li key={idx} className="text-sm tracking-wide flex items-start">
                      <span className="mr-3 text-lg leading-none mt-[1px]" style={{ color: colors.accent }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-b border-dashed pb-2" style={{ color: colors.textMuted, borderColor: colors.border }}>AVOID</h4>
                <ul className="space-y-3">
                  {finalProfile.jewelry.avoid.map((item, idx) => (
                    <li key={idx} className="text-sm tracking-wide flex items-start" style={{ color: colors.textMuted }}>
                      <span className="mr-3 text-lg leading-none mt-[1px]">☐</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-medium tracking-[0.2em] mb-4 uppercase border-t pt-6" style={{ color: colors.textMuted, borderColor: colors.border }}>STYLING SUGGESTION</h4>
              <p className="text-sm leading-loose text-justify mb-16" style={{ color: colors.textMain }}>{finalProfile.jewelry.stylingSuggestion}</p>
            </div>

            <div className="text-center pt-8 border-t" style={{ borderColor: colors.border }}>
              <div className="text-[9px] tracking-[0.4em] uppercase" style={{ color: colors.textMuted }}>Explore Your Charm. Wear It Naturally.</div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center pb-12">
          <button onClick={() => setAppState('home')} className="text-xs tracking-[0.2em] transition-colors border-b pb-1" style={{ color: colors.textMuted, borderColor: 'transparent' }} onMouseEnter={(e) => { e.currentTarget.style.color = colors.accent; e.currentTarget.style.borderColor = colors.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; e.currentTarget.style.borderColor = 'transparent'; }}>
            重新測驗
          </button>
        </div>
      </div>
    );
  }

  return null;
}
