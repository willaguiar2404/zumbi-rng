import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
} from "./firebase-config.js";

function formatar(n) {
  n = Number(n) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "MI";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}

function carregarNumero(chave, padrao) {
  const valor = Number(localStorage.getItem(chave));
  return Number.isFinite(valor) ? valor : padrao;
}

function normalizarCarta(carta) {
  if (!carta || typeof carta !== "object") return null;

  const raridadesValidas = ["comum", "raro", "epico", "lendario", "secreta", "secreta2"];

  return {
    nome: String(carta.nome || "Carta"),
    raridade: raridadesValidas.includes(carta.raridade) ? carta.raridade : "comum",
    moeda: Number(carta.moeda) || 0,
    img: String(carta.img || "cartas/comum1.png")
  };
}

function carregarCartas(chave) {
  try {
    const valor = JSON.parse(localStorage.getItem(chave));
    if (!Array.isArray(valor)) return [];
    return valor.map(normalizarCarta).filter(Boolean);
  } catch {
    return [];
  }
}

function clonarCarta(carta) {
  return {
    nome: String(carta.nome || "Carta"),
    raridade: String(carta.raridade || "comum"),
    moeda: Number(carta.moeda) || 0,
    img: String(carta.img || "cartas/comum1.png")
  };
}

const cartasBase = [
  { nome: "Zumbi Podre", raridade: "comum", moeda: 2, img: "cartas/comum1.png" },
  { nome: "Zumbi Soldado", raridade: "comum", moeda: 3, img: "cartas/comum2.png" },
  { nome: "Zumbi Encapuzado", raridade: "comum", moeda: 4, img: "cartas/comum3.png" },
  { nome: "Zumbi Pálido", raridade: "comum", moeda: 5, img: "cartas/comum4.png" },
  { nome: "Zumbi Tático", raridade: "raro", moeda: 9, img: "cartas/rara1.png" },
  { nome: "Infectado Militar", raridade: "raro", moeda: 11, img: "cartas/rara2.png" },
  { nome: "Oficial Corrompido", raridade: "raro", moeda: 14, img: "cartas/rara3.png" },
  { nome: "Mutante Brutal", raridade: "epico", moeda: 26, img: "cartas/epica1.png" },
  { nome: "Lobisomem Infectado", raridade: "epico", moeda: 32, img: "cartas/epica2.png" },
  { nome: "Aberração Viral", raridade: "epico", moeda: 38, img: "cartas/epica3.png" },
  { nome: "Rei Zumbi", raridade: "lendario", moeda: 85, img: "cartas/lendaria1.png" },
  { nome: "Titã da Praga", raridade: "lendario", moeda: 110, img: "cartas/lendaria2.png" },
  { nome: "Imperador Morto", raridade: "secreta", moeda: 800, img: "cartas/secreta1.png" },
  { nome: "Deus da Infecção", raridade: "secreta2", moeda: 2500, img: "cartas/secreta2.png" }
];

const maxEquip = 20;
const xpPorGiro = 50;
const precoAbrir3 = 100000;
const precoAutoOpen = 150000;
const precoPacks = { comum: 100, raro: 800, epico: 5000, lendario: 25000 };

let moedas = carregarNumero("moedas", 500);
let giros = carregarNumero("giros", 0);
let nivel = carregarNumero("nivel", 1);
let xp = carregarNumero("xp", 0);

let desbloqueouAbrir3 = localStorage.getItem("desbloqueouAbrir3") === "true";
let desbloqueouAutoOpen = localStorage.getItem("desbloqueouAutoOpen") === "true";
let abrir3Ativo = localStorage.getItem("abrir3Ativo") === "true";
let autoOpenAtivo = localStorage.getItem("autoOpenAtivo") === "true";
let skipAnimacao = localStorage.getItem("skipAnimacao") === "true";

let inventario = carregarCartas("inventario");
let equipadas = carregarCartas("equipadas");
let quests = JSON.parse(localStorage.getItem("quests")) || null;

let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID ? crypto.randomUUID() : "player_" + Math.random().toString(36).slice(2);
  localStorage.setItem("playerId", playerId);
}

let playerName = localStorage.getItem("playerName") || "";
let lastChatSentAt = carregarNumero("lastChatSentAt", 0);

