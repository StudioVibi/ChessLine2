# TODO - Chess Line 2
codex resume 019dda5a-ce48-7040-a468-4e48c23c5570
Fonte principal: `GDD_Chess_Line_2.txt`

## Escopo Base

- [x] Implementar o jogo em TS + React.
- [x] Manter uma engine deterministica para a logica de jogo.
- [x] Implementar modo alvo 1v1 online.
- [x] Manter menu principal fora do escopo deste GDD.
- [x] Manter matchmaking fora do escopo deste GDD.
- [x] Manter backend/AWS fora do escopo deste GDD.
- [x] Manter regras de CL2 com precedencia sobre regras herdadas do CL1.

## Fluxo Macro da Run

- [x] Implementar fluxo: Draft -> Round 1 -> Pick 1 -> Round 2 -> Pick 2 -> Round 3 -> Pick 3 -> Final Round -> Relatorio.
- [x] Implementar hierarquia Rodadas -> Turnos -> Phases.
- [x] Implementar tela/estado de Draft.
- [x] Implementar tela/estado de intro de Round.
- [x] Implementar tela/estado de Battle.
- [x] Implementar tela/estado de resultado de Round.
- [x] Implementar tela/estado de Pick.
- [x] Implementar tela/estado de Relatorio final.
- [x] Resetar board e pecas entre rounds.
- [x] Restaurar estoque definido no Draft ao iniciar cada round.
- [x] Manter apenas efeitos globais entre rounds.

## Board, Slots e Territorio

- [x] Implementar board linear com 10 slots.
- [x] Reservar slot 0 para White King.
- [x] Reservar slot 9 para Black King.
- [x] Usar slot 1 como invocacao normal White.
- [x] Usar slot 2 como invocacao especial White.
- [x] Usar slot 8 como invocacao normal Black.
- [x] Usar slot 7 como invocacao especial Black.
- [x] Usar slots 3, 4, 5 e 6 como pista central.
- [x] Implementar direcao White para direita.
- [x] Implementar direcao Black para esquerda.
- [x] Impedir movimento dos reis.
- [x] Implementar territorio White como slots 0 a 3.
- [x] Implementar territorio Black como slots 6 a 9.
- [x] Garantir que territorio nao altera movimento, colisao, confronto, invocacao ou bloqueio por padrao.
- [x] Usar territorio para efeitos especificos, como Knight 2x em territorio adversario.
- [ ] Melhorar UI da esteira para identificar visualmente slots de invocacao normal/especial, nao apenas indices.

## Pecas, Stats e Draft

- [x] Implementar Pawn com 1 dano / 1 vida / peso 1.
- [x] Implementar Knight com 3 dano / 3 vida / peso 3.
- [x] Implementar Bishop com 3 dano / 3 vida / peso 3.
- [x] Implementar Tower/Rook com 5 dano / 5 vida / peso 5.
- [x] Implementar Queen com 9 dano / 9 vida / peso 9.
- [x] Implementar King com 4 dano / 4 vida / peso 0.
- [x] Incluir King automaticamente.
- [x] Remover King das opcoes de Draft.
- [x] Permitir escolher quantidades livres de pecas comuns.
- [x] Bloquear Draft acima de peso total 20.
- [x] Exibir peso atual do Draft na UI.
- [x] Exibir stats de dano, vida e peso das pecas no Draft.
- [x] Consumir estoque do round quando uma invocacao tem sucesso.
- [x] Nao consumir estoque quando a invocacao falha.
- [x] Restaurar estoque do Draft em cada novo round.

## Representacao SPEC

- [x] Gerar board textual no formato de slots.
- [x] Representar Pawn como `P`.
- [x] Representar Knight como `K`.
- [x] Representar Bishop como `B`.
- [x] Representar Tower/Rook como `T`.
- [x] Representar Queen como `Q`.
- [x] Representar White como `W`.
- [x] Representar Black como `B`.
- [x] Representar vida atual no token textual.
- [x] Representar White King como `[WK4]`.
- [x] Representar Black King como `[BK4]`.
- [x] Expor painel SPEC/debug com board, efeitos e historico recente.
- [ ] Avaliar se o painel SPEC precisa mostrar historico completo/replay, ou se historico recente e suficiente.

