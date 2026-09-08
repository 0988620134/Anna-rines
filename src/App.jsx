import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ChevronRight, Download, ArrowLeft, Shield } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

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

// 公開靜態網站不應以前端明碼密碼保護管理資料。
// 本專案預設停用後台登入；若要正式使用後台，請改用 Firebase Auth / 伺服器端驗證。
const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || '';

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
  { id: 20, type: 'single', text: "下面哪一種飾品線條最吸引你？", image: "https://scontent.ftpe8-4.fna.fbcdn.net/v/t39.30808-6/748534244_27483348444691892_5577594842880799638_n.jpg?stp=dst-jpg_tt6&cstp=mx700x148&ctp=s700x148&_nc_cat=110&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=pkAY3TPzbQEQ7kNvwFwPREm&_nc_oc=AdqJ0800l3NHAM5Nw0qUGhMsFASCM4B2zNZ_lWh72HWeC03nJOIV9UP-FijA9sREkCQ&_nc_zt=23&_nc_ht=scontent.ftpe8-4.fna&_nc_gid=e-ervbSMoLik_zJv4C2KJw&_nc_ss=7b2a8&oh=00_AQKADo83oOgk44WfCKSSOL_AN0bf4B3eJLA5TH-8hNCWkg&oe=6AA4DAA7", options: { A: "金屬光澤、質感簡約", B: "珍珠柔和、溫潤優雅", C: "個性有設計感、時尚有型" } },
  { id: 21, type: 'single', text: "下面哪一種材質氛圍最符合你的喜好？",image: "https://scontent.ftpe8-3.fna.fbcdn.net/v/t39.30808-6/748520216_27483348514691885_6771845898835116325_n.jpg?stp=dst-jpg_tt6&cstp=mx700x148&ctp=s700x148&_nc_cat=111&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=TEqYu85wg-YQ7kNvwHqNs4s&_nc_oc=AdpaOMDXbX0Idm5Oys0JtYOrNPNdy1gdlGvm8CtELXnkiEjzm3Wia1o9vdn5UVWyvpU&_nc_zt=23&_nc_ht=scontent.ftpe8-3.fna&_nc_gid=_dAi3Fqqnk7AcPIyV-BY6g&_nc_ss=7b2a8&oh=00_AQIWgWOY-1JLCJL6FrWYq3S-65hRLCTK3UlHkFYOkirY3g&oe=6AA5087D", options: { A: "金屬光澤、質感簡約", B: "珍珠柔和、溫潤優雅", C: "個性有設計感、時尚有型" } },
  { id: 22, type: 'single', text: "你更偏好哪種飾品存在感？", image: "https://scontent.ftpe8-2.fna.fbcdn.net/v/t39.30808-6/748466085_27483348441358559_5876906661781516044_n.jpg?stp=dst-jpg_tt6&cstp=mx700x138&ctp=s700x138&_nc_cat=103&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=cbRWpH51ieQQ7kNvwECzg31&_nc_oc=AdpLMrGeYm-RhrEBtc997iGHtGk54Q8seze8gD-fZ7qGHjgvT4yrVizl4WuLAIXxvvg&_nc_zt=23&_nc_ht=scontent.ftpe8-2.fna&_nc_gid=CxUVphCzY-PloBm4YkPCTg&_nc_ss=7b2a8&oh=00_AQK3wDCgHMjCXhbXJNaX3R_12N5aCuDMnVyhKH7-rvAUag&oe=6AA4DFC1",options: { A: "小巧細緻、低調優雅", B: "適中平衡、日常百搭", C: "吸睛亮點、風格突出" } },
  { id: 23, type: 'single', text: "如果第一次見面，你希望飾品讓別人留下什麼樣的印象？", image: "https://scontent.ftpe8-2.fna.fbcdn.net/v/t39.30808-6/748327165_27483348704691866_4973989275636592503_n.jpg?stp=dst-jpg_tt6&cstp=mx700x348&ctp=s700x348&_nc_cat=100&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=TsG4OdoWQY0Q7kNvwENdF18&_nc_oc=AdoM2ZnM9C8FCEvbTtncfStyrg9fR10KCKYc9_Mo_BemCqSjiJwTiyPrn_JMt4d4_HA&_nc_zt=23&_nc_ht=scontent.ftpe8-2.fna&_nc_gid=WHzuYFkHoLkd1FR9turNKw&_nc_ss=7b2a8&oh=00_AQKOFqPKAiCk3Chawe1eeakxphGMOt3WxcXESgZ8CPc9zQ&oe=6AA4E6DC",options: { A: "質感、精緻有型，展現專業與品味", B: "自然、舒服親切，給人溫暖好感", C: "獨特個性、有記憶點，讓人印象深刻" } },
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
  const [appState, setAppState] = useState('home'); // 'home', 'intro', 'quiz', 'analyzing', 'result', 'adminLogin', 'admin'
  const [userName, setUserName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState({ Warmth: 0, Freedom: 0, Power: 0 });
  const [finalProfile, setFinalProfile] = useState(null);
  const [aiError, setAiError] = useState(null);
  
  // Admin state
  const [adminPassword, setAdminPassword] = useState('');
  const [adminData, setAdminData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [adminTab, setAdminTab] = useState('dashboard');
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

  useEffect(() => {
    if (appState === 'admin' && user && db) {
      setIsLoadingData(true);
      const resultsRef = collection(db, 'artifacts', appId, 'public', 'data', 'quizResults');
      const q = query(resultsRef);
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        data.sort((a, b) => {
          const timeA = a.timestamp?.toMillis() || 0;
          const timeB = b.timestamp?.toMillis() || 0;
          return timeB - timeA;
        });
        setAdminData(data);
        setIsLoadingData(false);
      }, (error) => {
        console.error("Error fetching data:", error);
        setErrorMsg("無法載入數據，請檢查權限。");
        setIsLoadingData(false);
      });
      return () => unsubscribe();
    }
  }, [appState, user]);

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
    setAnswers(prev => ({ ...prev, [qId]: textInput || '未填寫' }));
    handleNextQuestion();
  };

  const buildSheetPayload = (profileName = '') => {
    const payload = {
      userName,
      resultProfile: profileName,
      warmth: scores.Warmth,
      freedom: scores.Freedom,
      power: scores.Power
    };

    questions.forEach(q => {
      const ansKey = answers[q.id];
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

  const postToAppsScript = (payload, timeoutMs = 90000) => {
    return new Promise((resolve, reject) => {
      if (!BACKEND_WEBAPP_URL || !BACKEND_WEBAPP_URL.startsWith('https://script.google.com/')) {
        reject(new Error('尚未設定 Apps Script Web App 網址'));
        return;
      }

      const requestId = (globalThis.crypto?.randomUUID?.() || `wrines-${Date.now()}-${Math.random()}`);
      const iframeName = `wrines_backend_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement('iframe');
      const form = document.createElement('form');
      let finished = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error('Apps Script 回應逾時'));
      }, timeoutMs);

      const onMessage = (event) => {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (_) {}
        }
        if (!data || data.source !== 'WRINES_BACKEND' || data.requestId !== requestId) return;
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();
        if (data.ok) resolve(data);
        else reject(new Error(data.error || '後端處理失敗'));
      };

      window.addEventListener('message', onMessage);

      iframe.name = iframeName;
      iframe.id = iframeName;
      // 不使用 display:none，避免部分瀏覽器延後/抑制跨站 iframe 導航與腳本執行。
      Object.assign(iframe.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        left: '-9999px',
        top: '-9999px',
        border: '0',
        opacity: '0',
        pointerEvents: 'none'
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

  const triggerAnalysis = async () => {
    setAppState('analyzing');
    setAiError(null);

    const answerDetails = questions.map(q => {
      if (q.id >= 20 && q.id <= 29 && answers[q.id]) {
        return `Q: ${q.text} A: ${q.options ? q.options[answers[q.id]] : answers[q.id]}`;
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
        ...buildSheetPayload('')
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
      setAiError('AI 連線失敗，已切換至標準分析模式；請檢查 Apps Script 設定。');
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

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (!DEMO_ADMIN_PASSWORD) {
      setErrorMsg('公開版預設停用後台登入。請依 README 改用安全的管理者驗證。');
      return;
    }
    if (adminPassword === DEMO_ADMIN_PASSWORD) {
      setAppState('admin');
      setErrorMsg('');
    } else {
      setErrorMsg('密碼錯誤');
    }
  };

  const exportToCSV = () => {
    if (adminData.length === 0) return;
    const questionHeaders = Array.from({length: 34}, (_, i) => `Q${i + 1}`);
    const headers = ['測驗時間', '姓名/暱稱', '結果類型', 'Warmth分數', 'Freedom分數', 'Power分數', ...questionHeaders];
    
    const rows = adminData.map(item => {
      const date = item.timestamp ? new Date(item.timestamp.toMillis()).toLocaleString() : 'N/A';
      const name = item.userName || 'N/A';
      const ansArray = Array.from({length: 34}, (_, i) => {
        const ans = item.answers ? item.answers[i + 1] : '';
        return `"${(ans || '').toString().replace(/"/g, '""')}"`;
      });
      return [
        `"${date}"`, `"${name}"`, `"${item.resultProfile || 'N/A'}"`,
        item.scores?.Warmth || 0, item.scores?.Freedom || 0, item.scores?.Power || 0,
        ...ansArray
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "RINES_Quiz_Data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (appState === 'home') {
    return (
      <div className="min-h-screen text-[#333333] font-sans flex flex-col items-center justify-center p-6 relative" style={{ backgroundColor: colors.bg }}>
        <button onClick={() => setAppState('adminLogin')} className="absolute top-6 right-6 transition-colors opacity-30 hover:opacity-100" style={{ color: colors.accent }}>
          <Shield size={20} />
        </button>
        <div className="max-w-md w-full bg-white p-12 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] text-center border" style={{ borderColor: colors.border }}>
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
      <div className="min-h-screen text-[#333333] font-sans flex flex-col items-center justify-center p-6" style={{ backgroundColor: colors.bg }}>
        <div className="max-w-2xl w-full bg-white p-10 md:p-14 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
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
      <div className="min-h-screen font-sans flex flex-col items-center justify-center p-6" style={{ backgroundColor: colors.bg, color: colors.textMain }}>
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
      <div className="min-h-screen font-sans flex flex-col items-center justify-center p-6" style={{ backgroundColor: colors.bg, color: colors.textMain }}>
        <div className="max-w-xl w-full flex flex-col items-center">
          <div className="text-center mb-10 w-full max-w-md">
            <h1 className="text-xl font-light tracking-[0.2em]">W.RINES</h1>
            <div className="mt-6 w-full h-[2px]" style={{ backgroundColor: colors.border }}>
              <div className="h-[2px] transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: colors.accent }}></div>
            </div>
            <div className="text-xs mt-3 tracking-widest" style={{ color: colors.textMuted }}>{currentQuestion + 1} / {questions.length}</div>
          </div>
          <div className="bg-white p-8 md:p-10 w-full rounded-2xl shadow-sm border mb-8 min-h-[160px] flex flex-col items-center justify-center text-center" style={{ borderColor: colors.border }}>
            <h2 className="text-base leading-loose tracking-[0.1em]" style={{ color: colors.textMain, marginBottom: q.image ? '1.5rem' : '0' }}>{q.text}</h2>
            {q.image && (
              <img src={q.image} alt="飾品參考圖" className="w-full max-w-lg rounded-sm object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x260/faf9f7/8b8276?text=圖片載入失敗，請參考文字選項'; }} />
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
          <div className="p-10 md:p-16">
            <div className="text-center mb-16">
              <h1 className="text-3xl font-light tracking-[0.3em] mb-4">W.RINES</h1>
              <h2 className="text-xs tracking-[0.4em] uppercase" style={{ color: colors.textMuted }}>PERSONAL CHARM PROFILE</h2>
              <div className="mt-6 text-sm tracking-[0.2em] font-medium border-t inline-block pt-6" style={{ borderColor: colors.border }}>
                <span style={{ color: colors.textMuted }}>FOR</span> <span className="uppercase ml-2">{userName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div>
                <h3 className="text-[10px] font-medium tracking-[0.2em] mb-6 uppercase border-t pt-4" style={{ color: colors.textMuted, borderColor: colors.border }}>NAME STORY<br/>名稱解讀</h3>
                <div className="mb-6">
                  <div className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: colors.textMuted }}>YOUR CHARM NAME</div>
                  <h4 className="text-5xl font-light mb-2">{finalProfile.charmName}</h4>
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
          <div className="p-10 md:p-16">
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

  if (appState === 'adminLogin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: colors.bg }}>
        <div className="w-full max-w-sm bg-white p-10 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
          <button onClick={() => setAppState('home')} className="mb-8 transition-colors" style={{ color: colors.textMuted }}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-light tracking-[0.2em] text-center mb-8" style={{ color: colors.textMain }}>W.RINES 後台</h2>
          <form onSubmit={handleAdminLogin}>
            <input type="password" placeholder="輸入密碼 " className="w-full border-b py-3 mb-8 focus:outline-none tracking-widest text-sm text-center bg-transparent" style={{ borderColor: colors.border, color: colors.textMain }} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            {errorMsg && <p className="text-red-500 text-xs text-center mb-6 tracking-wider">{errorMsg}</p>}
            <button type="submit" className="w-full py-4 text-white text-sm tracking-[0.2em] hover:opacity-90 transition-opacity" style={{ backgroundColor: colors.accent }}>登入</button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === 'admin') {
    const profileCounts = {};
    const avgScores = { Warmth: 0, Freedom: 0, Power: 0 };
    const dateCounts = {};

    adminData.forEach(item => {
      const p = item.resultProfile || '未完成';
      profileCounts[p] = (profileCounts[p] || 0) + 1;
      
      if (item.scores) {
        avgScores.Warmth += item.scores.Warmth || 0;
        avgScores.Freedom += item.scores.Freedom || 0;
        avgScores.Power += item.scores.Power || 0;
      }
      if (item.timestamp) {
        const d = new Date(item.timestamp.toMillis()).toLocaleDateString();
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      }
    });

    const total = adminData.length || 1;
    const pieData = Object.keys(profileCounts).map(k => ({ name: k, value: profileCounts[k] }));
    const radarData = [
      { subject: 'Warmth', A: Math.round((avgScores.Warmth / total) * 10) / 10, fullMark: 17 },
      { subject: 'Freedom', A: Math.round((avgScores.Freedom / total) * 10) / 10, fullMark: 17 },
      { subject: 'Power', A: Math.round((avgScores.Power / total) * 10) / 10, fullMark: 17 },
    ];
    const pieColors = ['#5C544D', '#8B8276', '#C4BDB1', '#E8E4DD'];

    return (
      <div className="min-h-screen font-sans p-6 md:p-12" style={{ backgroundColor: colors.bg, color: colors.textMain }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
            <div className="flex items-center">
              <button onClick={() => setAppState('home')} className="mr-4 hover:opacity-70 transition-opacity" style={{ color: colors.accent }}><ArrowLeft size={24} /></button>
              <h1 className="text-xl font-light tracking-[0.2em]">數據中心</h1>
            </div>
            <div className="flex space-x-4 bg-white p-1 rounded border" style={{ borderColor: colors.border }}>
               <button onClick={() => setAdminTab('dashboard')} className="px-4 py-2 text-sm tracking-widest rounded transition-colors" style={{ backgroundColor: adminTab === 'dashboard' ? colors.bg : 'transparent' }}>圖表總覽</button>
               <button onClick={() => setAdminTab('table')} className="px-4 py-2 text-sm tracking-widest rounded transition-colors" style={{ backgroundColor: adminTab === 'table' ? colors.bg : 'transparent' }}>原始數據</button>
            </div>
          </div>

          {isLoadingData ? (
             <div className="p-16 text-center tracking-[0.2em] text-sm bg-white rounded-2xl shadow-sm border" style={{ borderColor: colors.border, color: colors.textMuted }}>資料載入中...</div>
          ) : errorMsg ? (
             <div className="p-16 text-center text-red-500 tracking-[0.2em] text-sm bg-white rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>{errorMsg}</div>
          ) : adminData.length === 0 ? (
             <div className="p-16 text-center tracking-[0.2em] text-sm bg-white rounded-2xl shadow-sm border" style={{ borderColor: colors.border, color: colors.textMuted }}>目前尚無測驗紀錄</div>
          ) : (
             <>
               {adminTab === 'dashboard' && (
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-white p-6 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
                          <h3 className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: colors.textMuted }}>總測驗人數</h3>
                          <div className="text-4xl font-light">{adminData.length}</div>
                       </div>
                       <div className="bg-white p-6 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
                          <h3 className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: colors.textMuted }}>最常見分型</h3>
                          <div className="text-4xl font-light">{pieData.sort((a,b) => b.value - a.value)[0]?.name || '-'}</div>
                       </div>
                       <div className="bg-white p-6 rounded-2xl shadow-sm border" style={{ borderColor: colors.border }}>
                          <h3 className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: colors.textMuted }}>整體最強特質</h3>
                          <div className="text-4xl font-light">{radarData.sort((a,b) => b.A - a.A)[0]?.subject || '-'}</div>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-white p-8 rounded-2xl shadow-sm border h-80 flex flex-col" style={{ borderColor: colors.border }}>
                          <h3 className="text-xs tracking-[0.2em] uppercase mb-4 text-center" style={{ color: colors.textMuted }}>魅力分型佔比</h3>
                          <div className="flex-1">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                   <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />)}
                                   </Pie>
                                   <RechartsTooltip />
                                </PieChart>
                             </ResponsiveContainer>
                          </div>
                       </div>
                       <div className="bg-white p-8 rounded-2xl shadow-sm border h-80 flex flex-col" style={{ borderColor: colors.border }}>
                          <h3 className="text-xs tracking-[0.2em] uppercase mb-4 text-center" style={{ color: colors.textMuted }}>受眾平均特質 (滿分17)</h3>
                          <div className="flex-1">
                             <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                   <PolarGrid />
                                   <PolarAngleAxis dataKey="subject" tick={{ fill: colors.textMuted, fontSize: 12 }} />
                                   <PolarRadiusAxis angle={30} domain={[0, 17]} tick={false} />
                                   <Radar name="平均分數" dataKey="A" stroke={colors.accent} fill={colors.accent} fillOpacity={0.4} />
                                   <RechartsTooltip />
                                </RadarChart>
                             </ResponsiveContainer>
                          </div>
                       </div>
                    </div>
                 </div>
               )}

               {adminTab === 'table' && (
                 <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: colors.border }}>
                    <div className="p-4 border-b flex justify-end" style={{ borderColor: colors.border }}>
                       <button onClick={exportToCSV} className="px-4 py-2 text-white text-xs tracking-[0.1em] flex items-center hover:opacity-90 transition-opacity rounded" style={{ backgroundColor: colors.accent }}>
                         <Download size={14} className="mr-2" />匯出 CSV
                       </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="border-b" style={{ backgroundColor: '#faf9f7', borderColor: colors.border, color: colors.textMuted }}>
                            <th className="p-5 font-normal tracking-wider">測驗時間</th>
                            <th className="p-5 font-normal tracking-wider">姓名/暱稱</th>
                            <th className="p-5 font-normal tracking-wider">分型</th>
                            <th className="p-5 font-normal text-center tracking-wider">Warmth</th>
                            <th className="p-5 font-normal text-center tracking-wider">Freedom</th>
                            <th className="p-5 font-normal text-center tracking-wider">Power</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: colors.border }}>
                              <td className="p-5 text-xs tracking-wider" style={{ color: colors.textMuted }}>{item.timestamp ? new Date(item.timestamp.toMillis()).toLocaleString() : 'N/A'}</td>
                              <td className="p-5 text-sm tracking-wider" style={{ color: colors.textMain }}>{item.userName || 'N/A'}</td>
                              <td className="p-5 font-medium tracking-[0.1em]">{item.resultProfile || '未完成'}</td>
                              <td className="p-5 text-center">{item.scores?.Warmth || 0}</td>
                              <td className="p-5 text-center">{item.scores?.Freedom || 0}</td>
                              <td className="p-5 text-center">{item.scores?.Power || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 </div>
               )}
             </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
