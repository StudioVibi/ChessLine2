# Chess Line 2 - Guia Rápido

Este é um resumo didático do GDD principal, focado em duas coisas: como jogar e quais regras controlam a partida.

## Como Jogar

### Objetivo

Chess Line 2 é um jogo 1v1 em uma esteira linear. Cada jogador tem um rei em uma ponta do tabuleiro. O objetivo de cada round é matar o rei inimigo ou forçar um empate quando não houver mais peças comuns nem estoque para invocar.

A partida completa tem 4 rounds:

1. Draft
2. Round 1
3. Pick 1: Buff
4. Round 2
5. Pick 2: Transform
6. Round 3
7. Pick 3: Transform
8. Final Round
9. Relatório final

Quem tiver mais pontos ao fim do Final Round vence a run. Se os dois jogadores terminarem com a mesma pontuação, a run termina empatada.

### 1. Monte seu Draft

Antes da partida, cada jogador monta seu estoque de peças.

Cada jogador pode escolher qualquer quantidade de peças comuns, desde que o peso total seja no máximo 20.

O rei já vem automaticamente, pesa 0 e não pode ser escolhido no Draft.

Pesos e stats:

| Peça | Dano | Vida | Peso |
| --- | ---: | ---: | ---: |
| Pawn | 1 | 1 | 1 |
| Knight | 3 | 3 | 3 |
| Bishop | 3 | 3 | 3 |
| Tower | 5 | 5 | 5 |
| Queen | 9 | 9 | 9 |
| King | 4 | 4 | 0 |

Exemplo válido:

```text
Queen x1 = 9
Tower x1 = 5
Bishop x2 = 6
Total = 20
```

Exemplo inválido:

```text
Queen x2 = 18
Tower x1 = 5
Total = 23
```

### 2. Jogue os Rounds

Cada round começa com o tabuleiro resetado e com o estoque do Draft restaurado.

Durante o round, cada jogador pode preparar uma invocação. A peça invocada entra apenas no fim do turno, na fase de Summon Resolution.

Se a peça entrar com sucesso, ela é consumida do estoque daquele round. Se a invocação falhar porque o slot está ocupado, a peça não é consumida.

Ao fim de cada round:

- Vitória vale 1 ponto.
- Empate vale 0,5 ponto para cada jogador.
- Derrota vale 0 ponto.

### 3. Escolha Picks Entre Rounds

Entre rounds existem Picks. Picks são modificadores globais que duram até o fim da run.

Pick 1 oferece Buffs:

- Multidão
- Crescimento
- Atropelamento

Pick 2 oferece Transforms:

- Pawn 2x vs Knight/Bishop
- Bishop Line
- Tower Durability

Pick 3 oferece Transforms:

- Queen Speed
- Knight 2x Territory
- Knight Void Step
- Pawn King Slayer

Os Picks são simultâneos:

- Qualquer jogador pode escolher primeiro.
- Os dois jogadores escolhem no mesmo Pick.
- A informação exata do input escolhido deve ser velada para o outro jogador até o momento de revelação/aplicação.
- Quando uma opção é revelada e aceita, essa opção fica bloqueada para o outro naquele Pick.
- Se os dois jogadores selarem a mesma opção, a primeira revelação válida permanece e a escolha duplicada é rejeitada.
- As duas escolhas válidas entram como efeitos globais permanentes.

### 4. Use o Placar

O placar fica acima da esteira.

White aparece à esquerda. Black aparece à direita.

Valores possíveis incluem:

```text
0 / 0,5 / 1 / 1,5 / 2 / 2,5 / 3 / 3,5 / 4
```

O placar só muda ao fim de um round.

## Regras do Jogo

### Informação Velada

Informações de input devem ser veladas quando forem escolhas estratégicas do jogador.

Isso significa:

- cada jogador pode ver o próprio input
- o oponente não deve ver o conteúdo exato antes da resolução
- o sistema pode indicar que um jogador já confirmou uma ação, mas não deve revelar qual ação foi escolhida antes da hora
- quando a fase resolver, a ação pode ser revelada pelo resultado do jogo
- tecnicamente, o estado online deve guardar apenas um compromisso opaco até a revelação

Inputs que devem ser tratados como informação velada:

- peça preparada para invocação
- slot de invocação escolhido, normal ou special
- escolha de Pick enquanto o outro jogador ainda não confirmou

Informações públicas continuam visíveis:

- estado atual do board
- vida e dano das peças em campo
- estoque restante, se a UI decidir manter estoque como informação pública
- pontuação
- round, turno e phase atual

Regra prática: o jogador não deve conseguir reagir ao input secreto do oponente antes da resolução desse input.

### Tabuleiro

O tabuleiro tem 10 slots:

```text
[0][1][2][3][4][5][6][7][8][9]
```

Função de cada slot:

| Slot | Função |
| ---: | --- |
| 0 | White King |
| 1 | White Invoke |
| 2 | White Special Invoke |
| 3 | Lane |
| 4 | Lane |
| 5 | Lane |
| 6 | Lane |
| 7 | Black Special Invoke |
| 8 | Black Invoke |
| 9 | Black King |

White anda para a direita.

Black anda para a esquerda.

Reis não se movem.

### Territórios

O território White são os 4 slots mais próximos do White King:

```text
0, 1, 2, 3
```

O território Black são os 4 slots mais próximos do Black King:

