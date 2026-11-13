# Forno & Mesa ERP — Cafeteria, Padaria, Confeitaria & Bistrô

Sistema full-stack completo de gestão gastronômica desenvolvido com **Next.js 16**, **TypeScript**, **React 19**, **Tailwind CSS v4** e **PostgreSQL + Prisma**.

## Módulos & Funcionalidades

- **Painel Geral (Command Center)**: barra de navegação superior fixa em tema **Cafeteria Especial**, acompanhamento da **Meta Diária de Faturamento**, indicadores de mesas, fila KDS, clube de fidelidade, gráficos por canal/pagamento, Top 5 produtos e **Mural do Turno** para recados entre barista, forno e caixa.
- **PDV Balcão & Comandas**: venda rápida com suporte a produtos por unidade/fatia/kg (balança), **Combos Rápidos**, vínculo com **Clube Fidelidade** (acúmulo automático e resgate de pontos), cálculo de desconto e taxa de serviço (10%), baixa de estoque e emissão de cupom térmico 80mm.
- **Mesas & QR Code (`/mesa/[number]`)**: gestão de áreas (`Salão`, `Varanda`, `Balcão`), cadastro de novas mesas com geração automática de **QR Code PNG/SVG** usando o IP da rede local, divisão da conta, transferência e fechamento integrado ao caixa.
- **Isolamento do Cardápio Mobile**: ao escanear o QR Code pelo celular, o cliente acessa exclusivamente o cardápio digital da mesa e o acompanhamento da comanda, com rotas administrativas (`/`, `/api/workspace`, `/api/finance`, etc.) bloqueadas para dispositivos móveis/LAN salvo autenticação por PIN de operador (`ERP_OPERATOR_PIN`).
- **Financeiro & DRE Gerencial**: demonstrativo de resultados em tempo real (receita bruta, taxas estimadas de cartão, CMV calculado por ficha técnica, margem de contribuição e lucro líquido), conciliação por meio de pagamento, histórico de turnos de caixa, contas a pagar/receber com baixa em 1 clique, engenharia de cardápio (margem por produto) e exportação CSV.
- **KDS (Kitchen Display System)**: tela de preparo por estação (`Cozinha`, `Forno`, `Confeitaria`, `Bar`, `Balcão`) com avanço de status em tempo real (`Pendente → Preparando → Pronto → Entregue`).
- **Padaria & Encomendas**: programação de **Fornadas do Dia** com reposição de estoque ao finalizar e controle de **Encomendas de Bolos/Tortas** com sinal pago e saldo pendente.
- **Clube de Fidelidade & Estoque**: cadastro de clientes (`Bronze`, `Prata`, `Ouro`), baixa automática de insumos por ficha técnica, controle de estoque mínimo e gestão de caixa (`Abertura`, `Suprimento`, `Sangria`, `Fechamento`).

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Subir PostgreSQL (Docker) ou Prisma Postgres integrado
docker compose up -d
# Alternativa sem Docker: npx prisma dev -n forno-e-mesa

# 4. Sincronizar schema e iniciar
npx prisma db push
npm run dev
```

## Verificação

```bash
npm run typecheck
npm test
npm run build
```