## Turnos e Phases

- [x] Implementar White Move Phase.
- [x] Implementar White Collision / Damage Resolution.
- [x] Implementar Black Move Phase.
- [x] Implementar Black Collision / Damage Resolution.
- [x] Remover Sickness Reduction Phase do ciclo de turno.
- [x] Implementar Summon Resolution Phase.
- [x] Resolver fases sempre na mesma ordem.
- [x] Permitir avancar uma phase por vez.
- [x] Permitir resolver um turno completo.
- [x] Registrar historico antes/depois de cada phase.

## Movimento

- [x] Mover pecas comuns elegiveis 1 slot por phase.
- [x] Impedir movimento de pecas mortas.
- [x] Impedir movimento de reis.
- [x] Permitir movimento normal de pecas invocadas quando chegar a proxima phase da cor.
- [x] Resolver prioridade por maior numero de movimentos ja realizados.
- [x] Desempatar White por menor indice para maior indice.
- [x] Desempatar Black por maior indice para menor indice.
- [x] Bloquear movimento se o destino ou bloqueador for aliado.
- [x] Permitir efeitos globais alterarem movimento, como Queen Speed e Knight Hop.

## Confronto e Dano

- [x] Criar confronto quando uma peca tenta entrar em slot inimigo.
- [x] Permitir confronto contra reis.
- [x] Aplicar dano do atacante no defensor.
- [x] Aplicar dano do defensor no atacante.
- [x] Resolver dano simultaneamente.
- [x] Garantir que peca que morre ainda causa dano no mesmo confronto.
- [x] Remover pecas comuns com vida <= 0 ao fim da resolucao de dano da phase.
- [x] Encerrar o round imediatamente quando um rei morre.
- [x] Declarar empate do round se os dois reis morrerem.
- [x] Aplicar modificadores aditivos antes de multiplicadores.
- [x] Aplicar reducao de dano recebido das Towers depois do dano calculado.

## Invocacao

- [x] Permitir um commit de invocacao por jogador.
- [x] Selar input de invocacao no estado online antes da Summon Resolution.
- [x] Revelar peca e slot de invocacao apenas na Summon Resolution.
- [x] Permitir invocacao White normal no slot 1.
- [x] Permitir invocacao White especial no slot 2.
- [x] Permitir invocacao Black normal no slot 8.
- [x] Permitir invocacao Black especial no slot 7.
- [x] Resolver invocacoes somente na Summon Resolution Phase.
- [x] Validar ocupacao do slot na hora da resolucao, nao no commit.
- [x] Falhar invocacao se o slot estiver ocupado por aliado.
- [x] Falhar invocacao se o slot estiver ocupado por inimigo.
- [x] Limpar commit apos sucesso ou falha.
- [x] Criar unidades invocadas sem contador de enjoo.
- [x] Permitir que unidades invocadas ajam normalmente quando chegar sua proxima phase de movimento.
- [ ] Adicionar teste automatizado para o caso: slot ocupado no commit, mas livre na resolucao, deve invocar com sucesso.

## Pontuacao e Encerramento de Round

- [x] Vitoria de round vale 1 ponto.
- [x] Empate de round vale 0,5 ponto para cada jogador.
- [x] Derrota de round vale 0 ponto.
- [x] Atualizar placar somente ao fim do round.
- [x] Encerrar round quando White King morre.
- [x] Encerrar round quando Black King morre.
- [x] Nao executar proximas phases do turno apos morte de rei.
- [x] Implementar empate quando nao ha pecas vivas alem dos reis e todos os estoques foram usados.
- [x] Calcular vencedor final por maior pontuacao acumulada.
- [x] Permitir empate final.
- [ ] Resolver inconsistencia do GDD: o fluxo tem 4 rounds, mas a lista de valores de placar vai so ate 3. Decidir se o maximo deve ser 3 ou 4.

## Picks e Efeitos Globais