const palavrasBloqueadas = [
  "fdp", "puta", "puta que pariu", "caralho", "porra", "merda",
  "desgraça", "cu", "viado", "buceta", "arrombado"
];

function salvar() {
  localStorage.setItem("moedas", String(Number(moedas) || 0));
  localStorage.setItem("giros", String(Number(giros) || 0));
  localStorage.setItem("nivel", String(Number(nivel) || 1));
  localStorage.setItem("xp", String(Number(xp) || 0));
  localStorage.setItem("desbloqueouAbrir3", String(desbloqueouAbrir3));
  localStorage.setItem("desbloqueouAutoOpen", String(desbloqueouAutoOpen));
  localStorage.setItem("abrir3Ativo", String(abrir3Ativo));
  localStorage.setItem("autoOpenAtivo", String(autoOpenAtivo));
  localStorage.setItem("skipAnimacao", String(skipAnimacao));
  localStorage.setItem("inventario", JSON.stringify(inventario));
  localStorage.setItem("equipadas", JSON.stringify(equipadas));
  localStorage.setItem("quests", JSON.stringify(quests));
  localStorage.setItem("playerId", playerId);
  localStorage.setItem("playerName", playerName);
  localStorage.setItem("lastChatSentAt", String(lastChatSentAt));
}

function abrirAba(id, btn) {
  document.querySelectorAll(".abaConteudo").forEach(el => el.classList.remove("ativa"));
  document.querySelectorAll(".abaBtn").forEach(el => el.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");
  if (btn) btn.classList.add("ativa");
}

function xpNecessarioDoNivel(n) {
  return n * 1000;
}

function bonusNivelMoeda() {
  return 1 + (nivel - 1) * 0.05;
}

function rendaTotal() {
  let total = 0;
  for (const carta of equipadas) total += Number(carta.moeda) || 0;
  return total * bonusNivelMoeda();
}

function contarRarasOuMelhores() {
  let total = 0;
  [...inventario, ...equipadas].forEach(carta => {
    if (!carta) return;
    if (["raro", "epico", "lendario", "secreta", "secreta2"].includes(carta.raridade)) {
      total++;
    }
  });
  return total;
}

function contarSecretasNormais() {
  let total = 0;
  [...inventario, ...equipadas].forEach(carta => {
    if (carta && carta.raridade === "secreta") total++;
  });
  return total;
}

function obterTituloJogador() {
  if (giros >= 5000) return { texto: "Deus do Apocalipse", classe: "titulo-divino" };
  if (giros >= 2000) return { texto: "Imperador da Ruína", classe: "titulo-apocalipse" };
  if (giros >= 750) return { texto: "Lenda da Zona Morta", classe: "titulo-lendario" };
  if (giros >= 250) return { texto: "Caçador de Aberrações", classe: "titulo-cacador" };
  if (giros >= 50) return { texto: "Sobrevivente Veterano", classe: "titulo-sobrevivente" };
  return { texto: "Catador de Restos", classe: "titulo-iniciante" };
}

function atualizarTituloJogador() {
  const badge = document.getElementById("tituloJogador");
  const nome = document.getElementById("nomeJogador");
  const info = obterTituloJogador();

  nome.innerText = playerName || "Sem nome";
  badge.innerText = info.texto;
  badge.className = "badge-titulo " + info.classe;
}

function atualizarUI() {
  const metaXp = xpNecessarioDoNivel(nivel);
  const porcentagem = Math.max(0, Math.min(100, (xp / metaXp) * 100));

  document.getElementById("moedas").innerText = formatar(moedas);
  document.getElementById("giros").innerText = formatar(giros);
  document.getElementById("renda").innerText = formatar(rendaTotal());
  document.getElementById("nivel").innerText = formatar(nivel);
  document.getElementById("xp").innerText = formatar(xp);
  document.getElementById("xpMeta").innerText = formatar(metaXp);
  document.getElementById("barraXp").style.width = porcentagem + "%";

  document.getElementById("statusAbrir3").innerText = !desbloqueouAbrir3
    ? "Abrir 3: BLOQUEADO"
    : "Abrir 3: " + (abrir3Ativo ? "LIGADO" : "DESLIGADO");

  document.getElementById("statusAutoOpen").innerText = !desbloqueouAutoOpen
    ? "Auto Open: BLOQUEADO"
    : "Auto Open: " + (autoOpenAtivo ? "LIGADO" : "DESLIGADO");

  document.getElementById("statusSkip").innerText =
    "Skip Animation: " + (skipAnimacao ? "LIGADO" : "DESLIGADO");

  document.getElementById("btnAbrir3").innerText = !desbloqueouAbrir3
    ? `Comprar Abrir 3 (${formatar(precoAbrir3)})`
    : abrir3Ativo ? "Desligar Abrir 3" : "Ligar Abrir 3";

  document.getElementById("btnAutoOpen").innerText = !desbloqueouAutoOpen
    ? `Comprar Auto Open (${formatar(precoAutoOpen)})`
    : autoOpenAtivo ? "Desligar Auto Open" : "Ligar Auto Open";

  atualizarTituloJogador();
}

function rolarRaridade(tipo) {
  const r = Math.random();

  if (tipo === "comum") {
    if (r < 0.000005) return "secreta";
    if (r < 0.0002) return "lendario";
    if (r < 0.01) return "epico";
    if (r < 0.12) return "raro";
    return "comum";
  }

  if (tipo === "raro") {
    if (r < 0.00002) return "secreta";
    if (r < 0.001) return "lendario";
    if (r < 0.05) return "epico";
    if (r < 0.32) return "raro";
    return "comum";
  }

  if (tipo === "epico") {
    if (r < 0.0002) return "secreta";
    if (r < 0.01) return "lendario";
    if (r < 0.18) return "epico";
    return "raro";
  }

  if (tipo === "lendario") {
    if (r < 0.001) return "secreta";
    if (r < 0.04) return "lendario";
    return "epico";
  }

  return "comum";
}

function gerarCarta(tipo) {
  const raridade = rolarRaridade(tipo);
  const pool = cartasBase.filter(c => c.raridade === raridade);
  return clonarCarta(pool[Math.floor(Math.random() * pool.length)] || cartasBase[0]);
}

function gerarCartaPorRaridade(raridade) {
  const pool = cartasBase.filter(c => c.raridade === raridade);
  return clonarCarta(pool[Math.floor(Math.random() * pool.length)] || cartasBase[0]);
}

function tocarSom(raridade) {
  try {
    const contexto = new (window.AudioContext || window.webkitAudioContext)();
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();

    oscilador.connect(ganho);
    ganho.connect(contexto.destination);

    let frequencia = 440;
    let duracao = 0.12;

    if (raridade === "raro") frequencia = 520;
    if (raridade === "epico") frequencia = 640;
    if (raridade === "lendario") { frequencia = 820; duracao = 0.2; }
    if (raridade === "secreta") { frequencia = 980; duracao = 0.28; }
    if (raridade === "secreta2") { frequencia = 1200; duracao = 0.35; }

    oscilador.type = "triangle";
    oscilador.frequency.setValueAtTime(frequencia, contexto.currentTime);
    ganho.gain.setValueAtTime(0.001, contexto.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.2, contexto.currentTime + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + duracao);

    oscilador.start();
    oscilador.stop(contexto.currentTime + duracao);
  } catch {}
}

function ativarFlashTela(raridade) {
  const tela = document.getElementById("efeitoTela");
  tela.classList.remove("flashLendario", "flashSecreta");

  if (raridade === "lendario") {
    void tela.offsetWidth;
    tela.classList.add("flashLendario");
  }

  if (raridade === "secreta" || raridade === "secreta2") {
    void tela.offsetWidth;
    tela.classList.add("flashSecreta");
  }
}

function limparResultadoTriplo() {
  document.getElementById("resultadoTriplo").innerHTML = "";
}

function mostrarResultadoTriplo(cartas) {
  const box = document.getElementById("resultadoTriplo");
  box.innerHTML = "";

  cartas.forEach(carta => {
    const item = document.createElement("div");
    item.className = "miniCarta " + carta.raridade;
    item.innerHTML = `
      <img src="${carta.img}" alt="${carta.nome}">
      <p><b>${carta.nome}</b></p>
      <p>${carta.raridade.toUpperCase()}</p>
    `;
    box.appendChild(item);
  });
}

function tocarAnimacaoCarta(carta) {
  const box = document.getElementById("packAnimacao");
  const img = document.getElementById("cartaDisplay");
  const nome = document.getElementById("nomeCartaSorteada");

  box.classList.remove(
    "packAbrindo",
    "revelada-comum",
    "revelada-raro",
    "revelada-epico",
    "revelada-lendario",
    "revelada-secreta",
    "revelada-secreta2"
  );

  void box.offsetWidth;

  img.src = carta.img;
  nome.innerText = `${carta.nome} • ${carta.raridade.toUpperCase()}`;

  if (!skipAnimacao) box.classList.add("packAbrindo");
  box.classList.add("revelada-" + carta.raridade);

  tocarSom(carta.raridade);
  ativarFlashTela(carta.raridade);
}

function ganharXp(valor) {
  xp += valor;
  while (xp >= xpNecessarioDoNivel(nivel)) {
    xp -= xpNecessarioDoNivel(nivel);
    nivel += 1;
    alert("🔥 Você subiu para o nível " + nivel + "!");
  }
}

function processarAberturaPack(tipo, mostrarAnimacao = true) {
  if (!(tipo in precoPacks)) return false;
  if (moedas < precoPacks[tipo]) return false;

  moedas -= precoPacks[tipo];
  giros += 1;
  ganharXp(xpPorGiro);

  const carta = gerarCarta(tipo);
  inventario.push(carta);

  if (mostrarAnimacao) {
    limparResultadoTriplo();
    tocarAnimacaoCarta(carta);
  }

  return true;
}

function abrirPack(tipo) {
  if (!processarAberturaPack(tipo, true)) {
    alert("Moedas insuficientes");
    return;
  }

  atualizarUI();
  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();
}

function alternarAbrir3() {
  if (!desbloqueouAbrir3) {
    if (moedas < precoAbrir3) {
      alert("Moedas insuficientes para comprar Abrir 3 Packs");
      return;
    }

    moedas -= precoAbrir3;
    desbloqueouAbrir3 = true;
    abrir3Ativo = false;

    atualizarUI();
    salvar();
    sincronizarRanking();
    alert("✅ Você comprou Abrir 3 Packs para sempre!");
    return;
  }

  abrir3Ativo = !abrir3Ativo;
  if (abrir3Ativo) autoOpenAtivo = false;

  atualizarUI();
  salvar();
}

function pararAbrir3() {
  if (!desbloqueouAbrir3) return;
  abrir3Ativo = false;
  atualizarUI();
  salvar();
}

function alternarAutoOpen() {
  if (!desbloqueouAutoOpen) {
    if (moedas < precoAutoOpen) {
      alert("Moedas insuficientes para comprar Auto Open");
      return;
    }

    moedas -= precoAutoOpen;
    desbloqueouAutoOpen = true;
    autoOpenAtivo = false;

    atualizarUI();
    salvar();
    sincronizarRanking();
    alert("✅ Você comprou Auto Open para sempre!");
    return;
  }

  autoOpenAtivo = !autoOpenAtivo;
  if (autoOpenAtivo) abrir3Ativo = false;

  atualizarUI();
  salvar();
}

function pararAutoOpen() {
  if (!desbloqueouAutoOpen) return;
  autoOpenAtivo = false;
  atualizarUI();
  salvar();
}

function alternarSkipAnimacao() {
  skipAnimacao = !skipAnimacao;
  atualizarUI();
  salvar();
}

function equiparMelhorTime() {
  const todas = [...equipadas, ...inventario]
    .map(normalizarCarta)
    .filter(Boolean)
    .sort((a, b) => (Number(b.moeda) || 0) - (Number(a.moeda) || 0));

  equipadas = todas.slice(0, maxEquip);
  inventario = todas.slice(maxEquip);

  renderInventario();
  salvar();
  sincronizarRanking();
}

function criarQuests() {
  return [
    { id: "quest_giros_10", titulo: "Sobrevivente Iniciante", descricao: "Abra 10 packs", tipo: "giros", meta: 10, recompensaMoedas: 2000, recompensaCarta: null, resgatada: false },
    { id: "quest_giros_50", titulo: "Caçador de Relíquias", descricao: "Abra 50 packs", tipo: "giros", meta: 50, recompensaMoedas: 15000, recompensaCarta: { raridade: "epico" }, resgatada: false },
    { id: "quest_nivel_5", titulo: "Veterano da Zona Morta", descricao: "Alcance o nível 5", tipo: "nivel", meta: 5, recompensaMoedas: 30000, recompensaCarta: { raridade: "lendario" }, resgatada: false },
    { id: "quest_moedas_100k", titulo: "Magnata do Apocalipse", descricao: "Junte 100K moedas", tipo: "moedas", meta: 100000, recompensaMoedas: 50000, recompensaCarta: null, resgatada: false },
    { id: "quest_5_secretas", titulo: "Apocalipse Supremo", descricao: "Consiga 5 cartas SECRETAS", tipo: "secretas", meta: 5, recompensaMoedas: 0, recompensaCarta: { raridade: "secreta2" }, resgatada: false }
  ];
}

function garantirQuests() {
  if (!Array.isArray(quests) || quests.length === 0) quests = criarQuests();
}

function progressoQuest(quest) {
  if (quest.tipo === "giros") return giros;
  if (quest.tipo === "nivel") return nivel;
  if (quest.tipo === "moedas") return moedas;
  if (quest.tipo === "secretas") return contarSecretasNormais();
  return 0;
}

function questCompleta(quest) {
  return progressoQuest(quest) >= quest.meta;
}

function resgatarQuest(id) {
  const quest = quests.find(q => q.id === id);
  if (!quest || quest.resgatada || !questCompleta(quest)) return;

  moedas += Number(quest.recompensaMoedas) || 0;

  if (quest.recompensaCarta?.raridade) {
    const cartaPremio = gerarCartaPorRaridade(quest.recompensaCarta.raridade);
    inventario.push(cartaPremio);
    tocarAnimacaoCarta(cartaPremio);
  }

  quest.resgatada = true;

  atualizarUI();
  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();
  alert("Quest resgatada com sucesso!");
}

function renderQuests() {
  garantirQuests();
  const lista = document.getElementById("listaQuests");
  lista.innerHTML = "";

  quests.forEach(quest => {
    const progresso = progressoQuest(quest);
    const pronta = questCompleta(quest);

    const box = document.createElement("div");
    box.className = "questBox" + (pronta && !quest.resgatada ? " questPronta" : "");

    let recompensaTexto = `Moedas: ${formatar(quest.recompensaMoedas)}`;
    if (quest.recompensaCarta?.raridade) {
      recompensaTexto += ` + Carta ${quest.recompensaCarta.raridade.toUpperCase()}`;
    }

    box.innerHTML = `
      <p><b>${quest.titulo}</b></p>
      <p>${quest.descricao}</p>
      <p>Progresso: ${formatar(Math.min(progresso, quest.meta))} / ${formatar(quest.meta)}</p>
      <p>Recompensa: ${recompensaTexto}</p>
      ${
        quest.resgatada
          ? `<button disabled>Resgatada</button>`
          : pronta
          ? `<button onclick="resgatarQuest('${quest.id}')">Resgatar</button>`
          : `<button disabled>Em andamento</button>`
      }
    `;

    lista.appendChild(box);
  });
}

function renderInventario() {
  const inv = document.getElementById("inventario");
  const eq = document.getElementById("equipadas");

  inv.innerHTML = "";
  eq.innerHTML = "";

  inventario.forEach((c, i) => {
    const valorVenda = (Number(c.moeda) || 0) * 20;
    const card = document.createElement("div");
    card.className = "card " + c.raridade;
    card.innerHTML = `
      <img src="${c.img}" alt="${c.nome}">
      <p><b>${c.nome}</b></p>
      <p>${c.raridade.toUpperCase()}</p>
      <p>${formatar(c.moeda)}/s</p>
      <button onclick="equipar(${i})">Equipar</button>
      <button onclick="vender(${i})">Vender ${formatar(valorVenda)}</button>
    `;
    inv.appendChild(card);
  });

  equipadas.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "card " + c.raridade;
    card.innerHTML = `
      <img src="${c.img}" alt="${c.nome}">
      <p><b>${c.nome}</b></p>
      <p>${c.raridade.toUpperCase()}</p>
      <p>${formatar(c.moeda)}/s</p>
      <button onclick="desequipar(${i})">Remover</button>
    `;
    eq.appendChild(card);
  });

  atualizarUI();
}

