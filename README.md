# Bloco de Notas · Paulo Xavier, CRP-20/09816

Bloco de notas pessoal, instalável como app (PWA), com sincronização automática
entre todos os dispositivos onde você fizer login — e funciona também sem
internet.

## 1. Firebase (já configurado)

O projeto `bloco-notas-paulo-xavier` já está configurado em `firebase-config.js`.
No console do Firebase, confirme que:

1. Em **Authentication → Sign-in method**, o provedor **E-mail/senha** está ativado.
2. Em **Firestore Database**, o banco foi criado (região `southamerica-east1`,
   se disponível).
3. Em **Firestore Database → Regras**, o conteúdo de `firestore.rules` deste
   projeto foi colado e publicado — isso garante que cada pessoa só enxerga
   as próprias notas.

## 2. Publicar no GitHub Pages

1. Suba **todos os arquivos desta pasta, direto na raiz do repositório**
   `PaulusXavier/Bloco-de-Notas-PX-` (sem subpastas `css/`, `js/` ou `icons/`).
2. Vá em **Settings → Pages**, selecione a branch `main` e a pasta raiz (`/`).
3. Aguarde alguns minutos — o site fica disponível em
   `https://paulusxavier.github.io/Bloco-de-Notas-PX-/`.

## 3. Instalar nos aparelhos

Abra o link gerado pelo GitHub Pages no celular ou computador e use a opção
"Adicionar à tela inicial" (Android/celular) ou o ícone de instalação na
barra de endereço (computador). Faça login com o mesmo e-mail e senha em
cada aparelho — as notas aparecem sincronizadas automaticamente.

## Funciona offline

- As notas ficam guardadas também no aparelho (cache local do Firestore).
  Se a internet cair, você continua vendo, criando, editando e excluindo
  notas normalmente.
- Uma faixa amarela avisa quando o app está sem conexão.
- O indicador no topo mostra três estados: **Sincronizado**, **Sincronizando…**
  e **Sem conexão**.
- Assim que a internet voltar, tudo o que foi feito offline é enviado
  automaticamente — não é preciso fazer nada manualmente.

## Atualiza sozinho

Sempre que você publicar uma versão nova destes arquivos no GitHub Pages, o
app já instalado nos aparelhos detecta a mudança sozinho (o navegador
verifica isso quando o app é reaberto ou volta ao primeiro plano) e recarrega
automaticamente para usar a versão nova — sem precisar desinstalar, limpar
cache ou clicar em nada. Se isso acontecer bem no momento em que uma nota
está aberta para edição, o app espera você fechá-la antes de recarregar, para
não perder o que ainda não foi salvo.

## Estrutura do projeto

Todos os arquivos ficam soltos na raiz do repositório (sem subpastas):

```
index.html              → tela de login + tela principal do app
style.css                → todo o visual (paleta linho/sálvia/ocre)
firebase-config.js       → chaves do projeto Firebase (já preenchidas)
app.js                   → autenticação, CRUD de notas e sincronização
manifest.json            → configuração de instalação (PWA)
service-worker.js        → cache do app para funcionar offline
firestore.rules          → regras de segurança do banco de dados
icon-192.png, icon-192-maskable.png,
icon-512.png, icon-512-maskable.png → ícones do app
```

## Notas sobre anexos

O modelo de dados já reserva um campo `attachments` em cada nota, vazio por
enquanto. Quando você quiser anexar arquivos, dá pra evoluir o app para
guardar os arquivos no **Firebase Storage** e salvar aqui só o link — sem
precisar redesenhar nada do que já existe.
