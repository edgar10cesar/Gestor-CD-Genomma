import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Wrench, 
  MapPin, 
  ClipboardList, 
  Plus, 
  Camera, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Trash2,
  ChevronRight,
  ChevronLeft,
  X,
  ArrowLeft,
  Pencil
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface MaintenanceTicket {
  id: string;
  location: string;
  description: string;
  resolution?: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority?: 'low' | 'medium' | 'high' | '';
  isSafetyRisk: boolean;
  reportedBy: string;
  reportedByName: string;
  photoUrls?: string[];
  createdAt: any;
  updatedAt?: any;
}

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta'
};

export default function MaintenanceModule({ onBack }: { onBack: () => void }) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [filter, setFilter] = useState<'todos' | 'abertos' | 'baixo' | 'medio' | 'alto' | 'resolvidos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'open' | 'in_progress' | 'resolved'>('todos');
  const [priorityFilter, setPriorityFilter] = useState<'todos' | 'low' | 'medium' | 'high'>('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<MaintenanceTicket | null>(null);
  const [resolutionInput, setResolutionInput] = useState('');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  
  const [newTicket, setNewTicket] = useState({
    location: '',
    description: '',
    priority: '' as 'low' | 'medium' | 'high' | '',
    isSafetyRisk: false,
    photos: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    location: '',
    description: '',
    resolution: '',
    priority: '' as 'low' | 'medium' | 'high' | '',
    isSafetyRisk: false,
    photos: [] as string[],
  });

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const ticketsQuery = query(collection(db, 'maintenance_tickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTicket));
      setTickets(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_tickets');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`O arquivo ${file.name} não é uma imagem.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setNewTicket(prev => ({ ...prev, photos: [...prev.photos, dataUrl] }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setEditForm(prev => ({ ...prev, photos: [...prev.photos, dataUrl] }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number, isEdit: boolean = false) => {
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    } else {
      setNewTicket(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index)
      }));
    }
  };

  const handleAddTicket = async () => {
    if (!newTicket.location || !newTicket.description || !newTicket.priority) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await addDoc(collection(db, 'maintenance_tickets'), {
        location: newTicket.location,
        description: newTicket.description,
        priority: newTicket.priority,
        isSafetyRisk: newTicket.isSafetyRisk,
        photoUrls: newTicket.photos,
        status: 'open',
        reportedBy: user?.uid,
        reportedByName: user?.displayName || user?.email,
        createdAt: serverTimestamp()
      });
      
      setIsAdding(false);
      setNewTicket({ location: '', description: '', priority: '', isSafetyRisk: false, photos: [] });
      toast.success("Solicitação de manutenção enviada!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'maintenance_tickets');
    }
  };

  const handleEditTicket = async () => {
    if (!editingTicket || !editForm.location || !editForm.description || !editForm.priority) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await updateDoc(doc(db, 'maintenance_tickets', editingTicket.id), {
        location: editForm.location,
        description: editForm.description,
        resolution: editForm.resolution || '',
        priority: editForm.priority,
        isSafetyRisk: editForm.isSafetyRisk,
        photoUrls: editForm.photos,
        updatedAt: serverTimestamp()
      });
      
      setIsEditing(false);
      setEditingTicket(null);
      toast.success("Solicitação atualizada!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `maintenance_tickets/${editingTicket.id}`);
    }
  };

  const openEdit = (ticket: MaintenanceTicket) => {
    setEditingTicket(ticket);
    setEditForm({
      location: ticket.location,
      description: ticket.description,
      resolution: ticket.resolution || '',
      priority: ticket.priority || '',
      isSafetyRisk: ticket.isSafetyRisk || false,
      photos: ticket.photoUrls || [],
    });
    setIsEditing(true);
  };

  const openView = (ticket: MaintenanceTicket) => {
    setSelectedTicket(ticket);
    setLightboxImages(ticket.photoUrls || []);
    setIsViewing(true);
  };

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setIsLightboxOpen(true);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
  };

  const updateStatus = async (id: string, newStatus: 'in_progress' | 'resolved', resolution?: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      if (resolution) updateData.resolution = resolution;

      await updateDoc(doc(db, 'maintenance_tickets', id), updateData);
      toast.success(newStatus === 'resolved' ? "Manutenção finalizada!" : "Manutenção iniciada!");
      
      if (newStatus === 'resolved') {
        setIsResolving(false);
        setResolvingTicket(null);
        setResolutionInput('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `maintenance_tickets/${id}`);
    }
  };

  const openResolveDialog = (ticket: MaintenanceTicket) => {
    setResolvingTicket(ticket);
    setResolutionInput(ticket.resolution || '');
    setIsResolving(true);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteTicket = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'maintenance_tickets', id));
      setDeleteConfirmId(null);
      toast.success("Solicitação removida.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `maintenance_tickets/${id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl h-9 w-9">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Button>
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm md:text-lg tracking-tight text-slate-900 truncate">Manutenções <span className="hidden sm:inline font-medium border-slate-200" style={{ color: '#002799', borderColor: '#e2e2f0' }}>do CD</span></h1>
              <p className="hidden md:block text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Gestão de Infraestrutura</p>
            </div>
          </div>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-600/20 font-bold text-[10px] md:text-xs uppercase tracking-wider px-4 md:px-6 h-9 md:h-11">
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Nova Solicitação</span>
              <span className="md:hidden">Novo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] sm:rounded-[2rem] border-none shadow-2xl p-6 sm:p-8 max-w-md">
            <DialogHeader className="mb-4 sm:mb-6">
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Nova Manutenção</DialogTitle>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Descreva o problema encontrado no CD.</p>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-amber-500" />
                    Local
                  </Label>
                  <Input 
                    placeholder="Ex: Docas, B12..."
                    value={newTicket.location}
                    onChange={(e) => setNewTicket({...newTicket, location: e.target.value})}
                    className="rounded-xl h-11 border-slate-200 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Criticidade
                  </Label>
              <Select 
                    value={newTicket.priority} 
                    onValueChange={(val: any) => setNewTicket({...newTicket, priority: val})}
                  >
                    <SelectTrigger className="rounded-xl h-11 border-slate-200">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  Risco de Segurança?
                </Label>
                <Select 
                  value={newTicket.isSafetyRisk ? 'sim' : 'nao'} 
                  onValueChange={(val: any) => setNewTicket({...newTicket, isSafetyRisk: val === 'sim'})}
                >
                  <SelectTrigger className="rounded-xl h-11 border-slate-200">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim, envolve risco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList className="w-3 h-3 text-amber-500" />
                  Descrição do Problema
                </Label>
                <textarea 
                  placeholder="Descreva detalhadamente o que precisa de conserto..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                  className="w-full min-h-[120px] rounded-xl p-4 bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Camera className="w-3 h-3 text-amber-500" />
                  Evidências Visuais (Fotos)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {newTicket.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-video rounded-xl overflow-hidden shadow-inner group">
                      <img src={photo} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div 
                    onClick={() => document.getElementById('photo-upload')?.click()}
                    className="relative cursor-pointer overflow-hidden border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 transition-all hover:border-amber-500/50 hover:bg-amber-50/30 flex flex-col items-center justify-center aspect-video"
                  >
                    <input 
                      id="photo-upload"
                      type="file" 
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Camera className="w-6 h-6 mb-1 text-slate-300" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Anexar</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-8 flex gap-3">
              <DialogClose asChild>
                <Button variant="ghost" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 flex-1">Cancelar</Button>
              </DialogClose>
              <Button 
                onClick={handleAddTicket}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-600/20 font-bold uppercase tracking-widest text-[10px] h-12 flex-1"
              >
                Enviar Chamado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-10 w-full space-y-6 animate-in fade-in duration-500">
        {/* Dashboard Summary moved to main content area for better mobile experience */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <Card 
            onClick={() => setFilter(filter === 'abertos' ? 'todos' : 'abertos')}
            className={cn(
              "rounded-2xl border-none shadow-sm p-3 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95",
              filter === 'abertos' ? "bg-slate-900 text-white shadow-lg" : "bg-white"
            )}
          >
            <span className={cn("text-xl sm:text-2xl font-black", filter === 'abertos' ? "text-white" : "text-slate-900")}>
              {tickets.filter(t => t.status !== 'resolved').length}
            </span>
            <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 text-slate-400", filter === 'abertos' && "text-slate-300")}>Abertas</span>
          </Card>
          
          <Card 
            onClick={() => setFilter(filter === 'baixo' ? 'todos' : 'baixo')}
            className={cn(
              "rounded-2xl border-none shadow-sm p-3 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-t-4",
              filter === 'baixo' ? "bg-emerald-500 text-white border-emerald-600 shadow-lg" : "bg-emerald-50 border-emerald-500"
            )}
          >
            <span className={cn("text-xl sm:text-2xl font-black", filter === 'baixo' ? "text-white" : "text-emerald-700")}>
              {tickets.filter(t => t.priority === 'low' && t.status !== 'resolved').length}
            </span>
            <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 text-emerald-600", filter === 'baixo' && "text-emerald-100")}>Baixas</span>
          </Card>

          <Card 
            onClick={() => setFilter(filter === 'medio' ? 'todos' : 'medio')}
            className={cn(
              "rounded-2xl border-none shadow-sm p-3 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-t-4",
              filter === 'medio' ? "bg-amber-500 text-white border-amber-600 shadow-lg" : "bg-amber-50 border-amber-500"
            )}
          >
            <span className={cn("text-xl sm:text-2xl font-black", filter === 'medio' ? "text-white" : "text-amber-700")}>
              {tickets.filter(t => t.priority === 'medium' && t.status !== 'resolved').length}
            </span>
            <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 text-amber-600", filter === 'medio' && "text-amber-100")}>Médias</span>
          </Card>

          <Card 
            onClick={() => setFilter(filter === 'alto' ? 'todos' : 'alto')}
            className={cn(
              "rounded-2xl border-none shadow-sm p-3 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-t-4",
              filter === 'alto' ? "bg-red-500 text-white border-red-600 shadow-lg" : "bg-red-50 border-red-500"
            )}
          >
            <span className={cn("text-xl sm:text-2xl font-black", filter === 'alto' ? "text-white" : "text-red-700")}>
              {tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length}
            </span>
            <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 text-red-600", filter === 'alto' && "text-red-100")}>Altas</span>
          </Card>

          <Card 
            onClick={() => setFilter(filter === 'resolvidos' ? 'todos' : 'resolvidos')}
            className={cn(
              "rounded-2xl border-none shadow-sm p-3 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-t-4 col-span-2 sm:col-span-1",
              filter === 'resolvidos' ? "bg-slate-500 text-white border-slate-600 shadow-lg" : "bg-slate-50 border-slate-400"
            )}
          >
            <span className={cn("text-xl sm:text-2xl font-black", filter === 'resolvidos' ? "text-white" : "text-slate-700")}>
              {tickets.filter(t => t.status === 'resolved').length}
            </span>
            <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 text-slate-500", filter === 'resolvidos' && "text-slate-100")}>Resolvidas</span>
          </Card>
        </div>
        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm mb-6 flex flex-col gap-4">
          <div className="relative w-full">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por local ou descrição..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 rounded-2xl border-slate-100 bg-slate-50/50 h-12 focus:ring-amber-500"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:flex gap-3 w-full items-center">
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-full rounded-2xl h-11 border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="open">Pendentes</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="resolved">Finalizados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(val: any) => setPriorityFilter(val)}>
              <SelectTrigger className="w-full rounded-2xl h-11 border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="todos">Todas Prioridades</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 bg-slate-50/50 border border-slate-100 rounded-2xl px-3 h-11">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Início:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50/50 border border-slate-100 rounded-2xl px-3 h-11">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fim:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[10px] font-bold text-slate-600 outline-none w-full"
              />
            </div>

            {(searchQuery || statusFilter !== 'todos' || priorityFilter !== 'todos' || filter !== 'todos' || startDate || endDate) && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('todos');
                  setPriorityFilter('todos');
                  setFilter('todos');
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-11 w-11 p-0 rounded-2xl hover:bg-slate-100 text-slate-400 transition-all active:scale-90 col-span-2 justify-self-center lg:col-span-1"
                title="Limpar Filtros"
              >
                <X className="w-5 h-5 mr-2 lg:mr-0" />
                <span className="lg:hidden text-[10px] font-bold uppercase">Limpar Filtros</span>
              </Button>
            )}
          </div>
        </div>

        {/* Cabeçalho da Lista (Apenas Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-3 bg-slate-50 rounded-2xl mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
          <div className="col-span-2 flex items-center gap-2">Abertura</div>
          <div className="col-span-4 flex items-center gap-2">Manutenção / Local</div>
          <div className="col-span-2 flex items-center gap-2 text-center justify-center">Criticidade</div>
          <div className="col-span-2 flex items-center gap-2 text-center justify-center">Status</div>
          <div className="col-span-2 text-right">Ações Operacionais</div>
        </div>

        <div className="space-y-3">
          {tickets.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Nenhuma manutenção registrada</p>
            </div>
          )}

          {tickets
            .filter(ticket => {
              // Quick Filter Cards Logic
              if (filter !== 'todos') {
                if (filter === 'abertos' && ticket.status === 'resolved') return false;
                if (filter === 'baixo' && (ticket.priority !== 'low' || ticket.status === 'resolved')) return false;
                if (filter === 'medio' && (ticket.priority !== 'medium' || ticket.status === 'resolved')) return false;
                if (filter === 'alto' && (ticket.priority !== 'high' || ticket.status === 'resolved')) return false;
                if (filter === 'resolvidos' && ticket.status !== 'resolved') return false;
              }

              // Search Query Logic
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchLocation = ticket.location?.toLowerCase().includes(query);
                const matchDesc = ticket.description?.toLowerCase().includes(query);
                if (!matchLocation && !matchDesc) return false;
              }

              // Status Filter Logic
              if (statusFilter !== 'todos') {
                const sMap: any = { 'aberto': 'open', 'em_andamento': 'in_progress', 'resolvido': 'resolved' };
                if (ticket.status !== sMap[statusFilter]) return false;
              }

              // Priority Filter Logic
              if (priorityFilter !== 'todos') {
                const pMap: any = { 'baixa': 'low', 'media': 'medium', 'alta': 'high' };
                if (ticket.priority !== pMap[priorityFilter]) return false;
              }

              // Date Range Filter Logic
              if (startDate || endDate) {
                // If filtering by date, tickets without a date should be hidden 
                // UNLESS they don't have a date because they were just created (optimistic update)
                if (!ticket.createdAt) return true; 

                let tDate: Date | null = null;
                try {
                  if (typeof ticket.createdAt.toDate === 'function') {
                    tDate = ticket.createdAt.toDate();
                  } else if (ticket.createdAt.seconds) {
                    tDate = new Date(ticket.createdAt.seconds * 1000);
                  } else if (ticket.createdAt instanceof Date) {
                    tDate = ticket.createdAt;
                  }
                } catch (e) {
                  console.error("Error parsing date", e);
                }

                if (tDate) {
                  // Normalize ticket date to midnight local time for day-by-day comparison
                  const ticketMidnight = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate()).getTime();

                  if (startDate) {
                    const [y, m, d] = startDate.split('-').map(Number);
                    const startMidnight = new Date(y, m - 1, d).getTime();
                    if (ticketMidnight < startMidnight) return false;
                  }

                  if (endDate) {
                    const [y, m, d] = endDate.split('-').map(Number);
                    const endMidnight = new Date(y, m - 1, d).getTime();
                    if (ticketMidnight > endMidnight) return false;
                  }
                }
              }

              return true;
            })
            .map((ticket) => (
            <div 
              key={ticket.id} 
              onClick={() => openView(ticket)}
              className="flex flex-col md:grid md:grid-cols-12 gap-4 items-stretch md:items-center bg-white p-5 md:px-8 md:py-5 rounded-[2rem] border border-slate-100 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-900/5 transition-all cursor-pointer group relative overflow-hidden"
            >
              {/* Indicador lateral de prioridade */}
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5 md:w-2",
                ticket.priority === 'low' ? 'bg-emerald-500' :
                ticket.priority === 'medium' ? 'bg-amber-500' :
                ticket.priority === 'high' ? 'bg-red-500' :
                'bg-slate-200'
              )} />

              {/* Mobile: Top Row (Status + Date) */}
              <div className="flex md:hidden justify-between items-center mb-1">
                 <Badge className={cn(
                  "rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-wider border select-none shadow-sm",
                  ticket.status === 'open' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                  ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                  'bg-emerald-500 text-white border-emerald-600'
                )}>
                  {ticket.status === 'open' ? 'Pendente' : 
                   ticket.status === 'in_progress' ? 'Em Andamento' : 'Finalizado'}
                </Badge>
                <span className="text-[10px] font-bold text-slate-400">
                  {ticket.createdAt?.seconds ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '--/--'}
                </span>
              </div>

              {/* Data de Abertura (Desktop) */}
              <div className="hidden md:flex col-span-2 items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-amber-50 transition-colors">
                  <Clock className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">
                    {ticket.createdAt?.seconds ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : '--/--/----'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">
                    {ticket.createdAt?.seconds ? new Date(ticket.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </span>
                </div>
              </div>

              {/* Nome / Local */}
              <div className="md:col-span-4 flex flex-col gap-1">
                <div className="flex items-center justify-between md:justify-start gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">{ticket.location}</span>
                  </div>
                  <Badge className={cn(
                    "md:hidden rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border",
                    ticket.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    ticket.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    ticket.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  )}>
                    {priorityLabels[ticket.priority || ''] || 'Normal'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 md:line-clamp-1 font-medium italic">"{ticket.description}"</p>
                {ticket.isSafetyRisk && (
                  <span className="text-[8px] font-black text-red-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" /> Risco de Segurança
                  </span>
                )}
              </div>

              {/* Criticidade (Desktop) */}
              <div className="hidden md:flex col-span-2 justify-center">
                <Badge className={cn(
                  "rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-wider border text-center min-w-[80px] flex justify-center",
                  ticket.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  ticket.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  ticket.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' :
                  'bg-slate-50 text-slate-600 border-slate-100'
                )}>
                  {priorityLabels[ticket.priority || ''] || 'Normal'}
                </Badge>
              </div>

              {/* Status (Desktop) */}
              <div className="hidden md:flex col-span-2 justify-center">
                <Badge className={cn(
                  "rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-wider border min-w-[100px] flex justify-center select-none shadow-sm",
                  ticket.status === 'open' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                  ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                  'bg-emerald-500 text-white border-emerald-600'
                )}>
                  {ticket.status === 'open' ? 'Pendente' : 
                   ticket.status === 'in_progress' ? 'Em Andamento' : 'Finalizado'}
                </Badge>
              </div>

              {/* Ações */}
              <div className="md:col-span-2 flex justify-end items-center gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-50" onClick={(e) => e.stopPropagation()}>
                {ticket.status !== 'resolved' && (
                   <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => ticket.status === 'open' ? updateStatus(ticket.id, 'in_progress') : openResolveDialog(ticket)}
                    className={cn(
                      "h-9 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                      ticket.status === 'open' ? "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                    )}
                  >
                    {ticket.status === 'open' ? 'Atender' : 'Baixar'}
                  </Button>
                )}
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => openEdit(ticket)}
                    className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>

                  <Dialog open={deleteConfirmId === ticket.id} onOpenChange={(open) => setDeleteConfirmId(open ? ticket.id : null)}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] max-w-sm p-8 border-none shadow-2xl">
                      <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Remover Registro?</DialogTitle>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Esta ação é permanente e removerá todos os dados desta manutenção do sistema.</p>
                      </DialogHeader>
                      <DialogFooter className="flex gap-3">
                        <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded-xl font-bold uppercase tracking-widest text-[9px] h-12">Cancelar</Button>
                        <Button variant="destructive" onClick={() => deleteTicket(ticket.id)} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 font-bold uppercase tracking-widest text-[9px] h-12 shadow-lg shadow-red-200">Confirmar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white/50 backdrop-blur-sm p-8 text-center text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Gestor CD-GEN • Manutenções</p>
      </footer>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2rem] border-none shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader className="mb-4 sm:mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Editar Manutenção</DialogTitle>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Atualize os detalhes da solicitação.</p>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-amber-500" />
                  Local
                </Label>
                <Input 
                  placeholder="Ex: Docas, Prateleira B12..."
                  value={editForm.location}
                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                  className="rounded-xl h-11 border-slate-200 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  Criticidade
                </Label>
                  <Select 
                    value={editForm.priority} 
                    onValueChange={(val: any) => setEditForm({...editForm, priority: val})}
                  >
                    <SelectTrigger className="rounded-xl h-11 border-slate-200">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-red-500" />
                Risco de Segurança?
              </Label>
                <Select 
                  value={editForm.isSafetyRisk ? 'sim' : 'nao'} 
                  onValueChange={(val: any) => setEditForm({...editForm, isSafetyRisk: val === 'sim'})}
                >
                  <SelectTrigger className="rounded-xl h-11 border-slate-200">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim, envolve risco</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ClipboardList className="w-3 h-3 text-amber-500" />
                Descrição do Problema
              </Label>
              <textarea 
                placeholder="Descreva o que precisa de conserto..."
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                className="w-full min-h-[120px] rounded-xl p-4 bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Resolução / Ações Tomadas
              </Label>
              <textarea 
                placeholder="Descreva o que foi feito para resolver o problema..."
                value={editForm.resolution}
                onChange={(e) => setEditForm({...editForm, resolution: e.target.value})}
                className="w-full min-h-[100px] rounded-xl p-4 bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Camera className="w-3 h-3 text-amber-500" />
                Evidências Visuais (Fotos)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {editForm.photos.map((photo, index) => (
                  <div key={index} className="relative aspect-video rounded-xl overflow-hidden shadow-inner group">
                    <img src={photo} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removePhoto(index, true)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div 
                  onClick={() => document.getElementById('edit-photo-upload')?.click()}
                  className="relative cursor-pointer overflow-hidden border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 transition-all hover:border-amber-500/50 hover:bg-amber-50/30 flex flex-col items-center justify-center aspect-video"
                >
                  <input 
                    id="edit-photo-upload"
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={handleEditImageChange}
                    className="hidden"
                  />
                  <Camera className="w-6 h-6 mb-1 text-slate-300" />
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Anexar</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <DialogClose asChild>
              <Button variant="ghost" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 flex-1">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={handleEditTicket}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 font-bold uppercase tracking-widest text-[10px] h-12 flex-1"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewing} onOpenChange={setIsViewing}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2rem] border-none shadow-2xl p-0 max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {selectedTicket && (
            <div className="flex flex-col overflow-y-auto">
              <div className={cn(
                "h-2 w-full flex-shrink-0",
                selectedTicket.priority === 'low' ? 'bg-emerald-500' :
                selectedTicket.priority === 'medium' ? 'bg-amber-500' :
                selectedTicket.priority === 'high' ? 'bg-red-500' :
                'bg-slate-200'
              )} />
              
              <div className="p-6 sm:p-8">
                <DialogHeader className="mb-6">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge className={cn(
                      "rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                      selectedTicket.status === 'open' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      selectedTicket.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-200'
                    )}>
                      {selectedTicket.status === 'open' ? 'Pendente' : 
                       selectedTicket.status === 'in_progress' ? 'Em Andamento' : 'Resolvido'}
                    </Badge>
                    <Badge className={cn(
                      "rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                      selectedTicket.priority === 'low' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      selectedTicket.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      selectedTicket.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {priorityLabels[selectedTicket.priority || ''] || 'Indefinida'}
                    </Badge>
                  </div>
                  <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-amber-500" />
                    {selectedTicket.location}
                  </DialogTitle>
                  <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Relatado por <span className="text-slate-900 font-bold">{selectedTicket.reportedByName}</span> em {selectedTicket.createdAt?.seconds ? new Date(selectedTicket.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Processando...'}
                  </p>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList className="w-3 h-3 text-amber-500" />
                        Descrição Completa
                      </Label>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                          {selectedTicket.description}
                        </p>
                      </div>
                    </div>

                    {selectedTicket.resolution && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolução Registrada
                        </Label>
                        <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 shadow-inner">
                          <p className="text-sm text-emerald-700 leading-relaxed font-bold italic">
                            "{selectedTicket.resolution}"
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedTicket.isSafetyRisk && (
                      <div className="flex items-center gap-3 p-4 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-200">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">Atenção: Este chamado envolve risco de segurança!</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Camera className="w-3 h-3 text-amber-500" />
                      Evidências Visuais ({selectedTicket.photoUrls?.length || 0})
                    </Label>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedTicket.photoUrls && selectedTicket.photoUrls.length > 0 ? (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {selectedTicket.photoUrls.map((url, idx) => (
                            <div key={idx} className="aspect-video w-full rounded-[2rem] overflow-hidden border-2 border-white shadow-xl">
                              <img 
                                src={url} 
                                alt={`Evidência ${idx + 1}`} 
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                                onClick={() => openLightbox(idx)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="aspect-square w-full rounded-[2rem] bg-slate-100 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 opacity-50">
                          <Camera className="w-12 h-12 text-slate-300 mb-2" />
                          <p className="text-[10px] font-bold uppercase text-slate-400">Nenhuma foto anexada</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-10 pt-6 border-t border-slate-100">
                  <Button 
                    variant="ghost" 
                    onClick={() => setIsViewing(false)}
                    className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 px-8"
                  >
                    Fechar Detalhes
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsViewing(false);
                      openEdit(selectedTicket);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 font-bold uppercase tracking-widest text-[10px] h-12 px-8"
                  >
                    Editar Registro
                  </Button>
                </DialogFooter>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={isResolving} onOpenChange={setIsResolving}>
        <DialogContent className="rounded-[2rem] sm:rounded-[2rem] border-none shadow-2xl p-6 sm:p-8 max-w-md">
          <DialogHeader className="mb-4 sm:mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              Finalizar Manutenção
            </DialogTitle>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Descreva brevemente o que foi feito para resolver este problema.</p>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Resolução / Ações Tomadas
              </Label>
              <textarea 
                placeholder="Ex: Nome das peças trocadas, ajuste efetuado, etc..."
                value={resolutionInput}
                onChange={(e) => setResolutionInput(e.target.value)}
                className="w-full min-h-[150px] rounded-xl p-4 bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 font-medium"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsResolving(false);
                setResolvingTicket(null);
                setResolutionInput('');
              }}
              className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 flex-1"
            >
              Voltar
            </Button>
            <Button 
              onClick={() => resolvingTicket && updateStatus(resolvingTicket.id, 'resolved', resolutionInput)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 font-bold uppercase tracking-widest text-[10px] h-12 flex-1"
            >
              Confirmar Resolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Lightbox / Image Viewer */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] bg-black/95 border-none p-0 flex flex-col items-center justify-center overflow-hidden rounded-[2rem]">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <Button 
              variant="ghost" 
              className="absolute top-4 right-4 text-white hover:bg-white/10 z-50 rounded-full h-10 w-10 p-0"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="w-6 h-6" />
            </Button>

            {lightboxImages.length > 1 && (
              <>
                <Button 
                  variant="ghost" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full h-12 w-12 p-0 bg-black/20 backdrop-blur-sm"
                  onClick={prevImage}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button 
                  variant="ghost" 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-50 rounded-full h-12 w-12 p-0 bg-black/20 backdrop-blur-sm"
                  onClick={nextImage}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}

            <img 
              src={lightboxImages[currentImageIndex]} 
              alt="Visualização ampliada" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <p className="text-white text-xs font-black uppercase tracking-[0.2em]">
                Foto {currentImageIndex + 1} de {lightboxImages.length}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
