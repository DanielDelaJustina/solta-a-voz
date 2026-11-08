# Solta a Voz

Karaokê com a letra na TV e o celular como microfone. No fim da música, cada cantor recebe uma nota.

Site: https://danieldelajustina.github.io/solta-a-voz/

## Como jogar

1. Na TV, abra o site e toque em **Abrir o palco na TV** (`tv.html`).
2. No celular, leia o QR code (ou digite o código da sala) e entre com seu nome. Até 4 pessoas cantam juntas.
3. Toque no microfone para ligá-lo. O site precisa de permissão para usar o microfone.
4. Quem entrou primeiro escolhe a música: busca pelo nome, abre o YouTube para achar uma versão karaokê e cola o link.
5. Durante a música, ele pode pausar, terminar e ajustar o tempo da letra ("Letra antes" / "Letra depois").

## Eco, o mascote

O Eco é um microfone com fone de ouvido que muda de cara conforme a pessoa canta. Ele aparece no celular, no lugar do microfone, e na TV, no cartão de cada cantor, na entrada e no resultado.

| Humor | Quando aparece |
|---|---|
| Esperando | Microfone desligado ou em silêncio |
| Normal | Cantando |
| Animado | Voz bem no centro das notas, ou linha "Muito bom!" |
| Desafinado | Voz entre as notas, ou linha "Errou": tapa os ouvidos |
| Astro | Linha "Perfeito!" e nota final 85 ou mais: óculos de estrela |
| Procurando | Olha para os lados (reservado) |

O desenho é SVG com animações CSS (`js/eco.js` e a seção "Eco" de `css/estilo.css`), leve o bastante para a TV. O arquivo `assets/eco.riv` é o mesmo desenho feito no Rive, guardado como referência: exportado no plano grátis, ele sai com marca d'água, por isso o site não o usa. Veja todas as caras em `eco.html`.

## Direitos autorais

O repositório não guarda nenhuma letra nem áudio:

- **Letra sincronizada:** vem na hora do [LRCLIB](https://lrclib.net), uma base pública e gratuita de letras com tempo (formato LRC).
- **Som:** vem de um vídeo do YouTube tocado no player oficial embutido, com o vídeo visível na tela.

Se o dono do vídeo bloqueou a reprodução fora do YouTube, a TV avisa para escolher outro vídeo.

## Como funciona

- A **TV é o juiz**: toca o vídeo, mostra a letra, desenha o tom de cada cantor e calcula as notas (`js/tv.js`).
- O **celular descobre a nota cantada ali mesmo** (Web Audio + autocorrelação, `js/afinador.js`). Ele não manda o áudio para a TV, só uns 20 números por segundo, em pacotes a cada 250 ms.
- A conversa passa pelo **Firebase Realtime Database** (API REST + EventSource, `js/firebase.js`), em `salas/<código>`. Os relógios da TV e do celular são acertados pelo horário do servidor do Firebase.
- O JavaScript da TV é escrito em estilo antigo (`var`/`function`) para rodar no navegador da TV Samsung de 2019.

### Pontuação

Não existe a melodia "oficial" de cada música, então a nota de cada linha da letra junta duas coisas:

- **No tempo:** quanto da linha você cantou enquanto ela estava na tela.
- **Afinação:** quão perto do centro das notas (dó, ré, mi...) a sua voz fica. A afinação padrão das músicas é Lá = 440 Hz, então quem canta afinado com a música fica perto do centro das notas, e quem desafina fica entre elas.

Nota da linha = 100 × no tempo × (0,45 + 0,55 × afinação). A nota final é a média das linhas.

O microfone também ouve a música da TV. Por isso só conta como voz o som bem acima do volume de fundo, que é medido o tempo todo. Cante perto do celular e não deixe a TV alta demais.

## Testar sem microfone

`celular.html?sala=CODIGO&sim=1` finge alguém cantando. Para mais de um cantor no mesmo navegador, use `&j=2`, `&j=3`...

Servidor local: `node ferramentas/servidor.js` (http://localhost:5600). No `localhost` o navegador libera o microfone. Em outro endereço sem HTTPS, ele bloqueia.