- [x] Implementar Pick 1 como Buff.
- [x] Implementar Pick 2 como Transform.
- [x] Implementar Pick 3 como Transform.
- [x] Permitir qualquer jogador escolher primeiro.
- [x] Exigir escolha dos dois jogadores para avancar.
- [x] Bloquear escolha duplicada no mesmo Pick.
- [x] Aplicar os dois efeitos escolhidos como globais permanentes.
- [x] Aplicar efeitos a aliados e inimigos.
- [x] Aplicar efeitos a pecas atuais e futuras.
- [x] Manter efeitos ativos ate o fim da run.
- [x] Nao implementar efeitos temporarios.
- [x] Nao implementar efeitos exclusivos de um jogador.

## Buffs

- [x] Implementar Multidao: todas as pecas ganham +1 dano.
- [x] Aplicar Multidao antes de multiplicadores.
- [x] Implementar Crescimento: peca machucada cura 1 ao mover.
- [x] Impedir sobrecura em Crescimento.
- [x] Nao curar peca ja com vida maxima.
- [x] Implementar Atropelamento: overkill pode atingir 1 alvo adicional em sequencia.
- [x] Impedir Atropelamento de atingir 2 ou mais alvos adicionais.
- [ ] Adicionar teste automatizado de Crescimento.
- [ ] Adicionar teste automatizado de Multidao com Pawn 2x vs Knight/Bishop.

## Transforms Pick 2

- [x] Implementar Pawn 2x vs Knight/Bishop.
- [x] Aplicar Pawn 2x para Pawns de ambos os jogadores.
- [x] Respeitar aditivos antes do multiplicador do Pawn 2x.
- [x] Implementar Bishop Line em sequencia de unidades iguais.
- [x] Interromper Bishop Line ao encontrar unidade de tipo diferente.
- [x] Implementar Tower/Rook Armor com dano recebido reduzido em 1.
- [x] Garantir dano minimo 0 depois da reducao da Tower.
- [ ] Adicionar teste automatizado de Tower/Rook Armor.
- [ ] Adicionar teste automatizado de Pawn 2x vs Knight/Bishop.

## Transforms Pick 3

- [x] Implementar Queen Speed: Queen avanca ate 5 slots.
- [x] Parar Queen antes de aliado.
- [x] Parar Queen em confronto adversario dentro do alcance.
- [x] Fazer Queen avancar o maximo possivel se inimigo estiver fora de alcance.
- [x] Implementar Knight 2x em territorio adversario.
- [x] Calcular territorio adversario com base no dono do Knight.
- [x] Aplicar Multidao antes do multiplicador de Knight 2x.
- [x] Implementar Knight ignorando colisao com Pawns.
- [x] Fazer Knight ocupar o slot apos o Pawn quando estiver vazio.
- [x] Fazer Knight confrontar inimigo no slot apos o Pawn.
- [x] Bloquear Knight se o slot apos o Pawn tiver aliado.
- [x] Implementar Pawn 4x vs King.
- [x] Aplicar Multidao antes do multiplicador Pawn 4x vs King.
- [ ] Adicionar testes automatizados para todos os 3 casos de Knight Hop.
- [ ] Revisar se Knight Hop em confronto deve mover o Knight para algum slot antes da resolucao ou permanecer na origem, conforme interpretacao final do GDD.
- [ ] Adicionar teste automatizado de Knight 2x em territorio adversario.

## UI/UX Geral

- [x] Usar interface legivel e centralizada.
- [x] Usar esteira horizontal clara.
- [x] Usar slots segmentados.
- [x] Exibir pecas com assets.
- [x] Exibir vida visivel nas pecas.
- [x] Exibir dano visivel nas pecas.
- [x] Exibir feedbacks curtos de resolucao.
- [x] Exibir event log.
- [x] Exibir estado de rede/sync.
- [x] Exibir room id.
- [x] Permitir copiar link da sala.
- [x] Permitir selecionar lado local White/Black.
- [x] Permitir reset da run.
- [ ] Avaliar se textos da UI devem ficar em portugues, ja que o GDD esta em portugues e a UI atual mistura ingles e portugues.
- [ ] Melhorar feedback visual das fases automaticas/resultado de dano se a experiencia precisar ser menos dependente do log textual.

## UI de Placar

