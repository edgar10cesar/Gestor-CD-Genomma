import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  writeBatch, 
  serverTimestamp,
  query,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  FileUp, 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Table as TableIcon,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface IndicatorsModuleProps {
  onBack?: () => void;
}

export default function IndicatorsModule({ onBack }: IndicatorsModuleProps) {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [dateColumn, setDateColumn] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [fileName, setFileName] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [kpiName, setKpiName] = useState<string>('Meu Novo KPI');

  // Aggregation States
  const [aggregationMode, setAggregationMode] = useState<'none' | 'daily' | 'monthly' | 'group_by'>('none');
  const [calculationType, setCalculationType] = useState<'sum' | 'average' | 'count'>('sum');
  const [groupByColumn, setGroupByColumn] = useState<string>('');

  // Load persistent data on mount
  useEffect(() => {
    const loadPersistentData = async () => {
      setIsLoading(true);
      try {
        // Load config
        const configDoc = await getDoc(doc(db, 'indicators_config', 'active'));
        if (configDoc.exists()) {
          const config = configDoc.data();
          setXAxis(config.xAxis);
          setYAxis(config.yAxis);
          setDateColumn(config.dateColumn);
          setChartType(config.chartType as any);
          setFileName(config.fileName);
          setKpiName(config.kpiName || 'KPI Arquivado');
          setAggregationMode(config.aggregationMode || 'none');
          setCalculationType(config.calculationType || 'sum');
          setGroupByColumn(config.groupByColumn || '');
          
          // Load data rows
          const dataSnap = await getDocs(collection(db, 'indicators_data'));
          const rows = dataSnap.docs.map(d => {
            const r = d.data();
            // Convert strings back to dates if they were date-like
            Object.keys(r).forEach(key => {
              if (typeof r[key] === 'string' && r[key].includes('T') && !isNaN(Date.parse(r[key]))) {
                // Check if it's actually an ISO date
                const d = new Date(r[key]);
                if (!isNaN(d.getTime())) r[key] = d;
              }
            });
            return r;
          });
          
          if (rows.length > 0) {
            const cols = Object.keys(rows[0]);
            setColumns(cols);
            setData(rows);
            setIsSuccess(true);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados persistentes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistentData();
  }, []);

  const deleteFromSystem = async () => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente todos os dados arquivados?")) return;
    
    setIsDeleting(true);
    try {
      // Deleta os dados em lotes (limite de 500 por lote no Firestore)
      const oldDataSnap = await getDocs(collection(db, 'indicators_data'));
      const docs = oldDataSnap.docs;
      
      const batchSize = 500;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      
      await deleteDoc(doc(db, 'indicators_config', 'active'));
      
      reset();
      alert("Todos os dados foram excluídos com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir dados:", error);
      handleFirestoreError(error, OperationType.DELETE, 'indicators');
    } finally {
      setIsDeleting(false);
    }
  };

  const saveToSystem = async () => {
    if (data.length === 0) return;
    setIsSaving(true);
    try {
      // 1. Clear old data (simplified for small/medium datasets)
      const oldDataSnap = await getDocs(collection(db, 'indicators_data'));
      const deleteBatch = writeBatch(db);
      oldDataSnap.docs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      // 2. Save new data rows in batches of 500
      const batchSize = 500;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = data.slice(i, i + batchSize);
        chunk.forEach((row, index) => {
          const rowId = `row_${i + index}`;
          const rowRef = doc(collection(db, 'indicators_data'), rowId);
          
          const cleanRow = { ...row };
          Object.keys(cleanRow).forEach(key => {
            if (cleanRow[key] instanceof Date) {
              cleanRow[key] = cleanRow[key].toISOString();
            }
          });
          
          batch.set(rowRef, cleanRow);
        });
        await batch.commit();
      }

      // 3. Save config
      await setDoc(doc(db, 'indicators_config', 'active'), {
        xAxis,
        yAxis,
        dateColumn,
        chartType,
        fileName,
        kpiName,
        aggregationMode,
        calculationType,
        groupByColumn,
        updatedAt: serverTimestamp()
      });

      alert("KPI montado e arquivado com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar no sistema:", error);
      handleFirestoreError(error, OperationType.WRITE, 'indicators');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setKpiName(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws);
      
      if (jsonData.length > 0) {
        const cols = Object.keys(jsonData[0] as object);
        setColumns(cols);
        setData(jsonData);
        setXAxis(cols[0]);
        
        // Find first numeric column for Y Axis
        const numericCol = cols.find(c => {
          const val = (jsonData[0] as any)[c];
          return typeof val === 'number';
        });
        setYAxis(numericCol || cols[1] || cols[0]);
        
        // Try to guess date column
        const dateCol = cols.find(c => {
          const lower = c.toLowerCase();
          return lower.includes('data') || 
                 lower.includes('date') ||
                 lower.includes('vencimento') ||
                 lower.includes('venc') ||
                 lower.includes('abertura') ||
                 lower.includes('fechamento') ||
                 lower.includes('competência') ||
                 lower.includes('referência');
        });
        if (dateCol) setDateColumn(dateCol);
        
        setIsSuccess(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const reset = () => {
    setData([]);
    setColumns([]);
    setXAxis('');
    setYAxis('');
    setDateColumn('');
    setStartDate('');
    setEndDate('');
    setFileName('');
    setKpiName('Meu Novo KPI');
    setAggregationMode('none');
    setCalculationType('sum');
    setGroupByColumn('');
    setIsSuccess(false);
  };

  const filteredData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!startDate && !endDate && (!dateColumn || dateColumn === 'none')) return data;
    
    // Preparar limites de data (início do dia para start, fim do dia para end)
    const startLimit = startDate ? new Date(startDate + 'T00:00:00').getTime() : -Infinity;
    const endLimit = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    return data.filter(item => {
      if (!dateColumn || dateColumn === 'none') {
        return true;
      }
      
      const val = item[dateColumn];
      if (val === undefined || val === null || val === '') return false;
      
      let itemDate: Date;
      if (val instanceof Date) {
        itemDate = val;
      } else if (typeof val === 'number') {
        // Lógica para datas seriais do Excel (caso não tenham sido convertidas no upload)
        // 25569 é o offset para 1970-01-01
        itemDate = new Date((val - 25569) * 86400 * 1000);
      } else {
        const dateStr = String(val).trim();
        
        // Tentar formatar DD/MM/YYYY comum no Brasil
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            itemDate = new Date(y, m, d);
          } else {
            itemDate = new Date(dateStr);
          }
        } else {
          itemDate = new Date(dateStr);
        }
      }
      
      const time = itemDate.getTime();
      if (isNaN(time)) return true; // Se não for uma data válida, mantém o registro
      
      return time >= startLimit && time <= endLimit;
    });
  }, [data, dateColumn, startDate, endDate]);

  const stats = React.useMemo(() => {
    if (filteredData.length === 0 || !yAxis) return { total: 0, average: 0, count: 0 };
    
    let sum = 0;
    let count = 0;
    
    filteredData.forEach(item => {
      const val = parseFloat(item[yAxis]);
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    });
    
    return {
      total: sum,
      average: count > 0 ? sum / count : 0,
      count: filteredData.length
    };
  }, [filteredData, yAxis]);

  const chartData = React.useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    if (!yAxis || !xAxis) return [];

    // Aggregation Logic
    if (aggregationMode !== 'none') {
      const groups: Record<string, { sum: number, count: number, label: string }> = {};

      filteredData.forEach(item => {
        let key = '';
        
        if (aggregationMode === 'daily' || aggregationMode === 'monthly') {
          if (!dateColumn || dateColumn === 'none') {
            key = 'Sem Data';
          } else {
            const val = item[dateColumn];
            let itemDate: Date | null = null;
            if (val instanceof Date) itemDate = val;
            else if (typeof val === 'number') itemDate = new Date((val - 25569) * 86400 * 1000);
            else if (val) itemDate = new Date(val);

            if (itemDate && !isNaN(itemDate.getTime())) {
              key = aggregationMode === 'daily' 
                ? itemDate.toLocaleDateString('pt-BR')
                : `${itemDate.getMonth() + 1}/${itemDate.getFullYear()}`;
            } else {
              key = 'Data Inválida';
            }
          }
        } else if (aggregationMode === 'group_by') {
          const groupVal = item[groupByColumn || xAxis];
          key = groupVal !== undefined && groupVal !== null ? String(groupVal) : 'Indefinido';
        }

        if (!groups[key]) {
          groups[key] = { sum: 0, count: 0, label: key };
        }

        const numericVal = parseFloat(item[yAxis]);
        if (!isNaN(numericVal)) {
          groups[key].sum += numericVal;
          groups[key].count += 1;
        } else if (calculationType === 'count') {
          groups[key].count += 1;
        }
      });

      // Convert groups to chart array
      return Object.values(groups).map(g => {
        // Try to create a sortable timestamp if it's a date label
        let sortValue: any = g.label;
        if (aggregationMode === 'daily' || aggregationMode === 'monthly') {
          const parts = g.label.split('/');
          if (parts.length === 3) { // DD/MM/YYYY
            sortValue = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          } else if (parts.length === 2) { // MM/YYYY
            sortValue = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1).getTime();
          }
        }

        return {
          [xAxis]: g.label,
          [yAxis]: calculationType === 'sum' ? g.sum : 
                   calculationType === 'average' ? (g.count > 0 ? g.sum / g.count : 0) : 
                   g.count,
          _sort: sortValue
        };
      }).sort((a, b) => {
        if (typeof a._sort === 'number' && typeof b._sort === 'number') {
          return a._sort - b._sort;
        }
        return String(a[xAxis]).localeCompare(String(b[xAxis]));
      });
    }

    // Original Mode (no aggregation)
    return filteredData.map(item => {
      const newItem = { ...item };
      Object.keys(newItem).forEach(key => {
        if (newItem[key] instanceof Date) {
          newItem[key] = newItem[key].toLocaleDateString('pt-BR');
        }
      });
      return newItem;
    });
  }, [filteredData, aggregationMode, calculationType, groupByColumn, xAxis, yAxis, dateColumn]);
  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel de <span className="text-emerald-600">Indicadores</span></h1>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Análise de Dados Logísticos</p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-6 border-slate-200">
            Voltar ao Início
          </Button>
        )}
      </header>

      {isLoading ? (
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden p-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando dados arquivados...</p>
        </Card>
      ) : !isSuccess ? (
        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
          <CardContent className="p-12 md:p-20 flex flex-col items-center text-center space-y-8">
            <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center border border-emerald-100 animate-pulse">
              <FileUp className="w-12 h-12 text-emerald-600" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900">Montar Novo KPI</h2>
              <p className="text-slate-500 max-w-md mx-auto text-lg leading-relaxed">
                Carregue sua planilha para definir as métricas e consolidar seu KPI no sistema.
              </p>
            </div>
            
            <div className="w-full max-w-md">
              <label 
                htmlFor="excel-upload" 
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 hover:border-emerald-400 transition-all group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 mb-3 transition-colors" />
                  <p className="mb-2 text-sm text-slate-500 font-bold uppercase tracking-wider">Clique para selecionar planilha</p>
                  <p className="text-xs text-slate-400">XLSX, XLS ou CSV</p>
                </div>
                <input id="excel-upload" type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mt-8">
              <div className="flex flex-col items-center space-y-2 p-6 rounded-3xl bg-slate-50/50 border border-slate-100">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Dashboard Persistente</span>
              </div>
              <div className="flex flex-col items-center space-y-2 p-6 rounded-3xl bg-slate-50/50 border border-slate-100">
                <PieChartIcon className="w-6 h-6 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Métricas em Tempo Real</span>
              </div>
              <div className="flex flex-col items-center space-y-2 p-6 rounded-3xl bg-slate-50/50 border border-slate-100">
                <TableIcon className="w-6 h-6 text-amber-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Arquivo Centralizado</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-3xl border-none shadow-sm bg-white p-6 flex flex-col gap-1 border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Acumulado</p>
              <h3 className="text-3xl font-black text-slate-900">
                {typeof stats.total === 'number' ? stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </h3>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Soma de {yAxis}</p>
            </Card>
            <Card className="rounded-3xl border-none shadow-sm bg-white p-6 flex flex-col gap-1 border-l-4 border-l-blue-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média por Registro</p>
              <h3 className="text-3xl font-black text-slate-900">
                {typeof stats.average === 'number' ? stats.average.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
              </h3>
              <p className="text-[10px] font-bold text-blue-600 uppercase">Eficiência Média</p>
            </Card>
            <Card className="rounded-3xl border-none shadow-sm bg-white p-6 flex flex-col gap-1 border-l-4 border-l-amber-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume de Registros</p>
              <h3 className="text-3xl font-black text-slate-900">{stats.count}</h3>
              <p className="text-[10px] font-bold text-amber-600 uppercase">Total de Linhas Processadas</p>
            </Card>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <Card className="lg:w-1/3 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden self-start">
              <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-lg">Configuração do KPI</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={reset} className="rounded-full hover:bg-red-50 hover:text-red-500 w-8 h-8">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Planilha Ativa</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{fileName}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Indicador (KPI)</Label>
                    <Input 
                      value={kpiName} 
                      onChange={(e) => setKpiName(e.target.value)}
                      className="rounded-xl h-11 border-slate-200 focus:ring-emerald-500 font-bold"
                      placeholder="Ex: Faturamento Mensal"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Eixo X (Categorias)</Label>
                    <Select value={xAxis} onValueChange={setXAxis}>
                      <SelectTrigger className="rounded-xl h-11 border-slate-200 font-medium">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Eixo Y (Métrica/Valor)</Label>
                    <Select value={yAxis} onValueChange={setYAxis}>
                      <SelectTrigger className="rounded-xl h-11 border-slate-200 font-medium">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <Label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Inteligência de Cálculo</Label>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Modo de Agregação</Label>
                      <Select value={aggregationMode} onValueChange={(v: any) => setAggregationMode(v)}>
                        <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs font-medium">
                          <SelectValue placeholder="Selecione o modo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Por Registro (Original)</SelectItem>
                          <SelectItem value="daily">Agrupar por Dia</SelectItem>
                          <SelectItem value="monthly">Agrupar por Mês</SelectItem>
                          <SelectItem value="group_by">Agrupar por Coluna</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {aggregationMode === 'group_by' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Coluna de Agrupamento</Label>
                        <Select value={groupByColumn} onValueChange={setGroupByColumn}>
                          <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs font-medium">
                            <SelectValue placeholder="Ex: Lote, Setor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map(col => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {aggregationMode !== 'none' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Operação</Label>
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                          {[
                            { id: 'sum', label: 'Soma' },
                            { id: 'average', label: 'Média' },
                            { id: 'count', label: 'Contagem' }
                          ].map((type) => (
                            <Button 
                              key={type.id}
                              variant={calculationType === type.id ? 'default' : 'ghost'} 
                              size="sm" 
                              onClick={() => setCalculationType(type.id as any)}
                              className={`flex-1 rounded-lg h-7 font-bold text-[8px] uppercase border-none transition-all ${calculationType === type.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                            >
                              {type.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtro de Data</Label>
                    <Select value={dateColumn} onValueChange={setDateColumn}>
                      <SelectTrigger className="rounded-xl h-11 border-slate-200 font-medium">
                        <SelectValue placeholder="Sem filtro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem filtro temporal</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visualização</Label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                      {[
                        { id: 'bar', label: 'Barras' },
                        { id: 'line', label: 'Linha' },
                        { id: 'pie', label: 'Pizza' }
                      ].map((type) => (
                        <Button 
                          key={type.id}
                          variant={chartType === type.id ? 'default' : 'ghost'} 
                          size="sm" 
                          onClick={() => setChartType(type.id as any)}
                          className={`flex-1 rounded-lg h-8 font-bold text-[9px] uppercase border-none transition-all ${chartType === type.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                        >
                          {type.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col gap-3">
                    <Button 
                      onClick={saveToSystem} 
                      disabled={isSaving || isDeleting}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest h-12 shadow-lg shadow-emerald-600/20"
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </span>
                      ) : 'Confirmar e Arquivar KPI'}
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={deleteFromSystem} 
                      disabled={isSaving || isDeleting}
                      className="w-full rounded-xl border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 font-bold text-[10px] uppercase tracking-widest h-11"
                    >
                      {isDeleting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                          Excluindo...
                        </span>
                      ) : 'Limpar Tudo'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 space-y-6">
              {dateColumn && dateColumn !== 'none' && (
                <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Filter className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Refinar Período:</span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                        <Input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)}
                          className="rounded-xl h-10 pl-10 border-slate-200 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                        <Input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)}
                          className="rounded-xl h-10 pl-10 border-slate-200 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                    </div>
                    
                    {(startDate || endDate) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 hover:bg-red-50 rounded-xl px-4"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden p-6 md:p-10">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{kpiName}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Análise de {xAxis} vs {yAxis}</p>
                  </div>
                </div>
                
                <div className="h-[450px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey={xAxis} 
                          angle={-45} 
                          textAnchor="end" 
                          height={80} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickFormatter={(val) => val.toLocaleString('pt-BR')}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                          cursor={{ fill: '#f8fafc' }}
                          formatter={(val: any) => [val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), yAxis]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        <Bar dataKey={yAxis} radius={[8, 8, 0, 0]} barSize={Math.min(40, 500 / chartData.length)}>
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey={xAxis} 
                          angle={-45} 
                          textAnchor="end" 
                          height={80} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickFormatter={(val) => val.toLocaleString('pt-BR')}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                          formatter={(val: any) => [val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), yAxis]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        <Line 
                          type="monotone" 
                          dataKey={yAxis} 
                          stroke="#10b981" 
                          strokeWidth={4} 
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={chartData || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => {
                            const pct = typeof percent === 'number' ? (percent * 100).toFixed(0) : '0';
                            return `${name || 'Item'} (${pct}%)`;
                          }}
                          outerRadius={140}
                          fill="#8884d8"
                          dataKey={yAxis || 'value'}
                          nameKey={xAxis || 'name'}
                        >
                          {(chartData || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                          formatter={(val: any) => [val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), yAxis]}
                        />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="p-8 bg-white rounded-[2rem] border border-slate-100 flex items-center gap-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
                  <AlertCircle className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dica de Gestão</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "Um KPI eficaz deve ser específico e mensurável. Use os cards acima para monitorar metas globais enquanto o gráfico revela anomalias pontuais no período selecionado."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
