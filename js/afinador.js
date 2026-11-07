// Descobre a nota que a pessoa está cantando, no próprio celular (Web Audio + autocorrelação).
// A música da TV também chega no microfone, então só conta como voz o som bem acima do "ruído de fundo",
// que é medido continuamente (o volume que fica sempre lá, mesmo nas respirações).
(function () {
  var TAM = 2048;

  // autocorrelação normalizada (método de McLeod): devolve { freq, clareza } ou null
  function detectar(buf, taxa) {
    var n = buf.length;
    var minLag = Math.floor(taxa / 1050);
    var maxLag = Math.min(Math.floor(taxa / 75), n >> 1);
    var nsdf = new Float32Array(maxLag + 2);
    for (var tau = 1; tau <= maxLag + 1; tau++) {
      var acf = 0, m = 0;
      for (var i = 0; i < n - tau; i++) {
        acf += buf[i] * buf[i + tau];
        m += buf[i] * buf[i] + buf[i + tau] * buf[i + tau];
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }
    // picos depois de cada cruzamento por zero
    var picos = [], melhor = 0, tau2 = 1;
    while (tau2 <= maxLag && nsdf[tau2] > 0) tau2++;
    while (tau2 <= maxLag) {
      while (tau2 <= maxLag && nsdf[tau2] <= 0) tau2++;
      var pico = -1;
      while (tau2 <= maxLag && nsdf[tau2] > 0) {
        if (pico < 0 || nsdf[tau2] > nsdf[pico]) pico = tau2;
        tau2++;
      }
      if (pico >= minLag) {
        picos.push(pico);
        if (nsdf[pico] > melhor) melhor = nsdf[pico];
      }
    }
    if (!picos.length || melhor < 0.5) return null;
    var esc = picos[0];
    for (var k = 0; k < picos.length; k++) {
      if (nsdf[picos[k]] >= 0.9 * melhor) { esc = picos[k]; break; }
    }
    var a = nsdf[esc - 1], b = nsdf[esc], c = nsdf[esc + 1];
    var desl = (a - 2 * b + c) !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
    return { freq: taxa / (esc + desl), clareza: b };
  }

  // cfg.aoMedir({ rms, nivel (0..1), midi (nota em semitons, fracionada) ou 0 }) ~20 vezes por segundo
  function Afinador(cfg) {
    this.cfg = cfg;
    this.historico = [];
  }

  Afinador.prototype.ligar = function () {
    var self = this;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !Ctx) {
      return Promise.reject(new Error('Este navegador não deixa usar o microfone.'));
    }
    self.ctx = new Ctx();
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }).then(function (stream) {
      self.stream = stream;
      var fonte = self.ctx.createMediaStreamSource(stream);
      self.analisador = self.ctx.createAnalyser();
      self.analisador.fftSize = TAM;
      fonte.connect(self.analisador);
      self.buf = new Float32Array(TAM);
      if (self.ctx.state === 'suspended') self.ctx.resume();
      self.timer = setInterval(function () { self.medir(); }, 50);
    });
  };

  Afinador.prototype.medir = function () {
    var buf = this.buf;
    this.analisador.getFloatTimeDomainData(buf);
    var soma = 0;
    for (var i = 0; i < buf.length; i++) soma += buf[i] * buf[i];
    var rms = Math.sqrt(soma / buf.length);

    // ruído de fundo = volume que fica por baixo de 80% das medições dos últimos ~6 s
    var h = this.historico;
    h.push(rms);
    if (h.length > 120) h.shift();
    var ord = h.slice().sort(function (a, b) { return a - b; });
    var fundo = ord[Math.floor(ord.length * 0.2)] || 0;
    var limiar = Math.max(0.012, fundo * 2.2);

    var midi = 0;
    if (rms > limiar) {
      // metade da taxa (média de pares) deixa a conta 4x mais leve e ainda sobra para a voz
      var meio = this.meio || (this.meio = new Float32Array(buf.length >> 1));
      for (var j = 0; j < meio.length; j++) meio[j] = (buf[2 * j] + buf[2 * j + 1]) * 0.5;
      var r = detectar(meio, this.ctx.sampleRate / 2);
      if (r && r.clareza > 0.82 && r.freq > 75 && r.freq < 1050) midi = 69 + 12 * Math.log(r.freq / 440) / Math.LN2;
    }
    var nivel = Math.min(1, rms / Math.max(limiar * 3, 0.05));
    this.cfg.aoMedir({ rms: rms, nivel: nivel, midi: midi });
  };

  Afinador.prototype.desligar = function () {
    clearInterval(this.timer);
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
    if (this.ctx && this.ctx.close) this.ctx.close();
  };

  // modo de teste (?sim=1): finge alguém cantando, para testar sem microfone
  function Simulado(cfg) {
    this.cfg = cfg;
  }
  Simulado.prototype.ligar = function () {
    var self = this, t = 0, nota = 60, canta = true;
    self.timer = setInterval(function () {
      t++;
      if (t % 12 === 0) {
        canta = Math.random() < 0.8;
        nota = 55 + Math.floor(Math.random() * 12);
      }
      var desvio = (Math.random() - 0.5) * 0.4 + Math.sin(t / 2) * 0.1;
      self.cfg.aoMedir({ rms: canta ? 0.1 : 0.005, nivel: canta ? 0.5 + Math.random() * 0.4 : 0.05, midi: canta ? nota + desvio : 0 });
    }, 50);
    return Promise.resolve();
  };
  Simulado.prototype.desligar = function () { clearInterval(this.timer); };

  window.AFINADOR = { Afinador: Afinador, Simulado: Simulado, detectar: detectar };
})();
