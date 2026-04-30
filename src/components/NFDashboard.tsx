import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Search, Plus, Filter, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function NFDashboard() {
  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Gestor de Notas Fiscais</h2>
          <p className="text-slate-500 mt-1">Gerenciamento centralizado de documentos fiscais e faturas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 px-6 font-medium shadow-lg shadow-slate-900/10 transition-all active:scale-95 flex items-center justify-center">
            <Plus className="mr-2 w-4 h-4" /> Nova Nota Fiscal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Total no Mês</CardDescription>
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">R$ --.---,--</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Aguardando Aprovação</CardDescription>
            <CardTitle className="text-3xl font-bold tracking-tight text-amber-600">--</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Status do Fluxo</CardDescription>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <CardTitle className="text-xl font-bold tracking-tight text-slate-900 uppercase">Em Implantação</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Módulo em Desenvolvimento</h3>
        <p className="text-slate-500 max-w-sm mb-8">
          Estamos integrando o Gestor de Notas Fiscais ao sistema de insumos. Em breve você poderá vincular compras diretamente às NFs.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" className="rounded-xl border-slate-200 text-slate-500 font-bold px-8">
            Ver Cronograma
          </Button>
          <Button disabled className="bg-emerald-600/50 text-white rounded-xl font-bold px-8">
            Acessar Versão Alpha
          </Button>
        </div>
      </div>
    </div>
  );
}
