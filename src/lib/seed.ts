import { prisma } from "./prisma";
import { calculateOrderTotals } from "./domain";

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded() {
  const existing = await prisma.category.count();
  if (existing === 0) {
    if (!seedPromise) {
      seedPromise = runInitialSeed().finally(() => {
        seedPromise = null;
      });
    }
    await seedPromise;
  }

  const zoneCount = await prisma.deliveryZone.count();
  if (zoneCount === 0) {
    await prisma.deliveryZone.createMany({
      data: [
        { name: "Centro", fee: 5, etaMinutes: 25, minOrder: 20 },
        { name: "Jardim América", fee: 7, etaMinutes: 35, minOrder: 25 },
        { name: "Vila Nova", fee: 8, etaMinutes: 40, minOrder: 30 },
        { name: "Bela Vista", fee: 10, etaMinutes: 45, minOrder: 35 },
        { name: "Zona Rural / Chácaras", fee: 18, etaMinutes: 60, minOrder: 60 },
      ],
      skipDuplicates: true,
    });
  }

  const customerCount = await prisma.customerProfile.count();
  if (customerCount === 0) {
    await prisma.customerProfile.createMany({
      data: [
        {
          name: "Beatriz Vasconcelos",
          phone: "(11) 98812-3401",
          email: "beatriz.v@email.com",
          favoriteItem: "Cappuccino Italiano Especial + Croissant",
          loyaltyPoints: 42,
          totalSpent: 540.0,
          visitsCount: 11,
          notes: "Prefere leite de aveia quando disponível",
        },
        {
          name: "Eduardo Nogueira",
          phone: "(11) 97654-2210",
          email: "edu.nogueira@email.com",
          favoriteItem: "Risoto de Funghi com Escalope",
          loyaltyPoints: 18,
          totalSpent: 285.5,
          visitsCount: 5,
          notes: "Cliente habitual do almoço",
        },
        {
          name: "Helena Guimarães",
          phone: "(11) 99321-8899",
          favoriteItem: "Fatia Bolo Red Velvet",
          loyaltyPoints: 9,
          totalSpent: 112.0,
          visitsCount: 3,
        },
      ],
    });
  }

  const noteCount = await prisma.shiftNote.count();
  if (noteCount === 0) {
    await prisma.shiftNote.createMany({
      data: [
        {
          author: "Barista Lucas",
          content: "Ajustar moagem do grão Mantiqueira (extração ideal em 27s).",
          priority: "IMPORTANTE",
          isDone: false,
        },
        {
          author: "Confeitaria",
          content: "Bolo Red Velvet da Mariana (ENC-0001) entrega confirmada às 18:00.",
          priority: "IMPORTANTE",
          isDone: false,
        },
        {
          author: "Gerência",
          content: "Conferir reposição de Manteiga Extra e Chocolate Belga 70%.",
          priority: "NORMAL",
          isDone: false,
        },
      ],
    });
  }

  const finCount = await prisma.financialEntry.count();
  if (finCount === 0) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const plus2Days = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const plus5Days = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

    await prisma.financialEntry.createMany({
      data: [
        {
          type: "DESPESA",
          category: "FORNECEDOR",
          description: "Café Especial Torra Média (15kg) - Fazenda Mantiqueira",
          counterparty: "Torrefação Mantiqueira",
          amount: 1120.0,
          dueDate: todayIso,
          status: "PAGO",
          paymentMethod: "PIX",
          paidAt: new Date(),
          notes: "Nota fiscal #4821 conferida",
        },
        {
          type: "DESPESA",
          category: "FORNECEDOR",
          description: "Farinha Tipo 1 & Manteiga Extra (Reposição Semanal)",
          counterparty: "Moinho Ouro Ltda",
          amount: 780.0,
          dueDate: plus2Days,
          status: "PENDENTE",
          paymentMethod: "BOLETO",
        },
        {
          type: "DESPESA",
          category: "ENERGIA",
          description: "Conta de Energia Elétrica & Gás dos Fornos",
          counterparty: "Companhia Energética",
          amount: 1450.0,
          dueDate: plus5Days,
          status: "PENDENTE",
          paymentMethod: "BOLETO",
        },
        {
          type: "RECEITA",
          category: "VENDAS_EXTRA",
          description: "Coffee Break Corporativo — Escritório Paulista (35 pessoas)",
          counterparty: "Nexus Consultoria",
          amount: 1890.0,
          dueDate: plus2Days,
          status: "PENDENTE",
          paymentMethod: "PIX",
          notes: "Entrada 50% pendente de confirmação",
        },
        {
          type: "RECEITA",
          category: "VENDAS_EXTRA",
          description: "Assinatura Mensal Café & Croissants — Sala Co-working",
          counterparty: "Hub Paulista",
          amount: 960.0,
          dueDate: todayIso,
          status: "PAGO",
          paymentMethod: "TRANSFERENCIA",
          paidAt: new Date(),
        },
      ],
    });
  }
}

