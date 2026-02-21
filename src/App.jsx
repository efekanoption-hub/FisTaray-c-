import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Plus,
  BarChart3,
  Scan,
  X,
  Receipt,
  Download,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  History,
  ShoppingCart,
  Wrench,
  Utensils,
  Shirt,
  Stethoscope,
  MoreHorizontal,
  ChevronRight,
  User,
  PieChart,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';

const App = () => {
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('camfis_profiles');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: 'Ana Profil' }];
  });

  const [activeProfileId, setActiveProfileId] = useState(() => {
    return localStorage.getItem('camfis_active_profile') || 'default';
  });

  const [receipts, setReceipts] = useState([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // Load receipts based on active profile
  useEffect(() => {
    const saved = localStorage.getItem(`camfis_receipts_${activeProfileId}`);
    setReceipts(saved ? JSON.parse(saved) : []);
  }, [activeProfileId]);

  // Save receipts whenever they change
  useEffect(() => {
    if (activeProfileId) {
      localStorage.setItem(`camfis_receipts_${activeProfileId}`, JSON.stringify(receipts));
    }
  }, [receipts, activeProfileId]);

  // Save profiles
  useEffect(() => {
    localStorage.setItem('camfis_profiles', JSON.stringify(profiles));
    localStorage.setItem('camfis_active_profile', activeProfileId);
  }, [profiles, activeProfileId]);

  const [activeTab, setActiveTab] = useState('home');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('camfis_receipts', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    if (isScanning) {
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access denied", err);
          alert("Kamera izni gerekiyor.");
          setIsScanning(false);
        }
      };
      initCamera();
    }
  }, [isScanning]);

  const totalAmount = receipts.reduce((acc, curr) => acc + curr.amount, 0);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current) return;
    setIsLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');
    stopCamera();

    try {
      const worker = await createWorker('tur+eng');
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();
      processOCR(text);
    } catch (err) {
      console.error(err);
      alert("Hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const processOCR = (text) => {
    const lines = text.split('\n');
    let amount = 0;
    let name = "CamFis Market";

    const totalMatch = text.match(/(TOPLAM|TOTAL|GENEL)\s*[:=]?\s*(\d+[,.]\d{2})/i);
    if (totalMatch) {
      amount = parseFloat(totalMatch[2].replace(',', '.'));
    } else {
      const amounts = text.match(/\d+[,.]\d{2}/g);
      if (amounts) {
        amount = Math.max(...amounts.map(a => parseFloat(a.replace(',', '.'))));
      }
    }

    const firstLine = lines.find(l => l.trim().length > 3);
    if (firstLine) name = firstLine.trim();

    const findCategory = (txt) => {
      const low = txt.toLowerCase();
      if (low.match(/migros|bim|a101|sok|şok|carrefour|market|gida|manav|kasap|fırın/)) return 'Market';
      if (low.match(/akaryakit|benzin|mazot|shell|opet|bp|petrol|oto|lastik|tamir|servis/)) return 'Sanayi/Oto';
      if (low.match(/restoran|lokanta|kafe|cafe|yemek|doner|pizz|burger|kahve/)) return 'Yemek/Kafe';
      if (low.match(/lcw|h&m|zara|koton|mavi|boyner|giyim|ayakkabi|tekstil/)) return 'Giyim/Aksesuar';
      if (low.match(/eczane|hastane|doktor|saglik|ilaç/)) return 'Sağlık';
      return 'Diğer';
    };

    const vatMatch = text.match(/KDV\s*(?:TOPLAM)?\s*%?\s*(\d{1,2})/i) || text.match(/%(\d{1,2})/);
    const rate = vatMatch ? parseInt(vatMatch[1]) : 20;

    const newReceipt = {
      id: Date.now(),
      name: name.substring(0, 20),
      date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      fullDate: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      amount: amount || 0,
      vatAmount: (amount * (rate / 100)).toFixed(2),
      vatRate: rate,
      category: findCategory(text + " " + name)
    };

    setReceipts([newReceipt, ...receipts]);
  };

  const deleteReceipt = (id) => {
    if (confirm('Silmek istediğine emin misin?')) {
      setReceipts(receipts.filter(r => r.id !== id));
      setSelectedReceipt(null);
    }
  };

  const addProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile = { id: Date.now().toString(), name: newProfileName.trim() };
    setProfiles([...profiles, newProfile]);
    setNewProfileName('');
  };

  const switchProfile = (id) => {
    setActiveProfileId(id);
    setIsProfileModalOpen(false);
  };

  const deleteProfile = (id, e) => {
    e.stopPropagation();
    if (id === 'default') return alert("Ana profil silinemez.");
    if (confirm("Bu profili ve TÜM fişlerini silmek istediğine emin misin?")) {
      setProfiles(profiles.filter(p => p.id !== id));
      localStorage.removeItem(`camfis_receipts_${id}`);
      if (activeProfileId === id) setActiveProfileId('default');
    }
  };

  const exportData = (data = receipts, fileName = `CamFis_Rapor`) => {
    const ws = XLSX.utils.json_to_sheet(data.map(r => ({
      Mağaza: r.name,
      Tarih: r.fullDate,
      Kategori: r.category,
      KDV_Yuzde: `%${r.vatRate}`,
      KDV_Tutar: r.vatAmount,
      Toplam: r.amount
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fişler");
    XLSX.writeFile(wb, `${fileName}_${Date.now()}.xlsx`);
  };

  const exportAnalysis = () => {
    const categories = ['Market', 'Sanayi/Oto', 'Yemek/Kafe', 'Giyim/Aksesuar', 'Sağlık', 'Diğer'];
    const analysisData = categories.map(cat => {
      const catReceipts = receipts.filter(r => r.category === cat);
      const total = catReceipts.reduce((a, b) => a + b.amount, 0);
      const vatTotal = catReceipts.reduce((a, b) => a + parseFloat(b.vatAmount), 0);
      return {
        Kategori: cat,
        Fiş_Adedi: catReceipts.length,
        Toplam_KDV: vatTotal.toFixed(2),
        Genel_Toplam: total.toFixed(2)
      };
    }).filter(row => row.Fiş_Adedi > 0);

    const ws = XLSX.utils.json_to_sheet(analysisData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analiz");
    XLSX.writeFile(wb, `CamFis_Analiz_Raporu_${Date.now()}.xlsx`);
  };

  const activeProfileName = profiles.find(p => p.id === activeProfileId)?.name || 'Profil';

  const getCatIcon = (cat) => {
    switch (cat) {
      case 'Market': return ShoppingCart;
      case 'Sanayi/Oto': return Wrench;
      case 'Yemek/Kafe': return Utensils;
      case 'Giyim/Aksesuar': return Shirt;
      case 'Sağlık': return Stethoscope;
      default: return MoreHorizontal;
    }
  };

  const getCatColor = (cat) => {
    switch (cat) {
      case 'Market': return 'cat-market';
      case 'Sanayi/Oto': return 'cat-sanayi';
      case 'Yemek/Kafe': return 'cat-yemek';
      case 'Giyim/Aksesuar': return 'cat-giyim';
      case 'Sağlık': return 'cat-health';
      default: return 'cat-other';
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">CamFis</div>
        <div className="profile-btn" onClick={() => setIsProfileModalOpen(true)}>
          <div style={{ marginRight: '8px', fontSize: '12px', fontWeight: '600', opacity: 0.7 }}>{activeProfileName}</div>
          <User size={20} />
        </div>
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="glass-panel total-card">
              <div className="total-label">Toplam Harcama</div>
              <div className="total-value">{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
              <div className="card-actions">
                <button className="mini-btn" onClick={() => exportData()}>
                  <Download size={16} /> Excel Al
                </button>
                <button className="mini-btn" onClick={() => setActiveTab('history')}>
                  <PieChart size={16} /> Analiz
                </button>
              </div>
            </div>

            <div className="section-header">
              <h2 className="section-title">Son Fişler</h2>
              {receipts.length > 0 && <span className="see-all">Tümünü Gör</span>}
            </div>

            {receipts.length === 0 ? (
              <div className="empty-hero">
                <div className="empty-icon"><Receipt size={40} /></div>
                <h3>Henüz fiş yok</h3>
                <p>Alttaki butona basarak ilk fişini tara.</p>
              </div>
            ) : (
              <div className="receipt-list">
                {receipts.map((r, i) => {
                  const Icon = getCatIcon(r.category);
                  const colorClass = getCatColor(r.category);
                  return (
                    <motion.div
                      key={r.id}
                      className="glass-panel receipt-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedReceipt(r)}
                    >
                      <div className={`icon-box ${colorClass}`}>
                        <Icon size={22} />
                      </div>
                      <div className="info-box">
                        <div className="receipt-title">{r.name}</div>
                        <div className="receipt-meta">{r.date} • {r.category}</div>
                      </div>
                      <div className="amount-box">
                        <div className="amount-val">{r.amount.toLocaleString('tr-TR')} ₺</div>
                        <ChevronRight size={14} style={{ opacity: 0.3 }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="section-header">
              <h2 className="section-title">Harcama Analizi</h2>
              <button className="mini-btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={exportAnalysis}>
                <Download size={14} /> Analiz İndir
              </button>
            </div>

            <div className="stats-grid">
              <div className="glass-panel stat-item">
                <div className="stat-header">Fiş Adet</div>
                <div className="stat-num">{receipts.length}</div>
              </div>
              <div className="glass-panel stat-item">
                <div className="stat-header">KDV Toplam</div>
                <div className="stat-num">
                  {receipts.reduce((a, b) => a + parseFloat(b.vatAmount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 1 })} ₺
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div className="stat-header" style={{ marginBottom: '20px' }}>Kategoriler</div>
              {['Market', 'Sanayi/Oto', 'Yemek/Kafe', 'Giyim/Aksesuar', 'Sağlık', 'Diğer'].map(cat => {
                const total = receipts.filter(r => r.category === cat).reduce((a, b) => a + b.amount, 0);
                const perc = totalAmount === 0 ? 0 : (total / totalAmount) * 100;
                if (total === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                      <span>{cat}</span>
                      <span style={{ fontWeight: '700' }}>{total.toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="progress-track">
                      <motion.div
                        className="progress-thumb"
                        initial={{ width: 0 }}
                        animate={{ width: `${perc}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Dock */}
      <div className="nav-dock-container">
        <div className="nav-dock">
          <div className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            <Home size={24} />
            <span>Ev</span>
          </div>

          <div className="scan-trigger-container">
            <div className="scan-trigger" onClick={() => setIsScanning(true)}>
              <Scan size={32} />
            </div>
          </div>

          <div className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={24} />
            <span>Geçmiş</span>
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            className="scan-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="scan-chrome">
              <button onClick={stopCamera} style={{ background: 'transparent', border: 'none', color: 'white' }}>
                <X size={28} />
              </button>
              <div style={{ fontWeight: '700' }}>FIŞI OKUT</div>
              <div style={{ width: 28 }} />
            </div>

            <div className="cam-view">
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div className="scan-reticle">
                <div className="scan-laser" />
              </div>
            </div>

            <div className="scan-actions">
              <button className="shutter-btn" onClick={captureAndScan}>
                <div className="shutter-core" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-box">
          <div className="pulsar" />
          <p style={{ marginTop: '24px', fontWeight: '600', letterSpacing: '1px' }}>AI ANALIZ EDIYOR...</p>
        </div>
      )}

      {/* Receipt Detail Sheet */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedReceipt(null)}
          >
            <motion.div
              className="glass-panel bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                <div className={`icon-box ${getCatColor(selectedReceipt.category)}`} style={{ width: '64px', height: '64px' }}>
                  {React.createElement(getCatIcon(selectedReceipt.category), { size: 30 })}
                </div>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{selectedReceipt.name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{selectedReceipt.fullDate}</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Kategori</span>
                  <span style={{ fontWeight: '700' }}>{selectedReceipt.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>KDV (%{selectedReceipt.vatRate})</span>
                  <span style={{ fontWeight: '700' }}>{selectedReceipt.vatAmount} ₺</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>Genel Toplam</span>
                  <span style={{ fontWeight: '800', fontSize: '24px', color: 'var(--primary)' }}>{selectedReceipt.amount.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '32px' }}>
                <button className="mini-btn" style={{ background: 'var(--primary)', border: 'none', height: '48px' }} onClick={() => exportData([selectedReceipt], `Fis_Detay_${selectedReceipt.name}`)}>
                  <Download size={18} /> Excel'i Al
                </button>
                <button className="delete-action" style={{ marginTop: 0, height: '48px' }} onClick={() => deleteReceipt(selectedReceipt.id)}>
                  <Trash2 size={18} /> Sil
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <motion.div
            className="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsProfileModalOpen(false)}
          >
            <motion.div
              className="glass-panel bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="sheet-handle" />
              <h2 style={{ marginBottom: '24px' }}>Profiller</h2>

              <div className="glass-panel" style={{ padding: '12px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Yeni Profil İsmi..."
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', padding: '4px' }}
                />
                <button className="mini-btn" style={{ width: 'auto', background: 'var(--primary)', border: 'none' }} onClick={addProfile}>
                  <Plus size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {profiles.map(p => (
                  <div
                    key={p.id}
                    className={`glass-panel profile-item ${activeProfileId === p.id ? 'active-profile' : ''}`}
                    style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: activeProfileId === p.id ? '1px solid var(--primary)' : '1px solid var(--card-border)' }}
                    onClick={() => switchProfile(p.id)}
                  >
                    <span style={{ fontWeight: '600' }}>{p.name} {activeProfileId === p.id && '✓'}</span>
                    <button onClick={(e) => deleteProfile(p.id, e)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default App;
