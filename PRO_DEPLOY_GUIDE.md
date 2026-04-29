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
   - `VITE_APP_URL`: A URL final que o Vercel te der (ex: `estoque-extrema.vercel.app`).
5. Clique em **Deploy**.

## 3. Por que isso é Profissional?
- **Domínio Próprio:** Você pode conectar `estoque.suaempresa.com.br`.
- **CI/CD:** Qualquer erro ou alteração que eu (o agente) fizer, passará por um processo de build automático.
- **Sincronização Total:** Todos os funcionários usarão o mesmo link estável, evitando o problema de uns verem itens que outros não veem.

---
*Configurado por AI Studio Build Agent - 2026*
