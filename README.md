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

## Celular e tablet

Como o uso principal é pelo celular e tablet instalados como app, o visual
tem alguns ajustes pensados especificamente para toque:

- Os campos de texto usam letra de pelo menos 16px — abaixo disso o Safari
  do iPhone dá zoom sozinho ao tocar no campo, o que já foi corrigido aqui.
- O cabeçalho do app quebra a linha em vez de estourar a tela em celulares
  mais estreitos.
- Botões pequenos (fechar nota, baixar/remover anexo, navegar entre
  páginas) ficam maiores especificamente em telas de toque, sem mudar o
  visual no computador.
- Em tablets (e telas a partir de ~700px de largura), a lista de notas usa
  mais de uma coluna para aproveitar o espaço, em vez de ficar esticada
  numa coluna só.

## Melhorias visuais e de uso

- Cada nota (nos cartões da lista e na janela de edição) tem uma pequena
  barra com três bolinhas coloridas, no estilo das janelas do macOS.
  No modal, a bolinha vermelha fecha a nota.
- Dentro do modal, **Ctrl+Enter** (ou **Cmd+Enter** no Mac) salva a nota na
  hora, sem precisar tirar a mão do teclado.
- Se uma nota (texto de todas as páginas + anexos) ficar grande demais para
  o Firestore, o app avisa antes de tentar salvar, em vez de dar um erro
  confuso.

## Páginas

Cada nota pode ter **mais de uma página**. Ao abrir uma nota (nova ou
existente), acima do campo de texto aparece o indicador "Página 1 de 1"; os
botões abaixo do campo permitem:

- **+ Nova página** — adiciona uma página em branco e já muda para ela.
- **◀ Anterior / Próxima ▶** — navega entre as páginas já criadas.
- **Excluir página** — remove a página atual (só aparece quando a nota tem
  mais de uma página).

O texto de cada página fica guardado separadamente; trocar de página nunca
apaga o que foi escrito nas outras. Ao salvar, todas as páginas são gravadas
juntas na nota. Na lista de notas, o cartão mostra "📄 N páginas" quando a
nota tem mais de uma. Ao imprimir (🖨️), cada página sai numa folha separada.

Notas criadas antes desta função continuam funcionando normalmente, como
notas de uma página só.

## Anexos

Cada nota aceita até **5 arquivos, de até 700 KB cada** (imagens, PDF, Word,
texto). Ao abrir uma nota, toque em "📎 Anexar arquivo" para escolher um ou
mais arquivos; eles aparecem numa lista com nome, tamanho, botão de baixar
(⬇) e de remover (✕) antes mesmo de salvar a nota.

Os anexos são guardados **dentro do próprio documento da nota no Firestore**
(convertidos para texto/base64), e não no Firebase Storage. Isso foi proposital:

- Funcionam offline pelo mesmo cache local das notas — sem precisar de mais
  nenhuma configuração no Firebase.
- Não exigem habilitar o Firebase Storage, que hoje pede um plano pago
  (Blaze) mesmo para uso pequeno.
- Em troca, o Firestore limita cada nota (texto + anexos somados) a 1 MB —
  por isso o limite de 700 KB por arquivo e 5 arquivos por nota. Esses
  limites estão no topo do arquivo `app.js`, nas constantes
  `MAX_ATTACHMENT_SIZE`, `MAX_ATTACHMENTS_TOTAL` e `MAX_ATTACHMENTS_COUNT`,
  caso queira ajustá-los.

Se no futuro os anexos precisarem ser maiores (fotos em alta resolução,
vídeos etc.), o caminho é migrar para o **Firebase Storage**, guardando ali
os arquivos e salvando na nota apenas o link — isso exigiria habilitar o
plano Blaze no projeto.

## Publicar uma nova versão

Sempre que alterar qualquer arquivo do app, aumente o número de `CACHE_NAME`
em `service-worker.js` (ex.: `v8` → `v9`). É a mudança nesse arquivo que faz os
aparelhos detectarem e aplicarem a atualização.

## Segurança

- Depois de criar o seu acesso, desative novos cadastros em **Authentication →
  Settings → User actions → Enable create (sign-up)**. Assim ninguém mais
  consegue criar conta apenas com o link público.
- Ao sair (⏻), as notas guardadas no aparelho são apagadas — isso protege
  aparelhos compartilhados.