- [x] Exibir placar acima da esteira durante turnos.
- [x] Exibir White score a esquerda.
- [x] Exibir Black score a direita.
- [x] Formatar meio ponto como `,5`.
- [x] Atualizar placar apos contabilizar fim de round.
- [ ] Ajustar/documentar faixa maxima do placar apos decisao sobre 3 vs 4 pontos maximos.

## UI de Draft e Estoque

- [x] Exibir painel de Draft para White.
- [x] Exibir painel de Draft para Black.
- [x] Exibir King incluso automaticamente.
- [x] Exibir peso atual e limite 20.
- [x] Exibir botoes para aumentar/diminuir quantidade de pecas.
- [x] Bloquear adicao que excede limite de peso.
- [x] Exibir presets de Draft.
- [x] Exibir estoque de cada jogador durante battle.
- [x] Exibir commit atual de invocacao.
- [x] Permitir limpar commit de invocacao.
- [x] Permitir escolher invocacao normal ou especial.
- [x] Mostrar ao oponente apenas que existe uma invocacao selada, sem revelar peca ou slot.

## UI de Picks

- [x] Exibir Pick 1 com 3 cartas.
- [x] Exibir Pick 2 com 3 cartas.
- [x] Exibir Pick 3 com 4 cartas.
- [x] Centralizar grid de Pick com 3 opcoes.
- [x] Centralizar grid de Pick com 4 opcoes.
- [x] Exibir arte de Buff ou Tag em cada carta.
- [x] Exibir titulo e detalhe de cada efeito.
- [x] Bloquear carta ja escolhida para o outro jogador.
- [x] Selar escolha de Pick antes de revelar o efeito escolhido.
- [x] Mostrar status selado/aguardando dos jogadores sem revelar carta antes da hora.
- [x] Rejeitar escolha duplicada revelada e exigir nova escolha.
- [x] Indicar qual jogador escolheu uma carta.
- [ ] Validar visualmente em mobile se as cartas continuam centralizadas e sem overflow.

## UI de Buffs

- [x] Exibir buffs na parte superior da esteira.
- [x] Exibir Crescimento ativo com `buff_regen.png`.
- [x] Exibir Crescimento inativo com `buff_regen_gray.png`.
- [x] Exibir Multidao ativo com `buff_dmg.png`.
- [x] Exibir Multidao inativo com `buff_dmg_gray.png`.
- [x] Exibir Atropelamento ativo com `buff_ramp.png`.
- [x] Exibir Atropelamento inativo com `buff_ramp_gray.png`.
- [x] Manter buffs ativos visiveis nos rounds seguintes.

## UI de Tags de Transformacao

- [x] Exibir tags visuais nas pecas afetadas por transforms.
- [x] Fazer tags acompanharem a peca no board.
- [x] Fazer tags desaparecerem quando a peca morre.
- [x] Exibir tag `tag_2x.png` para transforms 2x.
- [x] Exibir tag `tag_void.png` para Knight Hop.
- [x] Exibir tag `tag_dur.png` para Tower/Rook Armor.
- [x] Exibir tag `tag_spd.png` para Queen Speed.
- [x] Exibir tag `tag_pen.png` para Bishop Line.
- [x] Exibir tag `tag_ik.png` para Pawn King Slayer.
- [ ] Validar visualmente se tags redimensionam bem junto com a peca em todas as larguras.
- [ ] Validar se multiplas tags na mesma peca nao poluem ou estouram o slot.

## Assets

- [x] Incluir `text_round1.png`.
- [x] Incluir `text_round2.png`.
- [x] Incluir `text_final_round.png`.
- [x] Incluir todos os assets `tag_*`.
- [x] Incluir todos os assets `buff_*`.
- [x] Incluir todos os assets de pecas White e Black.
- [x] Exibir asset de Round 1.
- [x] Exibir asset de Round 2.
- [x] Exibir asset de Final Round.
- [x] Usar fallback textual para Round sem asset especifico.
- [ ] Confirmar se `text_round2.ping` no GDD era typo e se `text_round2.png` e o nome final correto.

## Estado, Imutabilidade e Determinismo