async function runInitialSeed() {
  const count = await prisma.category.count();
  if (count > 0) return;

  const padaria = await prisma.category.create({
    data: { name: "Padaria & Pães", slug: "padaria-paes", sector: "PADARIA", sortOrder: 1 },
  });
  const confeitaria = await prisma.category.create({
    data: { name: "Confeitaria & Doces", slug: "confeitaria-doces", sector: "CONFEITARIA", sortOrder: 2 },
  });
  const restaurante = await prisma.category.create({
    data: { name: "Restaurante & Bistrô", slug: "restaurante-bistro", sector: "RESTAURANTE", sortOrder: 3 },
  });
  const bebidas = await prisma.category.create({
    data: { name: "Cafés & Bebidas", slug: "cafes-bebidas", sector: "BEBIDAS", sortOrder: 4 },
  });

  const paoFrances = await prisma.product.create({
    data: {
      sku: "PAD-001",
      name: "Pão Francês Crocante (kg)",
      description: "Fermentação natural leve, casca dourada e miolo macio.",
      price: 22.9,
      unit: "KG",
      prepStation: "FORNO",
      prepTimeMinutes: 3,
      isFeatured: true,
      stockQty: 18.5,
      minStockQty: 5,
      categoryId: padaria.id,
    },
  });

  const croissant = await prisma.product.create({
    data: {
      sku: "PAD-002",
      name: "Croissant de Manteiga",
      description: "Massa folhada francesa com 27 camadas e manteiga extra.",
      price: 14.5,
      unit: "UN",
      prepStation: "FORNO",
      prepTimeMinutes: 4,
      isFeatured: true,
      stockQty: 26,
      minStockQty: 8,
      categoryId: padaria.id,
    },
  });

  const paoQueijo = await prisma.product.create({
    data: {
      sku: "PAD-003",
      name: "Pão de Queijo Canastra (Porção 6 un)",
      description: "Receita mineira com queijo Canastra curado e polvilho artesanal.",
      price: 18.0,
      unit: "PORCAO",
      prepStation: "FORNO",
      prepTimeMinutes: 6,
      stockQty: 22,
      minStockQty: 6,
      categoryId: padaria.id,
    },
  });

  const baguete = await prisma.product.create({
    data: {
      sku: "PAD-004",
      name: "Baguete Rústica Levain",
      description: "36h de fermentação lenta, crosta caramelizada.",
      price: 19.5,
      unit: "UN",
      prepStation: "FORNO",
      prepTimeMinutes: 3,
      stockQty: 12,
      minStockQty: 4,
      categoryId: padaria.id,
    },
  });

  const redVelvet = await prisma.product.create({
    data: {
      sku: "CNF-001",
      name: "Fatia Bolo Red Velvet",
      description: "Massa aveludada de cacau com cream cheese frost e frutas vermelhas.",
      price: 24.0,
      unit: "FATIA",
      prepStation: "CONFEITARIA",
      prepTimeMinutes: 4,
      isFeatured: true,
      stockQty: 14,
      minStockQty: 4,
      categoryId: confeitaria.id,
    },
  });

  const tortaLimao = await prisma.product.create({
    data: {
      sku: "CNF-002",
      name: "Tartelete de Limão Siciliano",
      description: "Base sablée crocante, curd cítrico e merengue maçaricado.",
      price: 19.0,
      unit: "UN",
      prepStation: "CONFEITARIA",
      prepTimeMinutes: 3,
      stockQty: 16,
      minStockQty: 5,
      categoryId: confeitaria.id,
    },
  });

  const milFolhas = await prisma.product.create({
    data: {
      sku: "CNF-003",
      name: "Mil-Folhas de Baunilha",
      description: "Folhado caramelizado recheado na hora com creme pâtissière.",
      price: 26.5,
      unit: "UN",
      prepStation: "CONFEITARIA",
      prepTimeMinutes: 7,
      stockQty: 9,
      minStockQty: 3,
      categoryId: confeitaria.id,
    },
  });

  const risotoFunghi = await prisma.product.create({
    data: {
      sku: "RST-001",
      name: "Risoto de Funghi com Escalope",
      description: "Arroz arbório ao vinho branco, mix de cogumelos e escalope de mignon.",
      price: 68.0,
      unit: "PORCAO",
      prepStation: "COZINHA",
      prepTimeMinutes: 18,
      isFeatured: true,
      stockQty: 20,
      minStockQty: 4,
      categoryId: restaurante.id,
    },
  });

  const brunch = await prisma.product.create({
    data: {
      sku: "RST-002",
      name: "Brunch da Casa (Para 1)",
      description: "Ovos beneditinos no brioche, bacon artesanal, frutas e mini croissant.",
      price: 54.0,
      unit: "PORCAO",
      prepStation: "COZINHA",
      prepTimeMinutes: 14,
      isFeatured: true,
      stockQty: 18,
      minStockQty: 4,
      categoryId: restaurante.id,
    },
  });

  const parmeggiana = await prisma.product.create({
    data: {
      sku: "RST-003",
      name: "Filé à Parmegiana Artesanal",
      description: "Molho pomodoro rústico, muçarela de búfala e purê cremoso.",
      price: 72.0,
      unit: "PORCAO",
      prepStation: "COZINHA",
      prepTimeMinutes: 20,
      stockQty: 15,
      minStockQty: 4,
      categoryId: restaurante.id,
    },
  });

  const sanduicheCroissant = await prisma.product.create({
    data: {
      sku: "RST-004",
      name: "Croissant Tostado Parma & Brie",
      description: "Presunto cru, queijo brie derretido, rúcula e redução balsâmica.",
      price: 38.0,
      unit: "UN",
      prepStation: "COZINHA",
      prepTimeMinutes: 9,
      stockQty: 16,
      minStockQty: 4,
      categoryId: restaurante.id,
    },
  });

  const cappuccino = await prisma.product.create({
    data: {
      sku: "BEB-001",
      name: "Cappuccino Italiano Especial",
      description: "Duplo espresso de grãos da Mantiqueira, leite vaporizado e cacau.",
      price: 15.0,
      unit: "UN",
      prepStation: "BAR",
      prepTimeMinutes: 4,
      isFeatured: true,
      stockQty: 60,
      minStockQty: 10,
      categoryId: bebidas.id,
    },
  });

  const sucoLaranja = await prisma.product.create({
    data: {
      sku: "BEB-002",
      name: "Suco Natural de Laranja 400ml",
      description: "Espremido na hora, sem adição de açúcar.",
      price: 14.0,
      unit: "UN",
      prepStation: "BAR",
      prepTimeMinutes: 3,
      stockQty: 35,
      minStockQty: 8,
      categoryId: bebidas.id,
    },
  });

  const sodaItaliana = await prisma.product.create({
    data: {
      sku: "BEB-003",
      name: "Soda Italiana Maçã Verde",
      description: "Água gaseificada gelada, xarope artesanal e gelo.",
      price: 16.0,
      unit: "UN",
      prepStation: "BAR",
      prepTimeMinutes: 3,
      stockQty: 40,
      minStockQty: 8,
      categoryId: bebidas.id,
    },
  });

  // Ingredients + Recipes
  const farinha = await prisma.ingredient.create({
    data: { name: "Farinha de Trigo Tipo 1", unit: "KG", currentQty: 48, minQty: 15, costPerUnit: 5.4, supplierName: "Moinho Sul" },
  });
  const manteiga = await prisma.ingredient.create({
    data: { name: "Manteiga Extra Sem Sal", unit: "KG", currentQty: 6.5, minQty: 8, costPerUnit: 46.0, supplierName: "Laticínios Serra" },
  });
  const chocolate = await prisma.ingredient.create({
    data: { name: "Chocolate Belga 70%", unit: "KG", currentQty: 4.2, minQty: 5, costPerUnit: 89.0, supplierName: "Cacau Import" },
  });
  const cremeLeite = await prisma.ingredient.create({
    data: { name: "Creme de Leite Fresco", unit: "L", currentQty: 11, minQty: 4, costPerUnit: 29.0, supplierName: "Laticínios Serra" },
  });
  const fileMignon = await prisma.ingredient.create({
    data: { name: "Filé Mignon Limpo", unit: "KG", currentQty: 12.4, minQty: 5, costPerUnit: 78.0, supplierName: "Frigorífico Prime" },
  });
  const arrozArborio = await prisma.ingredient.create({
    data: { name: "Arroz Arbório Italiano", unit: "KG", currentQty: 9.0, minQty: 3, costPerUnit: 24.5, supplierName: "Empório Itália" },
  });
  const cafeGraos = await prisma.ingredient.create({
    data: { name: "Café Especial em Grãos", unit: "KG", currentQty: 7.5, minQty: 3, costPerUnit: 64.0, supplierName: "Torrefação Alta" },
  });
  const queijoCanastra = await prisma.ingredient.create({
    data: { name: "Queijo Canastra Curado", unit: "KG", currentQty: 3.1, minQty: 4, costPerUnit: 68.0, supplierName: "Fazenda Minas" },
  });

  await prisma.recipeItem.createMany({
    data: [
      { productId: paoFrances.id, ingredientId: farinha.id, qtyRequired: 0.7 },
      { productId: croissant.id, ingredientId: farinha.id, qtyRequired: 0.08 },
      { productId: croissant.id, ingredientId: manteiga.id, qtyRequired: 0.045 },
      { productId: paoQueijo.id, ingredientId: queijoCanastra.id, qtyRequired: 0.14 },
      { productId: baguete.id, ingredientId: farinha.id, qtyRequired: 0.35 },
      { productId: redVelvet.id, ingredientId: cremeLeite.id, qtyRequired: 0.08 },
      { productId: redVelvet.id, ingredientId: chocolate.id, qtyRequired: 0.05 },
      { productId: milFolhas.id, ingredientId: manteiga.id, qtyRequired: 0.04 },
      { productId: milFolhas.id, ingredientId: cremeLeite.id, qtyRequired: 0.09 },
      { productId: risotoFunghi.id, ingredientId: arrozArborio.id, qtyRequired: 0.14 },
      { productId: risotoFunghi.id, ingredientId: fileMignon.id, qtyRequired: 0.18 },
      { productId: parmeggiana.id, ingredientId: fileMignon.id, qtyRequired: 0.22 },
      { productId: cappuccino.id, ingredientId: cafeGraos.id, qtyRequired: 0.02 },
    ],
  });

  // Tables
  const tableSpecs = [
    { number: 1, name: "Mesa 01", area: "SALAO", capacity: 2, status: "LIVRE", qrToken: "fm-mesa-01-a91x" },
    { number: 2, name: "Mesa 02", area: "SALAO", capacity: 4, status: "OCUPADA", qrToken: "fm-mesa-02-b82k" },
    { number: 3, name: "Mesa 03", area: "SALAO", capacity: 4, status: "LIVRE", qrToken: "fm-mesa-03-c73m" },
    { number: 4, name: "Mesa 04", area: "SALAO", capacity: 6, status: "RESERVADA", qrToken: "fm-mesa-04-d64p" },
    { number: 5, name: "Varanda 05", area: "VARANDA", capacity: 4, status: "OCUPADA", qrToken: "fm-mesa-05-e55r" },
    { number: 6, name: "Varanda 06", area: "VARANDA", capacity: 4, status: "LIVRE", qrToken: "fm-mesa-06-f46t" },
    { number: 7, name: "Varanda 07", area: "VARANDA", capacity: 2, status: "LIVRE", qrToken: "fm-mesa-07-g37v" },
    { number: 8, name: "Mesa Família 08", area: "SALAO", capacity: 8, status: "LIVRE", qrToken: "fm-mesa-08-h28w" },
    { number: 9, name: "Balcão Café 09", area: "BALCAO", capacity: 2, status: "LIVRE", qrToken: "fm-mesa-09-j19y" },
    { number: 10, name: "Balcão Café 10", area: "BALCAO", capacity: 2, status: "LIVRE", qrToken: "fm-mesa-10-k01z" },
  ];

  const createdTables = [];
  for (const t of tableSpecs) {
    createdTables.push(await prisma.diningTable.create({ data: t }));
  }

  // Bakery Batches
  await prisma.bakeryBatch.createMany({
    data: [
      {
        productId: paoFrances.id,
        productName: paoFrances.name,
        plannedQty: 15,
        producedQty: 15,
        status: "PRONTA",
        bakeTime: "06:30",
        notes: "Primeira fornada da manhã finalizada",
      },
      {
        productId: croissant.id,
        productName: croissant.name,
        plannedQty: 30,
        producedQty: 0,
        status: "NO_FORNO",
        bakeTime: "16:00",
        notes: "Fornada da tarde para o café",
      },
      {
        productId: paoQueijo.id,
        productName: paoQueijo.name,
        plannedQty: 20,
        producedQty: 0,
        status: "AGENDADA",
        bakeTime: "17:30",
        notes: "Reposição do happy hour",
      },
    ],
  });

  // Confectionery Custom Orders
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  await prisma.cakeCustomOrder.createMany({
    data: [
      {
        code: "ENC-0001",
        customerName: "Mariana Costa",
        customerPhone: "(11) 98765-4321",
        title: "Bolo Red Velvet Aniversário",
        weightKg: 2.5,
        flavor: "Red Velvet com Cacau",
        filling: "Cream Cheese & Frutas Vermelhas",
        themeNotes: "Topo dourado escrito Parabéns Mari + morangos frescos",
        deliveryDate: todayStr,
        deliverySlot: "18:00",
        totalPrice: 325.0,
        depositPaid: 160.0,
        status: "PRODUCAO",
      },
      {
        code: "ENC-0002",
        customerName: "Rafael Almeida",
        customerPhone: "(11) 99123-7788",
        title: "Torta Mil-Folhas Corporativa",
        weightKg: 3.0,
        flavor: "Massa Folhada Caramelizada",
        filling: "Creme Pâtissière de Baunilha",
        themeNotes: "Cortada em 24 fatias embaladas",
        deliveryDate: tomorrow,
        deliverySlot: "10:30",
        totalPrice: 390.0,
        depositPaid: 195.0,
        status: "CONFIRMADA",
      },
      {
        code: "ENC-0003",
        customerName: "Camila Ferreira",
        customerPhone: "(11) 97444-1122",
        title: "Bolo Pistache & Chocolate Belga",
        weightKg: 2.0,
        flavor: "Chocolate 70%",
        filling: "Ganache de Pistache",
        themeNotes: "Acabamento espatulado rústico",
        deliveryDate: tomorrow,
        deliverySlot: "15:00",
        totalPrice: 280.0,
        depositPaid: 280.0,
        status: "PRONTA",
      },
    ],
  });

  // Cash Register Session
  const session = await prisma.cashRegisterSession.create({
    data: {
      openedBy: "Ana Paula (Gerente)",
      openingAmount: 250.0,
      expectedAmount: 317.8,
      status: "ABERTO",
    },
  });

  // Paid PDV order + Active Mesa orders
  const pdvTotals = calculateOrderTotals({
    items: [
      { qty: 1.2, unitPrice: paoFrances.price },
      { qty: 2, unitPrice: croissant.price },
      { qty: 1, unitPrice: cappuccino.price },
    ],
  });

  await prisma.order.create({
    data: {
      code: "PED-0001",
      channel: "PDV_BALCAO",
      status: "PAGO",
      customerName: "Cliente Balcão",
      paymentMethod: "PIX",
      subtotal: pdvTotals.subtotal,
      discount: 0,
      serviceFee: 0,
      total: pdvTotals.total,
      paidAt: new Date(),
      items: {
        create: [
          {
            productId: paoFrances.id,
            productName: paoFrances.name,
            prepStation: paoFrances.prepStation,
            qty: 1.2,
            unitPrice: paoFrances.price,
            totalPrice: 27.48,
            itemStatus: "ENTREGUE",
          },
          {
            productId: croissant.id,
            productName: croissant.name,
            prepStation: croissant.prepStation,
            qty: 2,
            unitPrice: croissant.price,
            totalPrice: 29.0,
            itemStatus: "ENTREGUE",
          },
          {
            productId: cappuccino.id,
            productName: cappuccino.name,
            prepStation: cappuccino.prepStation,
            qty: 1,
            unitPrice: cappuccino.price,
            totalPrice: 15.0,
            itemStatus: "ENTREGUE",
          },
        ],
      },
    },
  });

  await prisma.cashMovement.create({
    data: {
      sessionId: session.id,
      type: "VENDA",
      paymentMethod: "PIX",
      amount: pdvTotals.total,
      description: "Venda PDV PED-0001",
    },
  });

  const mesa2 = createdTables.find((t) => t.number === 2)!;
  const mesa2Totals = calculateOrderTotals({
    items: [
      { qty: 2, unitPrice: risotoFunghi.price },
      { qty: 2, unitPrice: sucoLaranja.price },
      { qty: 1, unitPrice: redVelvet.price },
    ],
    applyServiceFee: true,
  });

  await prisma.order.create({
    data: {
      code: "PED-0002",
      channel: "MESA",
      status: "EM_PREPARO",
      tableId: mesa2.id,
      customerName: "Mesa 02 - Lucas",
      subtotal: mesa2Totals.subtotal,
      discount: 0,
      serviceFee: mesa2Totals.serviceFee,
      total: mesa2Totals.total,
      items: {
        create: [
          {
            productId: risotoFunghi.id,
            productName: risotoFunghi.name,
            prepStation: risotoFunghi.prepStation,
            qty: 2,
            unitPrice: risotoFunghi.price,
            totalPrice: 136.0,
            itemStatus: "PREPARANDO",
            notes: "1 escalope ao ponto, 1 bem passado",
          },
          {
            productId: sucoLaranja.id,
            productName: sucoLaranja.name,
            prepStation: sucoLaranja.prepStation,
            qty: 2,
            unitPrice: sucoLaranja.price,
            totalPrice: 28.0,
            itemStatus: "PRONTO",
          },
          {
            productId: redVelvet.id,
            productName: redVelvet.name,
            prepStation: redVelvet.prepStation,
            qty: 1,
            unitPrice: redVelvet.price,
            totalPrice: 24.0,
            itemStatus: "PENDENTE",
            notes: "Servir após o prato principal",
          },
        ],
      },
    },
  });

  const mesa5 = createdTables.find((t) => t.number === 5)!;
  const mesa5Totals = calculateOrderTotals({
    items: [
      { qty: 1, unitPrice: brunch.price },
      { qty: 2, unitPrice: cappuccino.price },
    ],
    applyServiceFee: true,
  });

  await prisma.order.create({
    data: {
      code: "PED-0003",
      channel: "QR_MESA",
      status: "ABERTO",
      tableId: mesa5.id,
      customerName: "Varanda 05 (QR)",
      subtotal: mesa5Totals.subtotal,
      discount: 0,
      serviceFee: mesa5Totals.serviceFee,
      total: mesa5Totals.total,
      items: {
        create: [
          {
            productId: brunch.id,
            productName: brunch.name,
            prepStation: brunch.prepStation,
            qty: 1,
            unitPrice: brunch.price,
            totalPrice: 54.0,
            itemStatus: "PENDENTE",
            notes: "Sem bacon",
          },
          {
            productId: cappuccino.id,
            productName: cappuccino.name,
            prepStation: cappuccino.prepStation,
            qty: 2,
            unitPrice: cappuccino.price,
            totalPrice: 30.0,
            itemStatus: "PENDENTE",
          },
        ],
      },
    },
  });
}
