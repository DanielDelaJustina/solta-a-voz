// Coisas usadas pela TV e pelo celular. JavaScript simples para o navegador da TV de 2019.
(function () {
  var CORES = [
    { cor: '#22d3ee', nome: 'Ciano' },
    { cor: '#e879f9', nome: 'Rosa' },
    { cor: '#a3e635', nome: 'Lima' },
    { cor: '#fbbf24', nome: 'Ouro' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function novoCodigo() {
    var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var c = '';
    for (var i = 0; i < 5; i++) c += letras.charAt(Math.floor(Math.random() * letras.length));
    return c;
  }
  function mmss(seg) {
    seg = Math.max(0, Math.round(seg));
    var s = seg % 60;
    return Math.floor(seg / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  // Letra sincronizada no formato LRC ("[01:02.34] texto") -> [{ ini, fim, txt }] em ms.
  // Linhas vazias marcam pausas: servem só para terminar a linha anterior.
  function lerLRC(lrc) {
    var marcas = [];
    String(lrc || '').split(/\r?\n/).forEach(function (linha) {
      var re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
      var m, tempos = [], fimTags = 0;
      while ((m = re.exec(linha))) {
        tempos.push(Math.round((parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000));
        fimTags = re.lastIndex;
      }
      if (!tempos.length) return;
      // tira marcas de palavra (<00:01.23>) de letras com sincronia por palavra
      var txt = linha.slice(fimTags).replace(/<\d+:\d+(?:\.\d+)?>/g, '').replace(/\s+/g, ' ').trim();
      tempos.forEach(function (t) { marcas.push({ t: t, txt: txt }); });
    });
    marcas.sort(function (a, b) { return a.t - b.t; });
    var linhas = [];
    for (var i = 0; i < marcas.length; i++) {
      if (!marcas[i].txt) continue;
      var prox = marcas[i + 1] ? marcas[i + 1].t : marcas[i].t + 6000;
      linhas.push({ ini: marcas[i].t, fim: Math.min(prox, marcas[i].t + 10000), txt: marcas[i].txt });
    }
    return linhas;
  }

  // aceita youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID ou só o ID
  function idDoVideo(texto) {
    texto = String(texto || '').trim();
    var m = texto.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(texto)) return texto;
    return null;
  }

  // nota da linha (0 a 100) -> elogio mostrado na TV e no celular
  function elogio(n) {
    if (n >= 85) return 'Perfeito!';
    if (n >= 65) return 'Muito bom!';
    if (n >= 40) return 'Bom';
    if (n >= 15) return 'Quase';
    return 'Errou';
  }
  function titulo(n) {
    if (n >= 85) return 'Estrela do palco';
    if (n >= 70) return 'Arrasou';
    if (n >= 50) return 'Mandou bem';
    if (n >= 30) return 'Aquecendo a voz';
    return 'Faltou coragem';
  }

  // chave da YouTube Data API (só funciona no site do Solta a Voz e no localhost); vazia = colar o link na mão
  var YT_KEY = '';

  window.KA = { YT_KEY: YT_KEY, CORES: CORES, esc: esc, ls: ls, novoCodigo: novoCodigo, mmss: mmss, lerLRC: lerLRC, idDoVideo: idDoVideo, elogio: elogio, titulo: titulo };
})();
