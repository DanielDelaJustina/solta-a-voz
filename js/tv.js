// TV: cria a sala, toca o vídeo do YouTube, mostra a letra e é o juiz da pontuação.
// Os celulares mandam ações em salas/<código>/acoes e as notas cantadas em salas/<código>/voz.
// JavaScript simples (var/function) para o navegador da TV Samsung de 2019.
(function () {
  var esc = KA.esc;
  var params = new URLSearchParams(location.search);
  var sala = params.get('sala') || (params.get('nova') ? null : KA.ls('sala_karaoke')) || KA.novoCodigo();
  KA.ls('sala_karaoke', sala);
  if (params.get('sala') !== sala) history.replaceState(null, '', 'tv.html?sala=' + sala);
  var base = 'salas/' + sala;
  var link = location.href.replace(/tv\.html.*$/, '') + 'celular.html?sala=' + sala;

  var estado = { fase: 'sala', jogadores: [], musica: null, ajuste: 0, placar: {}, resultado: null, msg: null, relogio: null };
  var linhas = [];       // letra da música atual: [{ ini, fim, txt }]
  var acum = {};         // tag -> [{ voz, q }] por linha
  var rastro = {};       // tag -> [[t, midi]] últimos segundos, para o gráfico
  var vistos = {};
  var proxFinal = 0;     // próxima linha a ser pontuada
  var player = null, playerPronto = false, tocando = false;
  var ultT = 0, ultPerf = 0;
  var relogioPub = null;
  var processadas = {};
  var fila = Promise.resolve();

  ECO.criar(document.getElementById('ecoSala')).humor('esperando');
  document.getElementById('codigo').textContent = sala;
  document.getElementById('link').textContent = link;
  document.getElementById('chipSala').textContent = 'sala ' + sala;
  if (window.QRCode) new QRCode(document.getElementById('qr'), { text: link, width: 300, height: 300, colorDark: '#0b1030', colorLight: '#ffffff' });
  document.getElementById('telaCheia').onclick = function () {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };
  document.getElementById('btnTocar').onclick = function () {
    document.getElementById('telaTocar').classList.add('hidden');
    if (player) player.playVideo();
  };

  // ---------- publicação ----------
  var pubAgendada = null;
  function publicar() {
    clearTimeout(pubAgendada);
    pubAgendada = null;
    var pub = {
      fase: estado.fase,
      jogadores: estado.jogadores.map(function (j) { return { tag: j.tag, nome: j.nome, cor: j.cor, nomeCor: j.nomeCor }; }),
      musica: estado.musica,
      ajuste: estado.ajuste,
      placar: estado.placar,
      resultado: estado.resultado,
      msg: estado.msg,
      relogio: estado.relogio,
    };
    desenharTelas();
    return FB.patch(base, { publico: pub, estado: estado }).catch(function (e) { console.error(e); });
  }
  function publicarLogo() {
    if (!pubAgendada) pubAgendada = setTimeout(publicar, 300);
  }
  function avisar(msg) {
    estado.msg = msg ? { txt: msg, t: FB.agora() } : null;
    var el = document.getElementById('aviso');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
    clearTimeout(avisar.t);
    if (msg) avisar.t = setTimeout(function () { el.classList.add('hidden'); }, 8000);
  }

  // ---------- relógio da música ----------
  function tempoVideo() {
    if (!player || !playerPronto || !player.getCurrentTime) return 0;
    var t = player.getCurrentTime() * 1000;
    var p = Date.now();
    if (t !== ultT) {
      ultT = t;
      ultPerf = p;
    }
    return tocando ? ultT + Math.min(600, p - ultPerf) : ultT;
  }
  function atualizarRelogio(forcar) {
    if (estado.fase !== 'cantando') return;
    var r = { inicio: Math.round(FB.agora() - tempoVideo()), pausado: !tocando, n: estado.musica.n };
    if (forcar || !relogioPub || relogioPub.pausado !== r.pausado || Math.abs(relogioPub.inicio - r.inicio) > 120) {
      relogioPub = r;
      estado.relogio = r;
      publicar();
    }
  }
  setInterval(function () { atualizarRelogio(false); }, 3000);

  // ---------- YouTube ----------
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('video', {
      width: '100%',
      height: '100%',
      playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0 },
      events: {
        onReady: function () { playerPronto = true; },
        onStateChange: function (e) {
          tocando = e.data === 1;
          if (e.data === 1) {
            document.getElementById('telaTocar').classList.add('hidden');
            if (estado.fase === 'preparando') {
              estado.fase = 'cantando';
              conferirDuracao();
            }
            atualizarRelogio(true);
          } else if (e.data === 2) {
            atualizarRelogio(true);
          } else if (e.data === 0 && estado.fase === 'cantando') {
            terminar();
          }
        },
        onError: function (e) {
          var codigo = e.data;
          estado.fase = 'sala';
          estado.musica = null;
          avisar(codigo === 101 || codigo === 150 || codigo === 153
            ? 'Esse vídeo não deixa tocar fora do YouTube. Escolha outro vídeo.'
            : 'Não consegui tocar esse vídeo (erro ' + codigo + '). Tente outro link.');
          publicar();
        },
      },
    });
  };

  function conferirDuracao() {
    var dv = player.getDuration ? player.getDuration() : 0;
    var dl = estado.musica.dur || 0;
    if (dv && dl && Math.abs(dv - dl) > 8) {
      avisar('O vídeo tem ' + KA.mmss(dv) + ' e a letra foi feita para ' + KA.mmss(dl) + '. Se a letra sair fora do tempo, ajuste no celular.');
    }
  }

  // ---------- música ----------
  function escolherMusica(acao) {
    if (!playerPronto) return Promise.resolve(avisar('O player do YouTube ainda está carregando. Tente de novo.'));
    avisar('Carregando "' + (acao.titulo || 'música') + '"...');
    return fetch('https://lrclib.net/api/get/' + encodeURIComponent(acao.id)).then(function (r) {
      if (!r.ok) throw new Error('lrclib ' + r.status);
      return r.json();
    }).then(function (d) {
      var ls = KA.lerLRC(d.syncedLyrics);
      if (!ls.length) throw new Error('sem letra sincronizada');
      linhas = ls;
      acum = {};
      rastro = {};
      vistos = {};
      proxFinal = 0;
      estado.placar = {};
      estado.jogadores.forEach(function (j) { estado.placar[j.tag] = { soma: 0, linhas: 0, pres: 0, afin: 0, ultima: null }; });
      estado.musica = { id: d.id, titulo: d.trackName, artista: d.artistName, dur: d.duration, video: acao.video, n: Math.random().toString(36).slice(2, 8) };
      estado.ajuste = 0;
      estado.resultado = null;
      estado.relogio = null;
      relogioPub = null;
      estado.fase = 'preparando';
      avisar(null);
      FB.del(base + '/voz');
      player.cueVideoById(acao.video);
      contagem(3);
      return publicar();
    }).catch(function (e) {
      console.error(e);
      avisar('Não consegui carregar a letra dessa música. Escolha outra.');
      publicar();
    });
  }

  function contagem(n) {
    var tela = document.getElementById('telaContagem');
    document.getElementById('contagemMusica').textContent = estado.musica.titulo + ' · ' + estado.musica.artista;
    tela.classList.remove('hidden');
    document.getElementById('contagem').textContent = n;
    if (n > 0) return setTimeout(function () { contagem(n - 1); }, 1000);
    tela.classList.add('hidden');
    player.playVideo();
    // se a TV bloquear o som automático, pede um OK no controle
    setTimeout(function () {
      if (estado.fase === 'preparando' && player.getPlayerState() !== 1 && player.getPlayerState() !== 3) {
        document.getElementById('telaTocar').classList.remove('hidden');
        document.getElementById('btnTocar').focus();
      }
    }, 2500);
  }

  function terminar() {
    if (estado.fase !== 'cantando' && estado.fase !== 'preparando') return;
    // pontua as linhas que já terminaram; se pararam no meio, as que não chegaram não contam
    finalizarLinhas(tempoVideo() - estado.ajuste + 1500);
    if (player && player.stopVideo) player.stopVideo();
    tocando = false;
    var res = estado.jogadores.map(function (j) {
      var p = estado.placar[j.tag] || { soma: 0, linhas: 0, pres: 0, afin: 0 };
      var n = p.linhas || 1;
      return {
        tag: j.tag, nome: j.nome, cor: j.cor,
        nota: Math.round(p.soma / n),
        pres: Math.round((100 * p.pres) / n),
        afin: Math.round((100 * p.afin) / n),
      };
    });
    res.sort(function (a, b) { return b.nota - a.nota; });
    estado.resultado = res;
    estado.relogio = null;
    estado.fase = 'fim';
    publicar();
  }

  // ---------- pontuação ----------
  function linhaEm(L) {
    var lo = 0, hi = linhas.length - 1, r = -1;
    while (lo <= hi) {
      var m = (lo + hi) >> 1;
      if (linhas[m].ini <= L) { r = m; lo = m + 1; } else hi = m - 1;
    }
    return r;
  }

  function receberAmostras(tag, txt) {
    if (typeof txt !== 'string' || !estado.musica) return;
    var partes = txt.split('|');
    if (partes[0] !== estado.musica.n) return;
    var lista = acum[tag] || (acum[tag] = []);
    var rs = rastro[tag] || (rastro[tag] = []);
    partes[1].split(';').forEach(function (s) {
      var v = s.split(',');
      var t = parseInt(v[0], 10);
      var midi = parseInt(v[1], 10) / 100;
      if (isNaN(t)) return;
      rs.push([t, midi]);
      if (!midi) return;
      var i = linhaEm(t - estado.ajuste);
      if (i < 0 || t - estado.ajuste >= linhas[i].fim || i < proxFinal) return;
      var desvio = Math.abs((midi - Math.round(midi)) * 100);  // centésimos de semitom até a nota mais próxima
      var a = lista[i] || (lista[i] = { voz: 0, q: 0 });
      a.voz++;
      a.q += 1 - desvio / 50;
    });
    while (rs.length && rs[0][0] < rs[rs.length - 1][0] - 12000) rs.shift();
  }

  // pontua as linhas que já terminaram (com folga para as amostras atrasadas chegarem)
  function finalizarLinhas(agoraL) {
    var mudou = false;
    while (proxFinal < linhas.length && linhas[proxFinal].fim + 1500 < agoraL) {
      var ln = linhas[proxFinal];
      var esperadas = ((ln.fim - ln.ini) / 50) * 0.5;
      estado.jogadores.forEach(function (j) {
        var a = (acum[j.tag] || [])[proxFinal] || { voz: 0, q: 0 };
        var pres = Math.min(1, a.voz / esperadas);
        var afin = a.voz ? Math.max(0, Math.min(1, (a.q / a.voz - 0.5) / 0.3)) : 0;
        var nota = Math.round(100 * pres * (0.45 + 0.55 * afin));
        var p = estado.placar[j.tag] || (estado.placar[j.tag] = { soma: 0, linhas: 0, pres: 0, afin: 0 });
        p.soma += nota;
        p.linhas++;
        p.pres += pres;
        p.afin += afin;
        p.ultima = { nota: nota, txt: KA.elogio(nota), i: proxFinal };
      });
      proxFinal++;
      mudou = true;
    }
    if (mudou && agoraL !== Infinity) publicarLogo();
  }

  FB.stream(base + '/voz', function (caminho, dados) {
    if (!dados) return;
    var partes = caminho.replace(/^\//, '').split('/').filter(Boolean);
    function bloco(tag, chave, txt) {
      if (vistos[tag + chave]) return;
      vistos[tag + chave] = true;
      receberAmostras(tag, txt);
    }
    if (partes.length === 0) {
      for (var tag in dados) for (var k in dados[tag]) bloco(tag, k, dados[tag][k]);
    } else if (partes.length === 1) {
      for (var k2 in dados) bloco(partes[0], k2, dados[k2]);
    } else {
      bloco(partes[0], partes[1], dados);
    }
  });

  // ---------- ações dos celulares ----------
  function jogadorDe(key) {
    for (var i = 0; i < estado.jogadores.length; i++) if (estado.jogadores[i].key === key) return i;
    return -1;
  }
  function processar(acao) {
    var idx = jogadorDe(acao.key);
    var dono = idx === 0;
    switch (acao.tipo) {
      case 'entrar':
        if (idx >= 0) return null;
        if (estado.jogadores.length >= 4) return avisar('A sala já tem 4 cantores.');
        var usadas = estado.jogadores.map(function (j) { return j.cor; });
        var c = KA.CORES.filter(function (x) { return usadas.indexOf(x.cor) < 0; })[0];
        var nome = String(acao.nome || 'Cantor').slice(0, 14);
        var tag = acao.key.slice(-4);
        estado.jogadores.push({ key: acao.key, tag: tag, nome: nome, cor: c.cor, nomeCor: c.nome });
        if (estado.fase !== 'sala' && estado.fase !== 'fim') estado.placar[tag] = { soma: 0, linhas: 0, pres: 0, afin: 0, ultima: null };
        return null;
      case 'renomear':
        if (idx >= 0) estado.jogadores[idx].nome = String(acao.nome || '').slice(0, 14) || estado.jogadores[idx].nome;
        return null;
      case 'sair':
        if (idx >= 0) estado.jogadores.splice(idx, 1);
        return null;
      case 'musica':
        if (!dono) return null;
        return escolherMusica(acao);
      case 'pausar':
        if (dono && player && estado.fase === 'cantando') player.pauseVideo();
        return null;
      case 'continuar':
        if (dono && player && estado.fase === 'cantando') player.playVideo();
        return null;
      case 'ajuste':
        if (dono) estado.ajuste = Math.max(-10000, Math.min(10000, estado.ajuste + (Number(acao.delta) || 0)));
        return null;
      case 'parar':
        if (dono) terminar();
        return null;
      case 'voltar':
        if (dono) {
          if (player && player.stopVideo) player.stopVideo();
          estado.fase = 'sala';
          estado.resultado = null;
          estado.relogio = null;
        }
        return null;
    }
    return null;
  }

  // ---------- telas ----------
  function desenharTelas() {
    var f = estado.fase;
    document.getElementById('telaSala').classList.toggle('hidden', f !== 'sala');
    document.getElementById('telaFim').classList.toggle('hidden', f !== 'fim');
    if (f !== 'preparando') document.getElementById('telaContagem').classList.add('hidden');

    var m = estado.musica;
    document.getElementById('faixaMusica').innerHTML = m && f !== 'sala' ? '<b>' + esc(m.titulo) + '</b> · ' + esc(m.artista) : '';

    var html = '';
    estado.jogadores.forEach(function (j, i) {
      html += '<div class="jog"><span class="bola" style="background:' + j.cor + ';box-shadow:0 0 14px ' + j.cor + '"></span>' + esc(j.nome) + (i === 0 ? ' <small>(escolhe as músicas)</small>' : '') + '</div>';
    });
    document.getElementById('listaJog').innerHTML = html || '<div class="dica">Ninguém entrou ainda.</div>';
    document.getElementById('dicaSala').textContent = estado.jogadores.length
      ? estado.jogadores[0].nome + ': escolha a música no celular. Até 4 pessoas cantam juntas.'
      : 'Entre pelo celular para começar.';

    if (f === 'fim' && estado.resultado) {
      document.getElementById('fimMusica').textContent = m ? m.titulo + ' · ' + m.artista : '';
      var ph = '';
      estado.resultado.forEach(function (r, i) {
        ph += '<div class="lugar' + (i === 0 ? ' primeiro' : '') + '" style="--c:' + r.cor + '">' +
          '<div class="lugar-eco" id="ecoFim' + i + '"></div>' +
          '<div class="pos">' + (i + 1) + 'º</div><div class="nome">' + esc(r.nome) + '</div>' +
          '<div class="nota">' + r.nota + '</div><div class="titulo">' + esc(KA.titulo(r.nota)) + '</div>' +
          '<div class="stats"><span>No tempo ' + r.pres + '%</span><span>Afinação ' + r.afin + '%</span></div></div>';
      });
      document.getElementById('podio').innerHTML = ph || '<p class="dica">Ninguém cantou.</p>';
      estado.resultado.forEach(function (r, i) {
        var e = ECO.criar(document.getElementById('ecoFim' + i));
        e.humor(ECO.humorDaNota(r.nota));
        e.boca(r.nota >= 55 ? 0.9 : 0.4);
      });
    }
    desenharCantores();
  }

  // cartões dos cantores: criados uma vez por cantor (o Eco de cada um continua animando)
  var cartoes = {};
  function desenharCantores() {
    var lista = document.getElementById('cantores');
    var tags = {};
    estado.jogadores.forEach(function (j, i) {
      tags[j.tag] = true;
      var c = cartoes[j.tag];
      if (!c) {
        var el = document.createElement('div');
        el.className = 'cantor';
        el.innerHTML = '<div class="cantor-eco"></div><div class="cantor-info">' +
          '<div class="cantor-topo"><span class="nome"></span><span class="pts"></span></div>' +
          '<div class="medidor"><div class="nivel"></div></div><div class="elogio"></div></div>';
        c = cartoes[j.tag] = {
          el: el, eco: ECO.criar(el.querySelector('.cantor-eco')),
          nome: el.querySelector('.nome'), pts: el.querySelector('.pts'), nivel: el.querySelector('.nivel'), elogio: el.querySelector('.elogio'),
          ultima: null, humorAte: 0, humorLinha: 0,
        };
      }
      if (lista.children[i] !== c.el) lista.insertBefore(c.el, lista.children[i] || null);
      c.el.style.setProperty('--c', j.cor);
      c.nome.textContent = j.nome;
      var p = estado.placar[j.tag];
      c.pts.textContent = p && p.linhas ? Math.round(p.soma / p.linhas) : 0;
      if (p && p.ultima && c.ultima !== p.ultima.i) {
        c.ultima = p.ultima.i;
        c.elogio.textContent = p.ultima.txt;
        c.elogio.className = 'elogio';
        void c.elogio.offsetWidth; // reinicia a animação
        c.elogio.className = 'elogio mostra ' + (p.ultima.nota >= 65 ? 'bom' : p.ultima.nota >= 40 ? 'ok' : 'ruim');
        c.humorLinha = ECO.humorDaNota(p.ultima.nota);
        c.humorAte = Date.now() + 3000;
      }
    });
    for (var t in cartoes) {
      if (!tags[t]) {
        lista.removeChild(cartoes[t].el);
        delete cartoes[t];
      }
    }
  }

  // humor do Eco de cada cantor: a última linha por 3 s; depois, se está cantando ou não
  function humorCantor(c, voz) {
    if (estado.fase === 'sala') return ECO.HUMOR.esperando;
    if (estado.fase !== 'cantando') return ECO.HUMOR.normal;
    if (c.humorAte > Date.now()) return c.humorLinha;
    return voz > 0.25 ? ECO.HUMOR.normal : ECO.HUMOR.esperando;
  }

  // letra: linha anterior, a atual enchendo de cor e as próximas
  var letraEl = document.getElementById('letra');
  var linhaDesenhada = -2, cheioEl = null;
  function tamanho(txt) {
    return Math.min(4.4, 100 / Math.max(10, txt.length)).toFixed(2) + 'vw';
  }
  function desenharLetra(L) {
    if (!linhas.length || estado.fase === 'sala') {
      if (linhaDesenhada !== -3) {
        letraEl.innerHTML = '<div class="espera">Escolha uma música no celular</div>';
        linhaDesenhada = -3;
      }
      return;
    }
    var i = linhaEm(L);
    var ativa = i >= 0 && L < linhas[i].fim;
    var chave = ativa ? i : -10 - i;
    if (chave !== linhaDesenhada) {
      linhaDesenhada = chave;
      var html = '';
      var ant = ativa ? i - 1 : i;
      var prox = i + 1;
      html += '<div class="l anterior">' + (ant >= 0 ? esc(linhas[ant].txt) : '&nbsp;') + '</div>';
      if (ativa) {
        var t = esc(linhas[i].txt);
        html += '<div class="l atual" style="font-size:' + tamanho(linhas[i].txt) + '"><span class="base">' + t + '</span><span class="cheio" id="cheio"><span>' + t + '</span></span></div>';
      } else {
        html += '<div class="l atual pausa"><span class="pontos" id="pontos"></span></div>';
      }
      for (var k = prox; k < prox + 2; k++) html += '<div class="l proxima">' + (linhas[k] ? esc(linhas[k].txt) : '&nbsp;') + '</div>';
      letraEl.innerHTML = html;
      cheioEl = document.getElementById('cheio');
    }
    if (ativa && cheioEl) {
      var ln = linhas[i];
      var prog = Math.max(0, Math.min(1, (L - ln.ini) / ((ln.fim - ln.ini) * 0.85)));
      cheioEl.style.width = (prog * 100).toFixed(1) + '%';
    } else if (!ativa) {
      var pt = document.getElementById('pontos');
      var falta = linhas[i + 1] ? linhas[i + 1].ini - L : Infinity;
      if (pt) pt.textContent = falta < 3500 ? new Array(Math.ceil(falta / 1000) + 1).join('● ') : (i + 1 >= linhas.length ? 'Fim da letra' : '♪');
    }
  }

  // gráfico do tom: cada cantor é uma linha brilhante
  var canvas = document.getElementById('grafico');
  var ctx = canvas.getContext('2d');
  var faixaMin = 52, faixaMax = 72;
  var JANELA = 7000, ATRASO = 450;
  function desenharGrafico(T) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    var fimJ = T - ATRASO, iniJ = fimJ - JANELA;
    var mn = 200, mx = 0;
    var tags = Object.keys(rastro);
    tags.forEach(function (tag) {
      rastro[tag].forEach(function (s) {
        if (s[0] < iniJ || !s[1]) return;
        if (s[1] < mn) mn = s[1];
        if (s[1] > mx) mx = s[1];
      });
    });
    if (mx > 0) {
      var alvoMin = Math.min(mn - 3, (mn + mx) / 2 - 8), alvoMax = Math.max(mx + 3, (mn + mx) / 2 + 8);
      faixaMin += (alvoMin - faixaMin) * 0.05;
      faixaMax += (alvoMax - faixaMax) * 0.05;
    }
    function y(m) { return h - ((m - faixaMin) / (faixaMax - faixaMin)) * h; }
    function x(t) { return ((t - iniJ) / JANELA) * w; }
    // linhas de semitom (Dó mais forte)
    for (var s = Math.ceil(faixaMin); s <= faixaMax; s++) {
      ctx.fillStyle = s % 12 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, Math.round(y(s)), w, 1);
    }
    // faixas das linhas da letra
    if (linhas.length) {
      ctx.fillStyle = 'rgba(168,85,247,0.08)';
      for (var i = Math.max(0, linhaEm(iniJ - estado.ajuste)); i < linhas.length; i++) {
        var a = linhas[i].ini + estado.ajuste, b = linhas[i].fim + estado.ajuste;
        if (a > fimJ) break;
        ctx.fillRect(x(a), 0, x(b) - x(a), h);
      }
    }
    estado.jogadores.forEach(function (j) {
      var rs = rastro[j.tag];
      if (!rs) return;
      [[10, 0.18], [4, 1]].forEach(function (estilo) {
        ctx.strokeStyle = j.cor;
        ctx.globalAlpha = estilo[1];
        ctx.lineWidth = estilo[0];
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        var antes = null;
        for (var k = 0; k < rs.length; k++) {
          var s2 = rs[k];
          if (s2[0] < iniJ || s2[0] > fimJ) continue;
          if (!s2[1]) { antes = null; continue; }
          if (antes && s2[0] - antes[0] < 160 && Math.abs(s2[1] - antes[1]) < 4) ctx.lineTo(x(s2[0]), y(s2[1]));
          else ctx.moveTo(x(s2[0]), y(s2[1]));
          antes = s2;
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      // medidor de "está cantando agora" e o Eco do cantor
      var c = cartoes[j.tag];
      if (c) {
        var voz = 0, tot = 0;
        for (var q = rs.length - 1; q >= 0 && rs[q][0] > fimJ - 600; q--) {
          tot++;
          if (rs[q][1]) voz++;
        }
        var frac = tot ? voz / tot : 0;
        c.nivel.style.width = Math.round(100 * frac) + '%';
        c.eco.humor(humorCantor(c, frac));
        c.eco.boca(0.2 + 0.7 * frac);
      }
    });
    // quem ainda não mandou voz nenhuma
    estado.jogadores.forEach(function (j) {
      var c = cartoes[j.tag];
      if (c && !rastro[j.tag]) {
        c.eco.humor(humorCantor(c, 0));
        c.nivel.style.width = '0%';
      }
    });
  }

  function quadro() {
    var T = tempoVideo();
    var cantando = estado.fase === 'cantando';
    if (cantando) {
      finalizarLinhas(T - estado.ajuste);
      // terminou a letra: dá um respiro e mostra o resultado
      if (linhas.length && proxFinal >= linhas.length) terminar();
    }
    desenharLetra(T - estado.ajuste);
    desenharGrafico(T);
    requestAnimationFrame(quadro);
  }

  // ---------- início ----------
  FB.medirRelogio(base + '/relogioTV').then(function () {
    return FB.get(base + '/estado');
  }).then(function (salvo) {
    // a TV pode recarregar: mantém os cantores, mas volta para a escolha de música
    if (salvo && salvo.jogadores) {
      estado.jogadores = salvo.jogadores;
      estado.placar = {};
    }
    return publicar();
  }).then(function () {
    FB.listen(base + '/acoes', function (acoes) {
      if (!acoes) return;
      Object.keys(acoes).sort().forEach(function (id) {
        if (processadas[id]) return;
        processadas[id] = true;
        fila = fila.then(function () {
          return Promise.resolve(processar(acoes[id])).then(function () {
            return Promise.all([publicar(), FB.del(base + '/acoes/' + id)]);
          });
        }).catch(function (e) { console.error(e); });
      });
    });
    requestAnimationFrame(quadro);
  });
})();
