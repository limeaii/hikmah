
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, LogOut, Search, Compass, 
  Calendar, Hand, Heart, Calculator, MessageCircle, 
  Menu, X, ChevronRight, ChevronLeft, PlayCircle,
  Bookmark as BookmarkIcon, Loader2, Grid, Lock, 
  Moon, Sun, CheckCircle, Utensils, Brain, Info, 
  ArrowLeft, Send, Share2, Coffee, AlignLeft, Book,
  Star, Layers, Sparkles, Smile, Frown, Meh, Zap, CloudRain
} from 'lucide-react';
import { ViewState, UserProfile, Ayah, Hadith, QuizQuestion, SurahMetadata, FavoriteItem } from './types';
import { SURAHS, ALLAH_NAMES, ZAKAT_THRESHOLD_GOLD_GRAMS, DUAS_DATA, SALAH_STEPS, SUNNAH_FOODS_DATA } from './constants';
import * as GeminiService from './services/gemini';

// --- Constants & Helpers ---

const DB_KEY = 'noor_users_db_v2';
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <Icon size={18} className={`transition-colors ${active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'}`} />
    <span className="text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
  </button>
);

const Loading = () => (
  <div className="flex flex-col justify-center items-center py-20 gap-6">
    <div className="relative">
      <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
      <Loader2 className="animate-spin text-emerald-600 relative z-10" size={48} />
    </div>
    <p className="text-slate-400 text-sm font-medium animate-pulse">Consulting the knowledge...</p>
  </div>
);

// --- Main App ---