- [x] Estado de peca carrega id estavel.
- [x] Estado de peca carrega tipo.
- [x] Estado de peca carrega cor/dono.
- [x] Estado de peca carrega vida atual.
- [x] Estado de peca carrega vida maxima.
- [x] Estado de peca carrega dano base.
- [x] Estado de peca carrega posicao.
- [x] Estado de peca nao carrega contador de enjoo.
- [x] Estado de peca carrega contador de movimentos.
- [x] Estado de peca carrega ordem/tempo de entrada.
- [x] Estado de peca carrega vivo/morto.
- [x] Tags visuais sao derivadas dos efeitos globais.
- [x] Estado de jogador carrega player id/cor.
- [x] Estado de jogador carrega Draft escolhido.
- [x] Estado de jogador carrega estoque atual do round.
- [x] Estado de jogador carrega commit atual de invocacao.
- [x] Estado de jogador carrega pontuacao acumulada.
- [x] Estado de jogador carrega resultados dos rounds.
- [x] Estado global carrega round, turno e phase.
- [x] Estado global carrega pecas/board derivavel.
- [x] Estado global carrega efeitos globais ativos.
- [x] Estado global carrega vencedor do round.
- [x] Estado global carrega vencedor final.
- [x] Estado global carrega historico para SPEC/debug.
- [x] Tratar atualizacoes de estado de forma imutavel.
- [x] Guardar efeitos globais como regras ativas, nao mutacoes manuais em pecas antigas.
- [x] Garantir ordem deterministica de movimento e resolucao.
- [x] Evitar aleatoriedade verdadeira na logica da partida.
- [x] Garantir que efeitos visuais nao alterem logica.
- [x] Resolver commits somente na phase apropriada.
- [x] Aplicar picks somente no momento apropriado.
- [x] Guardar no estado compartilhado apenas compromissos opacos para inputs velados.
- [x] Contabilizar vitoria de round imediatamente quando um rei morre.
- [ ] Se o GDD exigir literalmente, adicionar peso total derivado ao modelo serializado do jogador em vez de calcular sob demanda.
- [ ] Se o GDD exigir literalmente, expor `king state` dentro do jogador em vez de apenas como peca no array global.

## Casos de Borda e Cobertura de Testes

- [x] Testar dano simultaneo em colisao.
- [x] Testar morte de rei e pontuacao de vitoria.
- [x] Testar falha de summon sem consumir estoque.
- [x] Testar restauracao de estoque entre rounds.
- [x] Testar Pick selado e rejeicao de reveal duplicado.
- [x] Testar Atropelamento limitado a 1 alvo adicional.
- [x] Testar Bishop Line.
- [x] Testar Queen Speed.
- [ ] Testar morte de rei durante White Collision.
- [ ] Testar morte de rei durante Black Collision.
- [ ] Testar empate por morte simultanea dos reis.
- [ ] Testar empate por ausencia de pecas comuns e estoque zerado.
- [ ] Testar empate final.
- [ ] Testar ordem de prioridade de movimento por `moves`.
- [ ] Testar desempate de movimento White por indice crescente.
- [ ] Testar desempate de movimento Black por indice decrescente.
- [ ] Testar bloqueio por aliado.
- [ ] Testar Growth sem sobrecura.
- [ ] Testar Rook Armor com dano 1 reduzindo para 0.
- [ ] Testar Pawn King Slayer sem Multidao.
- [ ] Testar Pawn King Slayer com Multidao.
- [ ] Testar Pawn 2x vs Knight/Bishop sem Multidao.
- [ ] Testar Pawn 2x vs Knight/Bishop com Multidao.
- [ ] Testar Knight 2x em territorio adversario sem Multidao.
- [ ] Testar Knight 2x em territorio adversario com Multidao.
- [ ] Testar Knight sem bonus fora do territorio adversario.
- [ ] Testar commit em slot ocupado que fica livre ate a resolucao.
- [ ] Testar commit em slot livre que fica ocupado antes da resolucao.
- [ ] Testar que peca morta nao se move em phase posterior.
- [x] Testar que unidade recem-invocada pode se mover quando chegar sua proxima phase de movimento.