function equipar(i) {
  if (i < 0 || i >= inventario.length) return;
  if (equipadas.length >= maxEquip) {
    alert("Máximo 20 cartas equipadas");
    return;
  }

  const carta = normalizarCarta(inventario[i]);
  if (!carta) return;

  equipadas.push(carta);
  inventario.splice(i, 1);

  renderInventario();
  salvar();
  sincronizarRanking();
}

function desequipar(i) {
  if (i < 0 || i >= equipadas.length) return;

  const carta = normalizarCarta(equipadas[i]);
  if (!carta) return;

  inventario.push(carta);
  equipadas.splice(i, 1);

  renderInventario();
  salvar();
  sincronizarRanking();
}

function vender(i) {
  if (i < 0 || i >= inventario.length) return;

  const carta = normalizarCarta(inventario[i]);
  if (!carta) return;

  moedas += (Number(carta.moeda) || 0) * 20;
  inventario.splice(i, 1);

  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();
}

async function garantirNomeUnico(nomeDesejado) {
  const nomeLimpo = nomeDesejado.trim().slice(0, 20);
  if (!nomeLimpo) return { ok: false, mensagem: "Nome inválido." };

  const nomeId = nomeLimpo.toLowerCase();
  const nomeRef = doc(db, "usernames", nomeId);
  const nomeSnap = await getDoc(nomeRef);

  if (!nomeSnap.exists()) {
    await setDoc(nomeRef, { playerId, displayName: nomeLimpo });
    return { ok: true, nomeFinal: nomeLimpo };
  }

  const dono = nomeSnap.data()?.playerId;
  if (dono === playerId) {
    return { ok: true, nomeFinal: nomeLimpo };
  }

  return { ok: false, mensagem: "Esse nome já está em uso." };
}

