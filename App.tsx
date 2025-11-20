
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, LogOut, Search, Compass, 
  Calendar, Hand, Heart, Calculator, MessageCircle, 
  Menu, X, ChevronRight, ChevronLeft, PlayCircle,
  Bookmark as BookmarkIcon, Loader2, Grid, Lock, 
  Moon, Sun, CheckCircle, Utensils, Brain, Info, 
  ArrowLeft, Send, Share2, Coffee, AlignLeft, Book
} from 'lucide-react';
import { ViewState, UserProfile, Ayah, Hadith, QuizQuestion, SurahMetadata } from './types';
import { SURAHS, ALLAH_NAMES, ZAKAT_THRESHOLD_GOLD_GRAMS, DUAS_DATA, SALAH_STEPS, SUNNAH_FOODS_DATA } from './constants';
import * as GeminiService from './services/gemini';

// --- Constants & Helpers ---

const DB_KEY = 'noor_users_db_v2';

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const Loading = () => (
  <div className="flex flex-col justify-center items-center py-16 gap-4">
    <Loader2 className="animate-spin text-emerald-600" size={40} />
    <p className="text-slate-400 text-sm animate-pulse">Consulting the knowledge...</p>
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
    <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 flex justify-between items-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div>
          <h2 className="text-3xl font-bold font-arabic">الحكمة</h2>
          <p className="text-emerald-100 text-xs uppercase tracking-widest">Al-Hikmah</p>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-white/80 hover:text-white">
          <X size={24} />
        </button>
      </div>
      <div className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-140px)]">
        <SidebarItem icon={Calendar} label="Dashboard" active={view === ViewState.DASHBOARD} onClick={() => { setView(ViewState.DASHBOARD); setIsMobileMenuOpen(false); }} />
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
        <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Core</div>
        <SidebarItem icon={BookOpen} label="Read Quran" active={view === ViewState.QURAN_INDEX || view === ViewState.QURAN_READ} onClick={() => { setView(ViewState.QURAN_INDEX); setIsMobileMenuOpen(false); }} />
        <SidebarItem icon={MessageCircle} label="Hadith Collection" active={view === ViewState.HADITH} onClick={() => { setView(ViewState.HADITH); if(hadiths.length === 0) loadHadiths(); setIsMobileMenuOpen(false); }} />
        <SidebarItem icon={Hand} label="Ask Scholar AI" active={view === ViewState.SCHOLAR} onClick={() => { setView(ViewState.SCHOLAR); setIsMobileMenuOpen(false); }} />
      </div>
      <div className="absolute bottom-0 w-full p-4 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold border-2 border-emerald-100">
            {user?.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500"/> Synced</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-2 w-full rounded-lg text-sm font-medium transition">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  const AppGridItem = ({ icon: Icon, label, color, onClick }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg border border-slate-100 transition-all hover:-translate-y-1 group">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${color} text-white shadow-md group-hover:scale-110 transition duration-300`}>
        <Icon size={30} />
      </div>
      <span className="text-sm font-bold text-slate-700 text-center">{label}</span>
    </button>
  );

  // --- Auth View ---

  if (view === ViewState.AUTH) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1542816417-0983c9c9ad53?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center">
        <div className="absolute inset-0 bg-emerald-900/80 backdrop-blur-sm"></div>
        <div className="relative bg-white/95 backdrop-blur-xl w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white/20 m-4">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-emerald-800 mb-2 font-arabic drop-shadow-sm">الحكمة</h1>
            <p className="text-slate-500 font-medium">Al-Hikmah | Premium Companion</p>
          </div>
          
          <div className="space-y-4">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium animate-pulse">
                {authError}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><CheckCircle size={18}/></span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="Enter secure password"
                />
              </div>
            </div>

            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="animate-spin mx-auto" /> : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
            
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="w-full text-slate-500 text-sm hover:text-emerald-600 transition py-2"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'New here? Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main View ---

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-4 lg:p-8 transition-all duration-300">
        {/* Mobile Header */}
        <div className="lg:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm">
          <span className="font-bold text-emerald-800 font-arabic text-xl">الحكمة</span>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-emerald-600">
            <Menu size={28} />
          </button>
        </div>

        {/* Views */}

        {view === ViewState.DASHBOARD && (
          <div className="max-w-4xl mx-auto space-y-8">
            <header>
              <h1 className="text-3xl font-bold text-slate-800">Welcome back, {user?.username}</h1>
              <p className="text-slate-500">May this day bring you beneficial knowledge.</p>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <BookOpen className="absolute top-4 right-4 opacity-20" size={80} />
                <p className="text-emerald-100 uppercase text-xs font-bold tracking-wider mb-2">Continue Reading</p>
                <h3 className="text-3xl font-bold font-arabic mb-1">{SURAHS[(user?.lastReadSurah || 1) - 1].name}</h3>
                <p className="text-emerald-50 mb-6">{SURAHS[(user?.lastReadSurah || 1) - 1].englishName}</p>
                <button 
                  onClick={() => loadSurah(user?.lastReadSurah || 1)}
                  className="bg-white text-emerald-600 px-6 py-2 rounded-full font-bold hover:bg-emerald-50 transition shadow-lg"
                >
                  Resume Surah
                </button>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden">
                <Brain className="absolute -bottom-4 -right-4 text-purple-50 opacity-50" size={120} />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Test Your Knowledge</h3>
                <p className="text-slate-500 mb-6 text-sm">Take a quick quiz on Seerah, Fiqh, and Quran.</p>
                <div className="flex items-center gap-4">
                   <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                     <div className="bg-purple-500 h-full w-0 transition-all" style={{width: `${Math.min(user?.quizScore || 0, 100)}%`}}></div>
                   </div>
                   <span className="text-xs font-bold text-purple-600">{user?.quizScore} pts</span>
                </div>
                <button onClick={startQuiz} className="mt-6 w-full bg-purple-50 text-purple-600 py-2 rounded-lg font-bold hover:bg-purple-100 transition">Start Quiz</button>
              </div>
            </div>
          </div>
        )}

        {view === ViewState.QURAN_INDEX && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search Surah name or number..." 
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SURAHS.filter(s => 
                s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.number.toString().includes(searchTerm)
              ).map((surah) => (
                <button
                  key={surah.number}
                  onClick={() => loadSurah(surah.number)}
                  className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition border border-slate-100 text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-sm group-hover:bg-emerald-500 group-hover:text-white transition">
                      {surah.number}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{surah.englishName}</h3>
                      <p className="text-xs text-slate-500">{surah.englishNameTranslation}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-arabic text-xl text-slate-700 block">{surah.name}</span>
                    <span className="text-xs text-slate-400">{surah.numberOfAyahs} Ayahs</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.QURAN_READ && (
          <div className="max-w-3xl mx-auto bg-white min-h-[80vh] rounded-3xl shadow-sm border border-slate-100 p-8 relative">
            <button onClick={() => setView(ViewState.QURAN_INDEX)} className="absolute top-6 left-6 text-slate-400 hover:text-emerald-600 transition">
              <ArrowLeft size={24} />
            </button>
            
            <div className="text-center mb-10 pt-4">
              <h2 className="font-arabic text-4xl mb-2 text-slate-800">{SURAHS[currentSurah - 1].name}</h2>
              <p className="text-slate-500">{SURAHS[currentSurah - 1].englishName} • {SURAHS[currentSurah - 1].revelationType}</p>
            </div>

            {loadingAyahs ? <Loading /> : (
              <div className="space-y-10">
                {ayahs.map((ayah) => (
                  <div key={ayah.numberInSurah} className="border-b border-slate-50 pb-8 last:border-0">
                    <div className="flex justify-between items-start mb-4">
                      <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                        {ayah.numberInSurah}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => handleViewTafsir(ayah.numberInSurah)} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-emerald-600 transition" title="Tafsir">
                          <BookOpen size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-right font-arabic text-3xl leading-[2.5] mb-6 text-slate-800">
                      {ayah.text}
                    </p>
                    <p className="text-slate-600 text-lg mb-2">{ayah.translation}</p>
                    <p className="text-slate-400 text-sm italic">{ayah.transliteration}</p>

                    {selectedAyahForTafsir === ayah.numberInSurah && (
                      <div className="mt-6 bg-amber-50 p-6 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold">
                           <Book size={18} /> Tafsir (Analysis)
                        </div>
                        {loadingTafsir ? <Loader2 className="animate-spin text-amber-600" /> : (
                          <p className="text-amber-900 leading-relaxed text-sm">{tafsirContent}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === ViewState.SCHOLAR && (
           <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-6rem)] bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-emerald-50/50">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                   <Hand size={24} />
                 </div>
                 <div>
                   <h2 className="font-bold text-slate-800">AI Scholar (Hanafi)</h2>
                   <p className="text-xs text-slate-500">Ask Fiqh, History, or Advice.</p>
                 </div>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {chatHistory.length === 0 && (
                 <div className="text-center text-slate-400 mt-10">
                   <Info size={48} className="mx-auto mb-4 opacity-20" />
                   <p>Ask a question to begin...</p>
                 </div>
               )}
               {chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] p-5 rounded-2xl ${
                     msg.role === 'user' 
                       ? 'bg-emerald-600 text-white rounded-tr-none shadow-md' 
                       : 'bg-slate-100 text-slate-800 rounded-tl-none'
                   }`}>
                     {msg.role === 'model' ? (
                        <div>
                            {msg.text.includes('|||') ? (
                                <>
                                    <p className="font-bold text-lg mb-3 border-b border-slate-200/50 pb-2">
                                        {msg.text.split('|||')[0]}
                                    </p>
                                    <p className="text-sm leading-relaxed opacity-90">
                                        {msg.text.split('|||')[1]}
                                    </p>
                                </>
                            ) : <p>{msg.text}</p>}
                        </div>
                     ) : (
                        <p>{msg.text}</p>
                     )}
                   </div>
                 </div>
               ))}
               {isChatLoading && (
                 <div className="flex justify-start">
                   <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-slate-500 text-sm">
                     <Loader2 className="animate-spin" size={16} /> Thinking...
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} />
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50">
               <div className="flex gap-2">
                 <input
                   type="text"
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleScholarChat()}
                   placeholder="Is seafood halal in Hanafi school?"
                   className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                 />
                 <button 
                   onClick={handleScholarChat}
                   disabled={isChatLoading}
                   className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                 >
                   <Send size={20} />
                 </button>
               </div>
             </div>
           </div>
        )}

        {view === ViewState.HADITH && (
          <div className="max-w-4xl mx-auto">
             <div className="flex justify-between items-end mb-8">
               <div>
                 <h2 className="text-2xl font-bold text-slate-800">Hadith Collection</h2>
                 <p className="text-slate-500">Authentic narrations from Kutub al-Sittah</p>
               </div>
               <select 
                 value={hadithTopic} 
                 onChange={(e) => setHadithTopic(e.target.value)}
                 className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm"
               >
                 <option value="faith">Faith (Iman)</option>
                 <option value="prayer">Prayer (Salah)</option>
                 <option value="charity">Charity (Zakat)</option>
                 <option value="manners">Manners (Adab)</option>
                 <option value="marriage">Marriage</option>
               </select>
             </div>

             <div className="space-y-6">
               {loadingHadiths ? <Loading /> : hadiths.map((h) => (
                 <div key={h.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                   <div className="flex justify-between items-start mb-4">
                     <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                       {h.source}
                     </span>
                     <span className="text-slate-400 text-sm">{h.grade}</span>
                   </div>
                   <p className="text-right font-arabic text-2xl mb-4 text-slate-700 leading-relaxed">{h.arabic}</p>
                   <p className="text-slate-800 text-lg mb-2 font-serif leading-relaxed">"{h.english}"</p>
                   <p className="text-slate-400 text-sm italic">— Narrated by {h.narrator}</p>
                 </div>
               ))}
               <button onClick={loadHadiths} className="w-full py-4 bg-white border border-dashed border-slate-300 text-slate-500 rounded-2xl hover:bg-slate-50 transition font-medium">
                 Load More Hadiths
               </button>
             </div>
          </div>
        )}

        {view === ViewState.HUB && (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">Apps Hub</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <AppGridItem icon={Calculator} label="Zakat Calc" color="bg-amber-500" onClick={() => setView(ViewState.ZAKAT)} />
              <AppGridItem icon={Brain} label="Islamic Quiz" color="bg-purple-500" onClick={startQuiz} />
              <AppGridItem icon={Moon} label="Dream Meanings" color="bg-indigo-500" onClick={() => setView(ViewState.DREAM)} />
              <AppGridItem icon={Utensils} label="Halal Check" color="bg-rose-500" onClick={() => setView(ViewState.HALAL)} />
              <AppGridItem icon={Compass} label="Digital Tasbih" color="bg-teal-500" onClick={() => setView(ViewState.TASBIH)} />
              <AppGridItem icon={Heart} label="99 Names" color="bg-pink-500" onClick={() => setView(ViewState.NAMES)} />
              
              {/* New Apps */}
              <AppGridItem icon={Coffee} label="Fortress of Dua" color="bg-blue-500" onClick={() => setView(ViewState.DUA)} />
              <AppGridItem icon={AlignLeft} label="Salah Guide" color="bg-green-500" onClick={() => setView(ViewState.SALAH)} />
              <AppGridItem icon={Utensils} label="Sunnah Foods" color="bg-orange-500" onClick={() => setView(ViewState.FOODS)} />
            </div>
          </div>
        )}

        {view === ViewState.QUIZ && (
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-2"><ArrowLeft size={18}/> Back to Hub</button>
            
            {isChatLoading ? <Loading /> : quizQuestions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                <div className="bg-purple-600 p-8 text-white text-center">
                  <div className="flex justify-between items-center mb-4 opacity-80 text-sm">
                    <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
                    <span>Score: {quizScore}</span>
                  </div>
                  <h2 className="text-2xl font-bold leading-tight">{quizQuestions[currentQuestionIndex].question}</h2>
                </div>
                
                <div className="p-8 space-y-4">
                  {quizQuestions[currentQuestionIndex].options.map((opt, idx) => {
                    let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all font-medium ";
                    if (quizState.answered) {
                      if (idx === quizQuestions[currentQuestionIndex].correctAnswer) btnClass += "border-green-500 bg-green-50 text-green-700";
                      else if (idx === quizState.selectedIndex) btnClass += "border-red-500 bg-red-50 text-red-700";
                      else btnClass += "border-slate-100 text-slate-400";
                    } else {
                      btnClass += "border-slate-100 hover:border-purple-500 hover:bg-purple-50 text-slate-700";
                    }

                    return (
                      <button key={idx} disabled={quizState.answered} onClick={() => handleQuizAnswer(idx)} className={btnClass}>
                        {opt}
                      </button>
                    )
                  })}

                  {quizState.answered && (
                    <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                      <p className="font-bold text-slate-800 mb-2">Explanation:</p>
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">{quizQuestions[currentQuestionIndex].explanation}</p>
                      <button onClick={nextQuizQuestion} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition">
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
          <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
             <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
             <div className="flex items-center gap-3 mb-6 text-amber-600">
               <Calculator size={32} />
               <h2 className="text-2xl font-bold text-slate-800">Zakat Calculator</h2>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-bold text-slate-600 mb-1">Total Cash & Gold Value (USD)</label>
                 <input type="number" value={zakatAssets} onChange={e => setZakatAssets(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200" placeholder="e.g. 5000" />
               </div>
               <div>
                 <label className="block text-sm font-bold text-slate-600 mb-1">Current Gold Price (per gram USD)</label>
                 <input type="number" value={goldPrice} onChange={e => setGoldPrice(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200" />
               </div>
               <button onClick={calculateZakat} className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition">Calculate</button>
             </div>

             {zakatResult && (
               <div className={`mt-8 p-6 rounded-2xl text-center ${zakatResult.eligible ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
                 <p className="text-sm uppercase font-bold mb-2 opacity-70">Result</p>
                 {zakatResult.eligible ? (
                   <>
                     <p className="text-3xl font-bold mb-1">${zakatResult.amount.toFixed(2)}</p>
                     <p className="text-sm">Zakat Due (2.5%)</p>
                   </>
                 ) : (
                   <p>Not eligible. Your wealth is below the Nisab threshold of ${(zakatResult.nisaab).toFixed(2)}.</p>
                 )}
               </div>
             )}
          </div>
        )}

        {view === ViewState.TASBIH && (
          <div className="max-w-md mx-auto text-center pt-12">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
            <h2 className="text-3xl font-bold text-teal-800 mb-8">Digital Tasbih</h2>
            
            <div className="bg-white rounded-full w-64 h-64 mx-auto flex items-center justify-center shadow-2xl border-8 border-teal-50 relative mb-8">
               <div className="text-center">
                 <span className="block text-6xl font-bold text-teal-600 font-mono">{tasbihCount}</span>
                 <span className="text-teal-400 text-xs uppercase tracking-widest">Count</span>
               </div>
            </div>

            <button 
              onClick={incrementTasbih}
              className="w-full bg-teal-600 text-white font-bold text-xl py-6 rounded-2xl shadow-lg hover:bg-teal-700 active:scale-95 transition transform"
            >
              SubhanAllah
            </button>
            <button onClick={() => { setTasbihCount(0); updateUserInDb({...user!, tasbihCount: 0})}} className="mt-4 text-slate-400 text-sm hover:text-red-500">Reset Counter</button>
          </div>
        )}

        {view === ViewState.NAMES && (
          <div className="max-w-4xl mx-auto">
            <button onClick={() => setView(ViewState.HUB)} className="mb-6 text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
            <h2 className="text-3xl font-bold text-pink-600 mb-8 text-center">Names of Allah</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {ALLAH_NAMES.map((n, i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm text-center border border-pink-50 hover:border-pink-200 transition">
                  <h3 className="font-bold text-slate-800 text-lg">{n.name}</h3>
                  <p className="text-pink-500 text-sm">{n.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- NEW VIEWS --- */}

        {view === ViewState.DUA && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-blue-800">Fortress of Dua</h2>
            </div>
            <div className="space-y-8">
              {DUAS_DATA.map((category, i) => (
                <div key={i}>
                  <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider mb-3">{category.category}</h3>
                  <div className="space-y-4">
                    {category.items.map((dua, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="font-arabic text-2xl text-right mb-3 text-slate-700 leading-loose">{dua.arabic}</p>
                        <p className="text-slate-800 font-medium mb-1">{dua.translation}</p>
                        <p className="text-slate-400 text-sm italic mb-2">{dua.transliteration}</p>
                        <p className="text-xs text-blue-500 font-bold uppercase">{dua.ref}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.SALAH && (
          <div className="max-w-3xl mx-auto">
             <div className="flex items-center gap-3 mb-6">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-green-800">Salah Guide (Hanafi)</h2>
            </div>
            <div className="space-y-4">
              {SALAH_STEPS.map((step) => (
                <div key={step.step} className="flex gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-green-200 transition">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold flex-shrink-0">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.FOODS && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
               <button onClick={() => setView(ViewState.HUB)} className="text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
               <h2 className="text-2xl font-bold text-orange-800">Sunnah Foods</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {SUNNAH_FOODS_DATA.map((food, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{food.name}</h3>
                  <p className="text-slate-600 text-sm mb-3 h-10">{food.benefit}</p>
                  <span className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded">Ref: {food.ref}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.DREAM && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <button onClick={() => setView(ViewState.HUB)} className="mb-4 text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
            <h2 className="text-2xl font-bold text-indigo-800 mb-2">Dream Interpretation</h2>
            <p className="text-slate-500 text-sm mb-6">Based on traditional Sunni sources (e.g., Ibn Sirin).</p>
            
            <textarea 
              value={dreamInput}
              onChange={(e) => setDreamInput(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none mb-4"
              placeholder="Describe your dream in detail..."
            ></textarea>
            
            <button 
              onClick={handleDreamInterpret}
              disabled={isChatLoading || !dreamInput}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {isChatLoading ? 'Interpreting...' : 'Interpret Dream'}
            </button>

            {dreamResult && (
              <div className="mt-6 p-6 bg-indigo-50 rounded-2xl text-indigo-900 leading-relaxed text-sm">
                {dreamResult}
              </div>
            )}
          </div>
        )}

        {view === ViewState.HALAL && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <button onClick={() => setView(ViewState.HUB)} className="mb-4 text-slate-400 hover:text-slate-600"><ArrowLeft /></button>
            <h2 className="text-2xl font-bold text-rose-800 mb-2">Halal/Haram Checker</h2>
            <p className="text-slate-500 text-sm mb-6">Analyze ingredients or food items.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={halalInput}
                onChange={(e) => setHalalInput(e.target.value)}
                placeholder="e.g. Gelatin, Carmine, Red 40" 
                className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
              />
              <button 
                onClick={handleHalalCheck}
                disabled={isChatLoading || !halalInput}
                className="bg-rose-600 text-white px-6 rounded-xl font-bold hover:bg-rose-700 transition disabled:opacity-50"
              >
                Check
              </button>
            </div>

            {isChatLoading ? <div className="text-center text-rose-400"><Loader2 className="animate-spin inline" /> Checking...</div> : halalResult && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 leading-relaxed">
                {halalResult}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