```text
6, 7, 8, 9
```

Território não altera as regras básicas por si só. Ele existe para efeitos específicos, como Knight causar 2x dano em peças no território adversário.

### Estrutura de Turno

Cada turno dentro de um round segue sempre esta ordem:

1. White Move
2. White Collision
3. Black Move
4. Black Collision
5. Summon Resolution

Não existe mais mecânica de enjoo. Peças invocadas podem agir normalmente quando chegar a próxima fase de movimento da sua cor.

### Movimento

Cada peça comum tenta avançar 1 slot na fase de movimento da sua cor.

Uma peça só move se:

- estiver viva
- não for rei

Se o slot à frente tem uma peça aliada, a peça fica bloqueada.

Se o slot à frente tem uma peça inimiga, acontece confronto.

Alguns efeitos mudam movimento, como:

- Queen Speed: Queen avança até 5 slots.
- Knight Void Step: Knight ignora colisão com Pawns e tenta pular para o slot seguinte.

### Prioridade de Movimento

Dentro da fase de movimento, as peças não andam em ordem aleatória.

A prioridade é:

1. Peça com mais movimentos acumulados age primeiro.
2. Empate para White: menor índice age primeiro.
3. Empate para Black: maior índice age primeiro.

Essa regra evita engarrafamentos e mantém o jogo determinístico.

### Confronto e Dano

Confronto acontece quando uma peça tenta entrar em um slot ocupado por inimigo, incluindo o rei.

No confronto:

- atacante causa dano ao defensor
- defensor causa dano ao atacante
- o dano é simultâneo
- mesmo se uma peça morrer, ela ainda causa dano naquele confronto

Depois da resolução de dano, peças comuns com vida 0 ou menor são removidas antes da próxima fase.

Se um rei morre, o round acaba imediatamente.

Se os dois reis morrem no mesmo confronto/fase, o round termina empatado.

### Invocação

Cada jogador pode deixar uma peça preparada para invocação.

O commit de invocação é informação velada até a Summon Resolution.

Slots de invocação:

| Jogador | Normal | Special |
| --- | ---: | ---: |
| White | 1 | 2 |
| Black | 8 | 7 |

A invocação só é resolvida na Summon Resolution.

Se o slot estiver livre na resolução, a peça entra.

Se o slot estiver ocupado na resolução, a invocação falha.

A validação real acontece na resolução, não no momento do commit.

Antes da resolução, a UI pode mostrar que o jogador confirmou uma invocação, mas não deve revelar a peça nem se ela foi para o slot normal ou special.

### Empate de Round

Um round empata quando:

- não existe nenhuma peça viva no tabuleiro além dos reis
- e todos os estoques disponíveis para invocação do round foram usados

Nesse caso, os dois jogadores recebem 0,5 ponto.

### Buffs

Buffs são globais, simétricos e permanentes.

Eles afetam peças dos dois jogadores, peças atuais e peças futuras.

#### Multidão

Todas as peças ganham +1 de dano.

Esse bônus entra antes de multiplicadores.

#### Crescimento

Quando uma peça se move, ela cura 1 de vida se estiver machucada.

Não existe sobrecura.

#### Atropelamento

Quando uma peça mata um alvo com dano excedente, esse dano excedente pode atingir até 1 alvo adicional em sequência.

Não pode continuar para um terceiro alvo.

### Transforms

Transforms também são globais, simétricas e permanentes.

Elas afetam todas as peças daquele tipo, dos dois jogadores.

#### Pawn 2x vs Knight/Bishop

Pawns causam 2x dano contra Knights e Bishops.

Com Multidão, o cálculo é:

```text
(dano base + 1) x 2
```

#### Bishop Line

Bishops causam dano a uma sequência de unidades iguais.

A sequência para quando encontra uma unidade de outro tipo.

#### Tower Durability

Towers recebem 1 dano a menos.

O dano final nunca fica negativo.

#### Queen Speed

Queens avançam até 5 slots.

A Queen para quando:

- encontra aliado
- encontra inimigo para confronto
- chega ao limite de 5 slots

#### Knight 2x Territory

Knights causam 2x dano contra peças localizadas no território adversário.

#### Knight Void Step

Knights ignoram colisão com Pawns.

Se o Knight encontraria um Pawn, ele tenta andar 1 slot a mais.

O slot depois do Pawn decide o resultado:

- vazio: Knight ocupa o slot
- inimigo: acontece confronto
- aliado: Knight fica bloqueado

#### Pawn King Slayer

Pawns causam 4x dano contra Kings.

Visualmente pode parecer instakill, mas a regra real é multiplicador de dano.

Com Multidão, o cálculo é:

```text
(dano base + 1) x 4
```

### Ordem de Cálculo de Dano

Sempre aplique bônus aditivos antes de multiplicadores.

Exemplo:

```text
Pawn base = 1
Multidão = +1
Multiplicador = 2x

(1 + 1) x 2 = 4
```

### Determinismo

O jogo deve produzir sempre o mesmo resultado para o mesmo estado inicial e a mesma sequência de inputs.

Requisitos:

- mesma ordem de fases
- mesma prioridade de movimento
- mesma resolução de colisões
- nenhuma aleatoriedade real
- efeitos visuais não alteram lógica
- commits resolvidos apenas na Summon Resolution
- picks aplicados apenas entre rounds
- vitória de round contabilizada imediatamente quando um rei morre
