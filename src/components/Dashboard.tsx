import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PackageSearch,
  AlertOctagon,
  AlertTriangle,
  Truck,
  Clock,
  Calculator,
  PieChart as PieChartIcon,
  Activity,
  BarChart3,
  AlignLeft,
  X,
  Search,
  Filter,
  RefreshCw,
  Printer,
  FileDown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { cn } from '../lib/utils';

// Consts
const API_URL = "https://script.google.com/macros/s/AKfycbwyrBt0HtUUGB1uObAQKvL0bIewDqcAOR_5AFleAT5OFu5zHUXeGXDiQ1J29Xo3_wAcPQ/exec";
const PAGE_SIZE = 15;
const PALETTE = ['#3b82f6', '#2dd4bf', '#a78bfa', '#fbbf24', '#34d399', '#f43f5e', '#60a5fa', '#f97316'];

// Utilities
const extractNum = (x: any) => {
  if (x === null || x === undefined) return NaN;
  if (typeof x === 'number') return x;
  const m = String(x).replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

const fmtFull = (n: any) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US'); // The user requested english numbers!
};

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [rawJson, setRawJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncTime, setSyncTime] = useState<string>('--:--');

  // Filters & State
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      setRawJson(json);
      
      const rows = Array.isArray(json.rows) ? json.rows : [];
      const processed = rows.map((r: any) => {
        // Try multiple keys for "Supply Duration" to be safe, preferring column H
        const durationKey = Object.keys(r).find(k => k.includes('مدة التوريد')) || 'مدة التوريد من تاريخ الطلب';
        return {
          ...r,
          _balance: extractNum(r['رصيد السيستم']),
          _reqNum: Object.keys(r).some(k => k.includes('طلب ك +')) 
                     ? extractNum(r[Object.keys(r).find(k => k.includes('طلب ك +'))!]) 
                     : extractNum(r['الكمية المطلوبة']),
          _days: (() => { 
            const d = extractNum(r[durationKey]); 
            return isNaN(d) ? null : d; 
          })(),
          _lastSup: extractNum(r['اخر كمية تم توريدها']),
        };
      });
      setData(processed);
      setSyncTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setError(err.message || 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const int = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(int);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (catFilter && (r['التصنيف'] || '') !== catFilter) return false;
      if (availFilter && (r['توفر المنتج في المعصرة'] || '') !== availFilter) return false;
      if (statusFilter && (r['حالة الطلب'] || '') !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const nm = String(r['اسم الصنف'] || '').toLowerCase();
        const bc = String(r['الباركود \\ مرجع داخلي'] || '').toLowerCase();
        if (!nm.includes(q) && !bc.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (!sortCol) return 0;
      let av = a[sortCol];
      let bv = b[sortCol];
      if (sortCol === 'رصيد السيستم') { av = a._balance; bv = b._balance; }
      if (sortCol === 'مدة التوريد من تاريخ الطلب') { av = a._days; bv = b._days; }
      if (sortCol === 'الكمية المطلوبة') { av = a._reqNum; bv = b._reqNum; }
      if (sortCol === 'اخر كمية تم توريدها') { av = a._lastSup; bv = b._lastSup; }
      
      if (typeof av === 'string') return av.localeCompare(bv, 'ar') * sortDir;
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * sortDir;
    });
  }, [data, search, catFilter, availFilter, statusFilter, sortCol, sortDir]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE) || 1;

  // KPIs
  const outStock = data.filter(r => r._balance === 0 || (r['توفر المنتج في المعصرة'] || '').includes('نفذ')).length;
  const lowStock = data.filter(r => (r['توفر المنتج في المعصرة'] || '').includes('وشك')).length;
  const ordered = data.filter(r => {
    const s = r['حالة الطلب'] || '';
    return s.includes('طلب') || s.includes('توريد');
  }).length;
  const validDays = data.map(r => r._days).filter(d => d !== null && !isNaN(d) && d > 0);
  const avgDays = validDays.length ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length) : 0;
  const sumBal = data.reduce((s, r) => s + (isNaN(r._balance) ? 0 : r._balance), 0);

  // Print Logic
  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
    const csv = [
      '\uFEFF' + headers.join(','),
      ...data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `نواقص_المخازن_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortCol(col); setSortDir(1); }
  };

  return (
    <div className="min-h-screen bg-[#050b14] text-[#e4eeff] selection:bg-blue-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 bg-[#0a1628]/80 backdrop-blur-xl border-b border-blue-500/10 shadow-lg">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-xl font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              ن
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{rawJson?.sheetName || 'لوحة تحكم نواقص المخازن'}</h1>
              <div className="text-xs text-blue-200/70 mt-1 flex items-center gap-2">
                <span className="font-mono">{data.length}</span> صنف مسجل
                {loading && <RefreshCw className="w-3 h-3 animate-spin inline ml-1" />}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              محدث {syncTime}
            </div>
            <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-blue-500/10 hover:text-blue-400 border border-white/5 transition-all flex items-center gap-2 text-sm font-medium">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> تحديث
            </button>
            <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-blue-500/10 hover:text-blue-400 border border-white/5 transition-all flex items-center gap-2 text-sm font-medium">
              <FileDown className="w-4 h-4" /> تصدير
            </button>
            <button onClick={handlePrint} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2 text-sm font-medium">
              <Printer className="w-4 h-4" /> طباعة
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-[1920px] mx-auto px-6 mt-4">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-400">
            <AlertOctagon className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      <main className="max-w-[1920px] mx-auto px-6 py-6 flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="إجمالي الأصناف" value={data.length} icon={PackageSearch} color="blue" delay={0.05} />
          <KPICard title="نفذت من المخزون" value={outStock} icon={AlertOctagon} color="rose" delay={0.1} />
          <KPICard title="على وشك النفاد" value={lowStock} icon={AlertTriangle} color="amber" delay={0.15} />
          <KPICard title="طلبات نشطة" value={ordered} icon={Truck} color="emerald" delay={0.2} />
          <KPICard title="متوسط التوريد (يوم)" value={avgDays} icon={Clock} color="violet" delay={0.25} />
          <KPICard title="إجمالي رصيد السيستم" value={sumBal} icon={Calculator} color="teal" delay={0.3} />
        </div>

        {/* Charts & Table Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start auto-rows-min">
          {/* Left Column - Small Charts */}
          <div className="xl:col-span-3 flex flex-col gap-6">
            <ChartCard title="حالة المنتجات في المعصرة" icon={PieChartIcon}>
              <DonutChart data={data} dataKey="توفر المنتج في المعصرة" />
            </ChartCard>
            <ChartCard title="حالات الطلبات" icon={Activity}>
              <StatusBars data={data} dataKey="حالة الطلب" />
            </ChartCard>
            <ChartCard title="التصنيفات" icon={AlignLeft}>
              <DonutChart data={data} dataKey="التصنيف" />
            </ChartCard>
          </div>

          {/* Right Column - Main Charts & Table */}
          <div className="xl:col-span-9 flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <ChartCard title="توزيع مدة التوريد الأيام" icon={Activity}>
                 <SupplyDurationChart data={data} />
               </ChartCard>
               <ChartCard title="أعلى الكميات المطلوبة" icon={BarChart3}>
                 <TopQuantitiesChart data={data} />
               </ChartCard>
            </div>

            {/* Table Card */}
            <div className="bg-[#0a1628] border border-blue-500/10 rounded-2xl shadow-xl overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-base font-bold flex items-center gap-2 text-white">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                  الجدول التفصيلي
                </h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200/50" />
                    <input 
                      type="text" 
                      placeholder="ابحث باسم الصنف..." 
                      className="bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-full sm:w-64 transition-all"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  
                  <select className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                    <option value="">كل التصنيفات</option>
                    {[...new Set(data.map(r => r['التصنيف']).filter(Boolean))].map((c: any) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">كل الحالات</option>
                    {[...new Set(data.map(r => r['حالة الطلب']).filter(Boolean))].map((c: any) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right whitespace-nowrap min-w-[1000px]">
                  <thead className="bg-[#0d1d35] text-blue-200/70 text-xs uppercase tracking-wider backdrop-blur-xl">
                    <tr>
                      {[
                        { k: 'اسم الصنف', l: 'اسم الصنف' },
                        { k: 'التصنيف', l: 'التصنيف' },
                        { k: 'رصيد السيستم', l: 'رصيد السيستم' },
                        { k: 'الكمية المطلوبة', l: 'الكمية المطلوبة' },
                        { k: 'توفر المنتج في المعصرة', l: 'التوافر' },
                        { k: 'مدة التوريد من تاريخ الطلب', l: 'مدة التوريد' },
                        { k: 'حالة الطلب', l: 'حالة الطلب' },
                        { k: 'تاريخ الطلب', l: 'تاريخ الطلب' },
                      ].map(col => (
                        <th key={col.k} onClick={() => handleSort(col.k)} className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors select-none group">
                          {col.l}
                          <span className={cn("inline-block ml-1 opacity-0 group-hover:opacity-50 transition-opacity", sortCol === col.k && "opacity-100 text-blue-400")}>
                            {sortCol === col.k ? (sortDir === 1 ? '↑' : '↓') : '↕'}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <AnimatePresence mode="popLayout">
                      {pagedData.map((row, idx) => (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          key={idx} 
                          className="hover:bg-blue-500/5 transition-colors"
                        >
                          <td className="px-4 py-3 max-w-[200px] truncate font-medium text-white">{row['اسم الصنف'] || '—'}</td>
                          <td className="px-4 py-3"><Badge>{row['التصنيف'] || '—'}</Badge></td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{fmtFull(row._balance)}</td>
                          <td className="px-4 py-3 font-mono text-blue-400">{fmtFull(row._reqNum)}</td>
                          <td className="px-4 py-3"><AvailBadge val={row['توفر المنتج في المعصرة']} /></td>
                          <td className="px-4 py-3 font-mono text-violet-400">{row._days !== null ? row._days : '—'}</td>
                          <td className="px-4 py-3"><StatusBadge val={row['حالة الطلب']} /></td>
                          <td className="px-4 py-3 text-blue-200/70 font-mono text-xs">{row['تاريخ الطلب'] || '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelectedRow(row)} className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 transition-colors">
                              <AlignLeft className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {pagedData.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-blue-200/50">لا توجد بيانات مطابقة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="p-4 border-t border-white/5 flex items-center justify-between text-sm">
                <div className="text-blue-200/70">
                  صفحة {page} من {totalPages} <span className="mx-2">•</span> <span className="font-mono">{filteredData.length}</span> نتيجة
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-blue-500/20 disabled:opacity-30 transition-colors">{'<'}</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-blue-500/20 disabled:opacity-30 transition-colors">{'>'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Row Modal */}
      <AnimatePresence>
        {selectedRow && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedRow(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a1628] border border-blue-500/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-lg font-bold text-white pr-8">{selectedRow['اسم الصنف']}</h2>
                <button onClick={() => setSelectedRow(null)} className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <DetailBox label="التصنيف" value={selectedRow['التصنيف']} />
                <DetailBox label="رصيد السيستم" value={fmtFull(selectedRow._balance)} mono color="emerald" />
                <DetailBox label="الكمية المطلوبة" value={fmtFull(selectedRow._reqNum)} mono color="blue" />
                <DetailBox label="التوافر" value={selectedRow['توفر المنتج في المعصرة']} />
                <DetailBox label="مدة التوريد" value={selectedRow._days ? `${selectedRow._days} يوم` : '—'} mono color="violet" />
                <DetailBox label="حالة الطلب" value={selectedRow['حالة الطلب']} />
                <DetailBox label="تاريخ الطلب" value={selectedRow['تاريخ الطلب']} mono />
                <DetailBox label="الباركود" value={selectedRow['الباركود \\ مرجع داخلي']} mono />
              </div>
              
              <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <div className="text-xs text-blue-400 mb-1">ملاحظات</div>
                <div className="text-sm text-blue-100 whitespace-pre-wrap">{selectedRow['ملاحظات'] || 'لا توجد ملاحظات.'}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponents
function KPICard({ title, value, icon: Icon, color, delay }: any) {
  const colors: any = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  };
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      className="bg-[#0a1628] border border-blue-500/10 rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-blue-500/30 transition-all"
    >
      <div className={cn("absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-transform group-hover:scale-150", 
        color==='blue'?'bg-blue-500':color==='rose'?'bg-rose-500':color==='amber'?'bg-amber-500':color==='emerald'?'bg-emerald-500':color==='violet'?'bg-violet-500':'bg-teal-500')} 
      />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn("p-2.5 rounded-xl border flex items-center justify-center", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={cn("text-3xl font-bold font-mono mb-1 tracking-tight", color==='blue'?'text-blue-400':color==='rose'?'text-rose-400':color==='amber'?'text-amber-400':color==='emerald'?'text-emerald-400':color==='violet'?'text-violet-400':'text-teal-400')}>
        {fmtFull(value)}
      </div>
      <div className="text-xs text-blue-200/70 font-medium">{title}</div>
    </motion.div>
  );
}

function ChartCard({ title, icon: Icon, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#0a1628] border border-blue-500/10 rounded-2xl p-5 shadow-xl">
      <h3 className="text-sm font-bold flex items-center gap-2 text-white mb-6">
        <Icon className="w-4 h-4 text-blue-400" /> {title}
      </h3>
      <div className="h-64 w-full relative">
        {children}
      </div>
    </motion.div>
  );
}

function DetailBox({ label, value, mono, color = 'default' }: any) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl p-3">
      <div className="text-xs text-blue-200/50 mb-1">{label}</div>
      <div className={cn("text-sm font-medium", 
        mono && "font-mono font-bold tracking-wider",
        color === 'emerald' ? 'text-emerald-400' :
        color === 'rose' ? 'text-rose-400' :
        color === 'amber' ? 'text-amber-400' :
        color === 'blue' ? 'text-blue-400' :
        color === 'violet' ? 'text-violet-400' : 'text-white'
      )}>
        {value || '—'}
      </div>
    </div>
  );
}

// Mini Components
const Badge = ({ children }: any) => <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-blue-200/80 font-medium">{children}</span>;
const AvailBadge = ({ val }: any) => {
  const v = val || '';
  if (v.includes('نفذ')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold">{val}</span>;
  if (v.includes('وشك')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">{val}</span>;
  if (v.includes('متوفر') || v.includes('موجود')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">{val}</span>;
  return <Badge>{val || '—'}</Badge>;
}
const StatusBadge = ({ val }: any) => {
  const v = val || '';
  if (v.includes('توريد')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">{val}</span>;
  if (v.includes('طلب')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">{val}</span>;
  return <Badge>{val || '—'}</Badge>;
}

// Charts
function DonutChart({ data, dataKey }: { data: any[], dataKey: string }) {
  const counts = data.reduce((acc, r) => {
    const k = r[dataKey] || 'غير محدد';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const plot = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a: any, b: any) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={plot} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} stroke="none">
          {plot.map((e, idx) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />)}
        </Pie>
        <RechartsTooltip 
          contentStyle={{ backgroundColor: '#0d1d35', borderColor: 'rgba(59,130,246,0.2)', borderRadius: 8, color: '#e4eeff', textAlign: 'right' }} 
          itemStyle={{ color: '#e4eeff' }}
          formatter={(value: any, name: any) => [`${value} صنف`, name]} 
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatusBars({ data, dataKey }: any) {
  const counts = data.reduce((acc: any, r: any) => {
    const k = r[dataKey] || 'غير محدد';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const list = Object.entries(counts).map(([k, v]) => ({ name: k, value: v as number })).sort((a: any, b: any) => b.value - a.value);
  const max = Math.max(...list.map(l => l.value));

  return (
    <div className="flex flex-col gap-4 overflow-y-auto pr-2 h-full">
      {list.map((item, idx) => (
        <div key={idx}>
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-blue-100 truncate w-32">{item.name}</span>
            <span className="font-mono font-bold text-white">{item.value}</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${(item.value / max) * 100}%` }} 
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SupplyDurationChart({ data }: any) {
  const validDays = data.map((r: any) => r._days).filter((d: any) => d !== null && !isNaN(d) && d > 0);
  if (validDays.length === 0) return <div className="flex items-center justify-center h-full text-blue-200/50 text-sm">لا توجد بيانات للمدة</div>;
  
  const maxD = Math.max(...validDays);
  const W = Math.max(5, Math.ceil((maxD + 1) / 8));
  const bCnt = Math.ceil((maxD + 1) / W);
  const buckets = Array.from({ length: bCnt }, (_, i) => ({ name: `${i*W}-${(i+1)*W-1}`, count: 0 }));
  validDays.forEach((v: any) => { buckets[Math.min(bCnt-1, Math.floor(v/W))].count++; });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" stroke="#6b8ab5" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#6b8ab5" fontSize={11} tickLine={false} axisLine={false} />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: '#0d1d35', borderColor: 'rgba(59,130,246,0.2)', borderRadius: 8, textAlign: 'right' }}
          formatter={(val: any) => [`${val} صنف`, 'العدد']}
          labelStyle={{ color: '#e4eeff', marginBottom: 4 }}
        />
        <Area type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopQuantitiesChart({ data }: any) {
  const top = [...data].filter(r => r._reqNum > 0).sort((a, b) => b._reqNum - a._reqNum).slice(0, 5);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={top} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" stroke="#6b8ab5" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="اسم الصنف" width={100} stroke="#6b8ab5" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(0, 15) + (v.length > 15 ? '...' : '')} />
        <RechartsTooltip 
          contentStyle={{ backgroundColor: '#0d1d35', borderColor: 'rgba(59,130,246,0.2)', borderRadius: 8, textAlign: 'right' }}
          formatter={(val: any) => [fmtFull(val), 'الكمية']}
          labelStyle={{ color: '#e4eeff', marginBottom: 4 }}
        />
        <Bar dataKey="_reqNum" radius={[0, 4, 4, 0]}>
          {top.map((entry, index) => <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
