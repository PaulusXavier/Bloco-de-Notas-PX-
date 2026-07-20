# Bloco de Notas · Paulo Xavier, CRP-20/09816

Bloco de notas pessoal, instalável como app (PWA), com sincronização automática
entre todos os dispositivos onde você fizer login.

## 1. Firebase (já configurado)

O projeto `bloco-notas-paulo-xavier` já está configurado em `js/firebase-config.js`.
No console do Firebase, confirme que:

1. Em **Authentication → Sign-in method**, o provedor **E-mail/senha** está ativado.
2. Em **Firestore Database**, o banco foi criado (região `southamerica-east1`,
   se disponível).
3. Em **Firestore Database → Regras**, o conteúdo de `firestore.rules` deste
   projeto foi colado e publicado — isso garante que cada pessoa só enxerga
   as próprias notas.

## 2. Publicar no GitHub Pages

1. Suba todos os arquivos desta pasta para o repositório
   `PaulusXavier/Bloco-de-Notas-PX-`.
2. Vá em **Settings → Pages**, selecione a branch `main` e a pasta raiz (`/`).
3. Aguarde alguns minutos — o site fica disponível em
   `https://paulusxavier.github.io/Bloco-de-Notas-PX-/`.

## 3. Instalar nos aparelhos

Abra o link gerado pelo GitHub Pages no celular ou computador e use a opção
"Adicionar à tela inicial" (Android/celular) ou o ícone de instalação na
barra de endereço (computador). Faça login com o mesmo e-mail e senha em
cada aparelho — as notas aparecem sincronizadas automaticamente.

## Estrutura do projeto

```
index.html              → tela de login + tela principal do app
css/style.css           → todo o visual (paleta linho/sálvia/ocre)
js/firebase-config.js   → chaves do projeto Firebase (já preenchidas)
js/app.js               → autenticação, CRUD de notas e sincronização
manifest.json           → configuração de instalação (PWA)
service-worker.js       → cache do app para funcionar offline
firestore.rules         → regras de segurança do banco de dados
icons/                  → ícones do app
```

## Notas sobre anexos

O modelo de dados já reserva um campo `attachments` em cada nota, vazio por
enquanto. Quando você quiser anexar arquivos, dá pra evoluir o app para
guardar os arquivos no **Firebase Storage** e salvar aqui só o link — sem
precisar redesenhar nada do que já existe.