const App = () => {
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Nav State
  const [view, setView] = useState<ViewState>(ViewState.AUTH);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Content State
  const [currentSurah, setCurrentSurah] = useState<number>(1);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState(false);
  const [hadiths, setHadiths] = useState<Hadith[]>([]);
  const [hadithTopic, setHadithTopic] = useState("faith");
  const [loadingHadiths, setLoadingHadiths] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role:string, text:string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [selectedAyahForTafsir, setSelectedAyahForTafsir] = useState<number | null>(null);
  const [tafsirContent, setTafsirContent] = useState<string>("");
  const [loadingTafsir, setLoadingTafsir] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // New Feature States
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<{answered: boolean, selectedIndex: number | null}>({ answered: false, selectedIndex: null });

  const [dreamInput, setDreamInput] = useState('');
  const [dreamResult, setDreamResult] = useState('');
  const [halalInput, setHalalInput] = useState('');
  const [halalResult, setHalalResult] = useState('');
  
  // Zakat State
  const [zakatAssets, setZakatAssets] = useState('');
  const [goldPrice, setGoldPrice] = useState('65'); // Approx USD per gram
  const [zakatResult, setZakatResult] = useState<{eligible: boolean, amount: number, nisaab: number} | null>(null);

  // Mood Feature State
  const [moodResult, setMoodResult] = useState<{arabic: string, translation: string, ref: string} | null>(null);
  const [moodLoading, setMoodLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Session
  useEffect(() => {
    const sessionUser = sessionStorage.getItem('noor_active_user');
    if (sessionUser) {
      setUser(JSON.parse(sessionUser));
      setView(ViewState.DASHBOARD);
    }
  }, []);

  useEffect(() => {
    if (user?.tasbihCount !== undefined) {
      setTasbihCount(user.tasbihCount);
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- Auth Logic ---

  const handleAuth = async () => {
    setAuthError('');
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Please fill in all fields.');
      return;
    }

    setAuthLoading(true);
    await new Promise(r => setTimeout(r, 800));

    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');

    if (isRegistering) {
      if (db[usernameInput]) {
        setAuthError('Username already taken. Please choose another.');
        setAuthLoading(false);
        return;
      }
      
      const newUser: UserProfile = {
        username: usernameInput,
        password: passwordInput, 
        createdAt: Date.now(),
        lastReadSurah: 1,
        lastReadAyah: 1,
        bookmarks: [],
        favorites: [],
        tasbihCount: 0,
        theme: 'light',
        fontSize: 18,
        quizScore: 0
      };

      db[usernameInput] = newUser;
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      loginUser(newUser);
    } else {
      const existingUser = db[usernameInput];
      if (!existingUser || existingUser.password !== passwordInput) {
        setAuthError('Invalid username or password.');
        setAuthLoading(false);
        return;
      }
      // Backwards compatibility for old users without favorites
      if (!existingUser.favorites) existingUser.favorites = [];
      loginUser(existingUser);
    }
  };

  const loginUser = (userData: UserProfile) => {
    setUser(userData);
    sessionStorage.setItem('noor_active_user', JSON.stringify(userData));
    setView(ViewState.DASHBOARD);
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('noor_active_user');
    setView(ViewState.AUTH);
    setUsernameInput('');
    setPasswordInput('');
  };

  // --- Favorites Logic ---

  const isFavorite = (type: 'surah' | 'ayah', id: number) => {
    if (!user || !user.favorites) return false;
    if (type === 'surah') {
        return user.favorites.some(f => f.type === 'surah' && f.ref === id);
    } else {
        // for ayahs, we check composite key usually, but here simplified logic
        return user.favorites.some(f => f.type === 'ayah' && typeof f.ref === 'object' && f.ref.surah === currentSurah && f.ref.ayah === id);
    }
  };

  const toggleFavoriteSurah = (surahNum: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!user) return;

    const exists = isFavorite('surah', surahNum);
    let newFavorites = [...(user.favorites || [])];

    if (exists) {
        newFavorites = newFavorites.filter(f => !(f.type === 'surah' && f.ref === surahNum));
    } else {
        newFavorites.push({
            id: Date.now().toString(),
            type: 'surah',
            ref: surahNum,
            timestamp: Date.now()
        });
    }
    
    const updated = { ...user, favorites: newFavorites };
    setUser(updated);
    updateUserInDb(updated);
  };

  const toggleFavoriteAyah = (ayahNum: number, text: string) => {
      if (!user) return;
      const exists = isFavorite('ayah', ayahNum);
      let newFavorites = [...(user.favorites || [])];

      if (exists) {
          newFavorites = newFavorites.filter(f => !(f.type === 'ayah' && typeof f.ref === 'object' && f.ref.surah === currentSurah && f.ref.ayah === ayahNum));
      } else {
          newFavorites.push({
              id: Date.now().toString(),
              type: 'ayah',
              ref: { surah: currentSurah, ayah: ayahNum, text: text.substring(0, 50) + '...' }, // Store snippet
              timestamp: Date.now()
          });
      }
      
      const updated = { ...user, favorites: newFavorites };
      setUser(updated);
      updateUserInDb(updated);
  };

  const handleMoodCheck = async (mood: string) => {
      setMoodLoading(true);
      setMoodResult(null);
      const result = await GeminiService.getAyahByMood(mood);
      setMoodResult(result);
      setMoodLoading(false);
  }

  // --- Feature Functions ---

  const loadSurah = useCallback(async (surahNumber: number) => {
    setView(ViewState.QURAN_READ);
    setLoadingAyahs(true);
    setCurrentSurah(surahNumber);
    setAyahs([]); 
    const data = await GeminiService.getSurahAyahs(surahNumber, 1, 15); 
    setAyahs(data);
    setLoadingAyahs(false);
    if (user) {
      const updated = { ...user, lastReadSurah: surahNumber, lastReadAyah: 1 };
      setUser(updated);
      updateUserInDb(updated);
    }
  }, [user]);

  const updateUserInDb = (updatedUser: UserProfile) => {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    db[updatedUser.username] = updatedUser;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    sessionStorage.setItem('noor_active_user', JSON.stringify(updatedUser));
  };

  const handleViewTafsir = async (ayahNum: number) => {
    if (selectedAyahForTafsir === ayahNum) {
      setSelectedAyahForTafsir(null); // Toggle off
      return;
    }
    setSelectedAyahForTafsir(ayahNum);
    setLoadingTafsir(true);
    const text = await GeminiService.getTafsir(currentSurah, ayahNum);
    setTafsirContent(text);
    setLoadingTafsir(false);
  };

  const loadHadiths = async () => {
    setLoadingHadiths(true);
    const data = await GeminiService.getHanafiHadiths(hadithTopic);
    setHadiths(data);
    setLoadingHadiths(false);
  };

  const handleScholarChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    setIsChatLoading(true);
    
    const response = await GeminiService.askScholarAI(msg);
    
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setIsChatLoading(false);
  };

  // --- Hub Features ---

  const startQuiz = async () => {
    setView(ViewState.QUIZ);
    setIsChatLoading(true); 
    const questions = await GeminiService.getIslamicQuiz();
    setQuizQuestions(questions);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setQuizState({ answered: false, selectedIndex: null });
    setIsChatLoading(false);
  };

  const handleQuizAnswer = (index: number) => {
    if (quizState.answered) return;
    
    const isCorrect = index === quizQuestions[currentQuestionIndex].correctAnswer;
    setQuizState({ answered: true, selectedIndex: index });
    
    if (isCorrect) {
      setQuizScore(s => s + 1);
    }
  };

  const nextQuizQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setQuizState({ answered: false, selectedIndex: null });
    } else {
      if (user && quizScore > user.quizScore) {
        const updated = { ...user, quizScore: quizScore };
        setUser(updated);
        updateUserInDb(updated);
      }
      alert(`Quiz Complete! Your Score: ${quizScore}/${quizQuestions.length}`);
      setView(ViewState.HUB);
    }
  };

  const handleDreamInterpret = async () => {
    if (!dreamInput) return;
    setIsChatLoading(true);
    const res = await GeminiService.interpretDream(dreamInput);
    setDreamResult(res);
    setIsChatLoading(false);
  }

  const handleHalalCheck = async () => {
    if (!halalInput) return;
    setIsChatLoading(true);
    const res = await GeminiService.checkHalalStatus(halalInput);
    setHalalResult(res);
    setIsChatLoading(false);
  }

  const calculateZakat = () => {
    const assets = parseFloat(zakatAssets);
    const gPrice = parseFloat(goldPrice);
    if (isNaN(assets) || isNaN(gPrice)) return;

    const nisaab = ZAKAT_THRESHOLD_GOLD_GRAMS * gPrice;
    const eligible = assets >= nisaab;
    const amount = eligible ? assets * 0.025 : 0;

    setZakatResult({ eligible, amount, nisaab });
  };

  const incrementTasbih = () => {
    const newCount = tasbihCount + 1;
    setTasbihCount(newCount);
    if (user) {
      const updated = { ...user, tasbihCount: newCount };
      setUser(updated);
      updateUserInDb(updated);
    }
  };

  // --- Render Components ---

  const Sidebar = () => (
    <div className={`fixed inset-y-0 right-0 z-50 w-72 bg-white/90 backdrop-blur-xl border-l border-slate-200 shadow-[-10px_0_40px_-10px_rgba(0,0,0,0.1)] transform transition-transform duration-300 ease-out lg:translate-x-0 overflow-y-auto ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-8 flex justify-between items-center border-b border-slate-100/50">
        <div>
          <h2 className="text-3xl font-bold text-emerald-700 font-arabic leading-none mb-1 drop-shadow-sm">الحكمة</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Al-Hikmah</p>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1">
          <X size={20} />
        </button>
      </div>
      
      <div className="px-4 py-6 space-y-1.5">
        <SidebarItem icon={Layers} label="Dashboard" active={view === ViewState.DASHBOARD} onClick={() => { setView(ViewState.DASHBOARD); setIsMobileMenuOpen(false); }} />
        <SidebarItem icon={Grid} label="Apps Hub" active={
          view === ViewState.HUB || 
          view === ViewState.QUIZ || 
          view === ViewState.DREAM || 
          view === ViewState.HALAL || 
          view === ViewState.ZAKAT ||
          view === ViewState.TASBIH ||
          view === ViewState.NAMES ||
          view === ViewState.DUA ||
          view === ViewState.SALAH ||
          view === ViewState.FOODS
        } onClick={() => { setView(ViewState.HUB); setIsMobileMenuOpen(false); }} />
        
        <div className="pt-6 pb-3 px-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest opacity-60">Library</div>
        <SidebarItem icon={BookOpen} label="Read Quran" active={view === ViewState.QURAN_INDEX || view === ViewState.QURAN_READ} onClick={() => { setView(ViewState.QURAN_INDEX); setIsMobileMenuOpen(false); }} />
        <SidebarItem icon={MessageCircle} label="Hadith Collection" active={view === ViewState.HADITH} onClick={() => { setView(ViewState.HADITH); if(hadiths.length === 0) loadHadiths(); setIsMobileMenuOpen(false); }} />
        <SidebarItem icon={Hand} label="AI Scholar" active={view === ViewState.SCHOLAR} onClick={() => { setView(ViewState.SCHOLAR); setIsMobileMenuOpen(false); }} />
      </div>

      <div className="absolute bottom-0 w-full p-6 bg-slate-50/80 backdrop-blur-md border-t border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-200">
            {user?.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
            <div className="flex items-center gap-1">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <p className="text-[10px] text-slate-500 font-medium uppercase">Online</p>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-slate-500 hover:bg-white hover:text-red-600 hover:shadow-sm py-2.5 w-full rounded-xl text-xs font-bold uppercase tracking-wider transition duration-200 border border-transparent hover:border-slate-100">
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );

  const AppGridItem = ({ icon: Icon, label, color, onClick, description }: any) => (
    <button onClick={onClick} className="flex flex-col items-start p-5 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:shadow-slate-100/50 hover:border-emerald-100 transition-all hover:-translate-y-1 group h-full text-left w-full">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} text-white shadow-md mb-4 group-hover:scale-110 transition duration-300`}>
        <Icon size={22} strokeWidth={2.5} />
      </div>
      <span className="text-sm font-bold text-slate-700 mb-1">{label}</span>
      {description && <span className="text-xs text-slate-400 leading-tight font-medium">{description}</span>}
    </button>
  );

  // --- Auth View ---

  if (view === ViewState.AUTH) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>

        <div className="relative bg-white/80 backdrop-blur-xl w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white z-10">
          <div className="text-center mb-10">
            <h1 className="text-6xl font-bold text-emerald-700 mb-3 font-arabic drop-shadow-sm">الحكمة</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">Al-Hikmah Companion</p>
          </div>
          
          <div className="space-y-5">
            {authError && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm text-center font-medium animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
                 <Info size={16} /> {authError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">Username</label>
                <div className="relative group">
                  <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition" size={18}/>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition text-slate-700 font-medium"
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition" size={18}/>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition text-slate-700 font-medium"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-emerald-200/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-4"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
            
            <div className="text-center mt-6">
              <button 
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
                className="text-slate-500 text-sm hover:text-emerald-600 transition font-medium"
              >
                {isRegistering ? 'Already have an account? Sign In' : 'No account? Create one for free'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main View ---

  return (
    <div className="flex min-h-screen font-sans text-slate-800 bg-[#f8fafc]">
      
      {/* Content Area - Pushed to LEFT because Sidebar is on RIGHT */}
      <main className="flex-1 lg:mr-72 p-4 sm:p-6 lg:p-10 transition-all duration-300 animate-in fade-in">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex justify-between items-center mb-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-4 z-40">
          <span className="font-bold text-emerald-800 font-arabic text-xl">الحكمة</span>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 bg-slate-50 p-2 rounded-lg">
            <Menu size={24} />
          </button>
        </div>

        {/* Views */}

        {view === ViewState.DASHBOARD && (
          <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex justify-between items-end pb-4 border-b border-slate-200/50">
              <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-1 tracking-tight">Salam, {user?.username}</h1>
                <p className="text-slate-400 text-sm font-medium">Welcome back to your spiritual space.</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="font-arabic text-xl text-emerald-600 drop-shadow-sm">بسم الله الرحمن الرحيم</p>
              </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Hero Card */}
              <div className="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden group flex flex-col justify-between min-h-[280px]">
                 {/* Background Pattern */}
                 <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 transition duration-1000 rotate-12">
                   <BookOpen size={180} />
                </div>
                
                <div className="relative z-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
                        Resume Reading
                    </span>
                    <h3 className="text-5xl font-bold font-arabic mb-2 leading-tight">{SURAHS[(user?.lastReadSurah || 1) - 1].name}</h3>
                    <p className="text-emerald-100 text-lg font-medium">{SURAHS[(user?.lastReadSurah || 1) - 1].englishName}</p>
                </div>

                <div className="relative z-10 mt-8 flex gap-3">
                    <button 
                    onClick={() => loadSurah(user?.lastReadSurah || 1)}
                    className="bg-white text-emerald-800 px-8 py-3.5 rounded-xl font-bold hover:bg-emerald-50 transition shadow-lg flex items-center gap-2"
                    >
                    <PlayCircle size={20} /> Continue Ayah {user?.lastReadAyah || 1}
                    </button>
                </div>
              </div>

              {/* Stats Column */}
              <div className="space-y-4 flex flex-col">
                <div className="flex-1 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Knowledge</h3>
                            <div className="p-2 bg-purple-50 text-purple-500 rounded-lg"><Brain size={20} /></div>
                        </div>
                        <div className="text-4xl font-bold text-slate-800 mb-1">{user?.quizScore || 0}</div>
                        <p className="text-xs text-slate-400 font-medium">Quiz Points Earned</p>
                    </div>
                    <button onClick={startQuiz} className="mt-4 w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold hover:bg-purple-50 hover:text-purple-600 transition">
                        Take Quiz
                    </button>
                </div>
                
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tasbih</p>
                        <p className="text-3xl font-bold text-teal-600 mt-1">{tasbihCount}</p>
                    </div>
                    <button onClick={() => setView(ViewState.TASBIH)} className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition">
                        <ChevronRight size={20} />
                    </button>
                 </div>
              </div>
            </div>

            {/* --- NEW CREATIVE SECTION: Spiritual Mood --- */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-8 rounded-[2rem] border border-indigo-100">
               <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-500"/> How is your heart feeling today?
               </h3>
               <div className="flex flex-wrap gap-3 mb-6">
                  {['Anxious', 'Grateful', 'Lost', 'Sad', 'Hopeful', 'Angry'].map(mood => (
                    <button key={mood} onClick={() => handleMoodCheck(mood)} className="bg-white px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-indigo-500 hover:text-white hover:shadow-lg hover:shadow-indigo-200 transition border border-indigo-100">
                       {mood}
                    </button>
                  ))}
               </div>
               {moodLoading && <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Finding comfort in the Quran...</div>}
               {moodResult && (
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-50 animate-in slide-in-from-bottom-2">
                    <p className="text-right font-arabic text-2xl text-slate-700 mb-4 leading-loose" dir="rtl">{moodResult.arabic}</p>
                    <p className="text-slate-600 italic mb-3">"{moodResult.translation}"</p>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{moodResult.ref}</p>
                 </div>
               )}
            </div>
            
            {/* --- NEW SECTION: Pinned Favorites --- */}
            {user?.favorites && user.favorites.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><Heart size={18} className="text-rose-500 fill-current"/> Pinned Favorites</h3>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {user.favorites.map((item) => {
                            if (item.type === 'surah') {
                                const s = SURAHS[(item.ref as number) - 1];
                                return (
                                    <button key={item.id} onClick={() => loadSurah(item.ref as number)} className="min-w-[200px] bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-rose-200 hover:shadow-md transition text-left group relative">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-xs font-bold">{s.number}</div>
                                            <Heart size={16} className="text-rose-500 fill-current" />
                                        </div>
                                        <p className="font-bold text-slate-800">{s.englishName}</p>
                                        <p className="text-xs text-slate-400">{s.englishNameTranslation}</p>
                                    </button>
                                )
                            } else {
                                // Ayah pin
                                const ref = item.ref as {surah: number, ayah: number, text?: string};
                                const s = SURAHS[ref.surah - 1];
                                return (
                                    <button key={item.id} onClick={() => loadSurah(ref.surah)} className="min-w-[240px] bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-rose-200 hover:shadow-md transition text-left">
                                         <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded uppercase">{s.englishName} {ref.surah}:{ref.ayah}</span>
                                            <Heart size={16} className="text-rose-500 fill-current" />
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2 font-serif">"{ref.text || 'Ayah...'}"</p>
                                    </button>
                                )
                            }
                        })}
                    </div>
                </div>
            )}

            {/* Quick Access Grid */}
            <div>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-800">Quick Apps</h3>
                    <button onClick={() => setView(ViewState.HUB)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">View All</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <button onClick={() => setView(ViewState.SALAH)} className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-green-200 hover:shadow-lg hover:shadow-green-100/50 transition-all hover:-translate-y-1 group">
                        <div className="w-14 h-14 rounded-2xl bg-green-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-green-200 group-hover:scale-110 transition">
                            <AlignLeft size={24} strokeWidth={2.5}/>
                        </div>
                        <p className="font-bold text-slate-700 text-sm">Salah</p>
                    </button>

                    <button onClick={() => setView(ViewState.DUA)} className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all hover:-translate-y-1 group">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-blue-200 group-hover:scale-110 transition">
                            <Coffee size={24} strokeWidth={2.5}/>
                        </div>
                        <p className="font-bold text-slate-700 text-sm">Daily Dua</p>
                    </button>

                    <button onClick={() => setView(ViewState.SCHOLAR)} className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all hover:-translate-y-1 group">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-200 group-hover:scale-110 transition">
                            <Hand size={24} strokeWidth={2.5}/>
                        </div>
                        <p className="font-bold text-slate-700 text-sm">Ask AI</p>
                    </button>

                    <button onClick={() => setView(ViewState.FOODS)} className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/50 transition-all hover:-translate-y-1 group">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-orange-200 group-hover:scale-110 transition">
                            <Utensils size={24} strokeWidth={2.5}/>
                        </div>
                        <p className="font-bold text-slate-700 text-sm">Foods</p>
                    </button>
                </div>
            </div>
          </div>
        )}

        {view === ViewState.QURAN_INDEX && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center gap-6 mb-10">
              <div>
                 <h2 className="text-3xl font-bold text-slate-800 mb-1">Noble Quran</h2>
                 <p className="text-slate-400 font-medium">Index of all 114 Surahs</p>
              </div>
              <div className="relative flex-1 max-w-md md:ml-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by name or number..." 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm transition"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {SURAHS.filter(s => 
                s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.number.toString().includes(searchTerm) ||
                s.name.includes(searchTerm)
              ).map((surah) => {
                const isPinned = isFavorite('surah', surah.number);
                return (
                  <button
                    key={surah.number}
                    onClick={() => loadSurah(surah.number)}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-emerald-100 hover:-translate-y-0.5 transition-all text-left flex items-center justify-between group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50/50 rounded-bl-[3rem] -mr-6 -mt-6 transition-all group-hover:bg-emerald-100/80"></div>
                    
                    <div className="flex items-center gap-4 z-10">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-sm group-hover:bg-emerald-600 group-hover:text-white transition duration-300 border border-slate-100">
                        {surah.number}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 leading-tight mb-0.5">{surah.englishName}</h3>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">{surah.revelationType} • {surah.numberOfAyahs}</p>
                      </div>
                    </div>
                    <div className="z-10 pl-2 flex flex-col items-end justify-between h-full">
                      <button 
                        onClick={(e) => toggleFavoriteSurah(surah.number, e)}
                        className={`p-2 rounded-full transition ${isPinned ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                      >
                        <Heart size={18} fill={isPinned ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === ViewState.QURAN_READ && (
          <div className="max-w-4xl mx-auto">
            {/* Sticky Header */}
             <div className="sticky top-0 z-30 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-200/50 mb-8 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
                <button onClick={() => setView(ViewState.QURAN_INDEX)} className="p-2 -ml-2 rounded-full bg-white hover:bg-slate-100 text-slate-500 transition shadow-sm border border-slate-100">
                  <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                  <h2 className="font-bold text-slate-800">{SURAHS[currentSurah - 1].englishName}</h2>
                  <p className="text-xs text-slate-400 font-arabic">{SURAHS[currentSurah - 1].name}</p>
                </div>
                <div className="w-10"></div> {/* Spacer for centering */}
             </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[80vh] p-8 sm:p-12 relative">
              
              {/* Bismillah (except Surah 9) */}
              {currentSurah !== 9 && (
                 <div className="text-center mb-16 mt-4">
                    <p className="font-arabic text-4xl sm:text-5xl text-slate-800 leading-relaxed opacity-80">{BISMILLAH}</p>
                 </div>
              )}

              {loadingAyahs ? <Loading /> : (
                <div className="space-y-2">
                  {ayahs.map((ayah, idx) => {
                    const isPinned = isFavorite('ayah', ayah.numberInSurah);
                    return (
                    <React.Fragment key={ayah.numberInSurah}>
                        <div className="group relative py-6 transition-colors hover:bg-slate-50/50 rounded-3xl px-4 -mx-4">
                            {/* Actions Toolbar */}
                            <div className="absolute top-6 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button onClick={() => handleViewTafsir(ayah.numberInSurah)} className={`p-2 rounded-full transition shadow-sm border ${selectedAyahForTafsir === ayah.numberInSurah ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-600'}`} title="Tafsir">
                                    <BookOpen size={16} />
                                </button>
                                <button onClick={() => toggleFavoriteAyah(ayah.numberInSurah, ayah.translation)} className={`p-2 rounded-full transition shadow-sm border ${isPinned ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-white text-slate-400 border-slate-200 hover:text-rose-500'}`} title="Pin Ayah">
                                    <Heart size={16} fill={isPinned ? "currentColor" : "none"} />
                                </button>
                                <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-xs font-bold">
                                    {ayah.numberInSurah}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="space-y-8 pl-0 sm:pl-12">
                                <p className="text-right font-arabic text-4xl sm:text-5xl leading-[2.3] text-slate-800" dir="rtl">
                                    {ayah.text}
                                </p>
                                <div className="space-y-2">
                                    <p className="text-slate-700 text-lg sm:text-xl font-serif leading-relaxed">{ayah.translation}</p>
                                    <p className="text-slate-400 text-sm italic">{ayah.transliteration}</p>
                                </div>
                            </div>

                            {/* Tafsir Panel */}
                            {selectedAyahForTafsir === ayah.numberInSurah && (
                                <div className="mt-8 ml-0 sm:ml-12 bg-amber-50 p-6 rounded-2xl border border-amber-100 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold border-b border-amber-200/50 pb-2">
                                        <Book size={18} /> Tafsir (Explanation)
                                    </div>
                                    {loadingTafsir ? <div className="py-4 flex justify-center text-amber-600"><Loader2 className="animate-spin" /></div> : (
                                        <p className="text-amber-900 leading-loose text-base text-justify">{tafsirContent}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Ornamental Divider */}
                        {idx < ayahs.length - 1 && (
                           <div className="ornament-divider"><span className="text-emerald-200 text-xl">۞</span></div>
                        )}
                    </React.Fragment>
                  )})}
                </div>
              )}
            </div>
          </div>
        )}

        {view === ViewState.SCHOLAR && (
           <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-6rem)] bg-white rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
             {/* Header */}
             <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                   <Hand size={24} />
                 </div>
                 <div>
                   <h2 className="font-bold text-slate-800 text-lg">AI Scholar (Hanafi)</h2>
                   <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Online & Ready</p>
                 </div>
               </div>
             </div>

             {/* Chat Area */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8">
               {chatHistory.length === 0 && (
                 <div className="text-center text-slate-400 mt-20 max-w-sm mx-auto">
                   <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Sparkles size={32} className="text-emerald-300" />
                   </div>
                   <h3 className="text-slate-700 font-bold mb-2">How can I help you?</h3>
                   <p className="text-sm mb-8">Ask about Fiqh, History, or get advice based on the Quran and Sunnah.</p>
                   <div className="grid grid-cols-1 gap-3">
                      <button onClick={() => setChatInput("Is seafood halal?")} className="text-xs font-medium bg-white border border-slate-200 p-4 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition text-left">"Is seafood halal in Hanafi school?"</button>
                      <button onClick={() => setChatInput("Explain the conditions of Wudu")} className="text-xs font-medium bg-white border border-slate-200 p-4 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition text-left">"Explain the conditions of Wudu"</button>
                   </div>
                 </div>
               )}
               
               {chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    {msg.role === 'model' && (
                         <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center text-emerald-700 mr-3 mt-2">
                             <Hand size={14} />
                         </div>
                    )}
                   <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm ${
                     msg.role === 'user' 
                       ? 'bg-emerald-600 text-white rounded-tr-none' 
                       : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                   }`}>
                     {msg.role === 'model' ? (
                        <div className="prose prose-sm max-w-none prose-emerald">
                            {msg.text.includes('|||') ? (
                                <>
                                    <p className="font-bold text-base text-slate-900 mb-4 border-b border-slate-200/50 pb-3">
                                        {msg.text.split('|||')[0]}
                                    </p>
                                    <p className="text-slate-600 leading-relaxed">
                                        {msg.text.split('|||')[1]}
                                    </p>
                                </>
                            ) : <p>{msg.text}</p>}
                        </div>
                     ) : (
                        <p className="leading-relaxed font-medium">{msg.text}</p>
                     )}
                   </div>
                 </div>
               ))}
               {isChatLoading && (
                 <div className="flex justify-start ml-11">
                   <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-slate-500 text-sm shadow-sm">
                     <Loader2 className="animate-spin text-emerald-500" size={16} /> Thinking...
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} />
             </div>

             {/* Input Area */}
             <div className="p-4 bg-white border-t border-slate-100">
               <div className="flex gap-3">
                 <input
                   type="text"
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleScholarChat()}
                   placeholder="Type your question..."
                   className="flex-1 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-medium"
                 />
                 <button 
                   onClick={handleScholarChat}
                   disabled={isChatLoading || !chatInput.trim()}
                   className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
                 >
                   <Send size={22} />
                 </button>
               </div>
             </div>
           </div>
        )}

        {view === ViewState.HADITH && (
          <div className="max-w-5xl mx-auto">
             <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-4">
               <div>
                 <h2 className="text-3xl font-bold text-slate-800 mb-2">Hadith Collection</h2>
                 <p className="text-slate-500">Authentic narrations derived from the Kutub al-Sittah</p>
               </div>
               <div className="flex items-center gap-2 bg-white p-1 pr-4 rounded-xl border border-slate-200 shadow-sm">
                 <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg"><Layers size={18}/></div>
                 <select 
                   value={hadithTopic} 
                   onChange={(e) => setHadithTopic(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                 >
                   <option value="faith">Faith (Iman)</option>
                   <option value="prayer">Prayer (Salah)</option>
                   <option value="charity">Charity (Zakat)</option>
                   <option value="manners">Manners (Adab)</option>
                   <option value="marriage">Marriage</option>
                 </select>
               </div>
             </div>

             <div className="grid gap-6">
               {loadingHadiths ? <Loading /> : hadiths.map((h) => (
                 <div key={h.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group">
                   <div className="flex justify-between items-start mb-6">
                     <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-emerald-100">
                       {h.source}
                     </span>
                     <span className="text-slate-400 text-xs font-medium bg-slate-50 px-2 py-1 rounded">{h.grade}</span>
                   </div>
                   <p className="text-right font-arabic text-2xl sm:text-3xl mb-6 text-slate-700 leading-loose" dir="rtl">{h.arabic}</p>
                   <div className="pl-4 border-l-4 border-emerald-500/20">
                      <p className="text-slate-800 text-lg font-medium leading-relaxed italic">"{h.english}"</p>
                   </div>
                   <p className="text-slate-400 text-sm mt-4 font-medium flex items-center gap-2">
                      <span className="w-6 h-[1px] bg-slate-300"></span> Narrated by {h.narrator}
                   </p>
                 </div>
               ))}
               
               {hadiths.length === 0 && !loadingHadiths && (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                     <p className="text-slate-400 mb-4">Select a topic to begin reading</p>
                     <button onClick={loadHadiths} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition">
                        Load Hadiths
                     </button>
                  </div>
               )}

               {hadiths.length > 0 && (
                <button onClick={loadHadiths} className="w-full py-4 bg-white border border-slate-200 text-emerald-700 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition font-bold shadow-sm">
                    Load More Narrations
                </button>
               )}
             </div>
          </div>
        )}

        {view === ViewState.HUB && (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Apps Hub</h2>
                <p className="text-slate-500">Tools for your daily spiritual life and knowledge.</p>
            </header>

            <div className="space-y-10">
                {/* Worship Section */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                        <Layers size={16}/> Worship Tools
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                        <AppGridItem icon={AlignLeft} label="Salah Guide" description="Step-by-step prayer" color="bg-green-500" onClick={() => setView(ViewState.SALAH)} />
                        <AppGridItem icon={Coffee} label="Fortress of Dua" description="Daily supplications" color="bg-blue-500" onClick={() => setView(ViewState.DUA)} />
                        <AppGridItem icon={Compass} label="Digital Tasbih" description="Dhikr counter" color="bg-teal-500" onClick={() => setView(ViewState.TASBIH)} />
                        <AppGridItem icon={Calculator} label="Zakat Calc" description="2.5% wealth check" color="bg-amber-500" onClick={() => setView(ViewState.ZAKAT)} />
                    </div>
                </section>

                {/* Knowledge Section */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                        <BookOpen size={16}/> Knowledge & Learning
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                        <AppGridItem icon={Brain} label="Islamic Quiz" description="Test your knowledge" color="bg-purple-500" onClick={startQuiz} />
                        <AppGridItem icon={Heart} label="99 Names" description="Asma ul Husna" color="bg-pink-500" onClick={() => setView(ViewState.NAMES)} />
                    </div>
                </section>

                {/* Lifestyle Section */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                        <Sparkles size={16}/> Lifestyle
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                        <AppGridItem icon={Moon} label="Dream Meanings" description="Islamic interpretation" color="bg-indigo-500" onClick={() => setView(ViewState.DREAM)} />
                        <AppGridItem icon={Utensils} label="Halal Check" description="Ingredient scanner" color="bg-rose-500" onClick={() => setView(ViewState.HALAL)} />
                        <AppGridItem icon={Utensils} label="Sunnah Foods" description="Prophetic diet" color="bg-orange-500" onClick={() => setView(ViewState.FOODS)} />
                    </div>
                </section>
            </div>
          </div>
        )}

        {view === ViewState.QUIZ && (
          <div className="max-w-2xl mx-auto pt-8">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-800 flex items-center gap-2 text-sm font-bold bg-white px-4 py-2 rounded-full shadow-sm"><ArrowLeft size={16}/> Back to Hub</button>
            
            {isChatLoading ? <Loading /> : quizQuestions.length > 0 && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-purple-600 p-10 text-white text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-purple-900/20"></div>  
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6 opacity-90 text-xs font-bold uppercase tracking-wider">
                        <span>Question {currentQuestionIndex + 1} / {quizQuestions.length}</span>
                        <span className="bg-white/20 px-3 py-1 rounded-full">Score: {quizScore}</span>
                    </div>
                    <h2 className="text-2xl font-bold leading-tight mb-2">{quizQuestions[currentQuestionIndex].question}</h2>
                  </div>
                </div>
                
                <div className="p-8 space-y-3">
                  {quizQuestions[currentQuestionIndex].options.map((opt, idx) => {
                    let btnClass = "w-full p-5 rounded-2xl border-2 text-left transition-all font-medium flex items-center justify-between group ";
                    if (quizState.answered) {
                      if (idx === quizQuestions[currentQuestionIndex].correctAnswer) btnClass += "border-green-500 bg-green-50 text-green-700";
                      else if (idx === quizState.selectedIndex) btnClass += "border-red-500 bg-red-50 text-red-700";
                      else btnClass += "border-slate-100 text-slate-300 opacity-50";
                    } else {
                      btnClass += "border-slate-100 hover:border-purple-500 hover:bg-purple-50 text-slate-600";
                    }

                    return (
                      <button key={idx} disabled={quizState.answered} onClick={() => handleQuizAnswer(idx)} className={btnClass}>
                        {opt}
                        {quizState.answered && idx === quizQuestions[currentQuestionIndex].correctAnswer && <CheckCircle size={20} />}
                        {!quizState.answered && <div className="w-4 h-4 rounded-full border-2 border-slate-200 group-hover:border-purple-500"></div>}
                      </button>
                    )
                  })}

                  {quizState.answered && (
                    <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex gap-3 mb-4">
                         <div className="p-2 bg-purple-100 text-purple-600 rounded-lg h-fit"><Info size={20}/></div>
                         <div>
                            <p className="font-bold text-slate-800 mb-1">Explanation</p>
                            <p className="text-slate-600 text-sm leading-relaxed">{quizQuestions[currentQuestionIndex].explanation}</p>
                         </div>
                      </div>
                      <button onClick={nextQuizQuestion} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-200">
                        {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === ViewState.ZAKAT && (
          <div className="max-w-xl mx-auto bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-lg border border-slate-100 mt-10">
             <button onClick={() => setView(ViewState.HUB)} className="mb-8 text-slate-400 hover:text-slate-600 transition"><ArrowLeft /></button>
             
             <div className="text-center mb-10">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calculator size={32} />
                </div>
                <h2 className="text-3xl font-bold text-slate-800">Zakat Calculator</h2>
                <p className="text-slate-500 mt-2">Calculate 2.5% on your eligible wealth.</p>
             </div>
             
             <div className="space-y-6">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Total Wealth (USD)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" value={zakatAssets} onChange={e => setZakatAssets(e.target.value)} className="w-full pl-8 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition bg-slate-50" placeholder="e.g. 5000" />
                 </div>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gold Price (per gram)</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" value={goldPrice} onChange={e => setGoldPrice(e.target.value)} className="w-full pl-8 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition bg-slate-50" />
                 </div>
               </div>
               <button onClick={calculateZakat} className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-200">Calculate Zakat</button>
             </div>

             {zakatResult && (
               <div className={`mt-8 p-8 rounded-2xl text-center border ${zakatResult.eligible ? 'bg-green-50 border-green-100 text-green-800' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                 <p className="text-xs uppercase font-bold mb-4 opacity-60 tracking-widest">Calculation Result</p>
                 {zakatResult.eligible ? (
                   <>
                     <p className="text-5xl font-bold mb-2 tracking-tight">${zakatResult.amount.toFixed(2)}</p>
                     <p className="text-sm font-medium">Zakat Payable (2.5%)</p>
                   </>
                 ) : (
                   <div className="flex flex-col items-center gap-2">
                        <span className="bg-white p-2 rounded-full shadow-sm"><X size={20}/></span>
                        <p className="font-bold">Not Eligible</p>
                        <p className="text-sm opacity-80 max-w-xs mx-auto">Your wealth is below the Nisab threshold of ${(zakatResult.nisaab).toFixed(2)}.</p>
                   </div>
                 )}
               </div>
             )}
          </div>
        )}

        {view === ViewState.TASBIH && (
          <div className="max-w-md mx-auto text-center pt-12 h-full flex flex-col justify-center">
            <div className="absolute top-8 left-4 sm:left-8">
                <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><ArrowLeft /></button>
            </div>
            
            <h2 className="text-3xl font-bold text-teal-900 mb-10">Digital Tasbih</h2>
            
            <div className="relative mb-10 group cursor-pointer" onClick={incrementTasbih}>
                <div className="absolute inset-0 bg-teal-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition duration-500"></div>
                <div className="bg-white rounded-full w-72 h-72 mx-auto flex flex-col items-center justify-center shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border-8 border-slate-50 relative z-10 active:scale-95 transition duration-150 select-none">
                    <span className="block text-8xl font-bold text-teal-600 font-mono tracking-tighter">{tasbihCount}</span>
                    <span className="text-teal-400 text-xs uppercase tracking-[0.3em] mt-2">Dhikr</span>
                </div>
            </div>

            <p className="text-slate-400 text-sm mb-8">Tap the circle to count</p>
            
            <button onClick={() => { setTasbihCount(0); updateUserInDb({...user!, tasbihCount: 0})}} className="text-slate-400 text-sm hover:text-red-500 font-bold uppercase tracking-wider transition">
                Reset Counter
            </button>
          </div>
        )}

        {view === ViewState.NAMES && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-pink-700">99 Names of Allah</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {ALLAH_NAMES.map((n, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-pink-200 hover:shadow-md transition text-center group">
                  <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-400 text-xs font-bold flex items-center justify-center mx-auto mb-3 group-hover:bg-pink-500 group-hover:text-white transition">{i + 1}</div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{n.name}</h3>
                  <p className="text-pink-500 text-xs font-medium">{n.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- NEW VIEWS --- */}

        {view === ViewState.DUA && (
          <div className="max-w-3xl mx-auto">
            <div className="sticky top-0 bg-[#f8fafc]/90 backdrop-blur p-4 -mx-4 mb-6 border-b border-slate-200 z-20 flex items-center gap-3">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-blue-800">Fortress of Dua</h2>
            </div>
            <div className="space-y-10">
              {DUAS_DATA.map((category, i) => (
                <div key={i}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-full shadow-sm">{category.category}</h3>
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                  </div>
                  <div className="space-y-6">
                    {category.items.map((dua, idx) => (
                      <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-blue-500">
                            <Coffee size={100} />
                        </div>
                        <p className="font-arabic text-3xl text-right mb-6 text-slate-700 leading-loose relative z-10" dir="rtl">{dua.arabic}</p>
                        <div className="bg-blue-50/50 p-5 rounded-2xl mb-4 border border-blue-50">
                            <p className="text-slate-800 font-medium leading-relaxed">"{dua.translation}"</p>
                        </div>
                        <p className="text-slate-400 text-sm italic mb-4">{dua.transliteration}</p>
                        <div className="flex justify-end">
                             <span className="text-[10px] font-bold uppercase bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-200">Ref: {dua.ref}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.SALAH && (
          <div className="max-w-4xl mx-auto">
             <div className="flex items-center gap-3 mb-8">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-green-800">Salah Guide (Hanafi)</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {SALAH_STEPS.map((step) => (
                <div key={step.step} className="flex gap-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-green-300 transition group">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-xl flex-shrink-0 group-hover:bg-green-500 group-hover:text-white transition duration-300 shadow-sm">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed text-sm font-medium">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.FOODS && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-orange-800">Sunnah Foods</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SUNNAH_FOODS_DATA.map((food, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-orange-200 transition group h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                     <h3 className="text-xl font-bold text-slate-800">{food.name}</h3>
                     <div className="p-2 bg-orange-50 rounded-lg text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition">
                        <Utensils size={18} />
                     </div>
                  </div>
                  <p className="text-slate-600 text-sm mb-6 flex-1 leading-relaxed">{food.benefit}</p>
                  <div className="pt-4 border-t border-slate-50">
                    <span className="inline-block bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded border border-orange-100 uppercase tracking-wide">Ref: {food.ref}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.DREAM && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 mt-8">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-600 transition"><ArrowLeft /></button>
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
                    <Moon size={32} />
                </div>
                <h2 className="text-3xl font-bold text-indigo-900 mb-2">Dream Interpretation</h2>
                <p className="text-slate-500 text-sm">Based on traditional Sunni sources (e.g., Ibn Sirin).</p>
            </div>
            
            <div className="relative">
                <textarea 
                value={dreamInput}
                onChange={(e) => setDreamInput(e.target.value)}
                className="w-full p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none h-40 resize-none mb-4 bg-slate-50 transition"
                placeholder="I saw myself flying over a green garden..."
                ></textarea>
                <div className="absolute bottom-8 right-4 text-xs text-slate-400 pointer-events-none">Detailed descriptions work best</div>
            </div>
            
            <button 
              onClick={handleDreamInterpret}
              disabled={isChatLoading || !dreamInput}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-200"
            >
              {isChatLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Interpret Dream'}
            </button>

            {dreamResult && (
              <div className="mt-8 p-8 bg-indigo-50 rounded-2xl text-indigo-900 leading-loose text-sm border border-indigo-100 animate-in fade-in">
                <h3 className="font-bold mb-2 flex items-center gap-2"><Sparkles size={16}/> Interpretation</h3>
                {dreamResult}
              </div>
            )}
          </div>
        )}

        {view === ViewState.HALAL && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 mt-8">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-600 transition"><ArrowLeft /></button>
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                    <Search size={32} />
                </div>
                <h2 className="text-3xl font-bold text-rose-800 mb-2">Halal Scanner</h2>
                <p className="text-slate-500 text-sm">Analyze ingredients (E-numbers, additives) for Halal status.</p>
            </div>
            
            <div className="flex gap-3 mb-8">
              <div className="flex-1 relative">
                <input 
                    type="text" 
                    value={halalInput}
                    onChange={(e) => setHalalInput(e.target.value)}
                    placeholder="e.g. E120, Gelatin, Carmine" 
                    className="w-full pl-5 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none bg-slate-50"
                />
              </div>
              <button 
                onClick={handleHalalCheck}
                disabled={isChatLoading || !halalInput}
                className="bg-rose-600 text-white px-8 rounded-xl font-bold hover:bg-rose-700 transition disabled:opacity-50 shadow-lg shadow-rose-200"
              >
                Check
              </button>
            </div>

            {isChatLoading ? (
                <div className="text-center text-rose-400 py-10">
                    <Loader2 className="animate-spin mx-auto mb-2" size={32}/> 
                    Analyzing ingredients...
                </div>
            ) : halalResult && (
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 leading-relaxed animate-in slide-in-from-bottom-2">
                {halalResult}
              </div>
            )}
          </div>
        )}

      </main>
      
      {/* Sidebar - Moved to RIGHT */}
      <Sidebar />
      
    </div>
  );
};

export default App;
