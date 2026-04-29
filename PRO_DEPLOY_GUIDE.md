# Sistema de Gestão Genomma Logística - Documentação de Produção

Este projeto foi configurado para um ambiente profissional de alta disponibilidade. Para garantir que as alterações feitas aqui sejam replicadas automaticamente para toda a sua equipe sem dependência manual, siga estas etapas:

## 1. Exportação para GitHub (O Coração da Automação)
1. No menu superior do **AI Studio**, clique em **Settings (Configurações)**.
2. Selecionar **Export to GitHub**.
3. Siga as instruções para criar um repositório privado ou público. 
4. **IMPORTANTE:** Toda vez que finalizarmos um ajuste aqui, você pode clicar em "Sync with GitHub" para enviar a versão mais recente.

## 2. Deploy Automático (Vercel)
Utilizaremos o Vercel para hospedar o sistema profissionalmente (Opção gratuita e robusta):
1. Acesse [vercel.com](https://vercel.com) e crie uma conta usando seu GitHub.
2. Clique em **"Add New"** -> **"Project"**.
3. Importe o repositório que você acabou de criar no passo anterior.
4. Nas **Environment Variables (Variáveis de Ambiente)** do Vercel, adicione:
   - `GEMINI_API_KEY`: Sua chave do Google Gemini.
   - `GMAIL_USER`: Seu e-mail do Gmail para notificações.
   - `GMAIL_APP_PASSWORD`: Sua Senha de App do Google.
   - `VITE_APP_URL`: A URL do seu site no Vercel. 
     *   **Onde achar?** Após o primeiro deploy, o Vercel mostrará um link abaixo de "DOMAINS" (ex: `https://meu-projeto.vercel.app`). Copie o link completo com `https://`.
     *   **No Print que você enviou:** Você deve apagar aquele código que digitou e colar o link do site.
5. Clique em **Deploy**.

## 3. Configuração do Firebase (Vital para o Login Google)
Como o seu sistema agora está em um novo endereço (`gestor-cd-genomma.vercel.app`), o Google bloqueia o login por segurança até você autorizar esse novo domínio.

1. Acesse o [Console do Firebase](https://console.firebase.google.com/).
2. Clique no seu projeto: **"Fluxo de caixa pessoal"** (é este o nome que aparece no seu print).
3. No menu lateral, vá em **Authentication** (Autenticação).
4. Clique na aba **Settings** (Configurações) no topo.
5. No menu à esquerda, clique em **Authorized Domains** (Domínios Autorizados).
6. Clique em **Add Domain** (Adicionar Domínio).
7. Digite: `gestor-cd-genomma.vercel.app` e salve.

---

## 4. Por que isso é Profissional?
- **Domínio Próprio:** Você pode conectar `estoque.suaempresa.com.br`.
- **CI/CD:** Qualquer erro ou alteração que eu (o agente) fizer, passará por um processo de build automático.
- **Sincronização Total:** Todos os funcionários usarão o mesmo link estável, evitando o problema de uns verem itens que outros não veem.

---
*Configurado por AI Studio Build Agent - 2026*