async function trocarNome() {
  const novo = prompt("Novo nome do jogador:", playerName || "Sobrevivente");
  if (!novo) return;

  try {
    const resultado = await garantirNomeUnico(novo);
    if (!resultado.ok) {
      alert(resultado.mensagem);
      return;
    }

    playerName = resultado.nomeFinal;
    salvar();
    atualizarUI();
    sincronizarRanking();
  } catch {
    alert("Não foi possível trocar o nome agora.");
  }
}

function textoTemPalavraBloqueada(texto) {
  const t = texto.toLowerCase();
  return palavrasBloqueadas.some(p => t.includes(p));
}

async function sincronizarRanking() {
  try {
    const titulo = obterTituloJogador();
    await setDoc(doc(db, "players", playerId), {
      playerId,
      name: playerName || "Sobrevivente",
      giros,
      nivel,
      moedas,
      renda: Math.floor(rendaTotal()),
      raras: contarRarasOuMelhores(),
      titulo: titulo.texto,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error("Erro ao sincronizar ranking:", e);
  }
}

function renderRankingLista(elementId, docs, campo) {
  const lista = document.getElementById(elementId);
  lista.innerHTML = "";

  let pos = 0;
  docs.forEach(item => {
    pos++;
    const div = document.createElement("div");
    div.className = "rankingItem" + (pos <= 3 ? ` rankingTop${pos}` : "");
    div.innerHTML = `
      <b>#${pos} ${item.name || "Jogador"}</b><br>
      <small>${item.titulo || "Sem título"}</small><br>
      ${campo}: ${formatar(item[elementId === "rankingRaras" ? "raras" : elementId === "rankingMoedas" ? "moedas" : elementId === "rankingNivel" ? "nivel" : "giros"] || 0)}
    `;
    lista.appendChild(div);
  });
}

function ouvirRankingColecao(elementId, campoFirestore) {
  const q = query(collection(db, "players"), orderBy(campoFirestore, "desc"), limit(10));
  onSnapshot(q, snapshot => {
    const docs = [];
    snapshot.forEach(s => docs.push(s.data()));
    renderRankingLista(elementId, docs, campoFirestore);
  });
}

async function enviarMensagemChat() {
  const input = document.getElementById("chatInput");
  const texto = (input.value || "").trim();
  if (!texto) return;

  const agora = Date.now();
  if (agora - lastChatSentAt < 4000) {
    alert("Espere alguns segundos para mandar outra mensagem.");
    return;
  }

  if (texto.length < 2) {
    alert("Mensagem muito curta.");
    return;
  }

  if (textoTemPalavraBloqueada(texto)) {
    alert("Mensagem bloqueada por conteúdo inadequado.");
    return;
  }

  try {
    await addDoc(collection(db, "chat"), {
      name: playerName || "Sobrevivente",
      titulo: obterTituloJogador().texto,
      text: texto.slice(0, 140),
      createdAt: serverTimestamp(),
      createdAtMs: agora
    });

    lastChatSentAt = agora;
    salvar();
    input.value = "";
  } catch {
    alert("Não foi possível enviar a mensagem.");
  }
}

function ouvirChat() {
  const q = query(collection(db, "chat"), orderBy("createdAtMs", "desc"), limit(30));
  onSnapshot(q, snapshot => {
    const box = document.getElementById("chatMensagens");
    box.innerHTML = "";

    const docs = [];
    snapshot.forEach(s => docs.push(s.data()));
    docs.reverse().forEach(msg => {
      const div = document.createElement("div");
      div.className = "chatMsg";
      div.innerHTML = `
        <b>${msg.name || "Jogador"}</b>
        <small> • ${msg.titulo || "Sem título"}</small><br>
        ${msg.text || ""}
      `;
      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

document.addEventListener("keydown", (e) => {
  const input = document.getElementById("chatInput");
  if (document.activeElement === input && e.key === "Enter") {
    enviarMensagemChat();
  }
});

setInterval(() => {
  moedas += rendaTotal();
  atualizarUI();
  renderQuests();
  salvar();
}, 1000);

setInterval(() => {
  if (!desbloqueouAutoOpen || !autoOpenAtivo) return;

  const abriu = processarAberturaPack("lendario", true);
  if (!abriu) {
    autoOpenAtivo = false;
    alert("Auto Open desligado por falta de moedas.");
  }

  atualizarUI();
  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();
}, 1500);

setInterval(() => {
  if (!desbloqueouAbrir3 || !abrir3Ativo) return;

  const precoUso = precoPacks.lendario * 3;
  if (moedas < precoUso) {
    abrir3Ativo = false;
    alert("Abrir 3 desligado por falta de moedas.");
    atualizarUI();
    salvar();
    return;
  }

  moedas -= precoUso;
  const cartasAbertas = [];

  for (let i = 0; i < 3; i++) {
    giros += 1;
    ganharXp(xpPorGiro);
    const carta = gerarCarta("lendario");
    inventario.push(carta);
    cartasAbertas.push(carta);
  }

  if (cartasAbertas.length) {
    tocarAnimacaoCarta(cartasAbertas[cartasAbertas.length - 1]);
    mostrarResultadoTriplo(cartasAbertas);
  }

  atualizarUI();
  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();
}, 2000);

setInterval(() => {
  sincronizarRanking();
}, 10000);

async function inicializarNomeJogador() {
  if (playerName) {
    const resultado = await garantirNomeUnico(playerName).catch(() => null);
    if (resultado?.ok) {
      playerName = resultado.nomeFinal;
      salvar();
      return;
    }
  }

  while (!playerName) {
    const nome = prompt("Digite seu nome de jogador (único):") || "";
    if (!nome.trim()) continue;

    try {
      const resultado = await garantirNomeUnico(nome);
      if (resultado.ok) {
        playerName = resultado.nomeFinal;
        salvar();
        break;
      } else {
        alert(resultado.mensagem);
      }
    } catch {
      alert("Erro ao validar nome. Tente de novo.");
    }
  }
}

window.abrirAba = abrirAba;
window.abrirPack = abrirPack;
window.alternarAbrir3 = alternarAbrir3;
window.pararAbrir3 = pararAbrir3;
window.alternarAutoOpen = alternarAutoOpen;
window.pararAutoOpen = pararAutoOpen;
window.alternarSkipAnimacao = alternarSkipAnimacao;
window.equiparMelhorTime = equiparMelhorTime;
window.resgatarQuest = resgatarQuest;
window.equipar = equipar;
window.desequipar = desequipar;
window.vender = vender;
window.enviarMensagemChat = enviarMensagemChat;
window.trocarNome = trocarNome;

function garantirQuests() {
  if (!Array.isArray(quests) || quests.length === 0) quests = criarQuests();
}

(async function iniciar() {
  garantirQuests();
  await inicializarNomeJogador();
  atualizarUI();
  renderInventario();
  renderQuests();
  salvar();
  sincronizarRanking();

  ouvirRankingColecao("rankingGiros", "giros");
  ouvirRankingColecao("rankingNivel", "nivel");
  ouvirRankingColecao("rankingMoedas", "moedas");
  ouvirRankingColecao("rankingRaras", "raras");
  ouvirChat();
})();
