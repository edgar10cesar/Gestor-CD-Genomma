import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  doc, 
  getDocFromServer,
  serverTimestamp, 
  orderBy,
  runTransaction,
  limit
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Settings,
  Plus, 
  Package, 
  AlertTriangle, 
  History, 
  CheckCircle2, 
  LogOut,
  Search,
  ShoppingCart,
  MinusCircle,
  BarChart3,
  Mail,
  Clock,
  Shield,
  Users,
  Trash2,
  AlertCircle,
  Copy,
  Pencil
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { db, auth, signIn, signOut, handleFirestoreError, OperationType, signInWithEmail, registerWithEmail, resetPassword } from './lib/firebase';
import { Material, InventoryLog } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NFDashboard from './components/NFDashboard';

const ADMIN_EMAILS = ['cesar.802012@gmail.com'];
const SHARED_APP_URL = 'https://ais-pre-2gfjzry7x7coyi5ajllvvx-150633624590.us-east5.run.app';

export default function App() {
  console.log("App component rendering...");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [settings, setSettings] = useState<{ 
    purchasingManagerEmail?: string,
    inventoryResponsibleEmails?: string[],
    lastAutoInventoryEmailSent?: string 
  }>({});
  const [lastAlerted, setLastAlerted] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [currentApp, setCurrentApp] = useState<'inventory' | 'nf'>('inventory');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  // Check if current user is admin
  const userRecord = allUsers.find(u => u.email === user?.email);
  const isAdmin = user?.email && (ADMIN_EMAILS.includes(user.email) || userRecord?.role === 'admin');
  const isSuperAdmin = user?.email === 'cesar.802012@gmail.com';

  // New Material Form State
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');

  // Unified User Management State
  const [targetUserEmail, setTargetUserEmail] = useState('');
  const [targetUserIsInventory, setTargetUserIsInventory] = useState(false);
  const [targetUserIsPurchasing, setTargetUserIsPurchasing] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProcessingUser, setIsProcessingUser] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showInventoryAlert, setShowInventoryAlert] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authPassConfirm, setAuthPassConfirm] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category: 'Embalagem',
    unit: 'Unidade',
    minStock: 10,
    initialStock: 0
  });

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockMaterials = materials.filter(m => m.currentStock <= m.minStock);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      // Monday is 1, check if it's Monday between 10:00 and 11:59
      const isMonday10h = now.getDay() === 1 && now.getHours() === 10;
      setShowInventoryAlert(isMonday10h);
    };

    if (!dataLoading && user) {
      checkTime();
      const interval = setInterval(checkTime, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [dataLoading, user]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Core Data Listeners - Forced real-time sync with no cache
    const materialsQuery = query(collection(db, 'materials'), orderBy('name'));
    const unsubscribeMaterials = onSnapshot(materialsQuery, { includeMetadataChanges: true }, (snapshot) => {
      const matList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      console.log("Materials updated from Firestore:", matList.length, "items");
      setMaterials(matList);
      setDataLoading(false);
      
      // Auto-alert check
      matList.forEach(m => {
        if (m.currentStock <= m.minStock && (!lastAlerted[m.id] || Date.now() - lastAlerted[m.id] > 3600000)) {
          toast.error(`ESTOQUE BAIXO: ${m.name} está com apenas ${m.currentStock} ${m.unit}`, {
            description: `O estoque mínimo é ${m.minStock}. Favor providenciar reposição.`,
            duration: 8000,
          });
          setLastAlerted(prev => ({ ...prev, [m.id]: Date.now() }));
        }
      });
    }, (error) => {
      setDataLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'materials');
    });

    const logsQuery = query(collection(db, 'inventory_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog)).slice(0, 50);
      setLogs(logList);
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, 'inventory_logs');
    });

    const settingsDoc = doc(db, 'settings', 'config');
    const unsubscribeSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings(data);
        setManagerEmail(data.purchasingManagerEmail || '');
      }
    });

    const usersQuery = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeMaterials();
      unsubscribeLogs();
      unsubscribeSettings();
      unsubscribeUsers();
    };
  }, [user, lastAlerted]);

    // Higher priority invite check
  useEffect(() => {
    if (loading) return;

    const urlParams = new URLSearchParams(window.location.search);
    const inviteId = urlParams.get('invite');
    
    if (inviteId) {
      const checkInvite = async () => {
        try {
          const userRef = doc(db, 'users', inviteId);
          const snap = await getDocFromServer(userRef);
          
          if (snap.exists()) {
            const userData = snap.data();
            if (userData.status === 'invited') {
              setCurrentInvite({ id: inviteId, ...userData });
              setAuthEmail(userData.email || '');
              
              // Force register mode for invitations to ensure name/pass-confirm fields show
              setAuthMode('register');
              setAuthError(""); 
              
              console.log("Invite valid, forcing register mode for:", userData.email);
            } else if (userData.status === 'active' && !user) {
              toast.info("Este convite já foi ativado. Por favor, faça login.");
            }
          }
        } catch (error) {
          console.error("Error verifying invite:", error);
        }
      };
      checkInvite();
    }
  }, [loading, window.location.search]); // Depend on URL search to re-trigger if needed

  // Centralized invite fulfillment (Auto-claim)
  useEffect(() => {
    if (!user || dataLoading || allUsers.length === 0) return;

    // Check if the currently logged-in user has an "invited" record in the system
    const invitedRecord = allUsers.find(u => 
      u.status === 'invited' && 
      u.email?.toLowerCase() === user.email?.toLowerCase()
    );

    if (invitedRecord) {
      const fulfillInvite = async () => {
        try {
          console.log("Auto-fulfilling invite for:", user.email);
          const userRef = doc(db, 'users', invitedRecord.id);
          await updateDoc(userRef, {
            status: 'active',
            joinedAt: serverTimestamp(),
            uid: user.uid,
            displayName: user.displayName || invitedRecord.displayName || ''
          });
          toast.success("Seu acesso foi vinculado e ativado com sucesso!");
          
          // Clear invite param from URL if present
          if (window.location.search.includes('invite=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setCurrentInvite(null);
        } catch (error) {
          console.error("Error auto-fulfilling invite:", error);
        }
      };
      fulfillInvite();
    }
  }, [user, allUsers, dataLoading]);

  const handleUpdateSettings = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'config');
      await setDoc(settingsRef, {
        purchasingManagerEmail: managerEmail,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsSettingsOpen(false);
      toast.success("Configurações atualizadas!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/config');
    }
  };

  const handleManageUser = async () => {
    if (!targetUserEmail) return;
    setIsProcessingUser(true);
    try {
      // Find if user already exists in listing
      const existingUser = allUsers.find(u => u.email === targetUserEmail);
      
      if (existingUser) {
        // Update existing
        await updateDoc(doc(db, 'users', existingUser.id), {
          isInventoryResponsible: targetUserIsInventory,
          isPurchasingManager: targetUserIsPurchasing,
          updatedAt: serverTimestamp()
        });
        toast.success("Acessos do usuário atualizados!");
      } else {
        // Create new (Invitation style)
        const userRef = await addDoc(collection(db, 'users'), {
          email: targetUserEmail,
          isInventoryResponsible: targetUserIsInventory,
          isPurchasingManager: targetUserIsPurchasing,
          role: 'user',
          status: 'invited',
          invitedAt: serverTimestamp(),
          invitedBy: user?.email
        });

        // Send Link
        const inviteUrl = window.location.origin + "?invite=" + userRef.id;
        const htmlBody = `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 25px; border-radius: 15px;">
            <h2 style="color: #059669; margin-bottom: 20px;">Convite de Acesso Genomma</h2>
            <p>Olá,</p>
            <p>Você foi convidado para acessar o <strong>Controle de insumos - CD Extrema/MG</strong>.</p>
            <p>Suas permissões configuradas: 
              ${targetUserIsInventory ? '• <strong>Responsável pelo Inventário</strong><br/>' : ''}
              ${targetUserIsPurchasing ? '• <strong>Responsável por Compras</strong><br/>' : ''}
              ${!targetUserIsInventory && !targetUserIsPurchasing ? '• <strong>Colaborador Padrão</strong>' : ''}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
                Clique aqui para Definir sua Senha
              </a>
            </div>
            <p style="font-size: 11px; color: #999; text-align: center;">Genomma Logística • CD Extrema/MG</p>
          </div>
        `;
        await handleRawEmailSend(targetUserEmail, "Acesso ao Sistema - Genomma Logística", htmlBody);
        toast.success("Convite enviado com sucesso!");
      }
      
      setTargetUserEmail('');
      setTargetUserIsInventory(false);
      setTargetUserIsPurchasing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsProcessingUser(false);
    }
  };

  const handleRawEmailSend = async (to: string, subject: string, html: string) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html,
          text: "Você recebeu um convite de acesso para o sistema Genomma Logística."
        })
      });

      if (response.ok) {
        toast.success(`E-mail de convite enviado para ${to}`);
      } else {
        const errorData = await response.json();
        const msg = errorData.error || "Erro desconhecido no servidor";
        console.error("Failed to send invitation email:", errorData);
        toast.error(`Falha no envio: ${msg}`);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Erro de conexão ao enviar e-mail. Use a opção de copiar link.");
    }
  };

  const handleRemoveUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success("Usuário removido do sistema.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materials', id));
      toast.success("Material excluído permanentemente.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `materials/${id}`);
    }
  };

  const handleGeneratePurchaseList = async (isTest = false, isAutomatic = false) => {
    // Collect all purchasing managers
    const managers = allUsers.filter(u => u.isPurchasingManager && u.email).map(u => u.email);
    
    // Add the legacy global email if it exists and not already in list
    if (settings.purchasingManagerEmail && !managers.includes(settings.purchasingManagerEmail)) {
      managers.push(settings.purchasingManagerEmail);
    }

    if (managers.length === 0) {
      if (!isAutomatic) {
        toast.error("Nenhum responsável por compras cadastrado.");
        setIsSettingsOpen(true);
      }
      return;
    }

    if (!isTest && lowStockMaterials.length === 0) {
      if (!isAutomatic) toast.info("Não há itens abaixo do estoque mínimo.");
      return;
    }

    setSendingEmail(true);

    const itemsText = isTest 
      ? "<li>ITEM TESTE: 5 UN (Mínimo: 10)</li>" 
      : lowStockMaterials.map(m => `<li>${m.name}: Atual ${m.currentStock} ${m.unit} (Mínimo: ${m.minStock})</li>`).join('');

    const htmlBody = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #059669;">Genomma Logística - ${isAutomatic ? 'Relatório Automático de Estoque' : 'Alerta de Reposição'}</h2>
        <p>Olá,</p>
        <p>${isAutomatic ? 'Este é o relatório semanal automático de inventário da Genomma Logística.' : 'Segue a lista de materiais para reposição urgente na Genomma Logística:'}</p>
        <ul style="background: #f9fafb; padding: 20px; border-radius: 8px; list-style-type: none; margin: 20px 0;">
          ${itemsText}
        </ul>
        <p>Por favor, providenciar a compra dos itens listados conforme a necessidade.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">
          Atenciosamente,<br />
          <strong>${isAutomatic ? 'Auditoria Automática' : (user?.displayName || 'Sistema de Logística')}</strong><br />
          Genomma Logística - CD Extrema/MG
        </p>
      </div>
    `;

    const subject = isTest 
      ? `[TESTE] Alerta de Estoque - Genomma Logística`
      : isAutomatic 
        ? `[INVENTÁRIO] Relatório de Reposição Semanal - ${new Date().toLocaleDateString()}`
        : `URGENTE: Lista de Compras - Genomma Logística - ${new Date().toLocaleDateString()}`;

    try {
      // Loop through all managers to send individual emails
      // In a real production system we might send a single email with CC, 
      // but for reliability in the preview environment, individual calls are safer.
      const sendPromises = managers.map(destination => 
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: destination,
            subject: subject,
            html: htmlBody,
            text: `Olá, segue o relatório de inventário: ${isTest ? "ITEM TESTE" : lowStockMaterials.map(m => m.name).join(", ")}`
          })
        })
      );

      const results = await Promise.all(sendPromises);
      const allOk = results.every(res => res.ok);

      if (allOk) {
        if (isAutomatic) {
          toast.success("Relatório de inventário enviado aos responsáveis.");
        } else {
          toast.success(isTest ? "E-mail de teste enviado!" : `Solicitação enviada para ${managers.length} responsáveis.`);
        }
      } else {
        toast.warning("Houve erro ao enviar para alguns destinatários. Verifique o log.");
      }
    } catch (e: any) {
      console.error("Email error:", e);
      if (!isAutomatic) {
        toast.error(`Falha no envio automático.`);
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendInventoryReminder = async (email?: string) => {
    // If no email provided, it's a manual trigger that shouldn't really happen without context anymore
    // but we can fallback to the first inventory responsible
    const destination = email || allUsers.find(u => u.isInventoryResponsible)?.email || '';
    if (!destination) return;

    const subject = `[GENOMMA] Lembrete de Inventário Semanal - CD Extrema/MG`;
    const htmlBody = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #059669; text-align: center;">Genomma Logística</h2>
        <div style="background: #059669; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="margin: 0; font-size: 20px;">Lembrete de Inventário</h3>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Segunda-feira | 10:00h</p>
        </div>
        <p>Olá,</p>
        <p>Este é um aviso automático para informar que está na hora de iniciar o <strong>Inventário Semanal de Insumos</strong> no CD de Extrema/MG.</p>
        <p>Por favor, realize a contagem física de todos os itens e atualize o sistema para manter a acuracidade do nosso estoque.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${window.location.origin}" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">Executar Inventário Agora</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">Importante: Após a contagem, o gerente de compras receberá automaticamente a lista de reposição atualizada.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          Sistema de Gestão Genomma Logística - Automação Operacional
        </p>
      </div>
    `;

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destination,
          subject: subject,
          html: htmlBody,
          text: `Olá, está na hora de realizar o Inventário Semanal (Segunda-feira às 10h). Acesse o sistema para conferir os estoques: ${window.location.origin}`
        })
      });
      console.log("Inventory reminder sent successfully");
    } catch (e) {
      console.error("Failed to send inventory reminder:", e);
    }
  };

  const handleAddMaterial = async () => {
    try {
      await addDoc(collection(db, 'materials'), {
        name: newMaterial.name,
        category: newMaterial.category,
        unit: newMaterial.unit,
        currentStock: Number(newMaterial.initialStock),
        minStock: Number(newMaterial.minStock),
        lastInventoryAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewMaterial({
        name: '',
        category: 'Embalagem',
        unit: 'Unidade',
        minStock: 10,
        initialStock: 0
      });
      toast.success("Material adicionado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'materials');
    }
  };

  const handleEditMaterial = async () => {
    if (!editingMaterial) return;
    try {
      const materialRef = doc(db, 'materials', editingMaterial.id);
      await updateDoc(materialRef, {
        name: editingMaterial.name,
        unit: editingMaterial.unit,
        minStock: Number(editingMaterial.minStock),
        category: editingMaterial.category
      });
      setIsEditModalOpen(false);
      setEditingMaterial(null);
      toast.success("Material atualizado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'materials');
    }
  };

  const updateStock = async (material: Material, type: 'purchase' | 'consumption', amount: number) => {
    try {
      const materialRef = doc(db, 'materials', material.id);
      const newStock = type === 'purchase' ? material.currentStock + amount : material.currentStock - amount;
      
      if (newStock < 0) {
        toast.error("Estoque não pode ser negativo");
        return;
      }

      await runTransaction(db, async (transaction) => {
        transaction.update(materialRef, { currentStock: newStock });
        const logRef = doc(collection(db, 'inventory_logs'));
        transaction.set(logRef, {
          materialId: material.id,
          type: type,
          quantity: amount,
          userId: user?.uid,
          timestamp: serverTimestamp()
        });
      });

      toast.success(`${type === 'purchase' ? 'Entrada' : 'Saída'} realizada!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transaction:inventory/update');
    }
  };

  const setManualStock = async (material: Material, newCount: number) => {
    try {
      if (newCount < 0) {
        toast.error("Estoque não pode ser negativo");
        return;
      }
      const materialRef = doc(db, 'materials', material.id);
      const difference = newCount - material.currentStock;
      
      await runTransaction(db, async (transaction) => {
        transaction.update(materialRef, { 
          currentStock: newCount,
          lastInventoryAt: serverTimestamp()
        });
        const logRef = doc(collection(db, 'inventory_logs'));
        transaction.set(logRef, {
          materialId: material.id,
          type: 'inventory_check',
          quantity: newCount,
          difference: difference,
          userId: user?.uid,
          timestamp: serverTimestamp()
        });
      });
      toast.success("Contagem atualizada!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'manual_count');
    }
  };

  const handleResetPassword = async () => {
    if (!authEmail) {
      setAuthError("Digite seu e-mail primeiro para resetar a senha.");
      return;
    }
    try {
      await resetPassword(authEmail);
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setAuthError("");
    } catch (err: any) {
      console.error("Reset error:", err);
      toast.error("Erro ao enviar e-mail de recuperação. Verifique o e-mail digitado.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmail(authEmail, authPass);
        toast.success("Bem-vindo!");
      } else {
        if (!authName) {
          setAuthError("Nome é obrigatório para cadastro");
          return;
        }
        if (authPass.length < 6) {
          setAuthError("A senha deve ter pelo menos 6 caracteres");
          return;
        }
        if (authPass !== authPassConfirm) {
          setAuthError("As senhas não coincidem");
          return;
        }
        
        await registerWithEmail(authEmail, authPass, authName);
        // The centralized useEffect handles invite fulfillment once 'user' state updates
        toast.success("Conta criada com sucesso!");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = "Erro ao autenticar. Verifique seus dados.";
      if (err.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
      if (err.code === 'auth/wrong-password') msg = "Senha incorreta.";
      if (err.code === 'auth/email-already-in-use') {
        msg = currentInvite 
          ? "Este e-mail já possui uma conta (provavelmente do Google). Por favor, clique no botão 'Google Account' abaixo ou mude para 'Login' se já souber sua senha." 
          : "Este e-mail já está vinculado a outra conta.";
      }
      if (err.code === 'auth/weak-password') msg = "Senha deve ter pelo menos 6 caracteres.";
      setAuthError(msg);
      toast.error(msg);
    }
  };

  if (loading) {
    console.log("App state: still loading auth...");
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-600/30 animate-bounce">
            <Package className="w-10 h-10 text-white" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-black text-slate-900 uppercase tracking-widest">Genomma Logística</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Autenticando...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || (currentInvite && (!user || user.email?.toLowerCase() !== currentInvite.email?.toLowerCase()))) {
    console.log("App state: showing auth screen");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB] p-4 font-sans">
        <div className="w-full max-w-md p-10 bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-600/20 mb-6 transform -rotate-3">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
              Genomma <span className="text-emerald-600">Logística</span>
            </h1>
            <div className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-4">
              - CD Extrema / MG -
            </div>
            {currentInvite ? (
              <div className="mt-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-[10px] text-[10px] font-bold uppercase tracking-wider border border-emerald-100 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Bem-vindo! Finalize seu cadastro
              </div>
            ) : (
              <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">
                Gestão Profissional de Insumos
              </p>
            )}
          </div>

          {user && currentInvite && user.email?.toLowerCase() !== currentInvite.email?.toLowerCase() && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4" />
                Usuário alternativo detectado
              </div>
              <p>Você está acessando um convite para <strong>{currentInvite.email}</strong>, mas já está logado como <strong>{user.email}</strong>.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 text-amber-900 border-amber-200 hover:bg-amber-100 h-8 rounded-lg text-[10px] items-center gap-1.5"
                onClick={() => {
                  signOut();
                  // No need to clear currentInvite here as it's needed for the register screen
                }}
              >
                <LogOut className="w-3 h-3" />
                Sair de {user.email} e aceitar convite
              </Button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {(authMode === 'register' || !!currentInvite) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</Label>
                <Input 
                  placeholder="Seu nome"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="rounded-xl h-12 border-slate-200 focus:ring-emerald-500"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</Label>
              <Input 
                type="email"
                placeholder="colaborador@logistica.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                disabled={!!currentInvite}
                className="rounded-xl h-12 border-slate-200 focus:ring-emerald-500 disabled:bg-slate-50 disabled:opacity-75"
              />
            </div>
            <div className="space-y-1.5 relative">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex justify-between items-center">
                {currentInvite ? "Crie sua Senha" : "Sua Senha"}
                {(authMode === 'register' || !!currentInvite) ? (
                  <span className="text-[9px] lowercase italic font-medium opacity-60">Mínimo 6 caracteres</span>
                ) : (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[9px] lowercase italic font-medium text-emerald-600 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </Label>
              <Input 
                type="password"
                placeholder="••••••••"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                className="rounded-xl h-12 border-slate-200 focus:ring-emerald-500"
              />
            </div>

            {(authMode === 'register' || !!currentInvite) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</Label>
                <Input 
                  type="password"
                  placeholder="Repita sua senha"
                  value={authPassConfirm}
                  onChange={(e) => setAuthPassConfirm(e.target.value)}
                  className="rounded-xl h-12 border-slate-200 focus:ring-emerald-500"
                />
              </div>
            )}

            {currentInvite && (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-[10px] text-emerald-700 leading-tight">
                <strong>Dica:</strong> Se você já usa este e-mail no <strong>Google/Gmail</strong>, você não precisa criar uma senha local. Basta clicar no botão <strong>"Google Account"</strong> mais abaixo para entrar instantaneamente e ativar seu convite.
              </div>
            )}

            {authError && <p className="text-xs text-red-500 font-medium ml-1">{authError}</p>}

            <Button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
            >
              {currentInvite ? 'Criar minha Conta e Acessar' : (authMode === 'login' ? 'Entrar no Sistema' : 'Finalizar Cadastro')}
            </Button>

            <div className="text-center mt-2">
              <button 
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError(""); // Clear errors when switching
                }}
                className="text-[10px] text-slate-400 hover:text-emerald-600 uppercase font-bold tracking-widest transition-colors"
              >
                {authMode === 'login' ? 'Não tem conta? Cadastrar-se' : 'Já tem uma conta? Faça login'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
            {!currentInvite && (
              <p className="text-[10px] text-slate-400 text-center italic">
                Acesso restrito. Solicite seu convite ao administrador.
              </p>
            )}
            
            {currentInvite && authMode === 'register' && (
              <button 
                onClick={() => setAuthMode('login')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Já tem uma conta? Faça login
              </button>
            )}
            
            <div className="flex flex-col items-center gap-2">
              <div className="h-px w-24 bg-slate-100"></div>
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Ou continue com</span>
            </div>

            <Button 
              onClick={signIn}
              variant="outline"
              className="w-full border-slate-200 rounded-xl h-12 text-slate-600 font-medium hover:bg-slate-50"
            >
              Google Account
            </Button>
          </div>
          
          {currentInvite && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Convite Validado</p>
                <p className="text-[10px] text-emerald-600">Complete o cadastro para acessar.</p>
              </div>
            </div>
          )}

          <p className="mt-8 text-[9px] text-center text-slate-400 uppercase tracking-widest font-bold">
            Uso Restrito • CD Extrema/MG
          </p>
        </div>
      </div>
    );
  }

  console.log("Main dashboard rendering...");
  return (
    <div className="min-h-screen bg-[#FBFCFD] text-slate-900 font-sans">
      <Toaster position="top-right" richColors closeButton />
      
      {/* Inventory Alert Banner */}
      {showInventoryAlert && (
        <div className="bg-emerald-600 text-white px-6 py-2 flex items-center justify-center gap-2 text-sm font-medium animate-pulse">
          <Clock className="w-4 h-4" />
          🕒 HORÁRIO DE INVENTÁRIO: Iniciar conferência semanal agora (Segunda-feira @ 10h).
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900">Genomma - <span className="font-medium text-slate-600">Controle de insumos</span> - <span className="text-slate-400 font-normal">CD Extrema/MG</span></h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
            <button 
              onClick={() => setCurrentApp('inventory')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${currentApp === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Estoque
            </button>
            <button 
              onClick={() => setCurrentApp('nf')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${currentApp === 'nf' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Notas Fiscais
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 pr-4 border-r border-slate-200">
             <div className="text-right">
              <p className="text-xs font-semibold text-slate-900">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 font-mono">{user.email}</p>
            </div>
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
          </div>
          
          {isSuperAdmin && (
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors flex items-center justify-center w-9 h-9">
                <Settings className="w-5 h-5" />
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] border-slate-200 shadow-2xl p-0 overflow-hidden">
                <div className="bg-emerald-600 p-8 text-white">
                  <Settings className="w-10 h-10 mb-4 opacity-80" />
                  <DialogTitle className="text-2xl font-bold">Configurações Avançadas</DialogTitle>
                  <p className="text-emerald-100 text-xs mt-1">Gerencie os parâmetros globais da Genomma Logística.</p>
                </div>
                <div className="p-8 space-y-6">
                  <div className="grid gap-3">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">E-mail do Responsável (Compras)</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                      <Input 
                        placeholder="financeiro@empresa.com" 
                        value={managerEmail} 
                        onChange={(e) => setManagerEmail(e.target.value)}
                        className="rounded-2xl h-14 pl-12 border-slate-200 focus:ring-emerald-500 text-slate-700 font-medium"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                      Este endereço receberá as solicitações de reposição quando você clicar em <span className="font-bold">"Gerar Lista de Compra"</span> no dashboard principal.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">Link de Acesso Oficial (Envie para a equipe)</Label>
                    <div className="flex gap-2">
                      <Input 
                        readOnly
                        value={window.location.origin}
                        className="rounded-xl bg-slate-50 border-slate-200 text-slate-500 text-[10px] h-10 font-mono"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          toast.success("Link oficial copiado!");
                        }}
                        className="rounded-xl shrink-0 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors h-10 w-10"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium px-1 flex items-center gap-1.5 leading-tight">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                      Para evitar falta de sincronização, certifique-se que todos usam este link acima.
                    </p>
                  </div>

                  <div className="grid gap-3 pt-4 border-t border-slate-100">
                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest px-1">Equipe e Acessos</Label>
                    <div className="space-y-4">
                      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <Input 
                          placeholder="E-mail do colaborador..." 
                          value={targetUserEmail} 
                          onChange={(e) => setTargetUserEmail(e.target.value)}
                          className="rounded-xl h-10 border-slate-200 text-xs"
                        />
                        <div className="flex items-center gap-4 px-1">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div onClick={() => setTargetUserIsInventory(!targetUserIsInventory)} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${targetUserIsInventory ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300 group-hover:border-emerald-400'}`}>
                              {targetUserIsInventory && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Resp. Inventário</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div onClick={() => setTargetUserIsPurchasing(!targetUserIsPurchasing)} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${targetUserIsPurchasing ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300 group-hover:border-emerald-400'}`}>
                              {targetUserIsPurchasing && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Resp. Compras</span>
                          </label>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={handleManageUser} 
                          disabled={isProcessingUser || !targetUserEmail}
                          className="w-full bg-slate-900 text-white rounded-xl h-10 font-bold"
                        >
                          {isProcessingUser ? "Processando..." : "Configurar / Convidar"}
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {allUsers.map(u => (
                          <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 group">
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs font-bold leading-tight ${u.status === 'invited' ? 'text-slate-400' : 'text-slate-700'}`}>{u.email}</span>
                              <div className="flex items-center gap-1.5">
                                {(u.role === 'admin' || ADMIN_EMAILS.includes(u.email)) && <Badge className="text-[8px] bg-indigo-50 text-indigo-600 border-none px-1.5 py-0">ADMIN</Badge>}
                                {u.isInventoryResponsible && <Badge className="text-[8px] bg-emerald-50 text-emerald-600 border-none px-1.5 py-0">RESP. INV</Badge>}
                                {u.isPurchasingManager && <Badge className="text-[8px] bg-amber-50 text-amber-600 border-none px-1.5 py-0">COMPRAS</Badge>}
                                {u.status === 'invited' && <Badge variant="outline" className="text-[8px] text-slate-400 border-slate-200 px-1.5 py-0 italic">PENDENTE</Badge>}
                                {u.status === 'active' && <Badge className="text-[8px] bg-blue-50 text-blue-600 border-none px-1.5 py-0 font-bold">ATIVO</Badge>}
                              </div>
                            </div>
                              <div className="flex items-center gap-1">
                                {u.status === 'invited' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                      const inviteUrl = SHARED_APP_URL + "?invite=" + u.id;
                                      navigator.clipboard.writeText(inviteUrl);
                                      toast.success("Link profissional copiado!");
                                    }}
                                    title="Copiar Link de Convite"
                                    className="w-8 h-8 rounded-full text-emerald-600 hover:bg-emerald-50"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRemoveUser(u.id)}
                                  className="w-8 h-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {managerEmail && (
                    <Button 
                      variant="ghost" 
                      disabled={sendingEmail}
                      onClick={() => handleGeneratePurchaseList(true)}
                      className="w-full text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl disabled:opacity-50"
                    >
                      <Mail className="w-3 h-3 mr-2" /> 
                      {sendingEmail ? "Enviando..." : "Enviar E-mail de Teste"}
                    </Button>
                  )}
                </div>
                <div className="p-8 pt-0 flex gap-3">
                  <Button variant="outline" onClick={() => setIsSettingsOpen(false)} className="flex-1 rounded-2xl h-12 border-slate-200 font-bold text-slate-500">
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateSettings} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 font-bold shadow-lg shadow-emerald-600/20">
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-0">
        {currentApp === 'inventory' ? (
          <div className="p-6 md:p-10 space-y-10 animate-in fade-in duration-500">
            {/* Top Summary Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard de Materiais</h2>
            <p className="text-slate-500 mt-1">Gerencie o fluxo de suprimentos e inventário semanal.</p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogTrigger className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 px-6 font-medium shadow-lg shadow-slate-900/10 transition-all active:scale-95 flex items-center justify-center">
                  <Plus className="mr-2 w-4 h-4" /> Adicionar Material
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-slate-200 shadow-2xl">
                  <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Novo Material</DialogTitle>
                </DialogHeader>
                <div className="grid gap-5 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Material</Label>
                    <Input id="name" value={newMaterial.name} onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})} className="rounded-xl border-slate-200 h-11 focus:ring-emerald-500" placeholder="Ex: Filme Stretch" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</Label>
                      <Select value={newMaterial.category} onValueChange={(v) => setNewMaterial({...newMaterial, category: v})}>
                        <SelectTrigger className="rounded-xl border-slate-200 h-11">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Embalagem">Embalagem</SelectItem>
                          <SelectItem value="Escritório">Escritório</SelectItem>
                          <SelectItem value="Limpeza">Limpeza</SelectItem>
                          <SelectItem value="Operação">Operação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="unit" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unidade</Label>
                      <Input id="unit" value={newMaterial.unit} onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})} placeholder="ex: Un, Cx" className="rounded-xl border-slate-200 h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="initial" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estoque Inicial</Label>
                      <Input id="initial" type="number" value={newMaterial.initialStock} onChange={(e) => setNewMaterial({...newMaterial, initialStock: Number(e.target.value)})} className="rounded-xl border-slate-200 h-11" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="min" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidade Mínima</Label>
                      <Input id="min" type="number" value={newMaterial.minStock} onChange={(e) => setNewMaterial({...newMaterial, minStock: Number(e.target.value)})} className="rounded-xl border-slate-200 h-11" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddMaterial} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold">Cadastrar Material</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Material Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogContent className="rounded-3xl border-slate-200 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Editar Material</DialogTitle>
                </DialogHeader>
                {editingMaterial && (
                  <div className="grid gap-5 py-4">
                    <div className="grid gap-2">
                      <Label className="text-xs font-bold uppercase text-slate-400">Nome do Material</Label>
                      <Input value={editingMaterial.name} onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})} className="rounded-xl h-12 border-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-400">Unidade</Label>
                        <Input value={editingMaterial.unit} onChange={e => setEditingMaterial({...editingMaterial, unit: e.target.value})} className="rounded-xl h-12 border-slate-200" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-400">Categoria</Label>
                        <Select value={editingMaterial.category} onValueChange={val => setEditingMaterial({...editingMaterial, category: val})}>
                          <SelectTrigger className="rounded-xl h-12 border-slate-200 text-slate-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200">
                            <SelectItem value="Embalagem">Embalagem</SelectItem>
                            <SelectItem value="Escritório">Escritório</SelectItem>
                            <SelectItem value="Limpeza">Limpeza</SelectItem>
                            <SelectItem value="Operação">Operação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-bold uppercase text-slate-400">Estoque Mínimo</Label>
                      <Input type="number" value={editingMaterial.minStock} onChange={e => setEditingMaterial({...editingMaterial, minStock: Number(e.target.value)})} className="rounded-xl h-12 border-slate-200" />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-600/20" onClick={handleEditMaterial}>Salvar Alterações</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-red-500/80 leading-tight">Quantidade de itens que precisam repor</CardDescription>
              <CardTitle className={`text-3xl font-bold tracking-tight ${lowStockMaterials.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {lowStockMaterials.length.toString().padStart(2, '0')}
              </CardTitle>
            </CardHeader>
            <div className="px-6 pb-4">
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${(lowStockMaterials.length / (materials.length || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </Card>
          


          <Card className="rounded-2xl border-emerald-100 shadow-sm overflow-hidden bg-emerald-50/50">
            <CardHeader className="pb-2">
              <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-emerald-600">Estoque Saudável</CardDescription>
              <CardTitle className="text-3xl font-bold tracking-tight text-emerald-700">
                {(materials.length - lowStockMaterials.length).toString().padStart(2, '0')}
              </CardTitle>
            </CardHeader>
            <div className="px-6 pb-4">
              <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${((materials.length - lowStockMaterials.length) / (materials.length || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Status Operacional</CardDescription>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <CardTitle className="text-xl font-bold tracking-tight text-slate-900 uppercase">Monitorando</CardTitle>
              </div>
            </CardHeader>
            <div className="px-6 pb-4">
              <p className="text-[10px] font-mono text-slate-400">Atualizado: {new Date().toLocaleTimeString()}</p>
            </div>
          </Card>
        </div>

        {/* Alerts Banner */}
        {lowStockMaterials.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
               <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-900">Alerta de Reposição Crítica</p>
              <p className="text-xs text-red-700 opacity-80">
                Os itens <span className="font-bold underline">{lowStockMaterials.map(m => m.name).join(', ')}</span> atingiram o nível de pedido.
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              disabled={sendingEmail}
              onClick={() => handleGeneratePurchaseList(false)}
              className="md:flex rounded-lg border-red-200 text-red-700 hover:bg-red-100 bg-white shadow-sm disabled:opacity-50"
            >
              <Mail className="w-3 h-3 mr-2" /> 
              {sendingEmail ? "Enviando..." : "Gerar Lista de Compra"}
            </Button>
          </div>
        )}

        {/* Tabbed Content */}
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-1 md:p-2 min-h-[600px] flex flex-col">
          <Tabs defaultValue="inventory" className="w-full flex-1 flex flex-col">
            <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100">
              <TabsList className="bg-slate-100/50 p-1 rounded-xl w-full md:w-auto self-start">
                <TabsTrigger 
                  value="inventory" 
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2 transition-all font-medium text-xs uppercase tracking-wider"
                >
                  <Package className="w-3.5 h-3.5 mr-2" /> Inventário
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2 transition-all font-medium text-xs uppercase tracking-wider"
                >
                  <History className="w-3.5 h-3.5 mr-2" /> Log de Auditoria
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Filtrar materiais..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 rounded-xl border-slate-200 bg-white h-10 text-sm"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] rounded-xl border-slate-200 h-10 text-xs font-semibold">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Embalagem">Embalagem</SelectItem>
                    <SelectItem value="Escritório">Escritório</SelectItem>
                    <SelectItem value="Limpeza">Limpeza</SelectItem>
                    <SelectItem value="Operação">Operação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="inventory" className="flex-1 p-0 focus-visible:ring-0">
              {dataLoading ? (
                <div className="py-20 flex flex-col items-center gap-4 text-slate-400">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Sincronizando com Banco de Dados...</p>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-slate-300">
                  <Search className="w-12 h-12 mb-4" />
                  <p className="font-medium">{search ? 'Nenhum material encontrado para esta busca' : 'O estoque está vazio. Adicione seu primeiro item!'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100 px-6">
                      <TableHead className="w-[40%] pl-8 font-bold text-[10px] uppercase tracking-widest text-slate-400">Material de Apoio</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">Nível</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">Estoque atual / Estoque mínimo</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">UM</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                      <TableHead className="pr-8 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right">Controle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => {
                      const stockRatio = Math.min(material.currentStock / (material.minStock * 2 || 1), 1.2) * 100;
                      const isLow = material.currentStock <= material.minStock;
                      const isWarning = material.currentStock <= material.minStock * 1.5 && !isLow;

                      return (
                        <TableRow key={material.id} className="group border-slate-50 transition-all hover:bg-slate-50/50">
                          <TableCell className="pl-8 py-5">
                            <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{material.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">{material.category}</p>
                          </TableCell>
                          <TableCell className="text-center w-32">
                            <div className="flex flex-col items-center gap-1.5 px-4">
                               <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ${isLow ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${stockRatio}%` }}
                                ></div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-mono text-base font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                              {material.currentStock.toString().padStart(2, '0')}
                            </span>
                            <span className="text-slate-300 mx-1 font-mono">/</span>
                            <span className="text-slate-400 font-mono text-xs">{material.minStock}</span>
                          </TableCell>
                          <TableCell className="text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                            {material.unit}
                          </TableCell>
                          <TableCell>
                            {isLow ? (
                              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase border border-red-200">Ruptura</span>
                            ) : isWarning ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase border border-amber-200">Repor</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase border border-emerald-200">Ok</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            <div className="flex items-center justify-end gap-1">
                               <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => updateStock(material, 'purchase', 1)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-700"
                                onClick={() => updateStock(material, 'consumption', 1)}
                              >
                                <MinusCircle className="w-4 h-4" />
                              </Button>
                              
                              <Dialog>
                                <DialogTrigger className="ml-2 h-8 rounded-lg text-[10px] font-bold uppercase border border-slate-200 hover:bg-slate-50 px-3 inline-flex items-center justify-center">
                                  Contagem
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Contagem Manual: {material.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-6 space-y-4">
                                    <div className="grid gap-2">
                                      <Label className="text-xs font-bold uppercase text-slate-400">Quantidade</Label>
                                      <Input id={`bulkAmount-${material.id}`} type="number" defaultValue={material.currentStock} className="rounded-xl h-12" />
                                    </div>
                                    <div className="pt-4">
                                      <DialogClose render={<Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold" onClick={() => {
                                          const amount = Number((document.getElementById(`bulkAmount-${material.id}`) as HTMLInputElement).value);
                                          setManualStock(material, amount);
                                        }} />}>Atualizar</DialogClose>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-lg text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 ml-1"
                                onClick={() => {
                                  setEditingMaterial({ ...material });
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>

                              {isAdmin && (
                                <Dialog>
                                  <DialogTrigger 
                                    render={
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"
                                      />
                                    }
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </DialogTrigger>
                                  <DialogContent className="rounded-3xl border-slate-200">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="w-5 h-5" />
                                        Confirmar Exclusão
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="py-4">
                                      <p className="text-sm text-slate-600 leading-relaxed">
                                        Tem certeza que deseja excluir o material <span className="font-bold text-slate-900">"{material.name}"</span>?
                                        Esta ação é irreversível e removerá todos os dados logísticos associados.
                                      </p>
                                    </div>
                                    <DialogFooter className="gap-2">
                                      <DialogClose render={<Button variant="ghost" className="rounded-xl flex-1 border-slate-200" />}>
                                        Cancelar
                                      </DialogClose>
                                      <Button 
                                        onClick={() => handleDeleteMaterial(material.id)} 
                                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl flex-1 font-bold"
                                      >
                                        Excluir Permanente
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
              {!dataLoading && <InventoryForm materials={materials} user={user} />}
            </TabsContent>

            <TabsContent value="history" className="flex-1 p-0">
               <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100 px-6">
                      <TableHead className="pl-8 font-bold text-[10px] uppercase tracking-widest text-slate-400">Timestamp</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Material</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">Operação</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right">Quantidade</TableHead>
                      <TableHead className="pr-8 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right">Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const material = materials.find(m => m.id === log.materialId);
                      return (
                        <TableRow key={log.id} className="border-slate-50">
                          <TableCell className="pl-8 py-4 font-mono text-[10px] text-slate-500">
                            {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString('pt-BR') : '--:--'}
                          </TableCell>
                          <TableCell className="font-bold text-slate-700">
                            {material?.name || '---'}
                          </TableCell>
                          <TableCell className="text-center">
                            {log.type === 'purchase' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 rounded-lg px-2 text-[10px] font-bold">Entrada</Badge>
                            ) : log.type === 'consumption' ? (
                              <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 rounded-lg px-2 text-[10px] font-bold">Consumo</Badge>
                            ) : (
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-50 rounded-lg px-2 text-[10px] font-bold">Sincronismo</Badge>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold ${log.type === 'purchase' ? 'text-emerald-600' : log.type === 'consumption' ? 'text-red-500' : 'text-indigo-600'}`}>
                            {log.type === 'consumption' ? '-' : '+'}{log.quantity}
                          </TableCell>
                          <TableCell className="pr-8 text-right font-mono text-[9px] text-slate-400">
                            ID: {log.userId?.slice(0, 6).toUpperCase()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <NFDashboard />
          </div>
        )}
      </main>

      {/* Corporate Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm">Genomma - <span className="text-slate-600">Controle de insumos</span> - <span className="text-slate-400 font-normal">CD Extrema/MG</span></p>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest sr-only">Controle de Suprimentos v2.0</p>
              </div>
            </div>
            
            <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex flex-col gap-1 items-center md:items-start">
                <span className="text-slate-300">Inventários Agendados</span>
                <span className="text-emerald-600">Segundas-feiras @ 10:00</span>
              </div>
            </div>
          </div>
          
          <div className="mt-10 pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-[9px] font-mono text-slate-300 uppercase leading-relaxed text-center md:text-left">
                Este sistema é de uso exclusivo para controle de estoque de materiais de apoio.<br/>
                Todas as movimentações são auditadas eletronicamente por {user.displayName}.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
                   <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-[8px] font-black text-emerald-700 uppercase tracking-tighter">Status: Produção Sincronizada</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md">
                   <Shield className="w-2.5 h-2.5 text-slate-400" />
                   <span className="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">Build: {new Date().toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Sistema Online</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Seguro via Firebase</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InventoryForm({ materials, user }: { materials: Material[], user: User }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isCounting, setIsCounting] = useState(false);

  const startInventory = () => {
    const initial = {};
    materials.forEach(m => initial[m.id] = m.currentStock);
    setCounts(initial);
    setIsCounting(true);
  };

  const submitInventory = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        for (const m of materials) {
          const newCount = Number(counts[m.id]);
          if (newCount !== m.currentStock) {
            const materialRef = doc(db, 'materials', m.id);
            transaction.update(materialRef, { 
              currentStock: newCount,
              lastInventoryAt: serverTimestamp()
            });

            const logRef = doc(collection(db, 'inventory_logs'));
            transaction.set(logRef, {
              materialId: m.id,
              type: 'inventory_check',
              quantity: newCount,
              difference: newCount - m.currentStock,
              userId: user.uid,
              timestamp: serverTimestamp()
            });
          }
        }
      });
      setIsCounting(false);
      toast.success("Inventário semanal finalizado e sincronizado!", { 
        description: `Contagem física processada por ${user.displayName}` 
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'transaction:inventory/bulk');
    }
  };

  if (!isCounting) {
    return (
      <div className="m-8 p-12 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-6 bg-slate-50/50">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-inner border border-slate-100">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Rotina de Inventário</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Sincronize o estoque físico com o sistema. Essencial para evitar rupturas de materiais de apoio.
          </p>
        </div>
        <Button onClick={startInventory} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-8 font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
          Iniciar Checkpoint Semanal
        </Button>
      </div>
    );
  }

  return (
    <div className="m-4 md:m-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 p-8 space-y-8 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Auditoria Física</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Checklist de Conformidade Operacional</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" onClick={() => setIsCounting(false)} className="rounded-xl h-12 px-6 font-bold flex-1 md:flex-none border-slate-200 text-slate-500">Cancelar</Button>
          <Button onClick={submitInventory} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-8 font-bold flex-1 md:flex-none shadow-lg shadow-emerald-600/20">Finalizar Auditoria</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {materials.map(m => (
          <div key={m.id} className="p-5 border border-slate-100 rounded-2xl flex flex-col gap-4 bg-slate-50/30 hover:bg-white hover:border-emerald-200 transition-all group">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{m.name}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-white px-2 py-1 rounded-full border border-slate-100 ">{m.unit}</span>
            </div>
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-50 shadow-sm">
              <div className="flex flex-col px-1 border-r border-slate-100 pr-4">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Sistema</span>
                <span className="font-mono text-base font-bold text-slate-400">{m.currentStock}</span>
              </div>
              <div className="flex-1">
                <Input 
                  type="number" 
                  value={counts[m.id]} 
                  onChange={(e) => setCounts({...counts, [m.id]: Number(e.target.value)})}
                  className="rounded-lg border-slate-200 h-10 bg-slate-50/50 font-mono font-bold text-emerald-600 focus:bg-white focus:border-emerald-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
